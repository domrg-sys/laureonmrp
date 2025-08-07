from django.db import models

class ShopFloorAccess(models.Model):
    class Meta:
        managed = False
        permissions = [
            ("view_shopfloor_page", "Can view the main shop floor page"),
        ]