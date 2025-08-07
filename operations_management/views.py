from django.shortcuts import render
from django.contrib.auth.decorators import permission_required

@permission_required('operations_management.view_operationsmanagement_page', raise_exception=True)
def operations_management_page(request):
    context = {}
    return render(request, 'operations_management/page.html', context)