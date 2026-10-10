"""URL routes for the moderation app."""

from django.urls import path
from moderation.views import ModerationFlagListView, ModerationFlagUpdateView

app_name = "moderation"

urlpatterns = [
    path("moderation/flags", ModerationFlagListView.as_view(), name="list"),
    path(
        "moderation/flags/<uuid:id>",
        ModerationFlagUpdateView.as_view(),
        name="update",
    ),
]
