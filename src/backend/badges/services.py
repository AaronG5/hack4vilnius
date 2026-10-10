"""
Badge-awarding logic. Stubbed for now.

Real validation-count tallying (optionally scoped to a district) is left
for later; callers get a sane, deterministic default in the meantime.
"""

from typing import TYPE_CHECKING

from badges.models import Badge

if TYPE_CHECKING:
    from users.models import User


def check_new_badges(user: "User") -> list[Badge]:
    """
    Check whether `user` has newly qualified for any badge.

    Stub: always returns an empty list (no new badges) until real
    validation-count tallying is implemented.
    """
    del user
    return []
