"""Active l'extension PostgreSQL btree_gist, requise par la contrainte d'exclusion
qui interdit deux réservations actives de se chevaucher sur la même chambre.

Cette migration doit s'exécuter AVANT la création de la table des réservations
(les migrations générées par `makemigrations` en dépendent automatiquement).
"""
from django.contrib.postgres.operations import BtreeGistExtension
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = []
    operations = [BtreeGistExtension()]
