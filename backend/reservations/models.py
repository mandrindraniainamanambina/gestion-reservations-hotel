from decimal import Decimal

from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import DateRangeField, RangeBoundary, RangeOperators
from django.db import models
from django.db.models import F, Func, Q


class PlageDates(Func):
    """daterange(arrivee, depart, '[)') : l'arrivée est incluse, le départ est exclu."""

    function = "DATERANGE"
    output_field = DateRangeField()


class Reservation(models.Model):
    class Statut(models.TextChoices):
        EN_ATTENTE = "EN_ATTENTE", "En attente"
        CONFIRMEE = "CONFIRMEE", "Confirmée"
        ANNULEE = "ANNULEE", "Annulée"
        TERMINEE = "TERMINEE", "Terminée"

    client = models.ForeignKey("clients.Client", on_delete=models.PROTECT, related_name="reservations")
    chambre = models.ForeignKey("chambres.Chambre", on_delete=models.PROTECT, related_name="reservations")
    date_arrivee = models.DateField()
    date_depart = models.DateField()
    nb_personnes = models.PositiveSmallIntegerField(default=1)
    nb_nuits = models.PositiveIntegerField()  # calculé côté serveur
    prix_total = models.DecimalField(max_digits=12, decimal_places=2)  # figé au moment de la réservation
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.EN_ATTENTE)
    notes = models.TextField(blank=True)
    cree_par = models.ForeignKey(
        "comptes.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="reservations_creees"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(condition=Q(date_depart__gt=F("date_arrivee")), name="reservation_dates_valides"),
            models.CheckConstraint(condition=Q(prix_total__gte=0), name="reservation_prix_positif"),
            # Garantie ultime au niveau de la base : même sous requêtes simultanées, deux réservations
            # actives de la même chambre ne peuvent pas avoir de périodes qui se chevauchent
            # (la date de départ est exclue : départ le 10 / arrivée le 10 est autorisé).
            ExclusionConstraint(
                name="reservation_pas_de_chevauchement",
                expressions=[
                    (PlageDates("date_arrivee", "date_depart", RangeBoundary()), RangeOperators.OVERLAPS),
                    ("chambre", RangeOperators.EQUAL),
                ],
                condition=Q(statut__in=["EN_ATTENTE", "CONFIRMEE"]),
            ),
        ]

    def __str__(self):
        return f"Réservation #{self.pk} – {self.client} – {self.chambre}"

    @property
    def montant_paye(self):
        """Paiements reçus moins remboursements. Utiliser prefetch_related('paiements') dans les listes."""
        total = Decimal("0")
        for p in self.paiements.all():
            total += p.montant if p.type == "PAIEMENT" else -p.montant
        return total

    @property
    def solde(self):
        """Reste à payer (0 pour une réservation annulée)."""
        if self.statut == self.Statut.ANNULEE:
            return Decimal("0")
        return self.prix_total - self.montant_paye


STATUTS_ACTIFS = (Reservation.Statut.EN_ATTENTE, Reservation.Statut.CONFIRMEE)
