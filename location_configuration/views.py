from django.contrib.auth.mixins import PermissionRequiredMixin
from django.views.generic import TemplateView
from django.urls import reverse, reverse_lazy
from django.utils.safestring import mark_safe
from django.shortcuts import get_object_or_404, redirect
import json

# The path to your mixin is correct
from core.views import GenericFormHandlingMixin
# Only the single, merged form is needed
from .forms import LocationTypeForm
from .models import LocationType

TABS = [
    {'slug': 'locations', 'label': 'Locations', 'url_name': 'location_configuration:locations_tab'},
    {'slug': 'types', 'label': 'Location Types', 'url_name': 'location_configuration:types_tab'},
]

def _prepare_tabs_context(active_tab_slug):
    # This helper function is unchanged
    tabs_with_urls = []
    for tab in TABS:
        tabs_with_urls.append({
            **tab,
            'url': reverse(tab['url_name'])
        })
    return {'tabs': tabs_with_urls, 'active_tab': active_tab_slug}

# --- VIEW 1: This view is unchanged ---
class LocationsTabView(PermissionRequiredMixin, TemplateView):
    permission_required = 'location_configuration.view_locationconfiguration_tab'
    template_name = 'location_configuration/locations_tab.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(_prepare_tabs_context('locations'))
        return context

# --- VIEW 2: FINAL CORRECTED VERSION ---
class LocationTypesTabView(PermissionRequiredMixin, GenericFormHandlingMixin, TemplateView):
    permission_required = 'location_configuration.view_locationconfiguration_tab'
    template_name = 'location_configuration/types_tab.html'
    success_url = reverse_lazy('location_configuration:types_tab')

    def get_context_data(self, **kwargs):
        """
        MODIFIED: This method now prepares placeholders for BOTH forms.
        This gives the mixin a "bucket" to put a restored form into if validation fails.
        """
        context = super().get_context_data(**kwargs)
        context.update(_prepare_tabs_context('types'))

        if 'add_form' not in context:
            context['add_form'] = LocationTypeForm()
        
        # This is the first key change: we add a placeholder for the edit form.
        if 'edit_form' not in context:
            context['edit_form'] = LocationTypeForm()

        context['table_headers'] = [
            'Name', 'Icon', 'Allowed Parents', 'Stores Inventory',
            'Stores Samples', 'Has Spaces', 'Grid', 'Actions'
        ]
        context['table_rows'] = self._get_table_rows()

        return context

    def post(self, request, *args, **kwargs):
        """
        MODIFIED: This method now tells the mixin the specific 'form_name'
        that failed, so it can be restored correctly.
        """
        form = None
        form_name = None # Variable to hold the unique form name

        if 'edit_form_submit' in request.POST:
            form_name = 'edit_form' # The unique identifier for this form
            instance = get_object_or_404(LocationType, pk=request.POST.get('location_type_id'))
            form = LocationTypeForm(request.POST, instance=instance)
        else:
            form_name = 'add_form' # The unique identifier for this form
            form = LocationTypeForm(request.POST)

        if form.is_valid():
            return self.form_valid(form)
        else:
            # This is the second key change: we pass the form_name to the invalid handler.
            return self.form_invalid(form, form_name=form_name)

    def form_valid(self, form):
        form.save()
        return redirect(self.get_success_url())

    def _get_table_rows(self):
        """ This helper method is unchanged. """
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
        """ This helper method is unchanged. """
        checked_attribute = 'checked' if checked else ''
        return mark_safe(f'<input type="checkbox" class="readonly-checkbox" {checked_attribute}>')
