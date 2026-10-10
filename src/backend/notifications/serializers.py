"""Serializer for `Notification`."""

from typing import final

from notifications.models import Notification
from problems.models import Problem
from rest_framework import serializers


@final
class NotificationSerializer(serializers.ModelSerializer[Notification]):
    """Public representation of a `Notification`."""

    # `pk_field` so the id renders as a uuid string, matching the contract.
    problem = serializers.PrimaryKeyRelatedField[Problem](
        read_only=True,
        pk_field=serializers.UUIDField(),
    )

    @final
    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        """Expose every contract field; `read` is flipped via a dedicated endpoint."""

        model = Notification
        fields = ("id", "message", "event_type", "read", "problem", "created_at")
        read_only_fields = fields
