from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import User


def _authentifie(request):
    return bool(request.user and request.user.is_authenticated)


class IsAdminRole(BasePermission):
    """Réservé aux administrateurs."""

    def has_permission(self, request, view):
        return _authentifie(request) and request.user.role == User.Role.ADMIN


class IsAdminOrReadOnly(BasePermission):
    """Lecture pour tout utilisateur connecté, écriture pour les administrateurs."""

    def has_permission(self, request, view):
        if not _authentifie(request):
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.role == User.Role.ADMIN
