"""
Validation scoring, urgency tallying and the confirm/cancel decision.

Point calculation is still a stub. The urgency tally and the status
decision are real: a validation is where a resident says whether the
problem is there at all, and how urgent it looks.
"""

from problems.models import Problem
from users.models import User
from validations.models import Validation
from vilnius_backend.choices import ProblemStatus, ProblemUrgency

_DEFAULT_POINTS_AWARDED = 10

# One passer-by shouldn't decide a problem's fate on their own.
_ANSWERS_TO_DECIDE = 2

# The statuses residents' answers decide between. Once the municipality has
# taken a problem on (ongoing, pending) or closed it (completed), the status
# is theirs and answers no longer move it.
_RESIDENTS_DECIDE = frozenset(
    {
        ProblemStatus.UNCONFIRMED,
        ProblemStatus.CONFIRMED,
        ProblemStatus.CANCELED,
    },
)

# Most severe first: a tie between two urgencies is settled the careful way.
_BY_SEVERITY: tuple[str, ...] = (
    ProblemUrgency.DANGEROUS_TO_LIFE,
    ProblemUrgency.URGENT,
    ProblemUrgency.CAN_WAIT,
)


def calculate_points(problem: Problem, validation: Validation) -> int:
    """
    Calculate points earned by submitting a validation.

    Stub: always awards a flat default amount, regardless of validation
    quality (extra media, description detail) or the problem's urgency.
    """
    # TODO:
    del problem, validation
    return _DEFAULT_POINTS_AWARDED


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


def evaluate_problem_validations(problem: Problem) -> None:
    """
    Confirm or cancel `problem` according to what residents answered.

    "The problem is there" counts toward confirming it, "there is no
    problem" toward canceling it. Deciding either way takes at least two
    answers that agree and more of them than the other way, so one person
    can neither confirm nor erase a problem alone.

    A verdict is only ever promoted, never withdrawn for lack of votes:
    the municipality also writes this status, and a single late answer
    must not undo what a case worker set.

    Still a stub: answers count one each, rather than by their author's
    trust score, and nobody is notified of the change.
    """
    # TODO:
    if problem.status not in _RESIDENTS_DECIDE:
        return

    answers = Validation.objects.filter(problem=problem)
    confirming = answers.filter(is_valid=True).count()
    disputing = answers.filter(is_valid=False).count()

    decided: str | None = None
    if confirming >= _ANSWERS_TO_DECIDE and confirming > disputing:
        decided = ProblemStatus.CONFIRMED
    elif disputing >= _ANSWERS_TO_DECIDE and disputing > confirming:
        decided = ProblemStatus.CANCELED

    if decided is not None and decided != problem.status:
        problem.status = decided
        problem.save(update_fields=["status", "updated_at"])
