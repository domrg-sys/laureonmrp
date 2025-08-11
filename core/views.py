import json
from django.forms.utils import ErrorDict
from django.shortcuts import redirect
from django.forms import Form
from django.views import View
from django.apps import apps
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import HttpResponseForbidden, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.db.models import ProtectedError
from django.contrib import messages

class GenericFormHandlingMixin:
    """
    A generic mixin to handle form processing using the Post-Redirect-Get pattern.
    Its sole responsibilities are to provide a success URL and to handle an
    invalid form submission by saving form data/errors to the session and
redirecting.
    """
    success_url = None

    def get_success_url(self):
        """Return the URL to redirect to after processing a valid form."""
        if not self.success_url:
            raise NotImplementedError("You must define a 'success_url' in your view.")
        return str(self.success_url)

    def form_invalid(self, form, form_name):
        """
        Stores form data and errors in the session using a unique key based
        on the form's context name, then redirects.
        """
        self.request.session[f'form_errors_{form_name}'] = form.errors.as_json()
        self.request.session[f'form_data_{form_name}'] = form.data
        
        return redirect(self.get_success_url())
    
class GenericDeleteView(LoginRequiredMixin, View):
    """
    A generic view to handle the deletion of any model instance.
    """
    def post(self, request, app_label, model_name, pk):
        # Dynamically get the model from the app_label and model_name
        Model = apps.get_model(app_label, model_name)
        
        # Construct the permission string (e.g., 'app_label.delete_modelname')
        perm_name = f'{app_label}.delete_{model_name.lower()}'
        
        # Check if the user has the required permission
        if not request.user.has_perm(perm_name):
            return HttpResponseForbidden("You do not have permission to delete this object.")
            
        # Get the object to be deleted
        obj = get_object_or_404(Model, pk=pk)
        
        # Get the URL to redirect to on success
        success_url = request.POST.get('success_url', reverse('main_menu:main_menu'))
        
        try:
            obj.delete()
            messages.success(request, f"{Model._meta.verbose_name.title()} '{obj}' was deleted successfully.")
        except ProtectedError:
            messages.error(request, f"Cannot delete this {Model._meta.verbose_name} because it is referenced by other objects.")
        
        return HttpResponseRedirect(success_url)