"""Views for listing badges and the current user's earned badges."""

from typing import TYPE_CHECKING, cast, final, override

from badges.models import Badge, UserBadge
from badges.serializers import BadgeSerializer, EarnedBadgeSerializer
from rest_framework.permissions import AllowAny, IsAuthenticated
from vilnius_backend.generic_views import DefaultListAPIView

if TYPE_CHECKING:
    from django.db.models import QuerySet
    from users.models import User


@final
class BadgeListView(DefaultListAPIView[Badge]):
    """`GET /api/badges` — list all available badges."""

    permission_classes = (AllowAny,)
    serializer_class = BadgeSerializer
    queryset = Badge.objects.select_related("district").all()


@final
class MyBadgesView(DefaultListAPIView[UserBadge]):
    """`GET /api/users/me/badges` — badges earned by the current user."""

    permission_classes = (IsAuthenticated,)
    serializer_class = EarnedBadgeSerializer

    @override
    def get_queryset(self) -> "QuerySet[UserBadge]":
        """Earned-badge records belonging to the requesting user."""
        user = cast("User", self.request.user)
        return UserBadge.objects.filter(user=user).select_related(
            "badge",
            "badge__district",
        )
