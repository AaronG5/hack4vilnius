"""URL routes for the notifications app."""

from django.urls import path
from notifications.views import NotificationListView, NotificationMarkReadView

app_name = "notifications"

urlpatterns = [
    path("notifications", NotificationListView.as_view(), name="list"),
    path(
        "notifications/<uuid:id>/read",
        NotificationMarkReadView.as_view(),
        name="mark-read",
    ),
]
