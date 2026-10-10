"""Serializers for `Badge` and earned-badge records."""

from typing import final

from badges.models import Badge, UserBadge
from districts.serializers import DistrictSerializer
from rest_framework import serializers


@final
class BadgeSerializer(serializers.ModelSerializer[Badge]):
    """Public representation of a `Badge`."""

    district = DistrictSerializer(read_only=True)

    @final
    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        """Expose every contract field; `id` is read-only."""

        model = Badge
        fields = (
            "id",
            "name",
            "description",
            "icon",
            "criteria",
            "required_validation_count",
            "district",
        )
        read_only_fields = ("id",)


@final
class EarnedBadgeSerializer(serializers.ModelSerializer[UserBadge]):
    """A badge earned by the current user, and when."""

    badge = BadgeSerializer(read_only=True)
    earned_at = serializers.DateTimeField(source="created_at", read_only=True)

    @final
    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        """Matches the contract's `EarnedBadge` shape."""

        model = UserBadge
        fields = ("badge", "earned_at")
        read_only_fields = fields
