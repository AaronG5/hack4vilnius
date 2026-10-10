"""URL routes for the reports app."""

from django.urls import path
from reports.views import ReportCreateView, ReportDetailView

app_name = "reports"

urlpatterns = [
    path("reports", ReportCreateView.as_view(), name="create"),
    path("reports/<uuid:id>", ReportDetailView.as_view(), name="detail"),
]
