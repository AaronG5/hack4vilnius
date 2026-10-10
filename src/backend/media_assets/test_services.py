"""Tests for inferring a media type from an uploaded file."""

from django.core.files.uploadedfile import SimpleUploadedFile
from media_assets.services import infer_media_type
from vilnius_backend.choices import MediaType


class TestInferMediaType:
    """Tests for `infer_media_type`."""

    def test_detects_a_photo(self) -> None:
        """An image content type is a photo."""
        upload = SimpleUploadedFile("p.jpg", b"bytes", content_type="image/jpeg")

        assert infer_media_type(upload) == MediaType.PHOTO

    def test_detects_a_video(self) -> None:
        """A video content type is a video."""
        upload = SimpleUploadedFile("v.mp4", b"bytes", content_type="video/mp4")

        assert infer_media_type(upload) == MediaType.VIDEO

    def test_detects_audio(self) -> None:
        """An audio content type is audio."""
        upload = SimpleUploadedFile("a.m4a", b"bytes", content_type="audio/mp4")

        assert infer_media_type(upload) == MediaType.AUDIO

    def test_defaults_to_photo_for_unknown_types(self) -> None:
        """An unrecognized content type falls back to photo."""
        upload = SimpleUploadedFile(
            "f.bin", b"bytes", content_type="application/x-thing"
        )

        assert infer_media_type(upload) == MediaType.PHOTO

    def test_defaults_to_photo_without_a_content_type(self) -> None:
        """A missing content type falls back to photo rather than erroring."""
        upload = SimpleUploadedFile("f.bin", b"bytes", content_type="")

        assert infer_media_type(upload) == MediaType.PHOTO
