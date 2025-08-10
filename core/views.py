import json
from django.forms.utils import ErrorDict
from django.shortcuts import redirect
from django.forms import Form

class GenericFormHandlingMixin:
    """
    A generic mixin to handle form processing using the Post-Redirect-Get pattern.
    
    It now uses the form's context name (e.g., 'add_form') as a unique key,
    allowing it to correctly handle multiple instances of the same form class on one page.
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
        on the form's context name.
        """
        self.request.session[f'form_errors_{form_name}'] = form.errors.as_json()
        self.request.session[f'form_data_{form_name}'] = form.data
        
        return redirect(self.get_success_url())

    def get_context_data(self, **kwargs):
        """
        MODIFIED: Now adds a '{form_name}_has_errors' flag to the context if a
        form is being restored from a failed submission. This allows the template
        to signal the frontend JavaScript to open the correct modal on page load.
        """
        context = super().get_context_data(**kwargs)

        for form_name, form_instance in list(context.items()):
            if isinstance(form_instance, Form):
                form_errors_key = f'form_errors_{form_name}'
                form_data_key = f'form_data_{form_name}'

                # Check for session data without removing it yet.
                form_errors_json = self.request.session.get(form_errors_key)
                session_data = self.request.session.get(form_data_key)

                if form_errors_json and session_data:
                    # Now that we know we need it, remove the data from the session.
                    self.request.session.pop(form_errors_key, None)
                    self.request.session.pop(form_data_key, None)

                    # Re-create the form with the failed data and errors.
                    instance = getattr(form_instance, 'instance', None)
                    rebound_form = type(form_instance)(data=session_data, instance=instance)
                    errors = json.loads(form_errors_json)
                    rebound_form._errors = ErrorDict(errors)
                    
                    # Replace the blank form in the context with the restored one.
                    context[form_name] = rebound_form
                    
                    # THIS IS THE KEY FIX: Add the flag to the context.
                    # e.g., context['add_form_has_errors'] = True
                    context[f'{form_name}_has_errors'] = True
        
        return context
