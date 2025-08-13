from django.contrib.auth.mixins import PermissionRequiredMixin
from django.views.generic import TemplateView
from django.urls import reverse, reverse_lazy
from django.utils.safestring import mark_safe
from django.shortcuts import get_object_or_404, redirect
from django.forms.utils import ErrorDict
from django.http import JsonResponse
import json

from core.views import GenericFormHandlingMixin
from .forms import LocationTypeForm, LocationForm
from .models import LocationType, Location
from collections import deque

TABS = [
    {'slug': 'locations', 'label': 'Locations', 'url_name': 'location_configuration:locations_tab'},
    {'slug': 'types', 'label': 'Location Types', 'url_name': 'location_configuration:types_tab'},
]

def _prepare_tabs_context(active_tab_slug):
    tabs_with_urls = []
    for tab in TABS:
        tabs_with_urls.append({**tab, 'url': reverse(tab['url_name'])})
    return {'tabs': tabs_with_urls, 'active_tab': active_tab_slug}

class LocationsTabView(PermissionRequiredMixin, GenericFormHandlingMixin, TemplateView):
    permission_required = 'location_configuration.view_locationconfiguration_tab'
    template_name = 'location_configuration/locations_tab.html'
    success_url = reverse_lazy('location_configuration:locations_tab')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(_prepare_tabs_context('locations'))
        context['add_location_form'] = LocationForm()
        # Provide a form instance for the new "add child" modal
        context['add_child_form'] = LocationForm()
        context['top_level_locations'] = Location.objects.filter(parent__isnull=True)
        return context

    def post(self, request, *args, **kwargs):
        # We now pass the request.POST data to the form instance
        form = LocationForm(request.POST)
        if form.is_valid():
            form.save()
        # Redirect on both success and failure to show the updated tree or clear the modal
        return redirect(self.get_success_url())
    
def get_child_location_types(request, parent_id):
    """
    Returns a JSON list of valid location types that can be a child
    of the specified parent location.
    """
    try:
        parent_location = Location.objects.get(pk=parent_id)
        # Find all location types that are allowed children of the parent's type
        allowed_child_types = parent_location.location_type.allowed_children.all()
        # Format the data for the JSON response
        data = [{'id': loc_type.id, 'name': loc_type.name} for loc_type in allowed_child_types]
        return JsonResponse(data, safe=False)
    except Location.DoesNotExist:
        return JsonResponse({'error': 'Parent location not found'}, status=404)

