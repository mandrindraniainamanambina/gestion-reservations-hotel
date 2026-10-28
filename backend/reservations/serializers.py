from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers

from chambres.models import Chambre

from .models import STATUTS_ACTIFS, Reservation
from .services import calculer_nuits_et_prix, verifier_disponibilite


class ReservationSerializer(serializers.ModelSerializer):
    client_nom = serializers.SerializerMethodField()
    chambre_numero = serializers.CharField(source="chambre.numero", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    montant_paye = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    solde = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Reservation
        fields = [
            "id", "client", "client_nom", "chambre", "chambre_numero", "date_arrivee", "date_depart",
            "nb_personnes", "nb_nuits", "prix_total", "statut", "statut_libelle", "montant_paye", "solde", "notes", "created_at",
        ]
        # nuits, prix et statut ne sont JAMAIS fournis par le client : calculés/gérés par le serveur
        read_only_fields = ["id", "nb_nuits", "prix_total", "statut", "created_at"]

    def get_client_nom(self, obj):
        return f"{obj.client.nom} {obj.client.prenom}"

    def validate_nb_personnes(self, value):
        if value < 1:
            raise serializers.ValidationError("Au moins une personne.")
        return value

    def validate(self, attrs):
        inst = self.instance
        if inst and inst.statut not in STATUTS_ACTIFS:
            raise serializers.ValidationError("Seule une réservation en attente ou confirmée peut être modifiée.")
        arrivee = attrs.get("date_arrivee", getattr(inst, "date_arrivee", None))
        depart = attrs.get("date_depart", getattr(inst, "date_depart", None))
        chambre = attrs.get("chambre", getattr(inst, "chambre", None))
        personnes = attrs.get("nb_personnes", getattr(inst, "nb_personnes", 1))

        if depart <= arrivee:
            raise serializers.ValidationError({"date_depart": "La date de départ doit être postérieure à l'arrivée."})
        arrivee_modifiee = inst is None or "date_arrivee" in attrs and attrs["date_arrivee"] != inst.date_arrivee
        if arrivee_modifiee and arrivee < timezone.localdate():
            raise serializers.ValidationError({"date_arrivee": "La date d'arrivée ne peut pas être dans le passé."})
        if inst is None or "chambre" in attrs:
            if not chambre.est_active or chambre.etat != Chambre.Etat.DISPONIBLE:
                raise serializers.ValidationError({"chambre": "Cette chambre n'est pas réservable."})
        if personnes > chambre.capacite:
            raise serializers.ValidationError(
                {"nb_personnes": f"Capacité dépassée : {chambre.capacite} personne(s) maximum."}
            )
        return attrs

    def _enregistrer(self, valider_et_sauver):
        try:
            with transaction.atomic():
                return valider_et_sauver()
        except IntegrityError:  # filet de sécurité : la contrainte d'exclusion PostgreSQL a refusé l'écriture
            raise serializers.ValidationError({"chambre": "Cette chambre vient d'être réservée sur cette période."})

    def create(self, validated_data):
        def operation():
            # Verrou sur la chambre : deux requêtes simultanées sur la même chambre passent l'une après l'autre
            chambre = Chambre.objects.select_for_update().get(pk=validated_data["chambre"].pk)
            verifier_disponibilite(chambre.pk, validated_data["date_arrivee"], validated_data["date_depart"])
            nuits, prix = calculer_nuits_et_prix(
                validated_data["date_arrivee"], validated_data["date_depart"], chambre.prix_nuit
            )
            validated_data.update(nb_nuits=nuits, prix_total=prix, cree_par=self.context["request"].user)
            return super(ReservationSerializer, self).create(validated_data)

        return self._enregistrer(operation)

    def update(self, instance, validated_data):
        def operation():
            chambre = Chambre.objects.select_for_update().get(
                pk=validated_data.get("chambre", instance.chambre).pk
            )
            arrivee = validated_data.get("date_arrivee", instance.date_arrivee)
            depart = validated_data.get("date_depart", instance.date_depart)
            verifier_disponibilite(chambre.pk, arrivee, depart, exclure_id=instance.pk)
            if {"date_arrivee", "date_depart", "chambre"} & validated_data.keys():
                nuits, prix = calculer_nuits_et_prix(arrivee, depart, chambre.prix_nuit)
                validated_data.update(nb_nuits=nuits, prix_total=prix)  # recalcul uniquement si nécessaire
            return super(ReservationSerializer, self).update(instance, validated_data)

        return self._enregistrer(operation)
