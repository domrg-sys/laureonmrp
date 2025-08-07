from django.urls import path
from . import views

app_name = 'shop_floor'
urlpatterns = [
    path('', views.shop_floor_page, name='shop_floor')
]