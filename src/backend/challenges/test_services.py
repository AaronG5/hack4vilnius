"""Tests for the (stubbed) challenge milestone service."""

import pytest
from challenges.models import Challenge
from challenges.services import get_milestones


@pytest.mark.django_db
class TestGetMilestones:
    """Tests for `get_milestones`."""

    def test_returns_an_empty_list_while_stubbed(self, challenge: Challenge) -> None:
        """No milestones are tracked yet, so the list is empty."""
        assert get_milestones(challenge) == []
