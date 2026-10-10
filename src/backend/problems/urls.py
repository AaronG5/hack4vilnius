"""URL routes for the problems app."""

from django.urls import path
from problems.views import ProblemDetailView, ProblemListView, ProblemStatusUpdateView

app_name = "problems"

urlpatterns = [
    path("problems", ProblemListView.as_view(), name="list"),
    path("problems/<uuid:id>", ProblemDetailView.as_view(), name="detail"),
    path(
        "problems/<uuid:id>/status",
        ProblemStatusUpdateView.as_view(),
        name="status",
    ),
]
