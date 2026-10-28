from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from reservations.models import Reservation

from .models import Paiement
from .services import verifier_regles


class PaiementSerializer(serializers.ModelSerializer):
    montant = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    reservation_label = serializers.SerializerMethodField()
    enregistre_par_nom = serializers.CharField(source="enregistre_par.username", read_only=True, default="")

    class Meta:
        model = Paiement
        fields = [
            "id", "reservation", "reservation_label", "montant", "type", "mode",
            "reference", "date_paiement", "enregistre_par_nom",
        ]
        read_only_fields = ["id", "date_paiement"]

    def get_reservation_label(self, obj):
        r = obj.reservation
        return f"#{r.pk} – {r.client.nom} {r.client.prenom} – chambre {r.chambre.numero}"

    def validate(self, attrs):
        verifier_regles(attrs["reservation"], attrs["type"], attrs["montant"])
        return attrs

    def create(self, validated_data):
        with transaction.atomic():
            # Verrou sur la réservation, puis nouveau contrôle avec le solde réellement à jour
            reservation = Reservation.objects.select_for_update().get(pk=validated_data["reservation"].pk)
            verifier_regles(reservation, validated_data["type"], validated_data["montant"])
            validated_data["enregistre_par"] = self.context["request"].user
            return super().create(validated_data)
