from django import forms
from .models import LocationType, Location

# =========================================================================
# === CUSTOM WIDGETS
# =========================================================================

class DisabledOptionsCheckboxSelectMultiple(forms.CheckboxSelectMultiple):
    # A custom widget that disables specific checkboxes in a multi-select field.
    # This is used to prevent users from making invalid changes, such as creating
    # circular dependencies in the LocationType hierarchy.
    def __init__(self, *args, **kwargs):
        self.disabled_choices = set(kwargs.pop('disabled_choices', []))
        super().__init__(*args, **kwargs)

    def create_option(self, name, value, label, selected, index, subindex=None, attrs=None):
        option_dict = super().create_option(name, value, label, selected, index, subindex, attrs)
        if value in self.disabled_choices:
            option_dict['attrs']['disabled'] = True
        return option_dict

# =========================================================================
# === CHOICES
# =========================================================================

# Defines the available icons for LocationType instances.
ICON_CHOICES = [
    ('warehouse', 'Warehouse'), ('factory', 'Factory'), ('corporate_fare', 'Building'),
    ('home_work', 'Office / Site'), ('store', 'Storefront / Shop'), ('room', 'Room (Generic)'),
    ('door_front', 'Door / Entrance'), ('domain', 'Building2'), ('house', 'House'),
    ('garage_door', 'Loading Dock'), ('science', 'Lab'), ('shelves', 'Shelves'),
    ('pallet', 'Pallet'), ('inventory_2', 'Inventory Box'), ('package', 'Package / Box'),
    ('kitchen', 'Fridge'), ('ac_unit', "Cold Storage"), ('package_2', 'Box 2'),
    ('lock', 'Secure'), ('orders', 'Open Box'), ('grid_view', 'Grid View'),
    ('view_module', 'Module View'), ('table_rows', 'Table Rows'), ('window', 'Window / Pane'),
]

# =========================================================================
# === FORMS
# =========================================================================

class BaseLocationTypeForm(forms.ModelForm):
    """
    A base form containing shared fields and validation for all location type forms.
    """
    icon = forms.ChoiceField(
        choices=ICON_CHOICES,
        required=False,
        label="Icon",
        widget=forms.Select(attrs={'class': 'js-choice-icon-picker'}),
    )

    class Meta:
        model = LocationType
        fields = [
            'name', 'icon', 'allowed_parents', 'can_store_inventory', 
            'can_store_samples', 'has_spaces', 'rows', 'columns'
        ]
        widgets = {
            'allowed_parents': forms.CheckboxSelectMultiple(),
        }

    def clean(self):
        """Orchestrates all form-wide validation."""
        super().clean()
        self._validate_name_uniqueness()
        self._validate_grid_fields()
        return self.cleaned_data

    def _validate_name_uniqueness(self):
        """Ensures that no two LocationTypes have the same name (case-insensitive)."""
        name = self.cleaned_data.get('name')
        if not name:
            return
            
        queryset = LocationType.objects.filter(name__iexact=name)
        if self.instance and self.instance.pk:
            queryset = queryset.exclude(pk=self.instance.pk)
        
        if queryset.exists():
            raise forms.ValidationError(
                f"A location type with the name '{name}' already exists."
            )

    def _validate_grid_fields(self):
        """Ensures that if 'Has Spaces' is checked, both rows and columns are provided."""
        if self.cleaned_data.get("has_spaces"):
            if not self.cleaned_data.get("rows"):
                self.add_error('rows', "This field is required when 'Has Spaces' is checked.")
            if not self.cleaned_data.get("columns"):
                self.add_error('columns', "This field is required when 'Has Spaces' is checked.")


class AddLocationTypeForm(BaseLocationTypeForm):
    """A simple, focused form for creating a new location type."""
    pass # Inherits all necessary functionality from the base form without changes.


