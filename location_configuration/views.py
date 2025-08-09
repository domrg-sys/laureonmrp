from django.contrib.auth.mixins import PermissionRequiredMixin
from django.views.generic import TemplateView
from django.urls import reverse, reverse_lazy
from django.utils.safestring import mark_safe
from django.shortcuts import get_object_or_404, redirect
import json

from core.views import FormHandlingMixin
from .forms import LocationTypeForm, EditLocationTypeForm
from .models import LocationType

TABS = [
    {'slug': 'locations', 'label': 'Locations', 'url_name': 'location_configuration:locations_tab'},
    {'slug': 'types', 'label': 'Location Types', 'url_name': 'location_configuration:types_tab'},
]

def _prepare_tabs_context(active_tab_slug):
    tabs_with_urls = []
    for tab in TABS:
        tabs_with_urls.append({
            **tab,
            'url': reverse(tab['url_name'])
        })
    return {'tabs': tabs_with_urls, 'active_tab': active_tab_slug}

# --- VIEW 1: "Locations" Tab (Now a Class-Based View) ---
class LocationsTabView(PermissionRequiredMixin, TemplateView):
    permission_required = 'location_configuration.view_locationconfiguration_tab'
    template_name = 'location_configuration/locations_tab.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(_prepare_tabs_context('locations'))
        return context

# --- VIEW 2: "Location Types" Tab (Refactored with the Mixin) ---
class LocationTypesTabView(PermissionRequiredMixin, FormHandlingMixin, TemplateView):
    permission_required = 'location_configuration.view_locationconfiguration_tab'
    template_name = 'location_configuration/types_tab.html'
    form_class = LocationTypeForm
    success_url = reverse_lazy('location_configuration:types_tab')

    def get_context_data(self, **kwargs):
        context = {} 
        context.update(_prepare_tabs_context('types'))

        # If the 'add' form ('form') isn't already in the context, create a fresh one.
        if 'form' not in context:
            context['form'] = self.get_form()
            
        # If the 'edit_form' isn't already in the context, create a fresh one.
        if 'edit_form' not in context:
            context['edit_form'] = EditLocationTypeForm()
            
        context['table_headers'] = [
            'Name', 'Icon', 'Allowed Parents', 'Stores Inventory',
            'Stores Samples', 'Has Spaces', 'Grid', 'Actions'
        ]
        context['table_rows'] = self._get_table_rows()
        
        return super().get_context_data(**context, **kwargs)

    def post(self, request, *args, **kwargs):
        """
        Handles POST requests for both adding and editing location types.
        """
        # Determine if this is an edit or an add submission.
        if 'edit_form_submit' in request.POST:
            instance = get_object_or_404(LocationType, pk=request.POST.get('location_type_id'))
            form = EditLocationTypeForm(request.POST, instance=instance)
        else:
            form = self.get_form()

        if form.is_valid():
            return self.form_valid(form)
        else:
            # This now correctly uses the mixin for both forms.
            return self.form_invalid(form)

    def form_valid(self, form):
        """ 
        This method is called when either the ADD or EDIT form is successfully validated. 
        """
        form.save()
        return redirect(self.get_success_url())

    def _get_table_rows(self):
        """ Private helper method to build and return the table rows. """
        table_rows = []
        location_types = LocationType.objects.prefetch_related('allowed_parents').all()

        can_change = self.request.user.has_perm('location_configuration.change_locationtype')
        can_delete_perm = self.request.user.has_perm('location_configuration.delete_locationtype')

        for type_obj in location_types:
            parent_names = ", ".join([p.name for p in type_obj.allowed_parents.all()]) or "—"
            grid_display = f"{type_obj.rows}x{type_obj.columns}" if type_obj.rows and type_obj.columns else "—"
            icon_html = mark_safe(f'<span class="material-symbols-outlined">{type_obj.icon}</span>') if type_obj.icon else "—"
            is_in_use = type_obj.location_set.exists()

            descendants = type_obj.get_all_descendants()
            descendant_ids = [desc.pk for desc in descendants]

            actions = []
            if can_change:
                actions.append({
                    'url': '#',
                    'icon': 'edit',
                    'label': 'Edit',
                    'class': 'btn-icon-blue edit-type-btn',
                    'modal_target': '#edit-type-modal',
                    'data': json.dumps({
                        'location_type_id': type_obj.pk,
                        'name': type_obj.name,
                        'icon': type_obj.icon,
                        'allowed_parents': [p.pk for p in type_obj.allowed_parents.all()],
                        'can_store_inventory': type_obj.can_store_inventory,
                        'can_store_samples': type_obj.can_store_samples,
                        'has_spaces': type_obj.has_spaces,
                        'rows': type_obj.rows,
                        'columns': type_obj.columns,
                        'is-in-use': is_in_use,
                        'descendant_ids': descendant_ids,
                        'self_id': type_obj.pk
                    })
                })
            else:
                actions.append({'url': None, 'icon': 'edit', 'label': 'Edit', 'class': 'btn-icon-disable'})

            # A user can only delete if they have permission AND the type is not in use.
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
        """ Private helper method to generate non-interactive, styled checkbox HTML. """
        checked_attribute = 'checked' if checked else ''
        return mark_safe(f'<input type="checkbox" class="readonly-checkbox" {checked_attribute}>')