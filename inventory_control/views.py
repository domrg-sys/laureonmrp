from django.shortcuts import render
from django.contrib.auth.decorators import permission_required

@permission_required('inventory_control.view_inventorycontrol_page', raise_exception=True)
def inventory_control_page(request):
    context = {}
    return render(request, 'inventory_control/page.html', context)