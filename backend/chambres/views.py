from django.db.models import Exists, OuterRef
from django.utils import timezone
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from comptes.permissions import IsAdminOrReadOnly, IsAdminRole
from config.utils import get_date, get_decimal, get_int
from reservations.models import STATUTS_ACTIFS, Reservation
from reservations.services import chambres_indisponibles_ids

from .models import Categorie, Chambre
from .serializers import CategorieSerializer, ChambreSerializer


class CategorieViewSet(viewsets.ModelViewSet):
    """Lecture : tout utilisateur connecté. Écriture : administrateur."""

    queryset = Categorie.objects.all()
    serializer_class = CategorieSerializer
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = None  # liste courte, utilisée dans les formulaires


class ChambreViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ChambreSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["numero", "description", "categorie__nom"]

    def get_permissions(self):
        if self.action in ("desactiver", "activer"):
            return [IsAdminRole()]
        return super().get_permissions()

    def get_queryset(self):
        aujourdhui = timezone.localdate()
        occupee = Reservation.objects.filter(
            chambre=OuterRef("pk"), statut__in=STATUTS_ACTIFS,
            date_arrivee__lte=aujourdhui, date_depart__gt=aujourdhui,
        )
        qs = Chambre.objects.select_related("categorie").annotate(occupee=Exists(occupee))
        p = self.request.query_params
        if (categorie := get_int(p, "categorie")) is not None:
            qs = qs.filter(categorie_id=categorie)
        if (capacite := get_int(p, "capacite_min")) is not None:
            qs = qs.filter(capacite__gte=capacite)
        if (prix_min := get_decimal(p, "prix_min")) is not None:
            qs = qs.filter(prix_nuit__gte=prix_min)
        if (prix_max := get_decimal(p, "prix_max")) is not None:
            qs = qs.filter(prix_nuit__lte=prix_max)
        if p.get("actif") in ("true", "false"):
            qs = qs.filter(est_active=p["actif"] == "true")
        return qs

    @action(detail=False, methods=["get"])
    def disponibles(self, request):
        """Chambres libres sur une période : ?arrivee=AAAA-MM-JJ&depart=AAAA-MM-JJ (+ filtres habituels)."""
        arrivee, depart = get_date(request.query_params, "arrivee"), get_date(request.query_params, "depart")
        if not arrivee or not depart:
            return Response({"detail": "Les paramètres 'arrivee' et 'depart' sont obligatoires."}, status=400)
        if depart <= arrivee:
            return Response({"detail": "La date de départ doit être postérieure à la date d'arrivée."}, status=400)
        exclure = get_int(request.query_params, "exclude_reservation")  # utile lors de la modification
        qs = self.filter_queryset(self.get_queryset()).filter(est_active=True, etat=Chambre.Etat.DISPONIBLE)
        qs = qs.exclude(pk__in=chambres_indisponibles_ids(arrivee, depart, exclure))
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=True, methods=["post"])
    def desactiver(self, request, pk=None):
        chambre = self.get_object()
        aujourdhui = timezone.localdate()
        futures = Reservation.objects.filter(
            chambre=chambre, statut__in=STATUTS_ACTIFS, date_depart__gt=aujourdhui
        ).exists()
        if futures:
            return Response(
                {"detail": "Impossible : cette chambre a des réservations actives en cours ou à venir."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        chambre.est_active = False
        chambre.save(update_fields=["est_active"])
        return Response(self.get_serializer(chambre).data)

    @action(detail=True, methods=["post"])
    def activer(self, request, pk=None):
        chambre = self.get_object()
        chambre.est_active = True
        chambre.save(update_fields=["est_active"])
        return Response(self.get_serializer(chambre).data)
