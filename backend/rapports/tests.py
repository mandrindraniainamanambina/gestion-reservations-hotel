from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from config.factories import creer_admin, creer_chambre, creer_client, creer_reservation
from paiements.models import Paiement
from reservations.models import Reservation


class RapportsTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(creer_admin())
        self.j = timezone.localdate()
        self.chambre = creer_chambre("101", prix="100000")
        self.resa = creer_reservation(chambre=self.chambre, arrivee=self.j, depart=self.j + timedelta(days=2),
                                      statut=Reservation.Statut.CONFIRMEE)  # 200 000

    def test_dashboard_calcule_depuis_la_base(self):
        creer_chambre("102")
        Paiement.objects.create(reservation=self.resa, montant=50000, mode="ESPECES")
        d = self.api.get("/api/dashboard/").data
        self.assertEqual(d["total_chambres"], 2)
        self.assertEqual(d["chambres_occupees"], 1)
        self.assertEqual(d["chambres_disponibles"], 1)
        self.assertEqual(d["reservations_confirmees"], 1)
        self.assertEqual(d["total_clients"], 1)
        self.assertEqual(float(d["revenus_encaisses"]), 50000)
        self.assertEqual(len(d["dernieres_reservations"]), 1)

    def test_revenus_distinguent_encaisse_et_previsionnel(self):
        Paiement.objects.create(reservation=self.resa, montant=50000, mode="ESPECES")
        d = self.api.get(f"/api/rapports/revenus/?date_debut={self.j}&date_fin={self.j}").data
        self.assertEqual(float(d["revenus_encaisses_nets"]), 50000)
        self.assertEqual(float(d["chiffre_affaires_previsionnel"]), 200000)
        self.assertEqual(float(d["reste_a_encaisser"]), 150000)

    def test_export_csv_reservations(self):
        r = self.api.get("/api/rapports/reservations/?export=csv")
        self.assertEqual(r.status_code, 200)
        self.assertIn("text/csv", r["Content-Type"])
        self.assertIn("Client", r.content.decode("utf-8-sig").splitlines()[0])

    def test_filtre_rapport_par_statut(self):
        creer_reservation(client=creer_client(nom="AUTRE", telephone="+261340000009"), chambre=creer_chambre("102"),
                          statut=Reservation.Statut.ANNULEE)
        r = self.api.get("/api/rapports/reservations/?statut=ANNULEE")
        self.assertEqual(len(r.data), 1)

    def test_periode_invalide_refusee(self):
        r = self.api.get(f"/api/dashboard/?date_debut={self.j}&date_fin={self.j - timedelta(days=3)}")
        self.assertEqual(r.status_code, 400)
