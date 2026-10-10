"""Serves the hand-written OpenAPI contract (not generated from the code)."""

from pathlib import Path
from typing import final

from django.http import HttpRequest, HttpResponse
from django.views import View

_REPO_ROOT = Path(__file__).resolve().parents[3]
_SCHEMA_PATH = _REPO_ROOT / "api" / "openapi.yaml"


@final
class ManualOpenApiSchemaView(View):
    """Return the manually authored OpenAPI document as-is."""

    def get(self, _request: HttpRequest) -> HttpResponse:
        """Read and return the static YAML contract file."""
        return HttpResponse(
            _SCHEMA_PATH.read_text(encoding="utf-8"),
            content_type="application/yaml",
        )
