"""Fabriques d'objets utilisées uniquement par les tests."""
from datetime import timedelta

from django.utils import timezone

from chambres.models import Categorie, Chambre
from clients.models import Client
from comptes.models import User
from reservations.models import Reservation
from reservations.services import calculer_nuits_et_prix

MOT_DE_PASSE = "Mdp-Test-123!"


def creer_admin(username="admin"):
    return User.objects.create_user(username=username, password=MOT_DE_PASSE, role=User.Role.ADMIN)


def creer_receptionniste(username="recep"):
    return User.objects.create_user(username=username, password=MOT_DE_PASSE, role=User.Role.RECEPTIONNISTE)


def creer_categorie(nom="Double"):
    return Categorie.objects.get_or_create(nom=nom)[0]


def creer_chambre(numero="101", prix="100000", capacite=2, **extra):
    return Chambre.objects.create(
        numero=numero, categorie=extra.pop("categorie", creer_categorie()),
        capacite=capacite, prix_nuit=prix, **extra,
    )


def creer_client(nom="RAKOTO", prenom="Jean", telephone="+261340000001", email=None):
    return Client.objects.create(nom=nom, prenom=prenom, telephone=telephone, email=email)


def creer_reservation(client=None, chambre=None, arrivee=None, depart=None,
                      statut=Reservation.Statut.EN_ATTENTE, nb_personnes=1):
    aujourdhui = timezone.localdate()
    arrivee = arrivee or aujourdhui + timedelta(days=10)
    depart = depart or arrivee + timedelta(days=3)
    chambre = chambre or creer_chambre()
    nuits, prix = calculer_nuits_et_prix(arrivee, depart, chambre.prix_nuit)
    return Reservation.objects.create(
        client=client or creer_client(), chambre=chambre, date_arrivee=arrivee, date_depart=depart,
        nb_nuits=nuits, prix_total=prix, nb_personnes=nb_personnes, statut=statut,
    )
