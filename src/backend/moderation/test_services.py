"""Tests for the (stubbed) trust-score adjustment service."""

from moderation.services import compute_trust_adjustment
from vilnius_backend.choices import ModerationFlagStatus

FULL_TRUST = 100.0
PARTIAL_TRUST = 42.5


class TestComputeTrustAdjustment:
    """Tests for `compute_trust_adjustment`."""

    def test_confirming_harm_leaves_the_score_unchanged(self) -> None:
        """Trust rating is deferred, so the score passes straight through."""
        adjusted = compute_trust_adjustment(
            FULL_TRUST,
            ModerationFlagStatus.CONFIRMED_HARMFUL,
        )

        assert adjusted == FULL_TRUST

    def test_dismissing_leaves_the_score_unchanged(self) -> None:
        """A dismissed flag has no effect on the reporter's trust either."""
        adjusted = compute_trust_adjustment(
            PARTIAL_TRUST,
            ModerationFlagStatus.DISMISSED,
        )

        assert adjusted == PARTIAL_TRUST
