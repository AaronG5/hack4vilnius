"""City-created challenges that users can participate in."""

import datetime as dt
from typing import ClassVar, final, override

from categories.models import Category
from django.db import models
from django.db.models.expressions import Combinable
from users.models import User
from vilnius_backend.base_models import UUIDModel
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
