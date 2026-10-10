"""Serializers for reading and creating `Report`s."""

from typing import final, override

from categories.models import Category
from media_assets.serializers import MediaSerializer
from moderation.models import ModerationFlag
from problems.models import Problem
from reports.models import Report
from rest_framework import serializers
from users.serializers import UserRefSerializer
from vilnius_backend.choices import ProblemUrgency


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


MAX_SUGGESTIONS = 5
DEFAULT_SUGGESTIONS = 3


@final
class ReportAnalyzeSerializer(serializers.Serializer[object]):
    """Validates a pre-submit analysis request (`POST /api/reports/analyze`)."""

    description: serializers.CharField = serializers.CharField(trim_whitespace=True)
    limit: serializers.IntegerField = serializers.IntegerField(
        min_value=1,
        max_value=MAX_SUGGESTIONS,
        required=False,
        default=DEFAULT_SUGGESTIONS,
    )


@final
class ReportCreateSerializer(serializers.Serializer[Report]):
    """
    Validates a new report submission (`POST /api/reports`).

    `category` is omitted to let AI suggest one; `problem` is omitted to
    report a new problem rather than attach to an existing one. `latitude`
    and `longitude` locate a new problem and are required unless `problem`
    is given — see the `location` note on `ReportCreate` in api/openapi.yaml.
    `media` is optional: a text-only report is allowed. `title`, `address`,
    `urgency` and `near_sensitive` describe a new problem and are ignored
    when attaching to an existing one.
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
    title = serializers.CharField(
        max_length=120,
        required=False,
        allow_blank=True,
        default="",
    )
    address = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        default="",
    )
    # The reporter's own urgency vote; without it, the category default applies.
    urgency = serializers.ChoiceField(
        choices=ProblemUrgency.choices,
        required=False,
    )
    near_sensitive = serializers.BooleanField(required=False, default=False)
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
