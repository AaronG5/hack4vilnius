"""Serializers for `Category`."""

from typing import final

from categories.models import Category
from institutions.serializers import InstitutionSerializer
from rest_framework import serializers


@final
class CategorySerializer(serializers.ModelSerializer[Category]):
    """Public representation of a `Category`."""

    institution = InstitutionSerializer(read_only=True)

    @final
    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        """Expose every contract field; `id` is read-only."""

        model = Category
        fields = (
            "id",
            "name",
            "description",
            "icon",
            "default_urgency",
            "institution",
        )
        read_only_fields = ("id",)
