from django.contrib import admin

from .models import Paiement


@admin.register(Paiement)
class PaiementAdmin(admin.ModelAdmin):
    list_display = ("id", "reservation", "type", "montant", "mode", "date_paiement")
    list_filter = ("type", "mode")
