from django.urls import path

from . import views

urlpatterns = [
    path("dashboard/", views.dashboard, name="dashboard"),
    path("rapports/reservations/", views.rapport_reservations, name="rapport-reservations"),
    path("rapports/paiements/", views.rapport_paiements, name="rapport-paiements"),
    path("rapports/revenus/", views.rapport_revenus, name="rapport-revenus"),
]
