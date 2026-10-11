"""
How a problem moves between statuses, and who earns points along the way.

Points reward claims that turned out true, never the act of claiming, so
answering blindly earns nothing:

- A report earns its reporter `REPORT_POINTS` once the problem is confirmed,
  not when it is filed.
- Answers saying the problem is there, given before it is confirmed, are the
  ones that confirm it, and are paid at that moment. Confirming takes at
  least `ANSWERS_TO_DECIDE` people besides the reporter whose trust-weighted
  sum reaches `CONFIRMING_WEIGHT` (see `problems.trust` and
  planning/PRIORITY.md). Answers after confirmation add nothing new, so they wait:
  they are paid only when the city takes the problem on, which is the
  strongest confirmation there is. The city starting work pays every true
  claim still unpaid, the report included.
- Saying the problem is gone marks it fixed for `FIX_WINDOW`. It stays on the
  map, green, so neighbours can confirm. The first `ANSWERS_TO_DECIDE` who
  confirm are paid, and so is whoever said it was fixed. Anyone saying it is
  still there reopens it instead, and the claim earns nothing. After the
  window the problem leaves the map whether or not anyone confirmed.
- The city canceling a problem as not real proves its reports and "it's
  there" answers wrong, which lowers their authors' trust.
"""

import datetime as dt

import badges.services as badge_services
import users.services as user_services
from django.utils import timezone
from notifications.services import notify_points, notify_problem_status_change
from problems import trust
from problems.models import Problem
from reports.models import Report
from users.models import User
from validations.models import Validation
from vilnius_backend.choices import ProblemStatus

REPORT_POINTS = 20
ANSWER_POINTS = 10
FIX_WINDOW = dt.timedelta(hours=1)

# How many agreeing answers decide something, and so how many are paid for it.
ANSWERS_TO_DECIDE = 2
# The trust-weighted sum those answers must reach to confirm a problem: two
# newcomers (weight 1.0 each) do; two distrusted residents (0.7 each) don't.
CONFIRMING_WEIGHT = 2.0

# Statuses residents' answers decide; once the city is working on a problem,
# its status is the city's. (Sets, also for single statuses: comparing a
# `TextChoices` member with `==` confuses the type checker.)
_RESIDENTS_DECIDE = frozenset({ProblemStatus.UNCONFIRMED, ProblemStatus.CONFIRMED})
_CITY_WORKING = frozenset({ProblemStatus.PENDING, ProblemStatus.ONGOING})
_FIXED = frozenset({ProblemStatus.COMPLETED})
_UNCONFIRMED = frozenset({ProblemStatus.UNCONFIRMED})
_CANCELED = frozenset({ProblemStatus.CANCELED})


def in_fix_window(problem: Problem, now: dt.datetime | None = None) -> bool:
    """Whether `problem` is marked fixed and residents may still confirm it."""
    if problem.status not in _FIXED or problem.fixed_at is None:
        return False
    return (now or timezone.now()) - problem.fixed_at <= FIX_WINDOW


def record_answer(problem: Problem, answer: Validation | Report) -> None:
    """
    Apply one resident's say about `problem`, already saved as `answer`.

    A `Validation` says whether the problem is there; a further `Report` on
    an existing problem always says it is.
    """
    present = answer.is_valid if isinstance(answer, Validation) else True
    now = timezone.now()

    if problem.status in _FIXED:
        if not in_fix_window(problem, now):
            return
        if present:
            _reopen(problem, now)
        elif isinstance(answer, Validation):
            _confirm_fix(problem, answer)
        return

    if problem.status not in _RESIDENTS_DECIDE:
        return
    if not present:
        user = answer.user
        _mark_fixed(problem, now, claimed_by=user)
        return
    if problem.status in _UNCONFIRMED and _residents_confirm(problem):
        problem.status = ProblemStatus.CONFIRMED
        problem.save(update_fields=["status", "updated_at"])
        paid = _pay_true_claims(problem, "confirmed")
        _ = notify_problem_status_change(problem, exclude=paid)


