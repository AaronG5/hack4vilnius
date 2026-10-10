"""Tests that the OpenAPI schema and its documentation views are served."""

from http import HTTPStatus
from typing import cast

import pytest
import yaml
from django.test import Client


def _document(client: Client) -> dict[str, object]:
    """Fetch and parse the raw OpenAPI document."""
    response = client.get("/api/schema/")
    return cast("dict[str, object]", yaml.safe_load(response.content))


@pytest.mark.django_db
def test_schema_is_a_valid_openapi_document(client: Client) -> None:
    """The raw schema endpoint returns a parseable OpenAPI document."""
    response = client.get("/api/schema/")
    assert response.status_code == HTTPStatus.OK

    document = _document(client)
    version = cast("str", document["openapi"])
    paths = cast("dict[str, object]", document["paths"])
    assert version.startswith("3.")
    assert "/api/auth/register/" in paths
    assert "/api/auth/login/" in paths
    assert "/api/auth/logout/" in paths
    assert "/api/auth/google/" in paths


@pytest.mark.django_db
def test_schema_includes_the_speakeasy_retry_extension(client: Client) -> None:
    """The root-level Speakeasy retry policy is present in the schema."""
    document = _document(client)

    retries = cast("dict[str, object]", document["x-speakeasy-retries"])
    assert retries["strategy"] == "backoff"


@pytest.mark.django_db
def test_swagger_ui_renders(client: Client) -> None:
    """The Swagger UI page loads without authentication."""
    response = client.get("/api/schema/swagger-ui/")

    assert response.status_code == HTTPStatus.OK
    content_type = response["Content-Type"]
    assert content_type.startswith("text/html")


@pytest.mark.django_db
def test_redoc_renders(client: Client) -> None:
    """The ReDoc page loads without authentication."""
    response = client.get("/api/schema/redoc/")

    assert response.status_code == HTTPStatus.OK
    content_type = response["Content-Type"]
    assert content_type.startswith("text/html")
