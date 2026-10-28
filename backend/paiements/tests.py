from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from config.factories import creer_admin, creer_chambre, creer_receptionniste, creer_reservation
from reservations.models import Reservation


class PaiementApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.recep = creer_receptionniste()
        self.admin = creer_admin()
        self.api.force_authenticate(self.recep)
        self.resa = creer_reservation(chambre=creer_chambre("101", prix="100000"))  # 3 nuits = 300 000

    def _payer(self, montant, type_="PAIEMENT", resa=None):
        return self.api.post("/api/paiements/", {
            "reservation": (resa or self.resa).pk, "montant": str(montant), "type": type_, "mode": "ESPECES",
        }, format="json")

    def test_paiement_partiel_puis_solde(self):
        self.assertEqual(self._payer(100000).status_code, 201)
        r = self.api.get(f"/api/reservations/{self.resa.pk}/")
        self.assertEqual(float(r.data["montant_paye"]), 100000)
        self.assertEqual(float(r.data["solde"]), 200000)

    def test_paiement_complet_solde_nul(self):
        self.assertEqual(self._payer(300000).status_code, 201)
        r = self.api.get(f"/api/reservations/{self.resa.pk}/")
        self.assertEqual(float(r.data["solde"]), 0)

    def test_paiement_superieur_au_solde_refuse(self):
        self._payer(250000)
        self.assertEqual(self._payer(100000).status_code, 400)

    def test_montant_nul_ou_negatif_refuse(self):
        self.assertEqual(self._payer(0).status_code, 400)
        self.assertEqual(self._payer(-10).status_code, 400)

    def test_paiement_sur_reservation_annulee_refuse(self):
        self.resa.statut = Reservation.Statut.ANNULEE
        self.resa.save()
        self.assertEqual(self._payer(1000).status_code, 400)

    def test_remboursement_reserve_a_l_admin(self):
        self._payer(100000)
        self.resa.statut = Reservation.Statut.ANNULEE
        self.resa.save()
        self.assertEqual(self._payer(50000, "REMBOURSEMENT").status_code, 403)

    def test_remboursement_refuse_si_reservation_non_annulee(self):
        self._payer(100000)
        self.api.force_authenticate(self.admin)
        self.assertEqual(self._payer(50000, "REMBOURSEMENT").status_code, 400)

    def test_remboursement_admin_apres_annulation(self):
        self._payer(100000)
        self.resa.statut = Reservation.Statut.ANNULEE
        self.resa.save()
        self.api.force_authenticate(self.admin)
        self.assertEqual(self._payer(100000, "REMBOURSEMENT").status_code, 201)
        self.assertEqual(self._payer(1, "REMBOURSEMENT").status_code, 400)  # plus rien à rembourser

    def test_pas_de_modification_ni_suppression(self):
        p = self._payer(1000).data["id"]
        self.assertEqual(self.api.delete(f"/api/paiements/{p}/").status_code, 405)
        self.assertEqual(self.api.patch(f"/api/paiements/{p}/", {"montant": "1"}, format="json").status_code, 405)

    def test_historique_filtre_par_reservation(self):
        autre = creer_reservation(chambre=creer_chambre("102"), arrivee=timezone.localdate() + timedelta(days=20))
        self._payer(1000)
        self._payer(2000, resa=autre)
        r = self.api.get(f"/api/paiements/?reservation={self.resa.pk}")
        self.assertEqual(r.data["count"], 1)
