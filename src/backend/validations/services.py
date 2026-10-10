"""
Urgency tallying from residents' answers.

What an answer does to a problem's status, and the points it earns, live in
`problems.lifecycle`.
"""

from problems.models import Problem
from users.models import User
from validations.models import Validation
from vilnius_backend.choices import ProblemUrgency

# Most severe first: a tie between two urgencies is settled the careful way.
_BY_SEVERITY: tuple[str, ...] = (
    ProblemUrgency.DANGEROUS_TO_LIFE,
    ProblemUrgency.URGENT,
    ProblemUrgency.CAN_WAIT,
)


def urgency_votes(problem: Problem) -> dict[str, int]:
    """
    Count how urgent residents think `problem` is.

    The first report's urgency counts as the reporter's own vote, so a
    problem nobody has validated yet still shows where it started.
    """
    # TODO:
    tally = dict.fromkeys(_BY_SEVERITY, 0)
    reported = problem.reported_urgency or problem.urgency
    tally[reported] = tally.get(reported, 0) + 1
    voted = Validation.objects.filter(problem=problem).exclude(urgency="")
    for urgency in voted.values_list("urgency", flat=True):
        tally[urgency] = tally.get(urgency, 0) + 1
    return tally


def urgency_vote_of(problem: Problem, user: User) -> str | None:
    """Return the urgency `user` voted for on `problem`, if they answered it."""
    # TODO:
    answer = Validation.objects.filter(problem=problem, user=user).first()
    return (answer.urgency or None) if answer is not None else None


def apply_urgency_votes(problem: Problem) -> None:
    """
    Set `problem.urgency` to what most residents voted for.

    Ties go to the more severe choice: under-reacting to something
    dangerous costs more than over-reacting to something that can wait.
    """
    # TODO:
    tally = urgency_votes(problem)
    winner = max(
        _BY_SEVERITY,
        key=lambda urgency: (tally[urgency], -_BY_SEVERITY.index(urgency)),
    )
    if winner != problem.urgency:
        problem.urgency = winner
        problem.save(update_fields=["urgency", "updated_at"])
