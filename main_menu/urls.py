from django.urls import path
from . import views

app_name = 'main_menu'
urlpatterns = [
    path('', views.main_menu_page, name='main_menu')
]