from rest_framework import filters, mixins, viewsets
from rest_framework.exceptions import PermissionDenied

from .filters import filtrer_paiements
from .models import Paiement
from .serializers import PaiementSerializer


class PaiementViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """Lecture + création uniquement : un mouvement financier ne se modifie pas et ne se supprime pas.
    Une erreur se corrige par un remboursement (traçabilité comptable)."""

    serializer_class = PaiementSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["reference", "reservation__client__nom", "reservation__client__prenom"]

    def get_queryset(self):
        qs = Paiement.objects.select_related("reservation__client", "reservation__chambre", "enregistre_par")
        return filtrer_paiements(qs, self.request.query_params)

    def perform_create(self, serializer):
        if serializer.validated_data["type"] == Paiement.Type.REMBOURSEMENT and not self.request.user.est_admin:
            raise PermissionDenied("Seul un administrateur peut enregistrer un remboursement.")
        serializer.save()
