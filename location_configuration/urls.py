"""
URL configuration for the Location Configuration application.

This file maps URLs to their corresponding views, organizing them by function:
- Page-Rendering URLs: For standard GET requests that display a page.
- API-like URLs: For GET requests from the frontend to fetch dynamic data.
- Form Submission URLs: For POST requests from AJAX forms.
"""

from django.urls import path
from . import views

app_name = 'location_configuration'

urlpatterns = [
    # --- Page-Rendering URLs (GET) ---
    path('', views.LocationsTabView.as_view(), name='location_configuration'),
    path('locations/', views.LocationsTabView.as_view(), name='locations_tab'),
    path('types/', views.LocationTypesTabView.as_view(), name='types_tab'),

    # --- API-like URLs for fetching data (GET) ---
    path('get-child-types/<int:parent_id>/', views.get_child_location_types, name='get_child_location_types'),
    path('get-location-details/<int:location_id>/', views.get_location_details, name='get_location_details'),

    # --- Form submission URLs (POST) ---
    path('types/add/', views.AddLocationTypeView.as_view(), name='add_location_type'),
    path('types/edit/<int:pk>/', views.EditLocationTypeView.as_view(), name='edit_location_type'),
    path('locations/add/', views.AddLocationView.as_view(), name='add_location'),
    path('locations/add-child/', views.AddLocationView.as_view(), name='add_child_location'),
    path('locations/edit/<int:pk>/', views.EditLocationView.as_view(), name='edit_location'),
]