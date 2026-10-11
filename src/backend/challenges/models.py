"""City-created challenges that users can participate in."""

import datetime as dt
from typing import ClassVar, final, override

from categories.models import Category
from django.db import models
from django.db.models.expressions import Combinable
from users.models import User
from vilnius_backend.base_models import TimestampedModel, UUIDModel
from vilnius_backend.choices import ChallengeStatus


@final
class Challenge(UUIDModel):
    """A city-run challenge, past, present or future."""

    name: models.CharField[str | Combinable, str] = models.CharField(max_length=255)
    description: models.TextField[str | Combinable, str] = models.TextField()
    start_date: models.DateField[str | dt.date | Combinable, dt.date] = (
        models.DateField()
    )
    end_date: models.DateField[str | dt.date | Combinable, dt.date] = models.DateField()
    reward_points: models.IntegerField[int | Combinable, int] = models.IntegerField()
    status: models.CharField[str | Combinable, str] = models.CharField(
        max_length=16,
        choices=ChallengeStatus.choices,
        default=ChallengeStatus.UPCOMING,
    )
    categories: models.ManyToManyField[Category, Category] = models.ManyToManyField(
        Category,
        related_name="challenges",
        blank=True,
    )
    participants: models.ManyToManyField[User, User] = models.ManyToManyField(
        User,
        related_name="challenges",
        blank=True,
    )

    class Meta(UUIDModel.Meta):
        """Soonest-starting first."""

        ordering: ClassVar[list[str]] = ["start_date"]

    @override
    def __str__(self) -> str:
        """Return the challenge's name, used in the admin and shell."""
        return self.name


@final
class ChallengeReward(UUIDModel, TimestampedModel):
    """
    A challenge's `reward_points`, paid to one participant when it ended.

    See `challenges.services.settle_ended_challenges`.
    """

    challenge: models.ForeignKey[Challenge | Combinable, Challenge] = models.ForeignKey(
        Challenge, on_delete=models.CASCADE, related_name="rewards"
    )
    user: models.ForeignKey[User | Combinable, User] = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="challenge_rewards",
    )
    points: models.IntegerField[int | Combinable, int] = models.IntegerField()

    class Meta(UUIDModel.Meta, TimestampedModel.Meta):
        """Once per participant per challenge."""

        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["challenge", "user"],
                name="unique_challenge_reward_per_user",
            ),
        ]

    @override
    def __str__(self) -> str:
        """Return who was rewarded for which challenge."""
        return f"{self.user} {self.challenge}"
