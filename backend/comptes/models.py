from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Utilisateur de l'application, avec un rôle métier."""

    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Administrateur"
        RECEPTIONNISTE = "RECEPTIONNISTE", "Réceptionniste"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.RECEPTIONNISTE)

    def save(self, *args, **kwargs):
        # Un superutilisateur (createsuperuser) est toujours administrateur de l'application.
        if self.is_superuser:
            self.role = self.Role.ADMIN
        super().save(*args, **kwargs)

    @property
    def est_admin(self):
        return self.role == self.Role.ADMIN
