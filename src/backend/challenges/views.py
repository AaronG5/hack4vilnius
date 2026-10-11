"""Views for listing, reading and joining challenges."""

from typing import TYPE_CHECKING, cast, final, override

import badges.services as badge_services
import challenges.services as challenge_services
from challenges.models import Challenge
from challenges.serializers import ChallengeDetailSerializer, ChallengeSerializer
from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from vilnius_backend.generic_views import (
    DefaultListAPIView,
    DefaultRetrieveAPIView,
)

if TYPE_CHECKING:
    from django.db.models import QuerySet
    from users.models import User


@final
class ChallengeListView(DefaultListAPIView[Challenge]):
    """`GET /api/challenges` - list challenges."""

    permission_classes = (AllowAny,)
    serializer_class = ChallengeSerializer

    @override
    def get_queryset(self) -> "QuerySet[Challenge]":
        """
        List challenges, settling any that ended first.

        Settling here means ended challenges pay out even where nobody has
        scheduled `manage.py settle_challenges`; it's cheap once settled.
        """
        _ = challenge_services.settle_ended_challenges()
        return Challenge.objects.prefetch_related("categories")


@final
class ChallengeDetailView(DefaultRetrieveAPIView[Challenge]):
    """`GET /api/challenges/{id}` - challenge details."""

    permission_classes = (AllowAny,)
    serializer_class = ChallengeDetailSerializer
    lookup_url_kwarg = "id"
    queryset = Challenge.objects.prefetch_related("categories", "participants")


@final
class ChallengeJoinView(APIView):
    """`POST`/`DELETE /api/challenges/{id}/join` - join or leave a challenge."""

    permission_classes = (IsAuthenticated,)

    def post(self, request: Request, id: str) -> Response:  # noqa: A002
        """Add the requesting user to the challenge's participants."""
        challenge = get_object_or_404(Challenge, pk=id)
        user = cast("User", request.user)
        challenge.participants.add(user)
        _ = badge_services.check_new_badges(user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def delete(self, request: Request, id: str) -> Response:  # noqa: A002
        """Remove the requesting user from the challenge's participants."""
        challenge = get_object_or_404(Challenge, pk=id)
        challenge.participants.remove(cast("User", request.user))
        return Response(status=status.HTTP_204_NO_CONTENT)
