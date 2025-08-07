from django.urls import path
from . import views

app_name = 'inventory_control'
urlpatterns = [
    path('', views.inventory_control_page, name='inventory_control')
]