class LocationTypesTabView(PermissionRequiredMixin, GenericFormHandlingMixin, TemplateView):
    permission_required = 'location_configuration.view_locationconfiguration_tab'
    template_name = 'location_configuration/types_tab.html'
    success_url = reverse_lazy('location_configuration:types_tab')

    def get_context_data(self, **kwargs):
        """
        This method now fully controls its context. It prepares the forms and
        then explicitly checks the session to restore them if a validation error
        occurred on a previous POST request.
        """
        context = super().get_context_data(**kwargs)
        context.update(_prepare_tabs_context('types'))

        # Define the forms this view uses
        forms_to_process = {
            'add_form': LocationTypeForm(),
            'edit_form': LocationTypeForm()
        }

        # Loop through the forms to check for and restore session data
        for form_name, form_instance in forms_to_process.items():
            form_errors_key = f'form_errors_{form_name}'
            form_data_key = f'form_data_{form_name}'
            
            form_errors_json = self.request.session.get(form_errors_key)
            session_data = self.request.session.get(form_data_key)

            if form_errors_json and session_data:
                # If we find data for a form, restore it
                self.request.session.pop(form_errors_key, None)
                self.request.session.pop(form_data_key, None)
                
                instance_id = session_data.get('location_type_id') if form_name == 'edit_form' else None
                instance = get_object_or_404(LocationType, pk=instance_id) if instance_id else None
                
                rebound_form = type(form_instance)(data=session_data, instance=instance)
                rebound_form._errors = ErrorDict(json.loads(form_errors_json))
                
                context[form_name] = rebound_form
                context[f'{form_name}_has_errors'] = True # Flag to open the modal
            else:
                # Otherwise, just add the blank form to the context
                context[form_name] = form_instance

        context['table_headers'] = [
            'Name', 'Icon', 'Allowed Parents', 'Stores Inventory',
            'Stores Samples', 'Has Spaces', 'Grid', 'Actions'
        ]
        context['table_rows'] = self._get_table_rows()

        return context

    def post(self, request, *args, **kwargs):
        form = None
        form_name = None 

        if 'edit_form_submit' in request.POST:
            form_name = 'edit_form'
            instance = get_object_or_404(LocationType, pk=request.POST.get('location_type_id'))
            form = LocationTypeForm(request.POST, instance=instance)
        else:
            form_name = 'add_form'
            form = LocationTypeForm(request.POST)

        if form.is_valid():
            return self.form_valid(form)
        else:
            return self.form_invalid(form, form_name=form_name)

    def form_valid(self, form):
        form.save()
        return redirect(self.get_success_url())

    def _get_table_rows(self):
        table_rows = []
        all_types = LocationType.objects.prefetch_related('allowed_parents').all()

        in_degree = {t.id: 0 for t in all_types}
        child_map = {t.id: [] for t in all_types}
        type_map = {t.id: t for t in all_types}

        for t in all_types:
            for parent in t.allowed_parents.all():
                if t.id in in_degree: in_degree[t.id] += 1
                if parent.id in child_map: child_map[parent.id].append(t.id)

        root_nodes = [t_id for t_id, degree in in_degree.items() if degree == 0]
        sorted_root_nodes = sorted(root_nodes, key=lambda t_id: type_map[t_id].name)

        queue = deque(sorted_root_nodes)
        sorted_types = []

        visited_in_sort = set()
        while queue:
            current_id = queue.popleft()
            if current_id in visited_in_sort: continue
            visited_in_sort.add(current_id)

            sorted_types.append(type_map[current_id])

            sorted_children = sorted(child_map.get(current_id, []), key=lambda t_id: type_map[t_id].name)
            for child_id in sorted_children:
                in_degree[child_id] -= 1
                if in_degree[child_id] == 0:
                    queue.append(child_id)

        # If a cycle exists, this adds the remaining items to the end
        remaining_types = [t for t in all_types if t.id not in visited_in_sort]
        location_types = sorted_types + sorted(remaining_types, key=lambda t: t.name)
        
        can_change = self.request.user.has_perm('location_configuration.change_locationtype')
        can_delete_perm = self.request.user.has_perm('location_configuration.delete_locationtype')

        for type_obj in location_types:
            parent_names = ", ".join([p.name for p in type_obj.allowed_parents.all()]) or "—"
            grid_display = f"{type_obj.rows}x{type_obj.columns}" if type_obj.rows and type_obj.columns else "—"
            icon_html = mark_safe(f'<span class="material-symbols-outlined">{type_obj.icon}</span>') if type_obj.icon else "—"
            is_in_use = type_obj.location_set.exists()
            
            # Get the IDs of the instance itself and all its descendants to prevent circular dependencies
            descendants = type_obj.get_all_descendants()
            invalid_parent_ids = {type_obj.pk} | {desc.pk for desc in descendants}

            actions = []
            if can_change:
                actions.append({
                    'url': '#',
                    'icon': 'edit',
                    'label': 'Edit',
                    'class': 'btn-icon-blue edit-type-btn',
                    'modal_target': '#edit-type-modal',
                    'data': json.dumps({
                        'location_type_id': type_obj.pk, 'name': type_obj.name,
                        'icon': type_obj.icon, 'allowed_parents': [p.pk for p in type_obj.allowed_parents.all()],
                        'can_store_inventory': type_obj.can_store_inventory, 'can_store_samples': type_obj.can_store_samples,
                        'has_spaces': type_obj.has_spaces, 'rows': type_obj.rows, 'columns': type_obj.columns,
                        'is-in-use': is_in_use,
                        'invalid_parent_ids': list(invalid_parent_ids)
                    })
                })
            else:
                actions.append({'url': None, 'icon': 'edit', 'label': 'Edit', 'class': 'btn-icon-disable'})

            can_actually_delete = can_delete_perm and not is_in_use
            actions.append({
                'url': '#' if can_actually_delete else None,
                'icon': 'delete',
                'label': 'Delete',
                'class': 'btn-icon-red' if can_actually_delete else 'btn-icon-disable',
                'modal_target': '#delete-confirmation-modal' if can_actually_delete else '',
                'data': json.dumps({
                    'app_label': 'location_configuration',
                    'model_name': 'LocationType',
                    'pk': type_obj.pk,
                    'item_name': type_obj.name,
                    'success_url': reverse('location_configuration:types_tab')
                }) if can_actually_delete else ''
            })

            table_rows.append({
                'cells': [
                    type_obj.name, icon_html, parent_names,
                    self._get_checkbox_html(type_obj.can_store_inventory),
                    self._get_checkbox_html(type_obj.can_store_samples),
                    self._get_checkbox_html(type_obj.has_spaces),
                    grid_display,
                ],
                'actions': actions
            })
        return table_rows

    def _get_checkbox_html(self, checked):
        checked_attribute = 'checked' if checked else ''
        return mark_safe(f'<input type="checkbox" class="readonly-checkbox" {checked_attribute}>')