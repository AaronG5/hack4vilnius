"""Tests for the (stubbed) report classification and moderation services."""

import pytest
from categories.models import Category
from django.core.files.uploadedfile import SimpleUploadedFile
from reports.services import detect_abuse, suggest_category, suggest_category_label
from vilnius_backend.choices import ProblemUrgency


def _category(name: str) -> Category:
    """Create a category with the given name."""
    return Category.objects.create(
        name=name,
        description=f"{name} problems.",
        icon=f"https://example.com/icons/{name.lower()}.svg",
        default_urgency=ProblemUrgency.CAN_WAIT,
    )


@pytest.mark.django_db
class TestSuggestCategory:
    """Tests for `suggest_category`."""

    def test_prefers_a_category_named_other(self, category: Category) -> None:
        """Prefer the deliberate catch-all category over an alphabetical first."""
        del category
        other = _category("Other")
        _ = _category("Graffiti")

        assert suggest_category("Something odd.") == other

    def test_matches_other_case_insensitively(self) -> None:
        """The fallback lookup doesn't depend on how "other" was capitalised."""
        other = _category("OTHER")

        assert suggest_category("Something odd.") == other

    def test_falls_back_to_any_category(self, category: Category) -> None:
        """Without an "Other" category, some existing category is still returned."""
        assert suggest_category("A pothole.") == category

    def test_returns_none_without_any_categories(self) -> None:
        """With nothing configured there is nothing to suggest."""
        assert suggest_category("A pothole.") is None


class TestSuggestCategoryLabel:
    """Tests for `suggest_category_label`."""

    def test_returns_none_while_stubbed(self) -> None:
        """No free-text AI suggestion is produced yet."""
        assert suggest_category_label("A pothole.") is None


class TestDetectAbuse:
    """Tests for `detect_abuse`."""

    def test_never_flags_while_stubbed(self) -> None:
        """Abuse screening is deferred, so nothing is flagged."""
        upload = SimpleUploadedFile("p.jpg", b"bytes", content_type="image/jpeg")

        assert detect_abuse("A pothole.", [upload]) is False
