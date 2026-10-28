"""Gestionnaire d'erreurs : réponses JSON propres, sans détails techniques."""
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.db.models import ProtectedError
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        detail = exc.message_dict if hasattr(exc, "error_dict") else exc.messages
        exc = DRFValidationError(detail=detail)
    elif isinstance(exc, ProtectedError):
        return Response(
            {"detail": "Suppression impossible : cet élément est utilisé par d'autres données."},
            status=409,
        )
    elif isinstance(exc, IntegrityError):
        return Response(
            {"detail": "Opération refusée : elle violerait une contrainte d'intégrité des données."},
            status=409,
        )
    return exception_handler(exc, context)
