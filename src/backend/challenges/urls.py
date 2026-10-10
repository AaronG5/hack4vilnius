"""URL routes for the challenges app."""

from challenges.views import ChallengeDetailView, ChallengeJoinView, ChallengeListView
from django.urls import path

app_name = "challenges"

urlpatterns = [
    path("challenges", ChallengeListView.as_view(), name="list"),
    path("challenges/<uuid:id>", ChallengeDetailView.as_view(), name="detail"),
    path("challenges/<uuid:id>/join", ChallengeJoinView.as_view(), name="join"),
]
