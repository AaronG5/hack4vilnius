"""Serializers for reading `Challenge`s."""

from typing import ClassVar, final

import challenges.services as challenge_services
from categories.serializers import CategorySerializer
from challenges.models import Challenge
from rest_framework import serializers


class ChallengeSerializer(serializers.ModelSerializer[Challenge]):
    """Public representation of a `Challenge`."""

    categories: CategorySerializer = CategorySerializer(many=True, read_only=True)

    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        """Expose every contract field; `id` is read-only."""

        model: ClassVar[type[Challenge]] = Challenge
        fields: ClassVar[tuple[str, ...]] = (
            "id",
            "name",
            "description",
            "start_date",
            "end_date",
            "reward_points",
            "status",
            "categories",
        )
        read_only_fields: ClassVar[tuple[str, ...]] = ("id",)


@final
class ChallengeDetailSerializer(ChallengeSerializer):
    """A `Challenge` with its participant count and progress milestones."""

    participant_count = serializers.SerializerMethodField()
    milestones = serializers.SerializerMethodField()

    @final
    class Meta(ChallengeSerializer.Meta):
        """Adds `participant_count` and `milestones` to the base fields."""

        fields = (*ChallengeSerializer.Meta.fields, "participant_count", "milestones")
        read_only_fields = fields

    def get_participant_count(self, challenge: Challenge) -> int:
        """Count users who have joined this challenge."""
        return challenge.participants.count()

    def get_milestones(self, challenge: Challenge) -> list[dict[str, object]]:
        """Delegate to the (stubbed) milestone-tracking service."""
        return [
            dict(milestone)
            for milestone in challenge_services.get_milestones(challenge)
        ]
