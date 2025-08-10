from django.contrib.auth.mixins import PermissionRequiredMixin
from django.views.generic import TemplateView
from django.urls import reverse, reverse_lazy
from django.utils.safestring import mark_safe
from django.shortcuts import get_object_or_404, redirect
from django.forms.utils import ErrorDict
import json

from core.views import GenericFormHandlingMixin
from .forms import LocationTypeForm
from .models import LocationType

TABS = [
    {'slug': 'locations', 'label': 'Locations', 'url_name': 'location_configuration:locations_tab'},
    {'slug': 'types', 'label': 'Location Types', 'url_name': 'location_configuration:types_tab'},
]

def _prepare_tabs_context(active_tab_slug):
    tabs_with_urls = []
    for tab in TABS:
        tabs_with_urls.append({**tab, 'url': reverse(tab['url_name'])})
    return {'tabs': tabs_with_urls, 'active_tab': active_tab_slug}

class LocationsTabView(PermissionRequiredMixin, TemplateView):
    permission_required = 'location_configuration.view_locationconfiguration_tab'
    template_name = 'location_configuration/locations_tab.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(_prepare_tabs_context('locations'))
        return context

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
        location_types = LocationType.objects.prefetch_related('allowed_parents').all()
        can_change = self.request.user.has_perm('location_configuration.change_locationtype')
        can_delete_perm = self.request.user.has_perm('location_configuration.delete_locationtype')

        for type_obj in location_types:
            parent_names = ", ".join([p.name for p in type_obj.allowed_parents.all()]) or "—"
            grid_display = f"{type_obj.rows}x{type_obj.columns}" if type_obj.rows and type_obj.columns else "—"
            icon_html = mark_safe(f'<span class="material-symbols-outlined">{type_obj.icon}</span>') if type_obj.icon else "—"
            is_in_use = type_obj.location_set.exists()

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
                        'is-in-use': is_in_use
                    })
                })
            else:
                actions.append({'url': None, 'icon': 'edit', 'label': 'Edit', 'class': 'btn-icon-disable'})

            can_actually_delete = can_delete_perm and not is_in_use
            actions.append({
                'url': '#' if can_actually_delete else None,
                'icon': 'delete',
                'label': 'Delete',
                'class': 'btn-icon-red' if can_actually_delete else 'btn-icon-disable'
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