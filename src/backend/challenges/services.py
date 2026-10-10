"""
Challenge progress logic. Stubbed for now.

Real milestone tracking (district contribution counts, progress toward
`reward_points`, etc.) is left for later; callers get a sane, empty default
in the meantime.
"""

from typing import TYPE_CHECKING, TypedDict

if TYPE_CHECKING:
    from challenges.models import Challenge


class Milestone(TypedDict):
    """A single progress milestone shown on a challenge's detail page."""

    label: str
    target: int
    reached: bool


def get_milestones(challenge: "Challenge") -> list[Milestone]:
    """
    List the progress milestones for `challenge`.

    Stub: always returns an empty list (no milestones configured) until
    real milestone tracking is implemented.
    """
    del challenge
    return []
