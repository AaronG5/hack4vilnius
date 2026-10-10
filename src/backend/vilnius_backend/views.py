"""Serves the hand-written OpenAPI contract (not generated from the code)."""

from pathlib import Path
from typing import final

from django.http import HttpRequest, HttpResponse
from django.views import View

_SCHEMA_PATH = Path(__file__).resolve().parent / "openapi.yaml"


@final
class ManualOpenApiSchemaView(View):
    """Return the manually authored OpenAPI document as-is."""

    def get(self, _request: HttpRequest) -> HttpResponse:
        """Read and return the static YAML contract file."""
        return HttpResponse(
            _SCHEMA_PATH.read_text(encoding="utf-8"),
            content_type="application/yaml",
        )
