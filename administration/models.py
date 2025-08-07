from django.db import models

class AdministrationAccess(models.Model):
    class Meta:
        managed = False
        permissions = [
            ("view_administration_page", "Can view the main administration page"),
        ]