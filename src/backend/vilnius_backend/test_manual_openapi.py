"""Tests that the hand-written OpenAPI contract is served at /api/."""

from http import HTTPStatus
from typing import cast

import pytest
import yaml
from django.test import Client


def _document(client: Client) -> dict[str, object]:
    """Fetch and parse the manually authored OpenAPI document."""
    response = client.get("/api/openapi.yaml")
    return cast("dict[str, object]", yaml.safe_load(response.content))


@pytest.mark.django_db
def test_manual_schema_is_a_valid_openapi_document(client: Client) -> None:
    """The manual schema endpoint returns a parseable OpenAPI document."""
    response = client.get("/api/openapi.yaml")
    assert response.status_code == HTTPStatus.OK
    assert response["Content-Type"] == "application/yaml"

    document = _document(client)
    version = cast("str", document["openapi"])
    paths = cast("dict[str, object]", document["paths"])
    assert version.startswith("3.")
    assert "/problems" in paths
    assert "/problems/{id}" in paths
    assert "/badges" in paths


@pytest.mark.django_db
def test_root_swagger_ui_renders_and_points_at_the_manual_schema(
    client: Client,
) -> None:
    """The Swagger UI at /api/ loads and targets the manual contract."""
    response = client.get("/api/")

    assert response.status_code == HTTPStatus.OK
    content_type = response["Content-Type"]
    assert content_type.startswith("text/html")
    assert "/api/openapi.yaml" in response.content.decode()
