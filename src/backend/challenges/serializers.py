"""Serializers for reading `Challenge`s."""

from typing import ClassVar, final

import challenges.services as challenge_services
from categories.serializers import CategorySerializer
from challenges.models import Challenge
from rest_framework import serializers
from users.models import User


class ChallengeSerializer(serializers.ModelSerializer[Challenge]):
    """Public representation of a `Challenge`."""

    categories: CategorySerializer = CategorySerializer(many=True, read_only=True)
    participant_count: serializers.SerializerMethodField = (
        serializers.SerializerMethodField()
    )
    joined: serializers.SerializerMethodField = serializers.SerializerMethodField()

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
            "participant_count",
            "joined",
        )
        read_only_fields: ClassVar[tuple[str, ...]] = ("id",)

    def get_participant_count(self, challenge: Challenge) -> int:
        """Count users who have joined this challenge."""
        return challenge.participants.count()

    def get_joined(self, challenge: Challenge) -> bool:
        """Whether the requesting user has joined it (False when anonymous)."""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not isinstance(user, User):
            return False
        return challenge.participants.contains(user)


@final
class ChallengeDetailSerializer(ChallengeSerializer):
    """A `Challenge` with its participant count and progress milestones."""

    milestones = serializers.SerializerMethodField()

    @final
    class Meta(ChallengeSerializer.Meta):
        """Adds `milestones` to the base fields."""

        fields = (*ChallengeSerializer.Meta.fields, "milestones")
        read_only_fields = fields

    def get_milestones(self, challenge: Challenge) -> list[dict[str, object]]:
        """Delegate to the (stubbed) milestone-tracking service."""
        return [
            dict(milestone)
            for milestone in challenge_services.get_milestones(challenge)
        ]
