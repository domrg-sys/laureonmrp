from django.db import models

class SampleControlAccess(models.Model):
    class Meta:
        managed = False
        permissions = [
            ("view_samplecontrol_page", "Can view the main sample control page"),
        ]