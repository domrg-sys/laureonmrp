import json
from django.forms.utils import ErrorDict
from django.shortcuts import redirect
from django.views.generic.edit import FormMixin
from django.forms import Form # Import the base Form class

class FormHandlingMixin(FormMixin):
    """
    A mixin to handle form processing using the Post-Redirect-Get pattern.
    
    It stores form errors and data in the session on POST failure and
    reconstitutes the form on the subsequent GET request. This prevents
    form resubmission on page refresh and keeps the form state.
    
    This version is enhanced to handle multiple forms on a single page
    by using form-specific session keys.
    """
    
    def post(self, request, *args, **kwargs):
        """
        Handles POST requests, instantiating a form instance with the passed
        POST variables and then validating it.
        """
        # This method remains the same, but is included for context.
        form = self.get_form()
        if form.is_valid():
            return self.form_valid(form)
        else:
            return self.form_invalid(form)

    def form_invalid(self, form):
        """
        If the form is invalid, store the form data and errors in the session
        using a key specific to the form class and redirect to the success URL.
        """
        form_class_name = type(form).__name__
        self.request.session[f'form_errors_{form_class_name}'] = form.errors.as_json()
        self.request.session[f'form_data_{form_class_name}'] = form.data
        
        return redirect(self.get_success_url())

    def get_form_kwargs(self):
        """
        Return the keyword arguments for instantiating the form.
        On a GET request, it checks the session for previous form data if
        this form was the one that previously failed.
        """
        kwargs = super().get_form_kwargs()
        form_class_name = self.get_form_class().__name__
        
        if self.request.method == 'GET':
            session_data = self.request.session.pop(f'form_data_{form_class_name}', None)
            if session_data:
                kwargs['data'] = session_data
        
        return kwargs

    def get_context_data(self, **kwargs):
        """
        Inserts forms into the context. If there were errors in the session
        for a specific form, they are loaded into the corresponding form instance.
        """
        context = super().get_context_data(**kwargs)

        # Iterate over all items in the context dictionary.
        for form_name, form_instance in context.items():
            # **FIXED LINE**: Check if the item is an instance of a Django Form.
            if isinstance(form_instance, Form):
                form_class_name = type(form_instance).__name__
                
                # Check for session errors for this specific form class.
                form_errors_json = self.request.session.pop(f'form_errors_{form_class_name}', None)
                
                if form_errors_json:
                    errors = json.loads(form_errors_json)
                    form_instance._errors = ErrorDict(errors)
                    
                    # Add a flag to the context to indicate which form had errors.
                    # This helps the template decide whether to show the modal on load.
                    context[f'{form_name}_has_errors'] = True
        
        return context