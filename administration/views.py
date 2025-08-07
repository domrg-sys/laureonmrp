from django.shortcuts import render
from django.contrib.auth.decorators import permission_required

@permission_required('administration.view_administration_page', raise_exception=True)
def administration_page(request):
    context = {}
    return render(request, 'administration/page.html', context)