from django.test import TestCase
from rest_framework.test import APIClient

from config.factories import MOT_DE_PASSE, creer_admin, creer_receptionniste


class AuthentificationTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = creer_admin()
        self.recep = creer_receptionniste()

    def test_connexion_valide_retourne_un_jeton(self):
        r = self.api.post("/api/auth/login/", {"username": "admin", "password": MOT_DE_PASSE}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("token", r.data)
        self.assertEqual(r.data["user"]["role"], "ADMIN")

    def test_mauvais_mot_de_passe_refuse(self):
        r = self.api.post("/api/auth/login/", {"username": "admin", "password": "faux"}, format="json")
        self.assertEqual(r.status_code, 401)

    def test_endpoint_protege_sans_jeton(self):
        self.assertEqual(self.api.get("/api/chambres/").status_code, 401)

    def test_deconnexion_invalide_le_jeton(self):
        token = self.api.post(
            "/api/auth/login/", {"username": "recep", "password": MOT_DE_PASSE}, format="json"
        ).data["token"]
        self.api.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        self.assertEqual(self.api.post("/api/auth/logout/").status_code, 204)
        self.assertEqual(self.api.get("/api/auth/me/").status_code, 401)

    def test_receptionniste_ne_gere_pas_les_utilisateurs(self):
        self.api.force_authenticate(self.recep)
        self.assertEqual(self.api.get("/api/utilisateurs/").status_code, 403)

    def test_admin_cree_un_utilisateur_avec_mot_de_passe_hache(self):
        self.api.force_authenticate(self.admin)
        r = self.api.post("/api/utilisateurs/", {
            "username": "nouveau", "role": "RECEPTIONNISTE", "password": "Un-Bon-Mdp-2026!",
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertNotIn("password", r.data)

    def test_mot_de_passe_faible_refuse(self):
        self.api.force_authenticate(self.admin)
        r = self.api.post("/api/utilisateurs/", {"username": "x", "password": "123"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_admin_ne_peut_pas_se_desactiver(self):
        self.api.force_authenticate(self.admin)
        r = self.api.post(f"/api/utilisateurs/{self.admin.pk}/desactiver/")
        self.assertEqual(r.status_code, 400)
