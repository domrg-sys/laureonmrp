"""
Handles the HTTP requests for the Location Configuration application.

This module is architected to support a dynamic, AJAX-driven frontend. It separates
views into three distinct categories:
1.  Page-Rendering Views (GET): Class-based views that render the main tabs.
2.  Form-Handling Views (POST): Class-based views that process AJAX form
    submissions and return JSON responses.
3.  API-like Views (GET): Function-based views that provide data to the frontend,
    such as populating dropdowns.
"""

import json
from collections import deque
from django.contrib.auth.mixins import PermissionRequiredMixin
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils.safestring import mark_safe
from django.views.generic import TemplateView
from django.views import View

from .forms import AddLocationTypeForm, EditLocationTypeForm, AddTopLevelLocationForm, AddChildLocationForm, EditLocationForm
from .models import Location, LocationType

# =========================================================================
# === 1. CONFIGURATION & HELPERS
# =========================================================================

# Defines the navigation structure for the tabs on the main page.
TABS = [
    {'slug': 'locations', 'label': 'Locations', 'url_name': 'location_configuration:locations_tab'},
    {'slug': 'types', 'label': 'Location Types', 'url_name': 'location_configuration:types_tab'},
]

def _prepare_tabs_context(active_tab_slug):
    """Builds the context dictionary required by the tab navigator component."""
    tabs_with_urls = [{**tab, 'url': reverse(tab['url_name'])} for tab in TABS]
    return {'tabs': tabs_with_urls, 'active_tab': active_tab_slug}

# =========================================================================
# === 2. PAGE-RENDERING VIEWS (GET REQUESTS)
# =========================================================================

class LocationsTabView(PermissionRequiredMixin, TemplateView):
    """Renders the 'Locations' tab, including its forms and location tree."""
    permission_required = 'location_configuration.view_locationconfiguration_tab'
    template_name = 'location_configuration/locations_tab.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(_prepare_tabs_context('locations'))
        
        # Use the new, specialized forms. Their names clearly state their purpose.
        context['add_location_form'] = AddTopLevelLocationForm()
        context['add_child_form'] = AddChildLocationForm()
        context['edit_location_form'] = EditLocationForm() # This form is just a placeholder here
        
        context['top_level_locations'] = Location.objects.filter(parent__isnull=True)
        context['can_delete_location'] = self.request.user.has_perm('location_configuration.delete_location')
        return context


