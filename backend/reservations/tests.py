from datetime import timedelta

from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from config.factories import creer_chambre, creer_client, creer_receptionniste, creer_reservation
from reservations.models import Reservation
from reservations.services import calculer_nuits_et_prix

S = Reservation.Statut


class CalculTests(TestCase):
    def test_nuits_et_prix(self):
        arrivee = timezone.localdate()
        nuits, prix = calculer_nuits_et_prix(arrivee, arrivee + timedelta(days=4), "50000")
        self.assertEqual(nuits, 4)
        self.assertEqual(prix, 200000)


class ReservationApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(creer_receptionniste())
        self.client_h = creer_client()
        self.chambre = creer_chambre("101", prix="100000", capacite=2)
        self.j = timezone.localdate()

    def _post(self, arrivee=None, depart=None, **extra):
        arrivee = arrivee or self.j + timedelta(days=5)
        depart = depart or arrivee + timedelta(days=3)
        data = {"client": self.client_h.pk, "chambre": self.chambre.pk,
                "date_arrivee": str(arrivee), "date_depart": str(depart), "nb_personnes": 2}
        data.update(extra)
        return self.api.post("/api/reservations/", data, format="json")

    def test_creation_calcule_nuits_prix_et_statut(self):
        r = self._post()
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["nb_nuits"], 3)
        self.assertEqual(float(r.data["prix_total"]), 300000)
        self.assertEqual(r.data["statut"], "EN_ATTENTE")

    def test_le_client_ne_peut_pas_imposer_prix_ni_statut(self):
        r = self._post(prix_total="1", nb_nuits=99, statut="CONFIRMEE")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(float(r.data["prix_total"]), 300000)
        self.assertEqual(r.data["statut"], "EN_ATTENTE")

    def test_depart_avant_arrivee_refuse(self):
        a = self.j + timedelta(days=5)
        self.assertEqual(self._post(arrivee=a, depart=a - timedelta(days=1)).status_code, 400)

    def test_depart_egal_arrivee_refuse(self):
        a = self.j + timedelta(days=5)
        self.assertEqual(self._post(arrivee=a, depart=a).status_code, 400)

    def test_arrivee_dans_le_passe_refusee(self):
        a = self.j - timedelta(days=2)
        self.assertEqual(self._post(arrivee=a, depart=a + timedelta(days=2)).status_code, 400)

    def test_capacite_depassee_refusee(self):
        self.assertEqual(self._post(nb_personnes=5).status_code, 400)

    def test_chevauchement_refuse(self):
        a = self.j + timedelta(days=5)
        self.assertEqual(self._post(arrivee=a, depart=a + timedelta(days=4)).status_code, 201)
        r = self._post(arrivee=a + timedelta(days=2), depart=a + timedelta(days=6))
        self.assertEqual(r.status_code, 400)
        self.assertIn("chambre", r.data)

    def test_sejours_consecutifs_autorises(self):
        a = self.j + timedelta(days=5)
        self.assertEqual(self._post(arrivee=a, depart=a + timedelta(days=2)).status_code, 201)
        self.assertEqual(self._post(arrivee=a + timedelta(days=2), depart=a + timedelta(days=4)).status_code, 201)

    def test_reservation_annulee_ne_bloque_pas(self):
        a = self.j + timedelta(days=5)
        id_ = self._post(arrivee=a).data["id"]
        self.assertEqual(self.api.post(f"/api/reservations/{id_}/annuler/").status_code, 200)
        self.assertEqual(self._post(arrivee=a).status_code, 201)

    def test_chambre_desactivee_non_reservable(self):
        self.chambre.est_active = False
        self.chambre.save()
        self.assertEqual(self._post().status_code, 400)

    def test_cycle_de_statuts(self):
        resa = creer_reservation(client=self.client_h, chambre=self.chambre, arrivee=self.j, depart=self.j + timedelta(days=2))
        self.assertEqual(self.api.post(f"/api/reservations/{resa.pk}/confirmer/").data["statut"], "CONFIRMEE")
        self.assertEqual(self.api.post(f"/api/reservations/{resa.pk}/terminer/").data["statut"], "TERMINEE")

    def test_transitions_interdites(self):
        resa = creer_reservation(client=self.client_h, chambre=self.chambre, statut=S.ANNULEE)
        self.assertEqual(self.api.post(f"/api/reservations/{resa.pk}/confirmer/").status_code, 400)
        en_attente = creer_reservation(client=self.client_h, chambre=creer_chambre("102"))
        self.assertEqual(self.api.post(f"/api/reservations/{en_attente.pk}/terminer/").status_code, 400)

    def test_terminer_avant_arrivee_refuse(self):
        resa = creer_reservation(client=self.client_h, chambre=self.chambre, statut=S.CONFIRMEE)
        self.assertEqual(self.api.post(f"/api/reservations/{resa.pk}/terminer/").status_code, 400)

    def test_modification_des_dates_recalcule_le_prix(self):
        resa = creer_reservation(client=self.client_h, chambre=self.chambre)
        r = self.api.patch(f"/api/reservations/{resa.pk}/", {
            "date_depart": str(resa.date_arrivee + timedelta(days=5))}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["nb_nuits"], 5)
        self.assertEqual(float(r.data["prix_total"]), 500000)

    def test_modification_refusee_si_annulee(self):
        resa = creer_reservation(client=self.client_h, chambre=self.chambre, statut=S.ANNULEE)
        r = self.api.patch(f"/api/reservations/{resa.pk}/", {"notes": "x"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_filtre_par_statut(self):
        creer_reservation(client=self.client_h, chambre=self.chambre, statut=S.ANNULEE)
        creer_reservation(client=self.client_h, chambre=creer_chambre("102"))
        r = self.api.get("/api/reservations/?statut=ANNULEE")
        self.assertEqual(r.data["count"], 1)

    def test_pas_de_suppression(self):
        resa = creer_reservation(client=self.client_h, chambre=self.chambre)
        self.assertEqual(self.api.delete(f"/api/reservations/{resa.pk}/").status_code, 405)


class ContrainteBaseDeDonneesTests(TestCase):
    """La base elle-même refuse un chevauchement, même si le code applicatif était contourné."""

    def test_exclusion_constraint_postgresql(self):
        chambre = creer_chambre("101")
        client = creer_client()
        a = timezone.localdate() + timedelta(days=5)
        creer_reservation(client=client, chambre=chambre, arrivee=a, depart=a + timedelta(days=3))
        with self.assertRaises(IntegrityError), transaction.atomic():
            creer_reservation(client=client, chambre=chambre, arrivee=a + timedelta(days=1), depart=a + timedelta(days=2))
