"""Views for staff review of flagged reports."""

from typing import TYPE_CHECKING, cast, final

import moderation.services as moderation_services
from django.utils import timezone
from moderation.models import ModerationFlag
from moderation.serializers import (
    ModerationFlagSerializer,
    ModerationFlagUpdateSerializer,
)
from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from users.permissions import IsCityAdministratorOrStaff
from vilnius_backend.choices import ModerationFlagStatus
from vilnius_backend.generic_views import DefaultListAPIView

if TYPE_CHECKING:
    from rest_framework.utils.serializer_helpers import ReturnDict
    from users.models import User


@final
class ModerationFlagListView(DefaultListAPIView[ModerationFlag]):
    """`GET /api/moderation/flags` - list flagged reports pending review."""

    permission_classes = (IsCityAdministratorOrStaff,)
    serializer_class = ModerationFlagSerializer
    queryset = ModerationFlag.objects.filter(
        status=ModerationFlagStatus.PENDING,
    ).select_related("report", "reviewed_by")


@final
class ModerationFlagUpdateView(APIView):
    """`PUT /api/moderation/flags/{id}` - approve or dismiss a flag."""

    permission_classes = (IsCityAdministratorOrStaff,)

    def put(self, request: Request, id: str) -> Response:  # noqa: A002
        """Record the review decision and (eventually) its trust-score effect."""
        flag = get_object_or_404(ModerationFlag, pk=id)
        serializer = ModerationFlagUpdateSerializer(data=request.data)
        _ = serializer.is_valid(raise_exception=True)
        new_status = cast("str", serializer.validated_data["status"])

        reporter = flag.report.user
        reporter.trust_score = moderation_services.compute_trust_adjustment(
            reporter.trust_score,
            new_status,
        )
        reporter.save(update_fields=["trust_score"])

        flag.status = new_status
        flag.reviewed_by = cast("User", request.user)
        flag.reviewed_at = timezone.now()
        flag.save(update_fields=["status", "reviewed_by", "reviewed_at"])

        output = ModerationFlagSerializer(flag)
        return Response(
            cast("ReturnDict[str, object]", output.data),
            status=status.HTTP_200_OK,
        )
