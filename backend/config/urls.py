from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("comptes.urls")),
    path("api/", include("chambres.urls")),
    path("api/", include("clients.urls")),
    path("api/", include("reservations.urls")),
    path("api/", include("paiements.urls")),
    path("api/", include("rapports.urls")),
]
