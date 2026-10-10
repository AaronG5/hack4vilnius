"""Abstract model mixins shared by (almost) every model in the project."""

import datetime as dt
import uuid
from typing import ClassVar

from django.db import models
from django.db.models.expressions import Combinable


class UUIDModel(models.Model):
    """
    A model with a non-consecutive (UUID) primary key.

    Per planning/ARCHITECTURE.md's "Non consecutive IDs" practice: ids must
    not be sequential integers, to avoid leaking object counts/order.
    """

    id: models.UUIDField[uuid.UUID | str, uuid.UUID] = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    class Meta:
        """Abstract: contributes only the `id` field to concrete subclasses."""

        abstract: ClassVar[bool] = True
        ordering: ClassVar[list[str]] = ["id"]


class TimestampedModel(models.Model):
    """A model that records when it was created."""

    created_at: models.DateTimeField[
        str | dt.datetime | dt.date | Combinable, dt.datetime
    ] = models.DateTimeField(auto_now_add=True)

    class Meta:
        """Abstract: contributes only the `created_at` field."""

        abstract: ClassVar[bool] = True
