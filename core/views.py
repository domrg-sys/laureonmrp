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
        MODIFIED: Now accepts a 'form_name' to create a truly unique session key.
        """
        # Use the provided form_name for the session key
        self.request.session[f'form_errors_{form_name}'] = form.errors.as_json()
        self.request.session[f'form_data_{form_name}'] = form.data
        
        return redirect(self.get_success_url())

    def get_context_data(self, **kwargs):
        """
        MODIFIED: Now looks up session data using the form's specific context name.
        """
        context = super().get_context_data(**kwargs)

        # Iterate over a copy of context items to avoid runtime errors
        for form_name, form_instance in list(context.items()):
            if isinstance(form_instance, Form):
                # Use the form's context name to build the key to look for
                form_errors_key = f'form_errors_{form_name}'
                form_data_key = f'form_data_{form_name}'

                form_errors_json = self.request.session.pop(form_errors_key, None)
                session_data = self.request.session.pop(form_data_key, None)

                if form_errors_json and session_data:
                    # An error was found for this form. We must restore its state.
                    instance = getattr(form_instance, 'instance', None)
                    
                    # Re-create the form, binding it with the failed data
                    rebound_form = type(form_instance)(data=session_data, instance=instance)
                    
                    # Attach the errors
                    errors = json.loads(form_errors_json)
                    rebound_form._errors = ErrorDict(errors)
                    
                    # Replace the original form in the context with our newly rebound one
                    context[form_name] = rebound_form
        
        return context