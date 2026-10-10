"""Shared enum-like choices used by several apps' models and serializers."""

from django.db import models


class UserRole(models.TextChoices):
    """Who a `User` is, for authorization purposes."""

    REGULAR_USER = "regular_user", "Regular user"
    CITY_ADMINISTRATOR = "city_administrator", "City administrator"
    STAFF = "staff", "Staff"


class ProblemStatus(models.TextChoices):
    """Lifecycle status of a `Problem`."""

    UNCONFIRMED = "unconfirmed", "Unconfirmed"
    CONFIRMED = "confirmed", "Confirmed"
    ONGOING = "ongoing", "Ongoing"
    PENDING = "pending", "Pending"
    COMPLETED = "completed", "Completed"
    CANCELED = "canceled", "Canceled"


class ProblemUrgency(models.TextChoices):
    """How urgently a `Problem` needs attention."""

    CAN_WAIT = "can_wait", "Can wait"
    URGENT = "urgent", "Urgent"
    DANGEROUS_TO_LIFE = "dangerous_to_life", "Dangerous to life"


class MediaType(models.TextChoices):
    """Kind of file attached as `Media`."""

    PHOTO = "photo", "Photo"
    VIDEO = "video", "Video"
    AUDIO = "audio", "Audio"


class ChallengeStatus(models.TextChoices):
    """Lifecycle status of a `Challenge`."""

    UPCOMING = "upcoming", "Upcoming"
    ACTIVE = "active", "Active"
    ENDED = "ended", "Ended"


class ModerationFlagStatus(models.TextChoices):
    """Review status of a `ModerationFlag`."""

    PENDING = "pending", "Pending"
    CONFIRMED_HARMFUL = "confirmed_harmful", "Confirmed harmful"
    DISMISSED = "dismissed", "Dismissed"


class BadgeRule(models.TextChoices):
    """What earns a `Badge`; awarded by `badges.services.check_new_badges`."""

    FIRST_REPORT = "first_report", "First report"
    PROVEN_ANSWERS = "proven_answers", "Answers that proved right"
    CHALLENGE = "challenge", "Joining a challenge"
