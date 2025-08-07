from django.shortcuts import render

def main_menu_page(request):
    context = {}
    return render(request, 'main_menu/page.html', context)