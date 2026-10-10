"""URL routes for the districts app."""

from districts.views import DistrictListView
from django.urls import path

app_name = "districts"

urlpatterns = [
    path("districts", DistrictListView.as_view(), name="list"),
]
