import json
from django.forms.utils import ErrorDict
from django.shortcuts import redirect
from django.views.generic.edit import FormMixin
from django.db.models.query import QuerySet
from django.forms import ModelMultipleChoiceField

class FormHandlingMixin(FormMixin):
    """
    A mixin to handle form processing using the Post-Redirect-Get pattern.
    
    It stores form errors and data in the session on POST failure and
    reconstitutes the form on the subsequent GET request. This prevents
    form resubmission on page refresh and keeps the form state.
    """
    
    def post(self, request, *args, **kwargs):
        """
        Handles POST requests, instantiating a form instance with the passed
        POST variables and then validating it.
        """
        form = self.get_form()
        if form.is_valid():
            return self.form_valid(form)
        else:
            return self.form_invalid(form)

    def form_invalid(self, form):
        """
        If the form is invalid, store the form data and errors in the session
        and redirect to the success URL.
        """
        # Store the name of the form class that failed.
        self.request.session['failed_form_class'] = self.get_form_class().__name__
        
        self.request.session['form_errors'] = form.errors.as_json()
        self.request.session['form_data'] = form.data
        
        return redirect(self.get_success_url())

    def get_form_kwargs(self):
        """
        Return the keyword arguments for instantiating the form.
        On a GET request, it checks the session for previous form data if
        this form was the one that previously failed.
        """
        kwargs = super().get_form_kwargs()
        
        # On GET, check if this form class was the one that failed.
        failed_form_class = self.request.session.get('failed_form_class')
        if self.request.method == 'GET' and failed_form_class == self.get_form_class().__name__:
            kwargs['data'] = self.request.session.pop('form_data', None)
        
        return kwargs

    def get_context_data(self, **kwargs):
        """
        Insert the form into the context dictionary. If there were errors
        in the session for this specific form, they are loaded into the form instance.
        """
        context = super().get_context_data(**kwargs)
        form = context.get('form')
        
        if form:
            failed_form_class = self.request.session.get('failed_form_class')
            # Only load errors if they belong to this form.
            if failed_form_class == type(form).__name__:
                form_errors = self.request.session.pop('form_errors', None)
                # Clear the flag since we're consuming the error state.
                self.request.session.pop('failed_form_class', None)
                if form_errors:
                    errors = json.loads(form_errors)
                    form._errors = ErrorDict(errors)
        
        return context