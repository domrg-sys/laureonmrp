from django.db import models

class OperationsManagementAccess(models.Model):
    class Meta:
        managed = False
        permissions = [
            ("view_operationsmanagement_page", "Can view the main operations management page"),
        ]