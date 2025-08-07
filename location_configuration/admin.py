from django.contrib import admin
from .models import LocationType, Location, LocationSpace

admin.site.register(LocationType)
admin.site.register(Location)
admin.site.register(LocationSpace)
