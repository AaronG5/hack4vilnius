"""Tests for what a moderation decision does to trust."""

import pytest
from moderation.models import ModerationFlag
from moderation.services import apply_review
from problems.trust import NEUTRAL_TRUST
from vilnius_backend.choices import ModerationFlagStatus


@pytest.mark.django_db
class TestApplyReview:
    """Tests for `apply_review`."""

    def test_confirming_harm_refutes_the_report(
        self,
        moderation_flag: ModerationFlag,
    ) -> None:
        """The report is proved wrong, and its author's trust drops below neutral."""
        apply_review(moderation_flag, ModerationFlagStatus.CONFIRMED_HARMFUL)

        report = moderation_flag.report
        report.refresh_from_db()
        report.user.refresh_from_db()
        assert report.refuted is True
        assert report.user.trust_score < NEUTRAL_TRUST

    def test_dismissing_refutes_nothing(self, moderation_flag: ModerationFlag) -> None:
        """A dismissed flag leaves the report standing."""
        apply_review(moderation_flag, ModerationFlagStatus.DISMISSED)

        moderation_flag.report.refresh_from_db()
        assert moderation_flag.report.refuted is False
