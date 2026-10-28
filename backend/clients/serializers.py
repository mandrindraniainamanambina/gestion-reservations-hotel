import re

from rest_framework import serializers

from .models import Client


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = ["id", "nom", "prenom", "email", "telephone", "adresse", "piece_identite", "created_at"]
        read_only_fields = ["id", "created_at"]

    # Normalisation avant contrôle d'unicité : "rakoto" et "RAKOTO " sont le même nom.
    def validate_nom(self, value):
        return value.strip().upper()

    def validate_prenom(self, value):
        return value.strip().title()

    def validate_piece_identite(self, value):
        value = (value or "").strip()
        if value and not re.fullmatch(r"\d{14}", value):
            raise serializers.ValidationError("Le numéro de CIN doit contenir exactement 14 chiffres.")
        return value

    def validate_telephone(self, value):
        nettoye = re.sub(r"[ .\-]", "", value)
        if not re.fullmatch(r"\+?\d{7,15}", nettoye):
            raise serializers.ValidationError("Numéro de téléphone invalide (7 à 15 chiffres, « + » autorisé).")
        return nettoye

    def validate_email(self, value):
        if not value:
            return None
        value = value.strip().lower()
        doublons = Client.objects.filter(email__iexact=value)
        if self.instance:
            doublons = doublons.exclude(pk=self.instance.pk)
        if doublons.exists():
            raise serializers.ValidationError("Un client avec cet e-mail existe déjà.")
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        if not (request and request.user.is_authenticated and request.user.est_admin):
            data.pop("piece_identite", None)  # protection des données personnelles
        return data
