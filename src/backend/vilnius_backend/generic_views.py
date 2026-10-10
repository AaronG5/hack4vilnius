"""
Thin DRF generic-view bases that pre-fill attributes the stubs leave bare.

`rest_framework-stubs` declares `GenericAPIView`'s `lookup_field`,
`lookup_url_kwarg`, `filter_backends`, `pagination_class`, `queryset` and
`serializer_class` as bare annotations with no default, even though the
real `GenericAPIView` sets runtime defaults for all of them. basedpyright
then requires every `@final` subclass to initialize them itself
(`reportUninitializedInstanceVariable`). Each class below assigns those
defaults once, in a single, ordinary (non-diamond) inheritance chain, so a
view built on top only needs its own `queryset`/`serializer_class` (or
`get_queryset`/`get_serializer_class` overrides).

Each assignment restates the type `GenericAPIView` declares for it,
parameterized by this class's model type variable, so basedpyright's
`reportUnannotatedClassAttribute` is satisfied for the non-`@final` bases.
"""

from typing import TYPE_CHECKING, TypeVar

from django.db.models import Manager, Model, QuerySet
from rest_framework.generics import (
    CreateAPIView,
    ListAPIView,
    ListCreateAPIView,
    RetrieveAPIView,
)
from rest_framework.pagination import BasePagination
from rest_framework.serializers import BaseSerializer

if TYPE_CHECKING:
    from collections.abc import Sequence

    # Stub-only protocol: `rest_framework.generics` has no such runtime name.
    from rest_framework.filters import BaseFilterBackend
    from rest_framework.generics import BaseFilterProtocol

_MT = TypeVar("_MT", bound=Model)


class DefaultListAPIView(ListAPIView[_MT]):
    """`ListAPIView` with its bare `GenericAPIView` attributes pre-filled."""

    queryset: QuerySet[_MT] | Manager[_MT] | None = None
    serializer_class: type[BaseSerializer[_MT]] | None = None
    lookup_field: str = "pk"
    lookup_url_kwarg: str | None = None
    filter_backends: "Sequence[type[BaseFilterBackend | BaseFilterProtocol[_MT]]]" = ()
    pagination_class: type[BasePagination] | None = None


class DefaultRetrieveAPIView(RetrieveAPIView[_MT]):
    """`RetrieveAPIView` with its bare `GenericAPIView` attributes pre-filled."""

    queryset: QuerySet[_MT] | Manager[_MT] | None = None
    serializer_class: type[BaseSerializer[_MT]] | None = None
    lookup_field: str = "pk"
    lookup_url_kwarg: str | None = None
    filter_backends: "Sequence[type[BaseFilterBackend | BaseFilterProtocol[_MT]]]" = ()
    pagination_class: type[BasePagination] | None = None


class DefaultCreateAPIView(CreateAPIView[_MT]):
    """`CreateAPIView` with its bare `GenericAPIView` attributes pre-filled."""

    queryset: QuerySet[_MT] | Manager[_MT] | None = None
    serializer_class: type[BaseSerializer[_MT]] | None = None
    lookup_field: str = "pk"
    lookup_url_kwarg: str | None = None
    filter_backends: "Sequence[type[BaseFilterBackend | BaseFilterProtocol[_MT]]]" = ()
    pagination_class: type[BasePagination] | None = None


class DefaultListCreateAPIView(ListCreateAPIView[_MT]):
    """`ListCreateAPIView` with its bare `GenericAPIView` attributes pre-filled."""

    queryset: QuerySet[_MT] | Manager[_MT] | None = None
    serializer_class: type[BaseSerializer[_MT]] | None = None
    lookup_field: str = "pk"
    lookup_url_kwarg: str | None = None
    filter_backends: "Sequence[type[BaseFilterBackend | BaseFilterProtocol[_MT]]]" = ()
    pagination_class: type[BasePagination] | None = None