class EditLocationTypeForm(BaseLocationTypeForm):
    """
    A form for editing an existing location type, with logic to handle
    dependencies and prevent invalid changes.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Only apply special logic if the form is bound to an existing instance.
        if self.instance and self.instance.pk:
            self._configure_parent_choices()
            self._disable_fields_if_in_use()

    def _configure_parent_choices(self):
        """
        Disables parent choices that would create a circular dependency
        or are part of an existing, in-use relationship.
        """
        descendants = self.instance.get_all_descendants()
        circular_dependency_ids = {self.instance.pk} | {d.pk for d in descendants}
        
        in_use_parent_ids = set(
            Location.objects.filter(location_type=self.instance, parent__isnull=False)
            .values_list('parent__location_type_id', flat=True)
            .distinct()
        )
        
        ids_to_disable = circular_dependency_ids.union(in_use_parent_ids)

        self.fields['allowed_parents'].widget = DisabledOptionsCheckboxSelectMultiple(
            disabled_choices=ids_to_disable
        )
        self.fields['allowed_parents'].help_text = (
            "Parents that are in use or would create a circular dependency cannot be changed."
        )

    def _disable_fields_if_in_use(self):
        """
        If a LocationType is used by any Location, certain fields that define
        its fundamental structure (like its grid) are locked to prevent data corruption.
        """
        if self.instance.location_set.exists():
            self.fields['has_spaces'].disabled = True
            self.fields['rows'].disabled = True
            self.fields['columns'].disabled = True

    def clean_allowed_parents(self):
        """
        Provides a backend safeguard to ensure that an in-use parent relationship
        cannot be removed, even if the form submission is tampered with.
        """
        if self.instance and self.instance.pk:
            in_use_parent_ids = set(
                Location.objects.filter(location_type=self.instance, parent__isnull=False)
                .values_list('parent__location_type_id', flat=True)
                .distinct()
            )
            submitted_parents = self.cleaned_data.get('allowed_parents', LocationType.objects.none())
            submitted_parent_ids = {p.id for p in submitted_parents}
            
            # If a required parent is missing from the submission, add it back.
            missing_in_use_ids = in_use_parent_ids - submitted_parent_ids
            if missing_in_use_ids:
                missing_parents = LocationType.objects.filter(pk__in=missing_in_use_ids)
                return submitted_parents | missing_parents

        return self.cleaned_data.get('allowed_parents')


class BaseLocationForm(forms.ModelForm):
    """
    A base form containing shared logic for all location forms,
    specifically for ensuring location names are unique.
    """
    class Meta:
        model = Location
        fields = ['name', 'location_type', 'parent']

    def clean_name(self):
        """Ensures that no two Locations have the same name (case-insensitive)."""
        name = self.cleaned_data.get('name')
        if not name:
            return name

        queryset = Location.objects.filter(name__iexact=name)
        # If we are editing an existing instance, exclude it from the check.
        if self.instance and self.instance.pk:
            queryset = queryset.exclude(pk=self.instance.pk)
        
        if queryset.exists():
            raise forms.ValidationError(
                f"A location with the name '{name}' already exists."
            )
        return name


class AddTopLevelLocationForm(BaseLocationForm):
    """A simple form for adding a new top-level location."""
    class Meta(BaseLocationForm.Meta):
        # Only include the name and type. The parent is null for top-level locations.
        fields = ['name', 'location_type']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Only show location types that can be a top level (no parents allowed).
        self.fields['location_type'].queryset = LocationType.objects.filter(
            allowed_parents__isnull=True
        )


class AddChildLocationForm(BaseLocationForm):
    """A form for adding a new location as a child of another."""
    parent_name = forms.CharField(label="Parent Location", required=False)

    class Meta(BaseLocationForm.Meta):
        # We need all three fields for this form's logic.
        fields = ['name', 'location_type', 'parent', 'parent_name']

    def __init__(self, *args, **kwargs):
        # The parent is passed in as an initial value from the view.
        parent = kwargs.get('initial', {}).get('parent')
        super().__init__(*args, **kwargs)

        # Configure the parent fields for display and submission.
        self.fields['parent'].widget = forms.HiddenInput()
        self.fields['parent_name'].widget.attrs['disabled'] = True
        if parent:
            self.fields['parent_name'].initial = parent.name
            # The queryset for location_type depends on the parent.
            self.fields['location_type'].queryset = parent.location_type.allowed_children.all()
        else:
            # If for some reason no parent is provided, show no types.
            self.fields['location_type'].queryset = LocationType.objects.none()


class EditLocationForm(BaseLocationForm):
    """A form for editing an existing location."""
    parent_name = forms.CharField(label="Parent Location", required=False)

    class Meta(BaseLocationForm.Meta):
        fields = ['name', 'location_type', 'parent', 'parent_name']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # Only run this logic if the form is bound to a real, saved instance.
        if self.instance and self.instance.pk:
            location = self.instance

            # The parent field is hidden; its value comes from the instance.
            self.fields['parent'].widget = forms.HiddenInput()
            
            # Configure the location_type field.
            if location.children.exists():
                self.fields['location_type'].disabled = True
                self.fields['location_type'].help_text = "This location has children, so its type cannot be changed."

            # Configure the parent_name display field.
            if location.parent:
                self.fields['parent_name'].widget.attrs['disabled'] = True
                self.fields['parent_name'].initial = location.parent.name
                # Set the valid location types based on the actual parent.
                self.fields['location_type'].queryset = location.parent.location_type.allowed_children.all()
            else:
                # If it's a top-level location, we don't need parent fields.
                if 'parent' in self.fields:
                    del self.fields['parent']
                if 'parent_name' in self.fields:
                    del self.fields['parent_name']
                # Set valid types for top-level locations.
                self.fields['location_type'].queryset = LocationType.objects.filter(
                    allowed_parents__isnull=True
                )

    def clean_location_type(self):
        """A safeguard to prevent changing the type if the field is disabled."""
        if self.fields['location_type'].disabled:
            return self.instance.location_type
        return self.cleaned_data.get('location_type')