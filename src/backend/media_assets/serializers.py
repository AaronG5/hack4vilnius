"""Serializer for the nested `Media` representation."""

from typing import TYPE_CHECKING, cast, final

from media_assets.models import Media
from rest_framework import serializers
from users.serializers import UserRefSerializer

if TYPE_CHECKING:
    from rest_framework.request import Request


@final
class MediaSerializer(serializers.ModelSerializer[Media]):
    """Public representation of a `Media` attachment."""

    file_url = serializers.SerializerMethodField()
    uploaded_by = UserRefSerializer(read_only=True)

    @final
    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        """Expose every contract field; writes go through the create flows."""

        model = Media
        fields = ("id", "type", "file_url", "created_at", "uploaded_by")
        read_only_fields = fields

    def get_file_url(self, media: Media) -> str:
        """Build an absolute URL for the uploaded file."""
        # `Field.context` is a `Mapping[str, Any]`, hence the `cast`.
        request = cast("Request | None", self.context.get("request"))
        url = media.file.url
        if request is not None:
            return request.build_absolute_uri(url)
        return url
