"""URL routes for the badges app."""

from badges.views import BadgeListView, MyBadgesView
from django.urls import path

app_name = "badges"

urlpatterns = [
    path("badges", BadgeListView.as_view(), name="list"),
    path("users/me/badges", MyBadgesView.as_view(), name="my-badges"),
]
