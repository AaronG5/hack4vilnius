"""Serializers for reading and updating `Problem`s."""

from typing import ClassVar, final

import validations.services as validation_services
from categories.serializers import CategorySerializer
from institutions.serializers import InstitutionSerializer
from problems.models import Problem
from reports.serializers import ReportSerializer
from rest_framework import serializers
from users.models import User
from validations.serializers import ValidationSerializer
from vilnius_backend.choices import ProblemStatus
from vilnius_backend.geo import GeoPointSerializer


class ProblemSerializer(serializers.ModelSerializer[Problem]):
    """Public representation of a `Problem`."""

    location: GeoPointSerializer = GeoPointSerializer()
    category: CategorySerializer = CategorySerializer(read_only=True)
    institution: InstitutionSerializer = InstitutionSerializer(read_only=True)
    urgency_votes = serializers.SerializerMethodField()
    my_urgency_vote = serializers.SerializerMethodField()

    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        """Expose every contract field; status changes via the status serializer."""

        model: ClassVar[type[Problem]] = Problem
        fields: ClassVar[tuple[str, ...]] = (
            "id",
            "status",
            "urgency",
            "title",
            "address",
            "near_sensitive",
            "legitimacy_score",
            "location",
            "category",
            "institution",
            "urgency_votes",
            "my_urgency_vote",
            "created_at",
            "updated_at",
        )
        read_only_fields: ClassVar[tuple[str, ...]] = fields

    def get_urgency_votes(self, problem: Problem) -> dict[str, int]:
        """Count how urgent residents think this problem is."""
        return validation_services.urgency_votes(problem)

    def get_my_urgency_vote(self, problem: Problem) -> str | None:
        """Return the requesting user's own urgency vote, if they cast one."""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not isinstance(user, User):
            return None
        return validation_services.urgency_vote_of(problem, user)


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
