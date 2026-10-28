"""Filtres partagés entre l'API des réservations et les rapports (principe DRY)."""
from config.utils import get_date, get_int

from .models import Reservation


def filtrer_reservations(qs, params):
    if (client := get_int(params, "client")) is not None:
        qs = qs.filter(client_id=client)
    if (chambre := get_int(params, "chambre")) is not None:
        qs = qs.filter(chambre_id=chambre)
    statut = params.get("statut")
    if statut in Reservation.Statut.values:
        qs = qs.filter(statut=statut)
    debut, fin = get_date(params, "date_debut"), get_date(params, "date_fin")
    if debut:  # séjours qui se terminent après le début de la période
        qs = qs.filter(date_depart__gte=debut)
    if fin:  # ... et qui commencent avant la fin de la période
        qs = qs.filter(date_arrivee__lte=fin)
    return qs
