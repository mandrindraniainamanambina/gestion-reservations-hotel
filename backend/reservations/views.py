from django.db import transaction
from rest_framework import filters, mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from chambres.models import Chambre

from .filters import filtrer_reservations
from .models import Reservation
from .serializers import ReservationSerializer
from .services import changer_statut


class ReservationViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """Pas de suppression : une réservation s'annule (statut), elle ne s'efface pas."""

    serializer_class = ReservationSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["client__nom", "client__prenom", "client__telephone", "chambre__numero"]

    def get_queryset(self):
        qs = Reservation.objects.select_related("client", "chambre").prefetch_related("paiements")
        return filtrer_reservations(qs, self.request.query_params)

    def _transition(self, request, cible):
        reservation = self.get_object()  # 404 si inconnue
        with transaction.atomic():
            Chambre.objects.select_for_update().get(pk=reservation.chambre_id)
            verrouillee = Reservation.objects.select_for_update().get(pk=reservation.pk)
            changer_statut(verrouillee, cible)
        return Response(self.get_serializer(self.get_object()).data)

    @action(detail=True, methods=["post"])
    def confirmer(self, request, pk=None):
        return self._transition(request, Reservation.Statut.CONFIRMEE)

    @action(detail=True, methods=["post"])
    def annuler(self, request, pk=None):
        return self._transition(request, Reservation.Statut.ANNULEE)

    @action(detail=True, methods=["post"])
    def terminer(self, request, pk=None):
        return self._transition(request, Reservation.Statut.TERMINEE)
