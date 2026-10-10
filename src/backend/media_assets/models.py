"""
Photo, video or audio attachments uploaded with a report or validation.

A `Media` row can attach to any model (a `Report` or a `Validation`) via a
generic relation, rather than carrying one nullable `ForeignKey` per possible
parent - see planning/ARCHITECTURE.md's Media relationships.
"""

import uuid
from typing import ClassVar, Protocol, final, override

from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.db.models.expressions import Combinable
from users.models import User
from vilnius_backend.base_models import TimestampedModel, UUIDModel
from vilnius_backend.choices import MediaType


class MediaRelation(Protocol):
    """
    The related manager a `GenericRelation(Media)` hands back.

    django-stubs types `GenericRelation` as `ForeignObject[Any, Any]`, so
    `report.media` would otherwise be `Any`; and its `Manager` classes
    deliberately reject instance access (`BaseManager.__get__` only accepts
    `instance=None`), so `Manager[Media]` can't serve as the declared type
    either. This protocol names the part of the related manager the project
    uses -- widen it as more of the manager API gets used.
    """

    def all(self) -> "models.QuerySet[Media]":
        """Return every attachment, as a queryset."""
        ...

    def count(self) -> int:
        """Return how many attachments there are."""
        ...

    def create(self, **kwargs: object) -> "Media":
        """Create one attachment against the related object."""
        ...


@final
class Media(UUIDModel, TimestampedModel):
    """A single uploaded file attached to a report or validation."""

    type: models.CharField[str | Combinable, str] = models.CharField(
        max_length=16,
        choices=MediaType.choices,
    )
    file: models.FileField = models.FileField(upload_to="media/%Y/%m/%d/")
    uploaded_by: models.ForeignKey[User | Combinable, User] = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="uploaded_media",
    )

    content_type: models.ForeignKey[
        ContentType | Combinable | None, ContentType | None
    ] = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    object_id: models.UUIDField[uuid.UUID | str | None, uuid.UUID | None] = (
        models.UUIDField(null=True, blank=True)
    )
    attached_to = GenericForeignKey("content_type", "object_id")

    class Meta(UUIDModel.Meta, TimestampedModel.Meta):
        """Most recently uploaded first."""

        ordering: ClassVar[list[str]] = ["-created_at"]

    @override
    def __str__(self) -> str:
        """Return the media's id, used in the admin and shell."""
        return str(self.id)
