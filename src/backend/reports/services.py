"""
Report classification/moderation logic. Stubbed for now.

Real AI category suggestion and abuse detection are left for later; callers
get sane, deterministic defaults in the meantime.
"""

from typing import TYPE_CHECKING

from categories.models import Category

if TYPE_CHECKING:
    from django.core.files.uploadedfile import UploadedFile

_FALLBACK_CATEGORY_NAME = "other"


def suggest_category(description: str) -> Category | None:
    """
    Suggest a category for a report with none chosen by the user.

    Stub: falls back to a category literally named "Other" (case
    insensitive) if one exists, else the first configured category, else
    `None` (no categories configured at all) until real classification is
    implemented.
    """
    del description
    return (
        Category.objects.filter(name__iexact=_FALLBACK_CATEGORY_NAME).first()
        or Category.objects.first()
    )


def suggest_category_label(description: str) -> str | None:
    """
    Produce the free-text `ai_category_suggestion` shown alongside a report.

    Stub: always returns `None` (no suggestion) until implemented.
    """
    del description
    return None


def detect_abuse(description: str, media_files: "list[UploadedFile[bytes]]") -> bool:
    """
    Decide whether a report looks abusive/illegitimate and needs review.

    Stub: always returns `False` (never flagged) until implemented.
    """
    del description, media_files
    return False
