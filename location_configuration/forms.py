from django import forms
from .models import LocationType

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
    It inherits from the main form but makes the 'name' field readonly.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['name'].disabled = True