"""Serializers for reading and updating `Problem`s."""

from typing import ClassVar, cast, final

import validations.services as validation_services
from categories.models import Category
from categories.serializers import CategorySerializer
from institutions.serializers import InstitutionSerializer
from problems.models import Problem
from problems.priority import Priority, priority_of
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
    priority: serializers.SerializerMethodField = serializers.SerializerMethodField()

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
            "priority",
            "fixed_at",
            "reopened_at",
            "created_at",
            "updated_at",
        )
        read_only_fields: ClassVar[tuple[str, ...]] = fields

    def get_urgency_votes(self, problem: Problem) -> dict[str, int]:
        """Count how urgent residents think this problem is."""
        return validation_services.urgency_votes(problem)

    def get_priority(self, problem: Problem) -> Priority | None:
        """Score this problem from 0 to 100 with its reasons (planning/PRIORITY.md)."""
        return priority_of(problem)

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


@final
class NearbyQuerySerializer(serializers.Serializer[object]):
    """Validates `GET /api/problems/nearby` query parameters."""

    lat = serializers.FloatField(min_value=-90, max_value=90)
    lng = serializers.FloatField(min_value=-180, max_value=180)
    category = serializers.PrimaryKeyRelatedField[Category](
        queryset=Category.objects.all(),
        required=False,
    )
    radius = serializers.FloatField(min_value=1, max_value=1000, default=270)


@final
class NearbyProblemSerializer(ProblemSerializer):
    """A `Problem` with how far it is from the point that was asked about."""

    distance_m = serializers.SerializerMethodField()

    @final
    class Meta(ProblemSerializer.Meta):
        """Adds `distance_m` to the base problem fields."""

        fields = (*ProblemSerializer.Meta.fields, "distance_m")
        read_only_fields = fields

    def get_distance_m(self, problem: Problem) -> int:
        """Return the distance in whole metres, from the view's context."""
        distances = cast("dict[object, float]", self.context["distances"])
        return round(distances[problem.id])
