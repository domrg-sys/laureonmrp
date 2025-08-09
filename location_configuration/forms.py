from django import forms
from .models import LocationType, Location

ICON_CHOICES = [
    # --- Buildings & Rooms ---
    ('warehouse', 'Warehouse'),
    ('factory', 'Factory'),
    ('corporate_fare', 'Building'),
    ('home_work', 'Office / Site'),
    ('store', 'Storefront / Shop'),
    ('room', 'Room (Generic)'),
    ('door_front', 'Door / Entrance'),
    ('domain', 'Building2'),
    ('house', 'House'),
    ('garage_door', 'Loading Dock'),
    ('science', 'Lab'),

    # --- Storage & Containers ---
    ('shelves', 'Shelves'),
    ('pallet', 'Pallet'),
    ('inventory_2', 'Inventory Box'),
    ('package', 'Package / Box'),
    ('kitchen', 'Fridge'),
    ('ac_unit', "Cold Storage"),
    ('package_2', 'Box 2'),
    ('lock', 'Secure'),
    ('orders', 'Open Box'),

    # --- Grids & Layouts ---
    ('grid_view', 'Grid View'),
    ('view_module', 'Module View'),
    ('table_rows', 'Table Rows'),
    ('window', 'Window / Pane'),
]

class LocationTypeForm(forms.ModelForm):
    """
    Form for creating and updating LocationType instances.
    """
    icon = forms.ChoiceField(
        choices=ICON_CHOICES,
        required=False,
        label="Icon",
        widget=forms.Select(attrs={'class': 'js-choice-icon-picker'}),
    )

    class Meta:
        model = LocationType
        fields = ['name', 'icon', 'allowed_parents', 'can_store_inventory', 'can_store_samples', 'has_spaces', 'rows', 'columns']
        widgets = {
            'allowed_parents': forms.CheckboxSelectMultiple(),
        }

    def clean(self):
        """
        Custom validation for the form.
        """
        cleaned_data = super().clean()
        has_spaces = cleaned_data.get("has_spaces")
        rows = cleaned_data.get("rows")
        columns = cleaned_data.get("columns")

        if has_spaces:
            # If "Has Spaces" is checked, both rows and columns must have a value.
            if not rows:
                self.add_error('rows', "This field is required when 'Has Spaces' is checked.")
            if not columns:
                self.add_error('columns', "This field is required when 'Has Spaces' is checked.")
        
        return cleaned_data

class EditLocationTypeForm(LocationTypeForm):
    """
    A form for editing an existing LocationType.
    It inherits from the main form and applies conditional logic to its fields.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        instance = kwargs.get('instance')

        if instance and instance.pk:
            # --- START: LOGIC TO HIDE INVALID PARENTS ---
            
            # 1. Get all descendants of the current location type.
            descendants = instance.get_all_descendants()
            
            # 2. Create a set of IDs to exclude: the instance itself and all its descendants.
            ids_to_exclude = {instance.pk} | {desc.pk for desc in descendants}
            
            # 3. Filter the queryset for the 'allowed_parents' field.
            self.fields['allowed_parents'].queryset = LocationType.objects.exclude(pk__in=ids_to_exclude)

            # --- END: LOGIC TO HIDE INVALID PARENTS ---

            # Check if the location type is in use by any location.
            is_in_use = instance.location_set.exists()

            if is_in_use:
                # If it's in use, disable the name and has_spaces fields.
                self.fields['name'].disabled = True
                self.fields['has_spaces'].disabled = True

    def clean_name(self):
        # If the name field is disabled, its value won't be in cleaned_data.
        # We return the original name from the instance to prevent it from being changed.
        if self.fields['name'].disabled:
            return self.instance.name
        return self.cleaned_data.get('name')

    def clean_has_spaces(self):
        # If the 'has_spaces' field is disabled, return its original value.
        if self.fields['has_spaces'].disabled:
            return self.instance.has_spaces
        return self.cleaned_data.get('has_spaces')
    
    def clean(self):
        """
        Custom validation to prevent circular dependencies in the hierarchy.
        """
        cleaned_data = super().clean()
        selected_parents = cleaned_data.get('allowed_parents')

        if self.instance and selected_parents:
            # Check 1: A type cannot be its own parent.
            if self.instance in selected_parents:
                raise forms.ValidationError("A location type cannot be its own parent.")

            # Check 2: A type's parent cannot be one of its own descendants.
            descendants = self.instance.get_all_descendants()
            for parent in selected_parents:
                if parent in descendants:
                    raise forms.ValidationError(
                        f"Circular dependency detected: You cannot set '{parent.name}' as a parent, "
                        f"because it is a descendant of this type."
                    )
        
        return cleaned_data