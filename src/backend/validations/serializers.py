"""Serializers for reading and creating `Validation`s."""

from typing import final

from media_assets.serializers import MediaSerializer
from problems.models import Problem
from rest_framework import serializers
from users.serializers import UserRefSerializer
from validations.models import Validation


@final
class ValidationSerializer(serializers.ModelSerializer[Validation]):
    """Public representation of a `Validation`."""

    user = UserRefSerializer(read_only=True)
    media = MediaSerializer(many=True, read_only=True)
    # `pk_field` so the id renders as a uuid string, matching the contract.
    problem = serializers.PrimaryKeyRelatedField[Problem](
        read_only=True,
        pk_field=serializers.UUIDField(),
    )

    @final
    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        """Expose every contract field; writes go through the create serializer."""

        model = Validation
        fields = (
            "id",
            "is_valid",
            "description",
            "points_awarded",
            "user",
            "problem",
            "media",
            "created_at",
        )
        read_only_fields = fields


@final
class ValidationCreateSerializer(serializers.Serializer[Validation]):
    """Validates a new validation submission (`POST /problems/{id}/validations`)."""

    # The contract names this field `is_valid`, which shadows
    # `Serializer.is_valid()` as far as a type checker can see. DRF's
    # metaclass pops declared fields off the class, so the method stays
    # reachable at runtime.
    is_valid = serializers.BooleanField()  # pyright: ignore[reportAssignmentType]
    description = serializers.CharField()
    # Optional: answering "still there" / "fixed" must stay a single tap.
    media = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        default=list,
    )
