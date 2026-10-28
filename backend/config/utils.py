"""Lecture sûre des paramètres de requête (dates, entiers, décimaux)."""
from decimal import Decimal, InvalidOperation

from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError


def get_date(params, name):
    value = params.get(name)
    if not value:
        return None
    try:
        parsed = parse_date(value)
    except ValueError:
        parsed = None
    if parsed is None:
        raise ValidationError({name: "Date invalide. Format attendu : AAAA-MM-JJ."})
    return parsed


def get_int(params, name):
    value = params.get(name)
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        raise ValidationError({name: "Nombre entier attendu."})


def get_decimal(params, name):
    value = params.get(name)
    if not value:
        return None
    try:
        return Decimal(value)
    except InvalidOperation:
        raise ValidationError({name: "Nombre attendu."})
