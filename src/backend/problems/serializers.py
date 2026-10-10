"""Serializers for reading and updating `Problem`s."""

from typing import ClassVar, final

from categories.serializers import CategorySerializer
from institutions.serializers import InstitutionSerializer
from problems.models import Problem
from reports.serializers import ReportSerializer
from rest_framework import serializers
from validations.serializers import ValidationSerializer
from vilnius_backend.choices import ProblemStatus
from vilnius_backend.geo import GeoPointSerializer


class ProblemSerializer(serializers.ModelSerializer[Problem]):
    """Public representation of a `Problem`."""

    location: GeoPointSerializer = GeoPointSerializer()
    category: CategorySerializer = CategorySerializer(read_only=True)
    institution: InstitutionSerializer = InstitutionSerializer(read_only=True)

    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        """Expose every contract field; status changes via the status serializer."""

        model: ClassVar[type[Problem]] = Problem
        fields: ClassVar[tuple[str, ...]] = (
            "id",
            "status",
            "urgency",
            "legitimacy_score",
            "location",
            "category",
            "institution",
            "created_at",
            "updated_at",
        )
        read_only_fields: ClassVar[tuple[str, ...]] = fields


@final
class ProblemDetailSerializer(ProblemSerializer):
    """A `Problem` together with its reports and validations."""

    reports = ReportSerializer(many=True, read_only=True)
    validations = ValidationSerializer(many=True, read_only=True)

    @final
    class Meta(ProblemSerializer.Meta):
        """Adds `reports` and `validations` to the base problem fields."""

        fields = (*ProblemSerializer.Meta.fields, "reports", "validations")
        read_only_fields = fields


@final
class ProblemStatusUpdateSerializer(serializers.Serializer[Problem]):
    """Validates a status change (`PUT /api/problems/{id}/status`)."""

    status = serializers.ChoiceField(choices=ProblemStatus.choices)
