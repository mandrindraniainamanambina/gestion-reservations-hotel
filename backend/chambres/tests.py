from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from config.factories import (
    creer_admin, creer_categorie, creer_chambre, creer_receptionniste, creer_reservation,
)
from reservations.models import Reservation


class ChambreApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = creer_admin()
        self.recep = creer_receptionniste()
        self.cat = creer_categorie("Suite")

    def _payload(self, **extra):
        data = {"numero": "201", "categorie": self.cat.pk, "capacite": 2, "prix_nuit": "150000"}
        data.update(extra)
        return data

    def test_creation_chambre(self):
        self.api.force_authenticate(self.recep)
        r = self.api.post("/api/chambres/", self._payload(), format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["numero"], "201")

    def test_numero_en_double_refuse(self):
        creer_chambre("201")
        self.api.force_authenticate(self.admin)
        self.assertEqual(self.api.post("/api/chambres/", self._payload(), format="json").status_code, 400)

    def test_prix_negatif_refuse(self):
        self.api.force_authenticate(self.admin)
        r = self.api.post("/api/chambres/", self._payload(prix_nuit="-5"), format="json")
        self.assertEqual(r.status_code, 400)

    def test_modification_chambre(self):
        chambre = creer_chambre("301")
        self.api.force_authenticate(self.recep)
        r = self.api.patch(f"/api/chambres/{chambre.pk}/", {"prix_nuit": "120000"}, format="json")
        self.assertEqual(r.status_code, 200)
        chambre.refresh_from_db()
        self.assertEqual(int(chambre.prix_nuit), 120000)

    def test_filtre_par_capacite(self):
        creer_chambre("101", capacite=1)
        creer_chambre("102", capacite=4)
        self.api.force_authenticate(self.recep)
        r = self.api.get("/api/chambres/?capacite_min=3")
        self.assertEqual([c["numero"] for c in r.data["results"]], ["102"])

    def test_receptionniste_ne_peut_pas_desactiver(self):
        chambre = creer_chambre("101")
        self.api.force_authenticate(self.recep)
        self.assertEqual(self.api.post(f"/api/chambres/{chambre.pk}/desactiver/").status_code, 403)

    def test_admin_desactive_une_chambre_libre(self):
        chambre = creer_chambre("101")
        self.api.force_authenticate(self.admin)
        r = self.api.post(f"/api/chambres/{chambre.pk}/desactiver/")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data["est_active"])

    def test_desactivation_refusee_si_reservation_active(self):
        chambre = creer_chambre("101")
        creer_reservation(chambre=chambre)
        self.api.force_authenticate(self.admin)
        self.assertEqual(self.api.post(f"/api/chambres/{chambre.pk}/desactiver/").status_code, 400)

    def test_disponibles_exclut_les_chambres_reservees(self):
        libre = creer_chambre("101")
        prise = creer_chambre("102")
        arrivee = timezone.localdate() + timedelta(days=5)
        creer_reservation(chambre=prise, arrivee=arrivee, depart=arrivee + timedelta(days=3))
        self.api.force_authenticate(self.recep)
        r = self.api.get(f"/api/chambres/disponibles/?arrivee={arrivee}&depart={arrivee + timedelta(days=2)}")
        self.assertEqual([c["numero"] for c in r.data], [libre.numero])

    def test_disponibles_ignore_les_reservations_annulees(self):
        chambre = creer_chambre("101")
        arrivee = timezone.localdate() + timedelta(days=5)
        creer_reservation(chambre=chambre, arrivee=arrivee, statut=Reservation.Statut.ANNULEE)
        self.api.force_authenticate(self.recep)
        r = self.api.get(f"/api/chambres/disponibles/?arrivee={arrivee}&depart={arrivee + timedelta(days=2)}")
        self.assertEqual(len(r.data), 1)
