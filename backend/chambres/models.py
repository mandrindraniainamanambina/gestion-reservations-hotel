from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q


class Categorie(models.Model):
    """Catégorie de chambre configurable (simple, double, familiale, suite...)."""

    nom = models.CharField(max_length=50, unique=True)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["nom"]

    def __str__(self):
        return self.nom


class Chambre(models.Model):
    class Etat(models.TextChoices):
        DISPONIBLE = "DISPONIBLE", "Disponible"
        MAINTENANCE = "MAINTENANCE", "En maintenance"

    numero = models.CharField(max_length=10, unique=True)
    categorie = models.ForeignKey(Categorie, on_delete=models.PROTECT, related_name="chambres")
    capacite = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(20)])
    prix_nuit = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    description = models.TextField(blank=True)
    etat = models.CharField(max_length=20, choices=Etat.choices, default=Etat.DISPONIBLE)
    est_active = models.BooleanField(default=True)  # désactivation logique : on ne supprime jamais une chambre
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["numero"]
        constraints = [
            models.CheckConstraint(condition=Q(prix_nuit__gt=0), name="chambre_prix_positif"),
            models.CheckConstraint(condition=Q(capacite__gte=1), name="chambre_capacite_positive"),
        ]

    def __str__(self):
        return f"Chambre {self.numero}"
