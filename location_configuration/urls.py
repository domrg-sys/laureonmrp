from django.urls import path
from . import views

app_name = 'location_configuration'

urlpatterns = [
    # When a user goes to the root of the app, send them to the locations tab view.
    path('', views.LocationsTabView.as_view(), name='location_configuration'),

    # URLs for the "Locations" tab.
    path('locations/', views.LocationsTabView.as_view(), name='locations_tab'),
    path('get-child-types/<int:parent_id>/', views.get_child_location_types, name='get_child_location_types'),

    # URLs for the "Location Types" tab.
    path('types/', views.LocationTypesTabView.as_view(), name='types_tab'),
    path('types/edit/', views.LocationTypesTabView.as_view(), name='edit_type'),
]