class LocationTypesTabView(PermissionRequiredMixin, TemplateView):
    """Renders the 'Location Types' tab, including its forms and data table."""
    permission_required = 'location_configuration.view_locationconfiguration_tab'
    template_name = 'location_configuration/types_tab.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(_prepare_tabs_context('types'))
        
        context['add_form'] = AddLocationTypeForm()
        context['edit_form'] = EditLocationTypeForm() # This is a placeholder for the modal

        context['table_headers'] = [
            'Name', 'Icon', 'Allowed Parents', 'Stores Inventory',
            'Stores Samples', 'Has Spaces', 'Grid', 'Actions'
        ]
        context['table_rows'] = self._get_table_rows()
        return context

    def _get_table_rows(self):
        """Orchestrates the creation of the data for the types table."""
        location_types = self._get_sorted_location_types()
        can_change = self.request.user.has_perm('location_configuration.change_locationtype')
        can_delete = self.request.user.has_perm('location_configuration.delete_locationtype')
        return [self._prepare_row_data(lt, can_change, can_delete) for lt in location_types]

    def _get_sorted_location_types(self):
        """
        Performs a topological sort on LocationTypes to display them in a
        logical parent-to-child order.
        """
        all_types = LocationType.objects.prefetch_related('allowed_parents', 'allowed_children').all()
        if not all_types: return []
        
        type_map = {t.id: t for t in all_types}
        in_degree = {t.id: t.allowed_parents.count() for t in all_types}
        queue = deque(sorted([t_id for t_id, degree in in_degree.items() if degree == 0], key=lambda id: type_map[id].name))
        sorted_list = []
        
        while queue:
            current_id = queue.popleft()
            current_type = type_map[current_id]
            sorted_list.append(current_type)
            for child in sorted(current_type.allowed_children.all(), key=lambda t: t.name):
                in_degree[child.id] -= 1
                if in_degree[child.id] == 0:
                    queue.append(child.id)
        
        if len(sorted_list) != len(all_types):
            sorted_ids = {t.id for t in sorted_list}
            remaining = sorted([t for t in all_types if t.id not in sorted_ids], key=lambda t: t.name)
            sorted_list.extend(remaining)
            
        return sorted_list

    def _prepare_row_data(self, type_obj, can_change, can_delete):
        """Builds the dictionary for a single row in the types table."""
        is_in_use = type_obj.location_set.exists()
        return {
            'cells': [
                type_obj.name,
                mark_safe(f'<span class="material-symbols-outlined">{type_obj.icon}</span>') if type_obj.icon else "—",
                ", ".join([p.name for p in type_obj.allowed_parents.all()]) or "—",
                self._get_checkbox_html(type_obj.can_store_inventory),
                self._get_checkbox_html(type_obj.can_store_samples),
                self._get_checkbox_html(type_obj.has_spaces),
                f"{type_obj.rows}x{type_obj.columns}" if type_obj.has_spaces else "—",
            ],
            'actions': [
                self._get_edit_action_data(type_obj, can_change, is_in_use),
                self._get_delete_action_data(type_obj, can_delete, is_in_use)
            ]
        }

    def _get_edit_action_data(self, type_obj, can_change, is_in_use):
        """Constructs the `data-action-info` payload for the 'Edit' button."""
        if not can_change:
            return {'icon': 'edit', 'label': 'Edit', 'class': 'btn-icon-disable'}
        
        descendants = type_obj.get_all_descendants()
        return {
            'icon': 'edit', 'label': 'Edit', 'class': 'btn-icon-blue edit-type-btn',
            'modal_target': '#edit-type-modal',
            'data': json.dumps({
                'location_type_id': type_obj.pk, 'name': type_obj.name, 'icon': type_obj.icon,
                'allowed_parents': [p.pk for p in type_obj.allowed_parents.all()],
                'can_store_inventory': type_obj.can_store_inventory,
                'can_store_samples': type_obj.can_store_samples,
                'has_spaces': type_obj.has_spaces, 'rows': type_obj.rows, 'columns': type_obj.columns,
                'is-in-use': is_in_use,
                'invalid_parent_ids': list({type_obj.pk} | {d.pk for d in descendants}),
                'in_use_parent_type_ids': list(Location.objects.filter(location_type=type_obj, parent__isnull=False).values_list('parent__location_type_id', flat=True).distinct()),
            })
        }

    def _get_delete_action_data(self, type_obj, can_delete, is_in_use):
        """Constructs the `data-action-info` payload for the 'Delete' button."""
        can_actually_delete = can_delete and not is_in_use
        if not can_actually_delete:
            return {'icon': 'delete', 'label': 'Delete', 'class': 'btn-icon-disable'}
        
        return {
            'icon': 'delete', 'label': 'Delete', 'class': 'btn-icon-red',
            'modal_target': '#delete-confirmation-modal',
            'data': json.dumps({
                'app_label': 'location_configuration', 'model_name': 'LocationType', 'pk': type_obj.pk,
                'item_name': type_obj.name, 'success_url': reverse('location_configuration:types_tab')
            })
        }

    def _get_checkbox_html(self, checked):
        """Generates the HTML for a read-only checkbox used in the table."""
        return mark_safe(f'<input type="checkbox" class="readonly-checkbox" {"checked" if checked else ""}>')

# =========================================================================
# === 3. FORM-HANDLING VIEWS (POST REQUESTS)
# =========================================================================

class AddLocationTypeView(PermissionRequiredMixin, View):
    """Handles the AJAX submission for adding a new LocationType."""
    permission_required = 'location_configuration.add_locationtype'
    
    def post(self, request, *args, **kwargs):
        # Use the simple, focused form for adding.
        form = AddLocationTypeForm(request.POST)
        if form.is_valid():
            form.save()
            return JsonResponse({'status': 'success'})
        return JsonResponse({'errors': form.errors}, status=400)


