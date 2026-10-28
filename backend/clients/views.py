from rest_framework import filters, mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from reservations.serializers import ReservationSerializer

from .models import Client
from .serializers import ClientSerializer


class ClientViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """Pas de suppression : on conserve l'historique des réservations."""

    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["nom", "prenom", "email", "telephone"]

    @action(detail=True, methods=["get"])
    def historique(self, request, pk=None):
        client = self.get_object()
        reservations = (
            client.reservations.select_related("client", "chambre").prefetch_related("paiements")
            .order_by("-date_arrivee")
        )
        return Response(ReservationSerializer(reservations, many=True, context={"request": request}).data)
