from rest_framework import serializers

from .models import Categorie, Chambre


class CategorieSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categorie
        fields = ["id", "nom", "description"]


class ChambreSerializer(serializers.ModelSerializer):
    categorie_nom = serializers.CharField(source="categorie.nom", read_only=True)
    occupee = serializers.SerializerMethodField()

    class Meta:
        model = Chambre
        fields = [
            "id", "numero", "categorie", "categorie_nom", "capacite", "prix_nuit",
            "description", "etat", "est_active", "occupee",
        ]
        read_only_fields = ["id", "est_active"]  # la désactivation passe par une action dédiée

    def get_occupee(self, obj):
        return getattr(obj, "occupee", False)  # annotation ajoutée par le viewset

    def validate_numero(self, value):
        return value.strip()
