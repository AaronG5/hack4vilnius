"""URL routes for the validations app."""

from django.urls import path
from validations.views import ValidationListCreateView

app_name = "validations"

urlpatterns = [
    path(
        "problems/<uuid:id>/validations",
        ValidationListCreateView.as_view(),
        name="list-create",
    ),
]
