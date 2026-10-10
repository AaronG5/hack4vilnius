"""Serializers for reading and resolving `ModerationFlag`s."""

from typing import final

from moderation.models import ModerationFlag
from reports.models import Report
from rest_framework import serializers
from users.serializers import UserRefSerializer
from vilnius_backend.choices import ModerationFlagStatus


@final
class ModerationFlagSerializer(serializers.ModelSerializer[ModerationFlag]):
    """Public representation of a `ModerationFlag`."""

    reviewed_by = UserRefSerializer(read_only=True)
    # `pk_field` so the id renders as a uuid string, matching the contract.
    report = serializers.PrimaryKeyRelatedField[Report](
        read_only=True,
        pk_field=serializers.UUIDField(),
    )

    @final
    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        """Expose every contract field; writes go through the update serializer."""

        model = ModerationFlag
        fields = ("id", "reason", "status", "report", "reviewed_by", "reviewed_at")
        read_only_fields = fields


@final
class ModerationFlagUpdateSerializer(serializers.Serializer[ModerationFlag]):
    """Validates approving or dismissing a flag (`PUT /moderation/flags/{id}`)."""

    status = serializers.ChoiceField(
        choices=[
            ModerationFlagStatus.CONFIRMED_HARMFUL,
            ModerationFlagStatus.DISMISSED,
        ],
    )
