from django.db import models

class InventoryControlAccess(models.Model):
    class Meta:
        managed = False
        permissions = [
            ("view_inventorycontrol_page", "Can view the main inventory control page"),
        ]