from django.contrib import admin

from .models import Categorie, Chambre

admin.site.register(Categorie)


@admin.register(Chambre)
class ChambreAdmin(admin.ModelAdmin):
    list_display = ("numero", "categorie", "capacite", "prix_nuit", "etat", "est_active")
    list_filter = ("categorie", "etat", "est_active")
