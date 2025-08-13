from django import forms
from .models import LocationType, Location

# --- WIDGETS ---

class DisabledOptionsCheckboxSelectMultiple(forms.CheckboxSelectMultiple):
    """
    A custom checkbox widget that grays out and disables specific choices.
    This is used to prevent users from selecting invalid parents in edit mode.
    """
    def __init__(self, *args, **kwargs):
        # Accept a custom 'disabled_choices' argument and store it.
        self.disabled_choices = set(kwargs.pop('disabled_choices', []))
        super().__init__(*args, **kwargs)

    def create_option(self, name, value, label, selected, index, subindex=None, attrs=None):
        # Get the default option attributes from the parent class.
        option_dict = super().create_option(name, value, label, selected, index, subindex, attrs)
        
        # If this specific choice is in our disabled set, add the 'disabled' HTML attribute.
        if value in self.disabled_choices:
            option_dict['attrs']['disabled'] = True
            
        return option_dict

# --- CHOICES ---

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


# --- FORMS ---

class LocationTypeForm(forms.ModelForm):
    """
    A single, intelligent form for both creating and updating LocationType instances.
    It adjusts its fields and validation based on whether it's in 'add' or 'edit' mode.
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
            # Note: This widget will be replaced dynamically in __init__ when in edit mode.
            'allowed_parents': forms.CheckboxSelectMultiple(),
        }

    def __init__(self, *args, **kwargs):
        """
        Applies conditional logic if the form is in 'edit' mode (i.e., bound to an instance).
        """
        super().__init__(*args, **kwargs)

        # This logic only runs if the form is bound to an existing instance.
        if self.instance and self.instance.pk:
            
            # 1. Gray out invalid parent choices to prevent circular dependencies.
            descendants = self.instance.get_all_descendants()
            ids_to_disable = {self.instance.pk} | {desc.pk for desc in descendants}
            
            self.fields['allowed_parents'].widget = DisabledOptionsCheckboxSelectMultiple(
                disabled_choices=ids_to_disable
            )

            # 2. Disable other fields if the type is already in use by a location.
            if self.instance.location_set.exists():
                self.fields['name'].disabled = True
                self.fields['has_spaces'].disabled = True

    def clean_name(self):
        """
        Ensures the name is not changed if the field is disabled.
        """
        if self.fields.get('name') and self.fields['name'].disabled:
            return self.instance.name
        return self.cleaned_data.get('name')

    def clean_has_spaces(self):
        """
        Ensures the 'has_spaces' value is not changed if the field is disabled.
        """
        if self.fields.get('has_spaces') and self.fields['has_spaces'].disabled:
            return self.instance.has_spaces
        return self.cleaned_data.get('has_spaces')

    def clean(self):
        """
        Handles all validation for both 'add' and 'edit' modes.
        """
        cleaned_data = super().clean()
        
        # Validation for grid spaces (runs in both modes).
        has_spaces = cleaned_data.get("has_spaces")
        if has_spaces:
            if not cleaned_data.get("rows"):
                self.add_error('rows', "This field is required when 'Has Spaces' is checked.")
            if not cleaned_data.get("columns"):
                self.add_error('columns', "This field is required when 'Has Spaces' is checked.")

        # Validation for parent hierarchy (only relevant in edit mode, but harmless in add mode).
        if self.instance and self.instance.pk:
            selected_parents = cleaned_data.get('allowed_parents')
            if selected_parents:
                # This check prevents a user from making a type a child of its own descendant.
                # It serves as a backend safeguard in case the 'disabled' attribute is bypassed.
                descendants = self.instance.get_all_descendants()
                for parent in selected_parents:
                    if parent in descendants:
                        raise forms.ValidationError(
                            f"Circular dependency detected: You cannot set '{parent.name}' as a parent."
                        )
        
        return cleaned_data
    
class LocationForm(forms.ModelForm):
    class Meta:
        model = Location
        fields = ['name', 'location_type', 'parent']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['parent'].required = False
        parent_id = None

        # On POST, the parent is in self.data, not self.initial
        if 'parent' in self.data:
            try:
                parent_id = int(self.data.get('parent'))
            except (ValueError, TypeError):
                parent_id = None
        elif 'parent' in self.initial:
            parent_id = self.initial.get('parent')

        if parent_id:
            try:
                parent_location = Location.objects.get(pk=parent_id)
                self.fields['location_type'].queryset = parent_location.location_type.allowed_children.all()
            except Location.DoesNotExist:
                self.fields['location_type'].queryset = LocationType.objects.none()
        else:
            # No parent, so these are top-level locations
            self.fields['location_type'].queryset = LocationType.objects.filter(allowed_parents__isnull=True)