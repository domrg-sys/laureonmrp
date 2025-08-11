from django.urls import path
from . import views

app_name = 'core'

urlpatterns = [
    path('delete/<str:app_label>/<str:model_name>/<int:pk>/', views.GenericDeleteView.as_view(), name='generic_delete'),
]