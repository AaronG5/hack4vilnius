"""URL routes for the geocoding app."""

from django.urls import path
from geocoding.views import GeocodeView, WalkingRouteView

app_name = "geocoding"

urlpatterns = [
    path("geocode", GeocodeView.as_view(), name="search"),
    path("routes/walk", WalkingRouteView.as_view(), name="walk"),
]
