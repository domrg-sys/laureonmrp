import json
from django.forms.utils import ErrorDict
from django.shortcuts import redirect
from django.views.generic.edit import FormMixin
from django.db.models.query import QuerySet

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
        form_data = form.data.copy()
        for name, value in form_data.items():
            # --- THIS IS THE CORRECTED SECTION ---
            # We must check if the key from the POST data is a real field
            # on the form before trying to access it. This prevents a KeyError
            # for items like 'csrfmiddlewaretoken'.
            if name in form.fields and isinstance(form.fields[name].initial, QuerySet):
                # getlist is used to handle multiple selections for ManyToManyFields
                form_data.setlist(name, [obj.pk for obj in value])

        self.request.session['form_errors'] = form.errors.as_json()
        self.request.session['form_data'] = form_data
        
        return redirect(self.get_success_url())

    def get_form_kwargs(self):
        """
        Return the keyword arguments for instantiating the form.
        On a GET request, it checks the session for previous form data.
        """
        kwargs = super().get_form_kwargs()
        
        # On a GET request, check for and load previous data from the session
        if self.request.method == 'GET':
            kwargs['data'] = self.request.session.pop('form_data', None)
        
        return kwargs

    def get_context_data(self, **kwargs):
        """
        Insert the form into the context dictionary. If there were errors
        in the session, they are loaded into the form instance.
        """
        context = super().get_context_data(**kwargs)
        form = context.get('form')
        
        if form:
            form_errors = self.request.session.pop('form_errors', None)
            if form_errors:
                errors = json.loads(form_errors)
                form._errors = ErrorDict(errors)
        
        return context
