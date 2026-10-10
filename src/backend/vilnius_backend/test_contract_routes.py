"""
Checks every path in the hand-written contract is actually routed.

api/openapi.yaml is the source of truth for the API surface, so a path
documented there but not wired into `urlpatterns` is a bug in the
implementation, not in the document.
"""

import re
from pathlib import Path
from typing import cast
from uuid import uuid4

import pytest
import yaml
from django.urls import Resolver404, resolve

_REPO_ROOT = Path(__file__).resolve().parents[3]
_SCHEMA_PATH = _REPO_ROOT / "api" / "openapi.yaml"
_SERVER_PREFIX = "/api"


def _contract_paths() -> list[str]:
    """Return every path the contract documents, with its server prefix."""
    document = cast(
        "dict[str, object]",
        yaml.safe_load(_SCHEMA_PATH.read_text(encoding="utf-8")),
    )
    paths = cast("dict[str, object]", document["paths"])
    return [f"{_SERVER_PREFIX}{path}" for path in paths]


def _concrete(path: str) -> str:
    """Replace `{id}` placeholders with a value the resolver accepts."""
    return re.sub(r"\{[^}]+\}", str(uuid4()), path)


@pytest.mark.parametrize("path", _contract_paths())
def test_contract_path_is_routed(path: str) -> None:
    """Every documented path resolves to a view."""
    try:
        match = resolve(_concrete(path))
    except Resolver404:  # pragma: no cover - the assert reports the failure
        pytest.fail(f"{path} is in api/openapi.yaml but is not routed")

    assert match.func is not None


def test_the_contract_documents_every_tag_group() -> None:
    """Guard against a path silently disappearing from the contract."""
    paths = set(_contract_paths())

    assert {
        "/api/session",
        "/api/auth/login",
        "/api/auth/logout",
        "/api/users/me",
        "/api/users/me/badges",
        "/api/problems",
        "/api/problems/{id}",
        "/api/problems/{id}/status",
        "/api/problems/{id}/validations",
        "/api/reports",
        "/api/reports/{id}",
        "/api/categories",
        "/api/districts",
        "/api/challenges",
        "/api/challenges/{id}",
        "/api/challenges/{id}/join",
        "/api/badges",
        "/api/notifications",
        "/api/notifications/{id}/read",
        "/api/moderation/flags",
        "/api/moderation/flags/{id}",
    } <= paths