class EditLocationTypeView(PermissionRequiredMixin, View):
    """Handles the AJAX submission for editing an existing LocationType."""
    permission_required = 'location_configuration.change_locationtype'
    
    def post(self, request, pk, *args, **kwargs):
        instance = get_object_or_404(LocationType, pk=pk)
        # Use the specialized form for editing.
        form = EditLocationTypeForm(request.POST, instance=instance)
        if form.is_valid():
            form.save()
            return JsonResponse({'status': 'success'})
        return JsonResponse({'errors': form.errors}, status=400)

class AddLocationView(PermissionRequiredMixin, View):
    """Handles the AJAX submission for adding a new Location."""
    permission_required = 'location_configuration.add_location'
    
    def post(self, request, *args, **kwargs):
        # Check if the submission is for a child or a top-level location.
        is_child_form = 'add-child' in request.path
        
        if is_child_form:
            # When adding a child, the parent object is needed for the form.
            parent_id = request.POST.get('parent')
            parent = get_object_or_404(Location, pk=parent_id)
            # Pass the parent instance in the 'initial' data.
            form = AddChildLocationForm(request.POST, initial={'parent': parent})
        else:
            form = AddTopLevelLocationForm(request.POST)

        if form.is_valid():
            form.save()
            return JsonResponse({'status': 'success'})
        return JsonResponse({'errors': form.errors}, status=400)
        
class EditLocationView(PermissionRequiredMixin, View):
    """Handles the AJAX submission for editing an existing Location."""
    permission_required = 'location_configuration.change_location'
    
    def post(self, request, pk, *args, **kwargs):
        instance = get_object_or_404(Location, pk=pk)
        # Simply swap the old form class with the new, specialized one.
        form = EditLocationForm(request.POST, instance=instance)
        
        if form.is_valid():
            form.save()
            return JsonResponse({'status': 'success'})
        return JsonResponse({'errors': form.errors}, status=400)

# =========================================================================
# === 4. API-LIKE VIEWS (DATA PROVIDERS)
# =========================================================================

def get_child_location_types(request, parent_id):
    """
    Returns a JSON list of valid child location types for a given parent,
    used to dynamically populate the 'Location Type' dropdown.
    """
    parent_location = get_object_or_404(Location, pk=parent_id)
    allowed_child_types = parent_location.location_type.allowed_children.all()
    data = [{'id': loc_type.id, 'name': loc_type.name} for loc_type in allowed_child_types]
    return JsonResponse(data, safe=False)

def get_location_details(request, location_id):
    """
    Returns a JSON object with the data needed to populate the
    'Edit Location' modal form.
    """
    location = get_object_or_404(Location, pk=location_id, select_related='occupied_space')

    space_info = None
    if hasattr(location, 'occupied_space') and location.occupied_space:
        space = location.occupied_space
        space_info = f"R{space.row}, C{space.column}"

    parent_name = None
    parent_id = None
    if location.parent:
        valid_location_types = location.parent.location_type.allowed_children.all()
        parent_name = location.parent.name
        parent_id = location.parent.pk
    else:
        valid_location_types = LocationType.objects.filter(allowed_parents__isnull=True)

    data = {
        'name': location.name,
        'parent_name': parent_name,
        'parent_id': parent_id,
        'space_info': space_info, # Add this line
        'current_location_type_id': location.location_type.id,
        'valid_location_types': [{'id': lt.id, 'name': lt.name} for lt in valid_location_types],
        'has_children': location.children.exists()
    }
    return JsonResponse(data)

def get_location_grid(request, location_id):
    """
    Returns a JSON object with the grid layout for a location that has spaces.
    """
    location = get_object_or_404(Location, pk=location_id)
    if not location.location_type.has_spaces:
        return JsonResponse({'has_spaces': False})

    occupied_spaces = {
        (space.row, space.column): space.child_location.name
        for space in location.spaces.filter(child_location__isnull=False)
    }

    grid = []
    for r in range(1, location.location_type.rows + 1):
        row = []
        for c in range(1, location.location_type.columns + 1):
            cell_data = {
                'row': r,
                'column': c,
                'is_occupied': (r, c) in occupied_spaces,
                'occupant_name': occupied_spaces.get((r, c), None)
            }
            row.append(cell_data)
        grid.append(row)

    data = {
        'has_spaces': True,
        'rows': location.location_type.rows,
        'columns': location.location_type.columns,
        'grid': grid
    }
    return JsonResponse(data)