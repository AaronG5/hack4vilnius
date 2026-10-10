"""
Badge awarding.

Each badge names the rule that earns it (`Badge.rule`). Rules count only
what proved true where they can, like points do (see `problems.lifecycle`):
"Tiesos tikrintojas" counts answers that were paid, not answers given.
"""

from badges.models import Badge, UserBadge
from notifications.services import notify_badge
from reports.models import Report
from users.models import User
from validations.models import Validation
from vilnius_backend.choices import BadgeRule


def _qualifies(user: User, badge: Badge) -> bool:
    """Whether `user` meets `badge`'s rule right now."""
    # Membership rather than `==`: comparing with a `TextChoices` member
    # confuses the type checker.
    if badge.rule in {BadgeRule.FIRST_REPORT}:
        return Report.objects.filter(user=user).exists()
    if badge.rule in {BadgeRule.PROVEN_ANSWERS}:
        needed = badge.required_validation_count or 1
        proven = Validation.objects.filter(user=user, points_awarded__gt=0)
        return proven.count() >= needed
    if badge.rule in {BadgeRule.CHALLENGE}:
        challenge = badge.challenge
        return challenge is not None and challenge.participants.contains(user)
    return False


def check_new_badges(user: User) -> list[Badge]:
    """Award `user` every badge they now qualify for, telling them; return those."""
    earned = UserBadge.objects.filter(user=user).values_list("badge_id", flat=True)
    awarded: list[Badge] = []
    for badge in Badge.objects.exclude(rule="").exclude(id__in=earned):
        if _qualifies(user, badge):
            _ = UserBadge.objects.create(user=user, badge=badge)
            _ = notify_badge(user, badge)
            awarded.append(badge)
    return awarded
