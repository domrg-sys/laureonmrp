import json
from django.forms.utils import ErrorDict
from django.shortcuts import redirect
from django.forms import Form

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