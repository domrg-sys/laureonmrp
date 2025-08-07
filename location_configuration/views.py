from django.shortcuts import render, redirect
from django.contrib.auth.decorators import permission_required
from django.urls import reverse
from .models import Location, LocationType, LocationSpace
from django import forms
from django.utils.safestring import mark_safe

# This list defines the tabs for the entire "Location Configuration" section.
TABS = [
    {
        'slug': 'locations',
        'label': 'Locations',
        'url_name': 'location_configuration:locations_tab'
    },
    {
        'slug': 'types',
        'label': 'Location Types',
        'url_name': 'location_configuration:types_tab'
    },
]

# --- A helper function to prepare the tabs ---
def _prepare_tabs_context(active_tab_slug):
    """
    A helper to generate the context for the tabs, including the final URLs.
    This avoids repeating the same logic in every view.
    """
    # This loop generates the final URLs for the tabs
    for tab in TABS:
        tab['url'] = reverse(tab['url_name'])
    
    return {
        'tabs': TABS,
        'active_tab': active_tab_slug,
    }

# --- VIEW 1: For the "Locations" Tab ---
@permission_required('location_configuration.view_locationconfiguration_tab', raise_exception=True)
def locations_tab_view(request):
    context = _prepare_tabs_context('locations')
    return render(request, 'location_configuration/locations_tab.html', context)

ICON_CHOICES = [
    ('', '---------'),
    ('warehouse', 'Warehouse'),
    ('factory', 'Factory'),
    ('room', 'Room'),
    ('door_front', 'Door'),
    ('shelves', 'Shelves'),
    ('freezer', 'Freezer'),
    ('conveyor_belt', 'Conveyor Belt'),
    ('science', 'Laboratory'),
    ('biotech', 'Biotech'),
    ('location_on', 'Generic Pin'),
]

# --- Form for LocationType ---
class LocationTypeForm(forms.ModelForm):
    # Explicitly define the 'icon' field to ensure it becomes a dropdown.
    icon = forms.ChoiceField(
        choices=ICON_CHOICES,
        required=False,
        label="Icon",
        widget=forms.Select(attrs={'id': 'icon-picker'})
    )

    class Meta:
        model = LocationType
        # The 'icon' field is now defined above, so it's handled.
        fields = ['name', 'icon', 'allowed_parents', 'can_store_inventory', 'can_store_samples', 'has_spaces', 'rows', 'columns']
        widgets = {
            'allowed_parents': forms.CheckboxSelectMultiple(),
        }

# --- VIEW 2: For the "Location Types" Tab ---
@permission_required('location_configuration.view_locationconfiguration_tab', raise_exception=True)
def location_types_tab_view(request):
    if request.method == 'POST':
        form = LocationTypeForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('location_configuration:types_tab')
    else:
        form = LocationTypeForm()

    context = _prepare_tabs_context('types')
    context['form'] = form

    context['table_headers'] = [
        'Name', 'Icon', 'Allowed Parents', 'Stores Inventory',
        'Stores Samples', 'Has Spaces', 'Grid', 'Actions'
    ]

    location_types = LocationType.objects.prefetch_related('allowed_parents').all()

    table_rows = []
    for type_obj in location_types:
        parent_names = ", ".join([p.name for p in type_obj.allowed_parents.all()]) or "—"
        if type_obj.rows and type_obj.columns:
            grid_display = f"{type_obj.rows}x{type_obj.columns}"
        else:
            grid_display = "—"

        def get_checkbox_html(checked):
            return mark_safe('<input type="checkbox" disabled {}>'.format('checked' if checked else ''))

        actions = []

        # Check if the user has the 'change' (edit) permission for the LocationType model
        if request.user.has_perm('location_configuration.change_locationtype'):
            actions.append({'url': '#', 'icon': 'edit', 'label': 'Edit', 'class': 'btn-icon-blue'})
        else:
            actions.append({'icon': 'edit', 'label': 'Edit', 'class': 'btn-icon-disabled'})

        # Check if the user has the 'delete' permission for the LocationType model
        if request.user.has_perm('location_configuration.delete_locationtype'):
            actions.append({'url': '#', 'icon': 'delete', 'label': 'Delete', 'class': 'btn-icon-red'})
        else:
            actions.append({'icon': 'delete', 'label': 'Delete', 'class': 'btn-icon-disabled'})

        row = {
            'cells': [
                type_obj.name,
                type_obj.icon or "—",
                parent_names,
                get_checkbox_html(type_obj.can_store_inventory),
                get_checkbox_html(type_obj.can_store_samples), 
                get_checkbox_html(type_obj.has_spaces), 
                grid_display, 
            ],
            'actions': [
                {'url': '#', 'icon': 'edit', 'label': 'Edit', 'class': 'btn-icon-blue'},
                {'url': '#', 'icon': 'delete', 'label': 'Delete', 'class': 'btn-icon-red'},
            ]
        }
        table_rows.append(row)
    
    context['table_rows'] = table_rows

    return render(request, 'location_configuration/types_tab.html', context)