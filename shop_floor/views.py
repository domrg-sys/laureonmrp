from django.shortcuts import render
from django.contrib.auth.decorators import permission_required

@permission_required('shop_floor.view_shopfloor_page', raise_exception=True)
def shop_floor_page(request):
    context = {}
    return render(request, 'shop_floor/page.html', context)