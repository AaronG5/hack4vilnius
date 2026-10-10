"""URL routes for the reports app."""

from django.urls import path
from reports.views import ReportAnalyzeView, ReportCreateView, ReportDetailView

app_name = "reports"

urlpatterns = [
    path("reports", ReportCreateView.as_view(), name="create"),
    path("reports/analyze", ReportAnalyzeView.as_view(), name="analyze"),
    path("reports/<uuid:id>", ReportDetailView.as_view(), name="detail"),
]
