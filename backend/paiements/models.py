from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Paiement(models.Model):
    """Mouvement d'argent lié à une réservation. Enregistré manuellement (aucun paiement bancaire réel)."""

    class Type(models.TextChoices):
        PAIEMENT = "PAIEMENT", "Paiement"
        REMBOURSEMENT = "REMBOURSEMENT", "Remboursement"

    class Mode(models.TextChoices):
        ESPECES = "ESPECES", "Espèces"
        CARTE = "CARTE", "Carte bancaire"
        MOBILE_MONEY = "MOBILE_MONEY", "Mobile money"
        VIREMENT = "VIREMENT", "Virement"

    reservation = models.ForeignKey("reservations.Reservation", on_delete=models.PROTECT, related_name="paiements")
    montant = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.PAIEMENT)
    mode = models.CharField(max_length=20, choices=Mode.choices)
    reference = models.CharField(max_length=100, blank=True)
    date_paiement = models.DateTimeField(default=timezone.now)
    enregistre_par = models.ForeignKey(
        "comptes.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="paiements_enregistres"
    )

    class Meta:
        ordering = ["-date_paiement", "-id"]
        constraints = [models.CheckConstraint(condition=Q(montant__gt=0), name="paiement_montant_positif")]

    def __str__(self):
        return f"{self.get_type_display()} {self.montant} – réservation #{self.reservation_id}"
