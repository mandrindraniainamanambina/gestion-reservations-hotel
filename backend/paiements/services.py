"""Règles de gestion des paiements et remboursements."""
from decimal import Decimal

from django.db.models import Case, DecimalField, F, Sum, When
from rest_framework.exceptions import ValidationError

from reservations.models import Reservation

from .models import Paiement


def somme_nette():
    """Expression d'agrégation : paiements (+) moins remboursements (−)."""
    return Sum(
        Case(
            When(type=Paiement.Type.PAIEMENT, then=F("montant")),
            default=-F("montant"),
            output_field=DecimalField(max_digits=14, decimal_places=2),
        )
    )


def verifier_regles(reservation, type_, montant):
    """
    R1. Pas de paiement sur une réservation annulée.
    R2. Un paiement ne peut pas dépasser le solde restant.
    R3. Un remboursement n'est possible que sur une réservation annulée.
    R4. Un remboursement ne peut pas dépasser le montant net déjà payé.
    """
    if type_ == Paiement.Type.PAIEMENT:
        if reservation.statut == Reservation.Statut.ANNULEE:
            raise ValidationError({"reservation": "Impossible d'enregistrer un paiement sur une réservation annulée."})
        if montant > reservation.solde:
            raise ValidationError({"montant": f"Le montant dépasse le solde restant ({reservation.solde:.2f})."})
    else:
        if reservation.statut != Reservation.Statut.ANNULEE:
            raise ValidationError({"type": "Un remboursement n'est possible que sur une réservation annulée."})
        if montant > reservation.montant_paye:
            raise ValidationError({"montant": f"Le remboursement dépasse le montant payé ({reservation.montant_paye:.2f})."})


def total_net(queryset):
    return queryset.aggregate(t=somme_nette())["t"] or Decimal("0")
