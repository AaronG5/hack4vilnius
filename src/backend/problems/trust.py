"""
Trust: how reliable a resident has been, learned from outcomes.

See planning/PRIORITY.md, "Trust". Every report and answer is, at any time,
proved right (it was paid under the points ladder, `points_awarded > 0`),
proved wrong (`refuted`: the city canceled its problem as not real, or
moderators confirmed the report harmful), or not known yet. Trust is the
resident's success rate over the known ones, starting from the middle:

    trust = 100 x (right + 1) / (right + wrong + 2)

A reopened fix is deliberately neither: problems do come back, so a
"Problemos nėra" that a neighbour later contradicts is just left unpaid.
"""

from reports.models import Report
from users.models import User
from validations.models import Validation

# Trust of someone with no known outcomes yet: neither trusted nor distrusted.
NEUTRAL_TRUST = 50.0

# A report or answer counts as `MIN_WEIGHT + trust / 100`: from 0.5 for the
# least reliable to 1.5 for the most, 1.0 for a newcomer.
MIN_WEIGHT = 0.5


def compute_trust(right: int, wrong: int) -> float:
    """Return trust (0-100) from counts of claims proved right and wrong."""
    return 100.0 * (right + 1) / (right + wrong + 2)


def outcomes(user: User) -> tuple[int, int]:
    """Count `user`'s reports and answers proved right and proved wrong."""
    right = (
        Report.objects.filter(user=user, points_awarded__gt=0).count()
        + Validation.objects.filter(user=user, points_awarded__gt=0).count()
    )
    wrong = (
        Report.objects.filter(user=user, refuted=True).count()
        + Validation.objects.filter(user=user, refuted=True).count()
    )
    return right, wrong


def recompute_trust(user: User) -> float:
    """Recompute and save `user`'s trust from their outcomes; return it."""
    right, wrong = outcomes(user)
    user.trust_score = round(compute_trust(right, wrong), 1)
    user.save(update_fields=["trust_score"])
    return user.trust_score


def weight(user: User) -> float:
    """How much `user`'s report or answer counts, from their stored trust."""
    return MIN_WEIGHT + user.trust_score / 100.0


def refute(entry: Report | Validation) -> None:
    """Mark a claim proved wrong and update its author's trust."""
    if entry.refuted:
        return
    entry.refuted = True
    entry.save(update_fields=["refuted"])
    _ = recompute_trust(entry.user)