def apply_city_status(problem: Problem, new_status: str) -> None:
    """Apply a status set by the city, paying claims the city just proved."""
    old_status = problem.status
    if new_status == old_status:
        return
    if new_status in _CANCELED:
        # Not real: whoever said it was there was wrong.
        for report in Report.objects.filter(problem=problem):
            trust.refute(report)
        for answer in Validation.objects.filter(problem=problem, is_valid=True):
            trust.refute(answer)
    if new_status in _FIXED:
        # The city fixing something reported is the city confirming it.
        paid = (
            _pay_true_claims(problem, "city") if old_status in _RESIDENTS_DECIDE else []
        )
        _mark_fixed(problem, timezone.now(), claimed_by=None, exclude=paid)
        return

    problem.status = new_status
    problem.fixed_at = None
    problem.fix_claimed_by = None
    problem.status_before_fix = ""
    if new_status in _CITY_WORKING and problem.institution is None:
        # Handed over without naming who takes it: the category's own does.
        problem.institution = problem.category.institution
    problem.save()
    paid = (
        _pay_true_claims(problem, "city")
        if new_status in _CITY_WORKING and old_status not in _CITY_WORKING
        else []
    )
    _ = notify_problem_status_change(problem, exclude=paid)


def _residents_confirm(problem: Problem) -> bool:
    """
    Whether enough reliable residents, besides the reporter, say it's there.

    At least `ANSWERS_TO_DECIDE` different people, whose trust-weighted sum
    reaches `CONFIRMING_WEIGHT`. A second report counts like an answer.
    """
    reports = list(Report.objects.filter(problem=problem).order_by("created_at"))
    reporter = reports[0].user if reports else None
    supporters: dict[str, User] = {}
    for report in reports[1:]:
        supporters[report.user.email] = report.user
    answers = Validation.objects.filter(problem=problem, is_valid=True)
    for answer in answers.select_related("user"):
        supporters[answer.user.email] = answer.user
    if reporter is not None:
        _ = supporters.pop(reporter.email, None)
    weight = sum(trust.weight(user) for user in supporters.values())
    return len(supporters) >= ANSWERS_TO_DECIDE and weight >= CONFIRMING_WEIGHT


def _mark_fixed(
    problem: Problem,
    now: dt.datetime,
    *,
    claimed_by: User | None,
    exclude: list[User] | None = None,
) -> None:
    """Mark `problem` fixed and open the window for neighbours to confirm."""
    problem.status_before_fix = problem.status
    problem.status = ProblemStatus.COMPLETED
    problem.fixed_at = now
    problem.fix_claimed_by = claimed_by
    problem.save()
    skip = list(exclude or ())
    if claimed_by is not None:
        skip.append(claimed_by)
    _ = notify_problem_status_change(problem, exclude=skip)


def _reopen(problem: Problem, now: dt.datetime) -> None:
    """Put a problem residents say isn't fixed back where it was."""
    problem.status = problem.status_before_fix or ProblemStatus.CONFIRMED
    problem.fixed_at = None
    problem.fix_claimed_by = None
    problem.status_before_fix = ""
    problem.reopened_at = now
    problem.save()
    _ = notify_problem_status_change(problem, reopened=True)


def _confirm_fix(problem: Problem, answer: Validation) -> None:
    """Pay the first confirmations of a fix, and whoever claimed it."""
    fixed_at = problem.fixed_at
    claimer = problem.fix_claimed_by
    confirmations = Validation.objects.filter(
        problem=problem,
        is_valid=False,
        created_at__gte=fixed_at,
        points_awarded__gt=0,
    )
    if claimer is not None:
        confirmations = confirmations.exclude(user=claimer)
    if confirmations.count() < ANSWERS_TO_DECIDE:
        _ = _pay(answer, ANSWER_POINTS, problem, "fix_confirmed")
    if claimer is not None:
        claim = Validation.objects.filter(problem=problem, user=claimer).first()
        if claim is not None:
            _ = _pay(claim, ANSWER_POINTS, problem, "fix_claim")


def _pay_true_claims(problem: Problem, reason: str) -> list[User]:
    """Pay every unpaid report and "it's there" answer; return who was paid."""
    paid: list[User] = []
    reports = Report.objects.filter(problem=problem).order_by("created_at")
    for index, report in enumerate(reports):
        points = REPORT_POINTS if index == 0 else ANSWER_POINTS
        if _pay(report, points, problem, f"report_{reason}"):
            paid.append(report.user)
    for answer in Validation.objects.filter(problem=problem, is_valid=True):
        if _pay(answer, ANSWER_POINTS, problem, f"answer_{reason}"):
            paid.append(answer.user)
    return paid


def _pay(
    entry: Validation | Report, points: int, problem: Problem, reason: str
) -> bool:
    """Pay `entry`'s author once; return whether anything was paid."""
    if entry.points_awarded > 0:
        return False
    entry.points_awarded = points
    entry.save(update_fields=["points_awarded"])
    user_services.award_points(entry.user, points)
    _ = trust.recompute_trust(entry.user)
    _ = notify_points(entry.user, problem, points, reason)
    _ = badge_services.check_new_badges(entry.user)
    return True
