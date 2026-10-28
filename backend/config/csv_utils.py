"""Export CSV compatible Excel (séparateur ';', UTF-8 avec BOM)."""
import csv

from django.http import HttpResponse

_DANGEREUX = ("=", "+", "-", "@", "\t", "\r")


def _proteger(valeur):
    """Empêche l'injection de formules lorsque le CSV est ouvert dans Excel."""
    texte = "" if valeur is None else str(valeur)
    return "'" + texte if texte.startswith(_DANGEREUX) else texte


def reponse_csv(nom_fichier, entetes, lignes):
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{nom_fichier}"'
    response.write("\ufeff")
    writer = csv.writer(response, delimiter=";")
    writer.writerow(entetes)
    for ligne in lignes:
        writer.writerow([_proteger(v) for v in ligne])
    return response
