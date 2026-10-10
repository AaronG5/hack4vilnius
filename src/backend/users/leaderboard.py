"""`GET /api/leaderboard` - residents ranked by points, city-wide or per district."""

from typing import TYPE_CHECKING, cast, final

from districts.models import District
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from users.models import User
from users.serializers import UserRefSerializer

if TYPE_CHECKING:
    from django.db.models import QuerySet

DEFAULT_LIMIT = 20
MAX_LIMIT = 100


@final
class LeaderboardQuerySerializer(serializers.Serializer[object]):
    """Validates the leaderboard's query parameters."""

    district = serializers.PrimaryKeyRelatedField[District](
        queryset=District.objects.all(),
        required=False,
    )
    limit = serializers.IntegerField(
        min_value=1,
        max_value=MAX_LIMIT,
        default=DEFAULT_LIMIT,
    )


def _ranked(district: District | None) -> "QuerySet[User]":
    """
    Residents with points, best first.

    Ties go to whoever joined first, so a rank never changes without points
    changing. With `district`, only residents who chose it in their profile.
    """
    users = User.objects.filter(is_active=True, points__gt=0)
    if district is not None:
        users = users.filter(district=district)
    return users.select_related("district").order_by("-points", "date_joined", "id")


def _entry(rank: int, user: User) -> dict[str, object]:
    """One leaderboard row."""
    district = user.district
    return {
        "rank": rank,
        "user": cast("dict[str, object]", UserRefSerializer(user).data),
        "points": user.points,
        "district": (
            {"id": str(district.id), "name": district.name} if district else None
        ),
    }


@final
class LeaderboardView(APIView):
    """`GET /api/leaderboard` - the top residents, and where you stand."""

    permission_classes = (AllowAny,)

    def get(self, request: Request) -> Response:
        """Return the top `limit` residents, plus the requester's own row."""
        query = LeaderboardQuerySerializer(data=request.query_params)
        _ = query.is_valid(raise_exception=True)
        params = cast("dict[str, object]", query.validated_data)
        district = cast("District | None", params.get("district"))
        ranked = _ranked(district)

        entries = [
            _entry(rank, user)
            for rank, user in enumerate(ranked[: cast("int", params["limit"])], 1)
        ]
        me: dict[str, object] | None = None
        user = request.user
        if isinstance(user, User) and ranked.contains(user):
            ahead = ranked.filter(points__gt=user.points).count() + (
                ranked.filter(
                    points=user.points, date_joined__lt=user.date_joined
                ).count()
            )
            me = _entry(ahead + 1, user)
        return Response({"entries": entries, "me": me})
