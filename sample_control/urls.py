from django.urls import path
from . import views

app_name = 'sample_control'
urlpatterns = [
    path('', views.sample_control_page, name='sample_control'),
    path('location/<int:location_id>/', views.get_location_details, name='get_location_details'),
]