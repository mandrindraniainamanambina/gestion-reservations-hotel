"""Données de démonstration FICTIVES : python manage.py seed_demo [--reset]"""
import os
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from chambres.models import Categorie, Chambre
from clients.models import Client
from comptes.models import User
from paiements.models import Paiement
from reservations.models import Reservation
from reservations.services import calculer_nuits_et_prix

S = Reservation.Statut


class Command(BaseCommand):
    help = "Crée des comptes, chambres, clients, réservations et paiements fictifs de démonstration."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Supprime les données métier avant de recréer la démo.")

    @transaction.atomic
    def handle(self, *args, **options):
        mot_de_passe = os.environ.get("DEMO_PASSWORD")
        if not mot_de_passe:
            raise CommandError("Définissez DEMO_PASSWORD dans backend/.env (mot de passe des comptes de démonstration).")
        if options["reset"]:
            Paiement.objects.all().delete()
            Reservation.objects.all().delete()
            Client.objects.all().delete()
            Chambre.objects.all().delete()
            Categorie.objects.all().delete()
        elif Reservation.objects.exists():
            raise CommandError("Des données existent déjà. Utilisez --reset pour les remplacer.")

        for username, role, prenom in [("admin", User.Role.ADMIN, "Admin"), ("reception", User.Role.RECEPTIONNISTE, "Réception")]:
            user, _ = User.objects.get_or_create(username=username, defaults={"role": role, "first_name": prenom})
            user.set_password(mot_de_passe)
            user.role = role
            user.save()
        recep = User.objects.get(username="reception")

        categories = {n: Categorie.objects.get_or_create(nom=n)[0] for n in ["Simple", "Double", "Familiale", "Suite"]}
        grille = {"Simple": (1, "80000", ["101", "102", "103"]), "Double": (2, "120000", ["201", "202", "203"]),
                  "Familiale": (4, "180000", ["301", "302"]), "Suite": (3, "350000", ["401", "402"])}
        chambres = {}
        for nom, (capacite, prix, numeros) in grille.items():
            for numero in numeros:
                chambres[numero] = Chambre.objects.create(
                    numero=numero, categorie=categories[nom], capacite=capacite, prix_nuit=Decimal(prix),
                    description=f"Chambre {nom.lower()} de démonstration")
        chambres["103"].etat = Chambre.Etat.MAINTENANCE
        chambres["103"].save()

        identites = [("RAKOTO", "Jean"), ("RASOA", "Marie"), ("ANDRIA", "Paul"), ("RABE", "Claire"),
                     ("RANDRIA", "Hery"), ("RAZAFY", "Lalao"), ("RAVELO", "Tiana"), ("RALAMBO", "Faly")]
        clients = [
            Client.objects.create(nom=n, prenom=p, telephone=f"+26134000010{i}", email=f"client{i}@example.com")
            for i, (n, p) in enumerate(identites)
        ]

        j = timezone.localdate()
        maintenant = timezone.now()

        def reserver(c, num, debut, fin, statut, personnes=1):
            ch = chambres[num]
            arrivee, depart = j + timedelta(days=debut), j + timedelta(days=fin)
            nuits, prix = calculer_nuits_et_prix(arrivee, depart, ch.prix_nuit)
            return Reservation.objects.create(
                client=clients[c], chambre=ch, date_arrivee=arrivee, date_depart=depart, nb_nuits=nuits,
                prix_total=prix, nb_personnes=personnes, statut=statut, cree_par=recep)

        def payer(resa, part, mode, il_y_a_jours=0, type_=Paiement.Type.PAIEMENT):
            Paiement.objects.create(
                reservation=resa, montant=(resa.prix_total * Decimal(part)).quantize(Decimal("0.01")), type=type_, mode=mode,
                reference=f"DEMO-{resa.pk}", date_paiement=maintenant - timedelta(days=il_y_a_jours), enregistre_par=recep)

        M = Paiement.Mode
        payer(reserver(7, "203", -20, -17, S.TERMINEE, 2), 1, M.ESPECES, 20)
        payer(reserver(0, "101", -10, -7, S.TERMINEE), 1, M.ESPECES, 10)
        payer(reserver(1, "102", -8, -5, S.TERMINEE), 1, M.CARTE, 8)
        payer(reserver(2, "201", -1, 2, S.CONFIRMEE, 2), "0.5", M.MOBILE_MONEY, 1)
        payer(reserver(3, "301", 0, 3, S.CONFIRMEE, 3), "0.3", M.VIREMENT, 0)
        reserver(4, "401", 5, 8, S.EN_ATTENTE, 2)
        payer(reserver(5, "202", 2, 4, S.EN_ATTENTE, 2), "0.2", M.ESPECES, 0)
        annulee = reserver(6, "102", 1, 3, S.ANNULEE)
        payer(annulee, "0.2", M.CARTE, 3)
        payer(annulee, "0.2", M.CARTE, 1, Paiement.Type.REMBOURSEMENT)

        self.stdout.write(self.style.SUCCESS("Données de démonstration créées."))
        self.stdout.write("Comptes : admin / reception (mot de passe = DEMO_PASSWORD de votre .env)")
