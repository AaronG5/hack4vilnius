"""Serializers for reading and creating `Report`s."""

from typing import final, override

from categories.models import Category
from media_assets.serializers import MediaSerializer
from moderation.models import ModerationFlag
from problems.models import Problem
from reports.models import Report
from rest_framework import serializers
from users.serializers import UserRefSerializer


@final
class ReportSerializer(serializers.ModelSerializer[Report]):
    """Public representation of a `Report`."""

    user = UserRefSerializer(read_only=True)
    media = MediaSerializer(many=True, read_only=True)
    has_moderation_flag = serializers.SerializerMethodField()
    ai_category_suggestion = serializers.SerializerMethodField()
    # `pk_field` so the id renders as a uuid string, matching the contract.
    problem = serializers.PrimaryKeyRelatedField[Problem](
        read_only=True,
        pk_field=serializers.UUIDField(),
    )

    @final
    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        """Expose every contract field; writes go through `ReportCreateSerializer`."""

        model = Report
        fields = (
            "id",
            "description",
            "ai_category_suggestion",
            "ai_abuse_flag",
            "user",
            "problem",
            "media",
            "has_moderation_flag",
            "created_at",
        )
        read_only_fields = fields

    def get_ai_category_suggestion(self, report: Report) -> str | None:
        """Represent "no suggestion yet" (an empty string) as `null`."""
        return report.ai_category_suggestion or None

    def get_has_moderation_flag(self, report: Report) -> bool:
        """Whether this report was flagged for staff review."""
        return ModerationFlag.objects.filter(report=report).exists()


@final
class ReportCreateSerializer(serializers.Serializer[Report]):
    """
    Validates a new report submission (`POST /api/reports`).

    `category` is omitted to let AI suggest one; `problem` is omitted to
    report a new problem rather than attach to an existing one. `latitude`
    and `longitude` locate a new problem and are required unless `problem`
    is given — see the `location` note on `ReportCreate` in api/openapi.yaml.
    `media` is optional: a text-only report is allowed.
    """

    description = serializers.CharField()
    category = serializers.PrimaryKeyRelatedField[Category](
        queryset=Category.objects.all(),
        required=False,
        allow_null=True,
    )
    problem = serializers.PrimaryKeyRelatedField[Problem](
        queryset=Problem.objects.all(),
        required=False,
        allow_null=True,
    )
    latitude = serializers.FloatField(required=False)
    longitude = serializers.FloatField(required=False)
    # Optional: the app also lets a resident describe a problem in words only.
    media = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        default=list,
    )

    @override
    def validate(self, attrs: dict[str, object]) -> dict[str, object]:
        """Require a location when the report isn't attaching to a problem."""
        if attrs.get("problem") is None and (
            "latitude" not in attrs or "longitude" not in attrs
        ):
            msg = "latitude and longitude are required when reporting a new problem."
            raise serializers.ValidationError(msg)
        return attrs
