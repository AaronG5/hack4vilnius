"""
Typed wrapper around drf-spectacular's `extend_schema`.

drf-spectacular ships inline type hints, but `extend_schema`'s own signature
uses bare `Any` for `request`/`responses`, so importing it directly leaves its
inferred type partially unknown. Routing the access through a module
attribute inside a single `cast()` keeps that gap from leaking into callers.

`request`/`responses` are generic over the serializer's model type `_S`
(inferred per call site) rather than `Any`, since `BaseSerializer` is
invariant in that parameter.
"""

from collections.abc import Callable, Mapping, Sequence
from typing import TypeVar, cast

import drf_spectacular.utils as _spectacular
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer

_ViewMethod = Callable[..., Response]
_S = TypeVar("_S")
_RequestSchema = type[BaseSerializer[_S]] | None
_ResponseSchema = (
    type[BaseSerializer[_S]] | _spectacular.OpenApiResponse | dict[int, object]
)
_ExtendSchema = Callable[..., Callable[[_ViewMethod], _ViewMethod]]

OpenApiResponse = _spectacular.OpenApiResponse
OpenApiParameter = _spectacular.OpenApiParameter


def extend_schema[S](
    *,
    summary: str | None = None,
    description: str | None = None,
    parameters: Sequence[_spectacular.OpenApiParameter] | None = None,
    request: _RequestSchema[S] = None,
    responses: Mapping[int, _ResponseSchema[S]] | None = None,
) -> Callable[[_ViewMethod], _ViewMethod]:
    """
    Document an `APIView.post` method for the generated OpenAPI schema.

    Every endpoint in this project is tagged "auth" — there's only one app
    so far; add a `tags` parameter here if/when that stops being true.
    """
    impl = cast("_ExtendSchema", _spectacular.extend_schema)
    return impl(
        tags=["auth"],
        summary=summary,
        description=description,
        parameters=parameters,
        request=request,
        responses=responses,
    )


__all__ = ["OpenApiParameter", "OpenApiResponse", "extend_schema"]
