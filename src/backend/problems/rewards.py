"""
The weekly goal: a bonus for answers that proved right within one week.

A resident whose answers given in one week (Monday to Sunday, Vilnius time)
include `WEEKLY_GOAL` that proved right (were paid) earns `WEEKLY_BONUS`
once for that week. Like every other reward, it counts outcomes rather than
activity, so answering blindly doesn't reach it.
"""

import datetime as dt
from zoneinfo import ZoneInfo

import users.services as user_services
from django.utils import timezone
from notifications.services import notify_reward
from users.models import User
from validations.models import Validation, WeeklyBonus

WEEKLY_GOAL = 5
WEEKLY_BONUS = 50

_VILNIUS = ZoneInfo("Europe/Vilnius")


def week_bounds(now: dt.datetime | None = None) -> tuple[dt.date, dt.datetime]:
    """Return this week's Monday (Vilnius time) and the moment it began."""
    local = (now or timezone.now()).astimezone(_VILNIUS)
    monday = local.date() - dt.timedelta(days=local.weekday())
    return monday, dt.datetime.combine(monday, dt.time.min, tzinfo=_VILNIUS)


def check_weekly_bonus(user: User, now: dt.datetime | None = None) -> bool:
    """Pay `user` this week's bonus if they just reached the goal; return if paid."""
    monday, start = week_bounds(now)
    if WeeklyBonus.objects.filter(user=user, week_start=monday).exists():
        return False
    proven = Validation.objects.filter(
        user=user,
        points_awarded__gt=0,
        created_at__gte=start,
    ).count()
    if proven < WEEKLY_GOAL:
        return False
    _ = WeeklyBonus.objects.create(user=user, week_start=monday, points=WEEKLY_BONUS)
    user_services.award_points(user, WEEKLY_BONUS)
    _ = notify_reward(
        user,
        WEEKLY_BONUS,
        f"Savaitės tikslas pasiektas: {WEEKLY_GOAL} pasitvirtinę patikrinimai.",
    )
    return True
