from django.db import models
from django.core.exceptions import ValidationError

class LocationConfigurationAccess(models.Model):
    """
    Proxy model to hold app-level permissions without creating a database table.
    """
    class Meta:
        managed = False
        permissions = [
            ("view_locationconfiguration_tab", "Can view the main location configuration tab"),
        ]

class LocationType(models.Model):
    name = models.CharField(max_length=100, unique=True)
    icon = models.CharField(max_length=100, blank=True, help_text="e.g., 'warehouse', 'room', 'freezer'")
    allowed_parents = models.ManyToManyField('self', blank=True, symmetrical=False, related_name='allowed_children')
    can_store_inventory = models.BooleanField(default=False)
    can_store_samples = models.BooleanField(default=False)
    has_spaces = models.BooleanField(default=False)
    rows = models.PositiveIntegerField(null=True, blank=True, help_text="Number of rows for the spaces grid")
    columns = models.PositiveIntegerField(null=True, blank=True, help_text="Number of columns for the spaces grid")

    def __str__(self):
        return self.name
    
    def get_all_descendants(self, visited=None):
        """
        Recursively finds all descendant types for the current instance,
        while keeping track of visited nodes to prevent infinite loops in
        case of circular dependencies.
        """
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
    name = models.CharField(max_length=100)
    location_type = models.ForeignKey(LocationType, on_delete=models.PROTECT)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')

    def __str__(self):
        return f"{self.name} ({self.location_type.name})"
    
    def clean(self):
        """
        Ensures the integrity of the Location instance hierarchy and relationships.
        """
        # Prevents a location from being its own parent.
        if self.parent == self:
            raise ValidationError("A location cannot be its own parent.")

        # Prevents nesting a location under one of its own descendants.
        if self.parent:
            # Simple check to prevent immediate circular reference
            if self.parent == self:
                 raise ValidationError("A location cannot be its own parent.")
            # Deeper check for multi-level circular reference
            ancestor = self.parent
            while ancestor is not None:
                if ancestor == self:
                    raise ValidationError("Circular dependency detected: You cannot set a location's parent to one of its own descendants.")
                ancestor = ancestor.parent
        
        # Enforces the allowed parent types defined in the LocationType model.
        if self.parent:
            allowed_parent_types = self.location_type.allowed_parents.all()
            if allowed_parent_types.exists() and self.parent.location_type not in allowed_parent_types:
                raise ValidationError(f"Invalid parent: A '{self.location_type.name}' cannot be placed inside a '{self.parent.location_type.name}'.")
        
        # Prevents a location from having a direct parent and being in a space.
        if self.parent and hasattr(self, 'occupied_space') and self.occupied_space is not None:
            raise ValidationError("A location cannot have a direct parent and be assigned to a space at the same time.")

    def get_all_descendants(self):
        """
        Recursively finds all descendants, traversing both the direct parent/child
        hierarchy and the space containment hierarchy.
        """
        descendants = set()

        # Traverse the explicit parent/child relationship.
        for child in self.children.all():
            descendants.add(child)
            descendants.update(child.get_all_descendants())
        
        # Traverse the implicit relationship of locations stored in spaces.
        if hasattr(self, 'spaces'):
            occupied_spaces = self.spaces.filter(child_location__isnull=False)
            for space in occupied_spaces:
                contained_child = space.child_location
                if contained_child:
                    descendants.add(contained_child)
                    descendants.update(contained_child.get_all_descendants())

        return descendants
    
class LocationSpace(models.Model):
    parent_location = models.ForeignKey(
        Location, 
        on_delete=models.CASCADE, 
        related_name='spaces'
    )
    row = models.PositiveIntegerField()
    column = models.PositiveIntegerField()
    child_location = models.OneToOneField(
        Location,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='occupied_space'
    )

    class Meta:
        unique_together = ('parent_location', 'row', 'column')

    def __str__(self):
        return f"{self.parent_location.name} (R{self.row}, C{self.column})"
    
    def clean(self):
        """
        Ensures that a location placed in this space has a valid type.
        """
        if self.child_location:
            parent_type = self.parent_location.location_type
            child_type = self.child_location.location_type
            
            # Check if the child's type is in the list of types allowed to be children of the parent's type.
            allowed_child_types = LocationType.objects.filter(allowed_parents=parent_type)
            if allowed_child_types.exists() and child_type not in allowed_child_types:
                raise ValidationError(f"Invalid child: A '{child_type.name}' cannot be placed in a space within a '{parent_type.name}'.")