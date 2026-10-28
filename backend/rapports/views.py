"""Tableau de bord et rapports. Tous les chiffres sont calculés depuis la base de données."""
from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Exists, OuterRef
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from chambres.models import Chambre
from clients.models import Client
from config.csv_utils import reponse_csv
from config.utils import get_date
from paiements.filters import filtrer_paiements
from paiements.models import Paiement
from paiements.serializers import PaiementSerializer
from paiements.services import somme_nette, total_net
from reservations.filters import filtrer_reservations
from reservations.models import STATUTS_ACTIFS, Reservation
from reservations.serializers import ReservationSerializer

LIMITE_LIGNES = 5000
LIMITE_JOURS = 366


def _periode(params):
    """Période du ?date_debut / ?date_fin (défaut : 30 derniers jours)."""
    fin = get_date(params, "date_fin") or timezone.localdate()
    debut = get_date(params, "date_debut") or fin - timedelta(days=29)
    if debut > fin:
        raise ValidationError({"date_debut": "La date de début doit précéder la date de fin."})
    if (fin - debut).days > LIMITE_JOURS:
        raise ValidationError({"date_fin": f"Période limitée à {LIMITE_JOURS} jours."})
    return debut, fin


@api_view(["GET"])
def dashboard(request):
    debut, fin = _periode(request.query_params)
    aujourdhui = timezone.localdate()

    occupee = Reservation.objects.filter(
        chambre=OuterRef("pk"), statut__in=STATUTS_ACTIFS, date_arrivee__lte=aujourdhui, date_depart__gt=aujourdhui
    )
    chambres = Chambre.objects.filter(est_active=True).annotate(occupee=Exists(occupee))
    total_chambres = chambres.count()
    occupees = chambres.filter(occupee=True).count()
    disponibles = chambres.filter(occupee=False, etat=Chambre.Etat.DISPONIBLE).count()

    paiements = Paiement.objects.filter(date_paiement__date__range=(debut, fin))
    par_jour = {
        ligne["jour"]: ligne["net"]
        for ligne in paiements.annotate(jour=TruncDate("date_paiement")).values("jour").annotate(net=somme_nette())
    }
    revenus_par_jour = []
    jour = debut
    while jour <= fin:
        revenus_par_jour.append({"date": jour.isoformat(), "montant": par_jour.get(jour, Decimal("0"))})
        jour += timedelta(days=1)

    compte = {l["statut"]: l["total"] for l in Reservation.objects.values("statut").annotate(total=Count("id"))}
    recentes = Reservation.objects.select_related("client", "chambre").prefetch_related("paiements")[:5]

    return Response({
        "periode": {"debut": debut, "fin": fin},
        "total_chambres": total_chambres,
        "chambres_disponibles": disponibles,
        "chambres_occupees": occupees,
        "reservations_en_attente": compte.get(Reservation.Statut.EN_ATTENTE, 0),
        "reservations_confirmees": compte.get(Reservation.Statut.CONFIRMEE, 0),
        "total_clients": Client.objects.count(),
        "revenus_encaisses": total_net(paiements),
        "revenus_par_jour": revenus_par_jour,
        "reservations_par_statut": [
            {"statut": valeur, "libelle": libelle, "total": compte.get(valeur, 0)}
            for valeur, libelle in Reservation.Statut.choices
        ],
        "dernieres_reservations": ReservationSerializer(recentes, many=True, context={"request": request}).data,
    })


@api_view(["GET"])
def rapport_reservations(request):
    qs = Reservation.objects.select_related("client", "chambre").prefetch_related("paiements")
    qs = filtrer_reservations(qs, request.query_params).order_by("date_arrivee", "id")[:LIMITE_LIGNES]
    donnees = ReservationSerializer(qs, many=True, context={"request": request}).data
    if request.query_params.get("export") == "csv":
        entetes = ["N°", "Client", "Chambre", "Arrivée", "Départ", "Nuits", "Prix total", "Payé", "Solde", "Statut"]
        lignes = [[d["id"], d["client_nom"], d["chambre_numero"], d["date_arrivee"], d["date_depart"],
                   d["nb_nuits"], d["prix_total"], d["montant_paye"], d["solde"], d["statut"]] for d in donnees]
        return reponse_csv("reservations.csv", entetes, lignes)
    return Response(donnees)


@api_view(["GET"])
def rapport_paiements(request):
    qs = Paiement.objects.select_related("reservation__client", "reservation__chambre", "enregistre_par")
    qs = filtrer_paiements(qs, request.query_params).order_by("date_paiement", "id")[:LIMITE_LIGNES]
    donnees = PaiementSerializer(qs, many=True, context={"request": request}).data
    if request.query_params.get("export") == "csv":
        entetes = ["N°", "Réservation", "Type", "Mode", "Montant", "Référence", "Date", "Enregistré par"]
        lignes = [[d["id"], d["reservation_label"], d["type"], d["mode"], d["montant"],
                   d["reference"], d["date_paiement"], d["enregistre_par_nom"]] for d in donnees]
        return reponse_csv("paiements.csv", entetes, lignes)
    return Response(donnees)


@api_view(["GET"])
def rapport_revenus(request):
    """Distingue l'argent réellement encaissé (paiements) du chiffre d'affaires prévisionnel (réservations)."""
    debut, fin = _periode(request.query_params)
    paiements = Paiement.objects.filter(date_paiement__date__range=(debut, fin))
    encaisse = total_net(paiements.filter(type=Paiement.Type.PAIEMENT))
    rembourse = total_net(paiements.filter(type=Paiement.Type.REMBOURSEMENT))  # négatif dans somme_nette
    par_mode = [
        {"mode": l["mode"], "net": l["net"]}
        for l in paiements.values("mode").annotate(net=somme_nette()).order_by("mode")
    ]

    reservations = (
        Reservation.objects.exclude(statut=Reservation.Statut.ANNULEE)
        .filter(date_arrivee__range=(debut, fin)).prefetch_related("paiements")
    )
    previsionnel = sum((r.prix_total for r in reservations), Decimal("0"))
    reste = sum((r.solde for r in reservations), Decimal("0"))

    return Response({
        "periode": {"debut": debut, "fin": fin},
        "encaisse_brut": encaisse,
        "rembourse": abs(rembourse),
        "revenus_encaisses_nets": encaisse + rembourse,
        "chiffre_affaires_previsionnel": previsionnel,
        "reste_a_encaisser": reste,
        "par_mode": par_mode,
    })
