"""Serializer for the nested `Institution` representation."""

from typing import final

from institutions.models import Institution
from rest_framework import serializers


@final
class InstitutionSerializer(serializers.ModelSerializer[Institution]):
    """Public representation of an `Institution`."""

    @final
    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        """Expose every contract field; `id` is read-only."""

        model = Institution
        fields = ("id", "name", "contact_info")
        read_only_fields = ("id",)
