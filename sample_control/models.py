from django.db import models
from django.core.exceptions import ValidationError
from location_configuration.models import Location, LocationSpace

class SampleControlAccess(models.Model):
    class Meta:
        managed = False
        permissions = [
            ("view_samplecontrol_page", "Can view the main sample control page"),
        ]

class Sample(models.Model):
    name = models.CharField(max_length=100, unique=True)
    location = models.ForeignKey(
        Location,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        limit_choices_to={'location_type__can_store_samples': True},
        help_text="Directly stored in this location (not in a space)."
    )
    space = models.OneToOneField(
        LocationSpace,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sample',
        help_text="Stored in a specific space within a location."
    )

    def __str__(self):
        return self.name

    def clean(self):
        """
        Ensures a sample is not in both a location and a space simultaneously.
        """
        if self.location and self.space:
            raise ValidationError("A sample cannot be assigned to both a direct location and a space.")
        if not self.location and not self.space:
            raise ValidationError("A sample must be assigned to either a location or a space.")

    @property
    def current_location(self):
        """Returns the top-level location of the sample."""
        if self.space:
            return self.space.parent_location
        return self.location