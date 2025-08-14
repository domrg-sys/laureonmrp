import json
from collections import deque
from django.contrib.auth.mixins import PermissionRequiredMixin
from django.forms.utils import ErrorDict
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse, reverse_lazy
from django.utils.safestring import mark_safe
from django.views.generic import TemplateView

from core.views import GenericFormHandlingMixin
from .forms import LocationForm, LocationTypeForm
from .models import Location, LocationType

# =========================================================================
# === CONSTANTS & MODULE-LEVEL HELPERS
# =========================================================================

# Defines the structure of the tab navigation for this application.
TABS = [
    {'slug': 'locations', 'label': 'Locations', 'url_name': 'location_configuration:locations_tab'},
    {'slug': 'types', 'label': 'Location Types', 'url_name': 'location_configuration:types_tab'},
]

def _prepare_tabs_context(active_tab_slug):
    # Builds the context required for the tab navigator component.
    tabs_with_urls = [{**tab, 'url': reverse(tab['url_name'])} for tab in TABS]
    return {'tabs': tabs_with_urls, 'active_tab': active_tab_slug}

def _rebound_form_from_session(request, form_name, FormClass, instance_id=None, ModelClass=None):
    # This helper checks the session for a failed form submission. If found,
    # it rebuilds the form with the user's data and validation errors.
    form_errors_json = request.session.get(f'form_errors_{form_name}')
    session_data = request.session.get(f'form_data_{form_name}')

    if not (form_errors_json and session_data):
        return None, False  # No session data found.

    # Clear the session data so it's only used once.
    request.session.pop(f'form_errors_{form_name}', None)
    request.session.pop(f'form_data_{form_name}', None)

    instance = get_object_or_404(ModelClass, pk=instance_id) if (instance_id and ModelClass) else None

    rebound_form = FormClass(data=session_data, instance=instance)
    rebound_form._errors = ErrorDict(json.loads(form_errors_json))
    
    return rebound_form, True

# =========================================================================
# === TAB VIEWS
# =========================================================================

class LocationsTabView(PermissionRequiredMixin, GenericFormHandlingMixin, TemplateView):
    # This view manages the 'Locations' tab, which displays a tree of locations
    # and includes modals for adding and editing them.
    permission_required = 'location_configuration.view_locationconfiguration_tab'
    template_name = 'location_configuration/locations_tab.html'
    success_url = reverse_lazy('location_configuration:locations_tab')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(_prepare_tabs_context('locations'))
        
        form_definitions = {
            'add_location_form': {'class': LocationForm, 'model': Location},
            'add_child_form': {'class': LocationForm, 'model': Location},
            'edit_location_form': {'class': LocationForm, 'model': Location},
        }

        # For each form, check for session data and add it to the context.
        for name, definition in form_definitions.items():
            session_data = self.request.session.get(f'form_data_{name}', {})
            instance_id = session_data.get('location_id') if name == 'edit_location_form' else None
            
            rebound_form, has_errors = _rebound_form_from_session(
                self.request, name, definition['class'], instance_id, definition['model']
            )
            
            context[name] = rebound_form if rebound_form else definition['class']()
            context[f'{name}_has_errors'] = has_errors

        context['top_level_locations'] = Location.objects.filter(parent__isnull=True)
        context['can_delete_location'] = self.request.user.has_perm('location_configuration.delete_location')
        return context

    def post(self, request, *args, **kwargs):
        # Handles submissions for all location forms on this tab.
        form_name = request.POST.get('form_name', 'add_location_form')
        instance = None

        if form_name == 'edit_location_form':
            instance_id = request.POST.get('location_id')
            if instance_id:
                instance = get_object_or_404(Location, pk=instance_id)
        
        form = LocationForm(request.POST, instance=instance)

        if form.is_valid():
            form.save()
            return redirect(self.get_success_url())
        else:
            return self.form_invalid(form, form_name)


