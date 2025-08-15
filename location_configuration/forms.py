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

class LocationTypeForm(forms.ModelForm):
    # A form for creating and updating LocationType instances. It contains
    # dynamic logic that changes its behavior when editing an existing instance.
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

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Only apply special logic if the form is bound to an existing instance.
        if self.instance and self.instance.pk:
            self._configure_parent_choices()
            self._disable_fields_if_in_use()

    def _configure_parent_choices(self):
        # Disables parent choices that would create a circular dependency
        # or are part of an existing, in-use relationship.
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
        # If a LocationType is used by any Location, certain fields that define
        # its fundamental structure (like its grid) are locked to prevent data corruption.
        if self.instance.location_set.exists():
            self.fields['has_spaces'].disabled = True
            self.fields['rows'].disabled = True
            self.fields['columns'].disabled = True

    def clean(self):
        # This orchestrates all form-wide validation steps.
        super().clean()
        self._validate_name_uniqueness()
        self._validate_grid_fields()
        return self.cleaned_data

    def _validate_name_uniqueness(self):
        # Ensures that no two LocationTypes have the same name (case-insensitive).
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
        # Ensures that if 'Has Spaces' is checked, both rows and columns are provided.
        if self.cleaned_data.get("has_spaces"):
            if not self.cleaned_data.get("rows"):
                self.add_error('rows', "This field is required when 'Has Spaces' is checked.")
            if not self.cleaned_data.get("columns"):
                self.add_error('columns', "This field is required when 'Has Spaces' is checked.")

    def clean_allowed_parents(self):
        # Provides a backend safeguard to ensure that an in-use parent relationship
        # cannot be removed, even if the form submission is tampered with.
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


class LocationForm(forms.ModelForm):
    # A form for creating and updating Location instances. It dynamically adjusts
    # the available 'location_type' choices based on the selected parent.
    class Meta:
        model = Location
        fields = ['name', 'location_type', 'parent']

    def __init__(self, *args, **kwargs):
        form_type = kwargs.pop('form_type', None)
        super().__init__(*args, **kwargs)
        self.fields['parent'].required = False
        # If this form is specifically for adding a child, start with an empty
        # queryset. The frontend JS will populate the correct options.
        if form_type == 'add_child':
            self.fields['location_type'].queryset = LocationType.objects.none()
        else:
            # Otherwise, use the original logic to determine choices.
            self._filter_location_type_choices()
        self._disable_fields_if_has_children()

    def _filter_location_type_choices(self):
        # Determines the correct queryset for the 'location_type' field based
        # on whether the location is a top-level location or a child.
        parent_id = self.data.get('parent') if 'parent' in self.data else self.initial.get('parent')
        
        if parent_id:
            try:
                parent_location = Location.objects.get(pk=parent_id)
                self.fields['location_type'].queryset = parent_location.location_type.allowed_children.all()
            except (Location.DoesNotExist, ValueError, TypeError):
                self.fields['location_type'].queryset = LocationType.objects.none()
        else:
            # If no parent, only show types that can be top-level.
            self.fields['location_type'].queryset = LocationType.objects.filter(allowed_parents__isnull=True)
    
    def _disable_fields_if_has_children(self):
        # If a Location has children, its own type cannot be changed, as this
        # could break the parent-child relationship rules.
        if self.instance and self.instance.pk and self.instance.children.exists():
            self.fields['location_type'].disabled = True
            self.fields['location_type'].help_text = "This location has children, so its type cannot be changed."

    def clean(self):
        # Orchestrates form-wide validation.
        super().clean()
        self._validate_name_uniqueness()
        return self.cleaned_data
    
    def _validate_name_uniqueness(self):
        # Ensures that no two Locations have the same name (case-insensitive).
        name = self.cleaned_data.get('name')
        if not name:
            return
            
        queryset = Location.objects.filter(name__iexact=name)
        if self.instance and self.instance.pk:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise forms.ValidationError(
                f"A location with the name '{name}' already exists."
            )

    def clean_location_type(self):
        # A safeguard to prevent changing the location_type if the field is disabled.
        if self.fields.get('location_type') and self.fields['location_type'].disabled:
            return self.instance.location_type
        return self.cleaned_data.get('location_type')