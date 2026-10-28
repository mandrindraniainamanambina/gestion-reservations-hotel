from django.test import TestCase
from rest_framework.test import APIClient

from config.factories import creer_admin, creer_client, creer_receptionniste


class ClientApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.recep = creer_receptionniste()
        self.admin = creer_admin()
        self.api.force_authenticate(self.recep)

    def _payload(self, **extra):
        data = {"nom": "rasoa", "prenom": "marie", "telephone": "+261 34 12 345 67", "piece_identite": "101 202 303"}
        data.update(extra)
        return data

    def test_creation_normalise_les_donnees(self):
        r = self.api.post("/api/clients/", self._payload(), format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["nom"], "RASOA")
        self.assertEqual(r.data["prenom"], "Marie")
        self.assertEqual(r.data["telephone"], "+261341234567")

    def test_email_en_double_refuse(self):
        creer_client(email="a@example.com")
        r = self.api.post("/api/clients/", self._payload(email="A@Example.com"), format="json")
        self.assertEqual(r.status_code, 400)

    def test_doublon_identite_telephone_refuse(self):
        self.api.post("/api/clients/", self._payload(), format="json")
        r = self.api.post("/api/clients/", self._payload(nom="RASOA "), format="json")
        self.assertEqual(r.status_code, 400)

    def test_telephone_invalide_refuse(self):
        r = self.api.post("/api/clients/", self._payload(telephone="abc"), format="json")
        self.assertEqual(r.status_code, 400)

    def test_plusieurs_clients_sans_email(self):
        self.api.post("/api/clients/", self._payload(), format="json")
        r = self.api.post("/api/clients/", self._payload(nom="Andry", telephone="0321234567"), format="json")
        self.assertEqual(r.status_code, 201)

    def test_recherche_par_nom(self):
        creer_client(nom="RAKOTO", prenom="Jean")
        creer_client(nom="RABE", prenom="Paul", telephone="+261340000002")
        r = self.api.get("/api/clients/?search=rabe")
        self.assertEqual(r.data["count"], 1)

    def test_piece_identite_visible_uniquement_pour_admin(self):
        client = creer_client()
        client.piece_identite = "123456"
        client.save()
        self.assertNotIn("piece_identite", self.api.get(f"/api/clients/{client.pk}/").data)
        self.api.force_authenticate(self.admin)
        self.assertEqual(self.api.get(f"/api/clients/{client.pk}/").data["piece_identite"], "123456")

    def test_pas_de_suppression(self):
        client = creer_client()
        self.assertEqual(self.api.delete(f"/api/clients/{client.pk}/").status_code, 405)