class LocationTypesTabView(PermissionRequiredMixin, GenericFormHandlingMixin, TemplateView):
    # This view manages the 'Location Types' tab, which displays a table of
    # types and includes modals for adding and editing them.
    permission_required = 'location_configuration.view_locationconfiguration_tab'
    template_name = 'location_configuration/types_tab.html'
    success_url = reverse_lazy('location_configuration:types_tab')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(_prepare_tabs_context('types'))

        # Prepare 'add' and 'edit' forms, checking the session for each.
        add_form, add_has_errors = _rebound_form_from_session(self.request, 'add_form', LocationTypeForm)
        context['add_form'] = add_form or LocationTypeForm()
        context['add_form_has_errors'] = add_has_errors

        session_data = self.request.session.get('form_data_edit_form', {})
        instance_id = session_data.get('location_type_id')
        edit_form, edit_has_errors = _rebound_form_from_session(
            self.request, 'edit_form', LocationTypeForm, instance_id, LocationType
        )
        context['edit_form'] = edit_form or LocationTypeForm()
        context['edit_form_has_errors'] = edit_has_errors

        context['table_headers'] = [
            'Name', 'Icon', 'Allowed Parents', 'Stores Inventory',
            'Stores Samples', 'Has Spaces', 'Grid', 'Actions'
        ]
        context['table_rows'] = self._get_table_rows()
        return context

    def post(self, request, *args, **kwargs):
        # Handles both 'add' and 'edit' form submissions.
        if 'edit_form_submit' in request.POST:
            instance = get_object_or_404(LocationType, pk=request.POST.get('location_type_id'))
            form = LocationTypeForm(request.POST, instance=instance)
            form_name = 'edit_form'
        else:
            form = LocationTypeForm(request.POST)
            form_name = 'add_form'

        if form.is_valid():
            form.save()
            return redirect(self.get_success_url())
        else:
            return self.form_invalid(form, form_name=form_name)

    # --- Private Helpers for Table Generation ---

    def _get_table_rows(self):
        # Orchestrates the creation of the data for the types table.
        location_types = self._get_sorted_location_types()
        can_change = self.request.user.has_perm('location_configuration.change_locationtype')
        can_delete = self.request.user.has_perm('location_configuration.delete_locationtype')
        
        return [self._prepare_row_data(t, can_change, can_delete) for t in location_types]

    def _get_sorted_location_types(self):
        # Performs a topological sort on LocationTypes to display them in a
        # logical parent-to-child order, which is more intuitive for users.
        all_types = LocationType.objects.prefetch_related('allowed_parents').all()
        if not all_types:
            return []

        type_map = {t.id: t for t in all_types}
        in_degree = {t.id: t.allowed_parents.count() for t in all_types}
        child_map = {t.id: list(t.allowed_children.values_list('id', flat=True)) for t in all_types}

        # Start the queue with root nodes (those with no parents).
        queue = deque(sorted(
            [t_id for t_id, degree in in_degree.items() if degree == 0],
            key=lambda id: type_map[id].name
        ))
        
        sorted_list = []
        while queue:
            current_id = queue.popleft()
            sorted_list.append(type_map[current_id])

            for child_id in sorted(child_map.get(current_id, []), key=lambda id: type_map[id].name):
                in_degree[child_id] -= 1
                if in_degree[child_id] == 0:
                    queue.append(child_id)
        
        # If the sorted list doesn't contain all types, there's a cycle.
        # This is a fallback to ensure all types are still displayed.
        if len(sorted_list) != len(all_types):
            sorted_ids = {t.id for t in sorted_list}
            remaining = [t for t in all_types if t.id not in sorted_ids]
            sorted_list.extend(sorted(remaining, key=lambda t: t.name))

        return sorted_list

    def _prepare_row_data(self, type_obj, can_change, can_delete):
        # Builds the dictionary for a single row in the types table.
        is_in_use = type_obj.location_set.exists()
        return {
            'cells': [
                type_obj.name,
                mark_safe(f'<span class="material-symbols-outlined">{type_obj.icon}</span>') if type_obj.icon else "—",
                ", ".join([p.name for p in type_obj.allowed_parents.all()]) or "—",
                self._get_checkbox_html(type_obj.can_store_inventory),
                self._get_checkbox_html(type_obj.can_store_samples),
                self._get_checkbox_html(type_obj.has_spaces),
                f"{type_obj.rows}x{type_obj.columns}" if type_obj.rows and type_obj.columns else "—",
            ],
            'actions': [
                self._get_edit_action_data(type_obj, can_change, is_in_use),
                self._get_delete_action_data(type_obj, can_delete, is_in_use)
            ]
        }

    def _get_edit_action_data(self, type_obj, can_change, is_in_use):
        # Constructs the data payload for the 'Edit' button, which is then
        # serialized into a JSON string for the frontend.
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
        # Constructs the data payload for the 'Delete' button.
        can_actually_delete = can_delete and not is_in_use
        if not can_actually_delete:
            return {'icon': 'delete', 'label': 'Delete', 'class': 'btn-icon-disable'}

        return {
            'icon': 'delete', 'label': 'Delete', 'class': 'btn-icon-red',
            'modal_target': '#delete-confirmation-modal',
            'data': json.dumps({
                'app_label': 'location_configuration', 'model_name': 'LocationType', 'pk': type_obj.pk,
                'item_name': type_obj.name, 'success_url': str(self.success_url)
            })
        }
        
    def _get_checkbox_html(self, checked):
        # Generates the HTML for a read-only checkbox used in the table.
        return mark_safe(f'<input type="checkbox" class="readonly-checkbox" {"checked" if checked else ""}>')

# =========================================================================
# === API-LIKE FUNCTION VIEWS
# =========================================================================

def get_child_location_types(request, parent_id):
    # This view is called via fetch() from the frontend to populate the
    # 'Location Type' dropdown when adding a child location.
    parent_location = get_object_or_404(Location, pk=parent_id)
    allowed_child_types = parent_location.location_type.allowed_children.all()
    data = [{'id': loc_type.id, 'name': loc_type.name} for loc_type in allowed_child_types]
    return JsonResponse(data, safe=False)

def get_location_details(request, location_id):
    # This view is called via fetch() to get the data needed to populate
    # the 'Edit Location' modal form.
    location = get_object_or_404(Location, pk=location_id)
    
    if location.parent:
        valid_location_types = location.parent.location_type.allowed_children.all()
    else: # This is a top-level location.
        valid_location_types = LocationType.objects.filter(allowed_parents__isnull=True)

    data = {
        'name': location.name,
        'current_location_type_id': location.location_type.id,
        'valid_location_types': [{'id': lt.id, 'name': lt.name} for lt in valid_location_types],
        'has_children': location.children.exists()
    }
    return JsonResponse(data)