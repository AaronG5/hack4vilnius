"""Points bookkeeping for users."""

from django.db.models import F
from users.models import User


def award_points(user: User, points: int) -> None:
    """
    Add `points` to `user`'s total.

    Added in the database with `F()` so two actions finishing at once
    can't overwrite each other's points; `user` is refreshed to match.
    """
    if points <= 0:
        return
    user.points = F("points") + points
    user.save(update_fields=["points"])
    user.refresh_from_db(fields=["points"])
