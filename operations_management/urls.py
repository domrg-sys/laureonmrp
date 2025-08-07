from django.urls import path
from . import views

app_name = 'operations_management'
urlpatterns = [
    path('', views.operations_management_page, name='operations_management')
]