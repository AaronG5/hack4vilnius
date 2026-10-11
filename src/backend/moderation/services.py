"""What a moderation decision does to the reporter's trust."""

from moderation.models import ModerationFlag
from problems import trust
from vilnius_backend.choices import ModerationFlagStatus

# Membership rather than `==`: comparing with a `TextChoices` member confuses
# the type checker.
_HARMFUL = frozenset({ModerationFlagStatus.CONFIRMED_HARMFUL})


def apply_review(flag: ModerationFlag, outcome: str) -> None:
    """
    Apply a reviewer's decision on `flag` to its reporter's trust.

    A report confirmed harmful is proved wrong, which lowers its author's
    trust (see `problems.trust`). A dismissed flag changes nothing.
    """
    if outcome in _HARMFUL:
        trust.refute(flag.report)
