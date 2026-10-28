from config.utils import get_date, get_int

from .models import Paiement


def filtrer_paiements(qs, params):
    if (reservation := get_int(params, "reservation")) is not None:
        qs = qs.filter(reservation_id=reservation)
    if params.get("type") in Paiement.Type.values:
        qs = qs.filter(type=params["type"])
    if params.get("mode") in Paiement.Mode.values:
        qs = qs.filter(mode=params["mode"])
    if (debut := get_date(params, "date_debut")):
        qs = qs.filter(date_paiement__date__gte=debut)
    if (fin := get_date(params, "date_fin")):
        qs = qs.filter(date_paiement__date__lte=fin)
    return qs
