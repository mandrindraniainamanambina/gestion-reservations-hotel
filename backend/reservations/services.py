"""Règles de gestion des réservations (indépendantes de l'API)."""
from decimal import Decimal

from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import STATUTS_ACTIFS, Reservation

S = Reservation.Statut

# Transitions autorisées : statut actuel -> statuts accessibles
TRANSITIONS = {
    S.EN_ATTENTE: {S.CONFIRMEE, S.ANNULEE},
    S.CONFIRMEE: {S.TERMINEE, S.ANNULEE},
    S.ANNULEE: set(),
    S.TERMINEE: set(),
}


def calculer_nuits_et_prix(arrivee, depart, prix_nuit):
    nuits = (depart - arrivee).days
    return nuits, Decimal(prix_nuit) * nuits


def _chevauchantes(arrivee, depart):
    # Deux périodes [a1, d1) et [a2, d2) se chevauchent si a1 < d2 et d1 > a2
    return Reservation.objects.filter(
        statut__in=STATUTS_ACTIFS, date_arrivee__lt=depart, date_depart__gt=arrivee
    )


def chambres_indisponibles_ids(arrivee, depart, exclure_id=None):
    qs = _chevauchantes(arrivee, depart)
    if exclure_id:
        qs = qs.exclude(pk=exclure_id)
    return qs.values_list("chambre_id", flat=True)


def verifier_disponibilite(chambre_id, arrivee, depart, exclure_id=None):
    """Lève une erreur si la chambre est déjà prise (réservations annulées ignorées)."""
    qs = _chevauchantes(arrivee, depart).filter(chambre_id=chambre_id)
    if exclure_id:
        qs = qs.exclude(pk=exclure_id)
    conflit = qs.first()
    if conflit:
        raise ValidationError({
            "chambre": f"Chambre déjà réservée du {conflit.date_arrivee:%d/%m/%Y} au {conflit.date_depart:%d/%m/%Y}."
        })


def changer_statut(reservation, cible):
    """Applique une transition de statut en respectant les règles de gestion."""
    if cible not in TRANSITIONS[reservation.statut]:
        raise ValidationError({
            "statut": f"Transition impossible : {S(reservation.statut).label} → {S(cible).label}."
        })
    if cible == S.CONFIRMEE:
        verifier_disponibilite(reservation.chambre_id, reservation.date_arrivee, reservation.date_depart,
                               exclure_id=reservation.pk)
    if cible == S.TERMINEE and reservation.date_arrivee > timezone.localdate():
        raise ValidationError({"statut": "Une réservation ne peut pas être terminée avant sa date d'arrivée."})
    reservation.statut = cible
    reservation.save(update_fields=["statut", "updated_at"])
    return reservation
