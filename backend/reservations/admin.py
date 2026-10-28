from django.contrib import admin

from .models import Reservation


@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = ("id", "client", "chambre", "date_arrivee", "date_depart", "statut", "prix_total")
    list_filter = ("statut",)
