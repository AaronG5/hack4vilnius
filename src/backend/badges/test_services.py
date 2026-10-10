"""Tests for the (stubbed) badge-awarding service."""

import pytest
from badges.models import Badge
from badges.services import check_new_badges
from users.models import User


@pytest.mark.django_db
class TestCheckNewBadges:
    """Tests for `check_new_badges`."""

    def test_awards_nothing_while_stubbed(self, user: User, badge: Badge) -> None:
        """Validation-count tallying is deferred, so no badge is awarded."""
        del badge

        assert check_new_badges(user) == []
