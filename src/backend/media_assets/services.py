"""Helpers for turning an uploaded file into a `Media` record."""

from typing import TYPE_CHECKING

from vilnius_backend.choices import MediaType

if TYPE_CHECKING:
    from django.core.files.uploadedfile import UploadedFile

_VIDEO_PREFIX = "video/"
_AUDIO_PREFIX = "audio/"


def infer_media_type(uploaded_file: "UploadedFile[bytes]") -> str:
    """
    Guess a `MediaType` from an uploaded file's content type.

    Defaults to `photo` when the content type is missing or unrecognized.
    """
    content_type = uploaded_file.content_type or ""
    if content_type.startswith(_VIDEO_PREFIX):
        return MediaType.VIDEO
    if content_type.startswith(_AUDIO_PREFIX):
        return MediaType.AUDIO
    return MediaType.PHOTO
