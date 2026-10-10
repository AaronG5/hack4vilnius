"""URL routes for the geocoding app."""

from django.urls import path
from geocoding.views import GeocodeView

app_name = "geocoding"

urlpatterns = [
    path("geocode", GeocodeView.as_view(), name="search"),
]
