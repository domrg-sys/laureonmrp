# domrg-sys/laureonmrp/laureonmrp-my-wip-backup/location_configuration/models.py
"""
This module defines the data models for the Location Configuration application.
These models represent the physical and logical structure of storage locations
within the facility, including their types, hierarchical relationships, and
any grid-based spaces they may contain.
"""

from django.db import models
from django.core.exceptions import ValidationError

# =========================================================================
# === PERMISSION MODELS
# =========================================================================

class LocationConfigurationAccess(models.Model):
    # This is a proxy model used solely to define app-level permissions.
    # It does not create a corresponding database table.
    class Meta:
        managed = False
        permissions = [
            ("view_locationconfiguration_tab", "Can view the main location configuration tab"),
        ]

# =========================================================================
# === CORE MODELS
# =========================================================================

class LocationType(models.Model):
    # Represents a category or template for a physical location, such as
    # 'Building', 'Room', 'Shelf', or 'Pallet'. It defines the rules for
    # how locations of this type can be structured and used.
    name = models.CharField(max_length=100, unique=True)
    icon = models.CharField(max_length=100, blank=True, help_text="e.g., 'warehouse', 'room', 'shelves'")
    
    # Defines the hierarchy rules for location types.
    allowed_parents = models.ManyToManyField(
        'self', 
        blank=True, 
        symmetrical=False, 
        related_name='allowed_children'
    )
    
    # Defines the functional capabilities of locations of this type.
    can_store_inventory = models.BooleanField(default=False)
    can_store_samples = models.BooleanField(default=False)
    
    # Defines the grid structure for locations that have internal spaces.
    has_spaces = models.BooleanField(default=False)
    rows = models.PositiveIntegerField(null=True, blank=True)
    columns = models.PositiveIntegerField(null=True, blank=True)

    def __str__(self):
        return self.name
    
    def get_all_descendants(self, visited=None):
        # Recursively finds all descendant types to prevent circular dependencies.
        # This is crucial for validation in the LocationTypeForm.
        if visited is None:
            visited = set()
        if self in visited:
            return set()
            
        visited.add(self)
        descendants = set()
        for child in self.allowed_children.all():
            descendants.add(child)
            descendants.update(child.get_all_descendants(visited=visited))
            
        return descendants


class Location(models.Model):
    # Represents a specific, unique physical location in the facility,
    # such as 'Building A', 'Lab 101', or 'Shelf 3A'.
    name = models.CharField(max_length=100, unique=True)
    location_type = models.ForeignKey(LocationType, on_delete=models.PROTECT)
    
    # Defines the direct parent-child relationship between locations.
    parent = models.ForeignKey(
        'self', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='children'
    )

    def __str__(self):
        return f"{self.name} ({self.location_type.name})"
    
    def clean(self):
        # This method is Django's hook for model-level validation. It ensures
        # the integrity of the location hierarchy before saving.
        super().clean()
        self._validate_parent_type()
        self._validate_no_circular_dependency()

    def _validate_parent_type(self):
        # Enforces the hierarchy rules defined in the LocationType model.
        if self.parent:
            allowed_parent_types = self.location_type.allowed_parents.all()
            if allowed_parent_types.exists() and self.parent.location_type not in allowed_parent_types:
                raise ValidationError(
                    f"Invalid parent: A '{self.location_type.name}' cannot be "
                    f"placed inside a '{self.parent.location_type.name}'."
                )

    def _validate_no_circular_dependency(self):
        # Prevents a location from being set as its own parent or a child of
        # one of its own descendants, which would create an infinite loop.
        ancestor = self.parent
        while ancestor is not None:
            if ancestor.pk == self.pk:
                raise ValidationError("Circular dependency detected: A location cannot be its own ancestor.")
            ancestor = ancestor.parent


class LocationSpace(models.Model):
    # Represents a single cell within a Location that has a grid layout
    # (i.e., where `has_spaces` is True). This allows for a two-tiered
    # containment model: a location can contain other locations either
    # directly (parent-child) or via spaces.
    parent_location = models.ForeignKey(
        Location, 
        on_delete=models.CASCADE, 
        related_name='spaces'
    )
    row = models.PositiveIntegerField()
    column = models.PositiveIntegerField()
    
    # A space can hold one child location.
    child_location = models.OneToOneField(
        Location,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='occupied_space'
    )

    class Meta:
        # Ensures that each cell within a parent location is unique.
        unique_together = ('parent_location', 'row', 'column')

    def __str__(self):
        return f"{self.parent_location.name} (R{self.row}, C{self.column})"
    
    def clean(self):
        # Validates that a location placed inside a space is of a type
        # that is allowed by the parent location's type.
        if self.child_location:
            parent_type = self.parent_location.location_type
            child_type = self.child_location.location_type
            
            allowed_child_types = parent_type.allowed_children.all()
            if allowed_child_types.exists() and child_type not in allowed_child_types:
                raise ValidationError(
                    f"Invalid child: A '{child_type.name}' cannot be placed in a "
                    f"space within a '{parent_type.name}'."
                )