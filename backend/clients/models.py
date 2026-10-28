from django.db import models


class Client(models.Model):
    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    email = models.EmailField(unique=True, null=True, blank=True)  # NULL autorisé : plusieurs clients sans e-mail
    telephone = models.CharField(max_length=20)
    adresse = models.CharField(max_length=255, blank=True)
    piece_identite = models.CharField(max_length=50, blank=True)  # donnée sensible : réservée aux administrateurs
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nom", "prenom"]
        constraints = [
            # Anti-doublon : même identité + même téléphone = même client
            models.UniqueConstraint(fields=["nom", "prenom", "telephone"], name="client_identite_unique"),
        ]

    def __str__(self):
        return f"{self.nom} {self.prenom}"
