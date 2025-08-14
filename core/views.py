from django.apps import apps
from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import ProtectedError
from django.http import HttpResponseForbidden, HttpResponseRedirect
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse
from django.views import View

# =========================================================================
# === MIXINS
# =========================================================================

class GenericFormHandlingMixin:
    """
    A mixin to handle form processing using the Post-Redirect-Get (PRG) pattern.
    Its primary job is to gracefully handle an invalid form submission by saving
    the form's data and errors to the session before redirecting. This prevents
    data loss and allows the form to be re-rendered with the user's input.
    """
    success_url = None

    def get_success_url(self):
        # Returns the URL to redirect to after a successful form submission.
        if not self.success_url:
            raise NotImplementedError("A 'success_url' must be defined in the view using this mixin.")
        return str(self.success_url)

    def form_invalid(self, form, form_name):
        # This method is the core of the PRG pattern for failed submissions.
        # It stores the form's state in the session using a unique key.
        self.request.session[f'form_errors_{form_name}'] = form.errors.as_json()
        self.request.session[f'form_data_{form_name}'] = form.data
        
        return redirect(self.get_success_url())

# =========================================================================
# === GENERIC VIEWS
# =========================================================================

class GenericDeleteView(LoginRequiredMixin, View):
    """
    A generic view to handle the deletion of any model instance. It is designed
    to be called from a modal confirmation dialog and requires the app label,
    model name, and primary key to be passed in the URL.
    """
    def post(self, request, app_label, model_name, pk):
        # This is the main entry point for the POST request. It orchestrates
        # the permission check, object retrieval, and deletion process.
        Model = self._get_model(app_label, model_name)
        obj = get_object_or_404(Model, pk=pk)
        
        if not self._user_has_permission(request, app_label, model_name):
            return HttpResponseForbidden("You do not have permission to delete this object.")
        
        self._delete_object(request, obj)
        
        success_url = request.POST.get('success_url', reverse('main_menu:main_menu'))
        return HttpResponseRedirect(success_url)

    def _get_model(self, app_label, model_name):
        # Safely retrieves the model class from Django's app registry.
        return apps.get_model(app_label, model_name)

    def _user_has_permission(self, request, app_label, model_name):
        # Dynamically constructs and checks for the required delete permission.
        perm_name = f'{app_label}.delete_{model_name.lower()}'
        return request.user.has_perm(perm_name)

    def _delete_object(self, request, obj):
        # Attempts to delete the object and handles the ProtectedError case,
        # which occurs if other objects in the database have a foreign key
        # relationship to the object being deleted.
        Model = obj.__class__
        try:
            obj.delete()
            messages.success(request, f"{Model._meta.verbose_name.title()} '{obj}' was deleted successfully.")
        except ProtectedError:
            messages.error(request, f"Cannot delete this {Model._meta.verbose_name.lower()} because it is referenced by other objects.")