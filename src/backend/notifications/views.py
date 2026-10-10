"""Views for listing and reading notifications."""

from typing import TYPE_CHECKING, cast, final, override

from notifications.models import Notification
from notifications.serializers import NotificationSerializer
from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from vilnius_backend.generic_views import DefaultListAPIView

if TYPE_CHECKING:
    from django.db.models import QuerySet
    from rest_framework.utils.serializer_helpers import ReturnDict
    from users.models import User


@final
class NotificationListView(DefaultListAPIView[Notification]):
    """`GET /api/notifications` — list current user's notifications."""

    permission_classes = (IsAuthenticated,)
    serializer_class = NotificationSerializer

    @override
    def get_queryset(self) -> "QuerySet[Notification]":
        """Notifications addressed to the requesting user only."""
        user = cast("User", self.request.user)
        return Notification.objects.filter(user=user)


@final
class NotificationMarkReadView(APIView):
    """
    `PUT /api/notifications/{id}/read` — mark a notification as read.

    Need-to-know basis: scoped to the requester's own notifications; any
    other id 404s rather than revealing it exists.
    """

    permission_classes = (IsAuthenticated,)

    def put(self, request: Request, id: str) -> Response:  # noqa: A002
        """Mark the named notification as read."""
        user = cast("User", request.user)
        notification = get_object_or_404(Notification, pk=id, user=user)
        notification.read = True
        notification.save(update_fields=["read"])

        output = NotificationSerializer(notification)
        return Response(
            cast("ReturnDict[str, object]", output.data),
            status=status.HTTP_200_OK,
        )
