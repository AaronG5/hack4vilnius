"""Tests for the report classification and moderation services."""

import json
from http import HTTPStatus
from typing import cast

import pytest
import requests
from categories.models import Category
from django.core.files.uploadedfile import SimpleUploadedFile
from pytest_django.fixtures import Settings
from reports.services import (
    CATEGORY_SUGGESTION_MODEL,
    default_category,
    detect_abuse,
    suggest_category,
    suggest_category_label,
)
from vilnius_backend.choices import ProblemUrgency

API_KEY = "test-anthropic-key"


def _category(name: str) -> Category:
    """Create a category with the given name."""
    return Category.objects.create(
        name=name,
        description=f"{name} problems.",
        icon=f"https://example.com/icons/{name.lower()}.svg",
        default_urgency=ProblemUrgency.CAN_WAIT,
    )


class _FakeResponse:
    """The parts of `requests.Response` the service reads."""

    def __init__(self, status_code: int, payload: object) -> None:
        self.status_code: int = status_code
        self.ok: bool = status_code < HTTPStatus.BAD_REQUEST
        self.text: str = json.dumps(payload)
        self._payload: object = payload

    def json(self) -> object:
        """Return the decoded body."""
        return self._payload


def _messages_response(text: str) -> _FakeResponse:
    """Build a successful Messages API response whose text block is `text`."""
    return _FakeResponse(
        HTTPStatus.OK,
        {
            "type": "message",
            "role": "assistant",
            "content": [{"type": "text", "text": text}],
            "stop_reason": "end_turn",
        },
    )


class _FakePost:
    """Stand-in for `requests.post` that records calls and replays a result."""

    def __init__(self, result: _FakeResponse | Exception) -> None:
        self.result: _FakeResponse | Exception = result
        self.calls: list[dict[str, object]] = []

    def __call__(self, url: str, **kwargs: object) -> _FakeResponse:
        """Record the request, then return or raise the configured result."""
        self.calls.append({"url": url, **kwargs})
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def _patch_post(
    monkeypatch: pytest.MonkeyPatch,
    result: _FakeResponse | Exception,
) -> _FakePost:
    """Replace the HTTP call to Anthropic so tests never hit the network."""
    fake = _FakePost(result)
    monkeypatch.setattr("reports.services.requests.post", fake)
    return fake


@pytest.fixture
def api_key(settings: Settings) -> str:
    """Configure an Anthropic API key (the suite blanks it by default)."""
    settings.ANTHROPIC_API_KEY = API_KEY
    return API_KEY


@pytest.mark.django_db
class TestDefaultCategory:
    """Tests for `default_category`."""

    def test_prefers_a_category_named_other(self, category: Category) -> None:
        """Prefer the deliberate catch-all category over an alphabetical first."""
        del category
        other = _category("Other")
        _ = _category("Graffiti")

        assert default_category() == other

    def test_matches_other_case_insensitively(self) -> None:
        """The fallback lookup doesn't depend on how "other" was capitalised."""
        other = _category("OTHER")

        assert default_category() == other

    def test_falls_back_to_any_category(self, category: Category) -> None:
        """Without an "Other" category, some existing category is still returned."""
        assert default_category() == category

    def test_returns_none_without_any_categories(self) -> None:
        """With nothing configured there is nothing to fall back to."""
        assert default_category() is None


@pytest.mark.django_db
@pytest.mark.usefixtures("api_key")
class TestSuggestCategory:
    """Tests for `suggest_category`."""

    def test_returns_categories_in_the_ranked_order(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Numbers in the reply map to categories, most likely first."""
        graffiti = _category("Graffiti")  # 1 (categories are ordered by name)
        other = _category("Other")  # 2
        pothole = _category("Pothole")  # 3
        _ = _patch_post(monkeypatch, _messages_response('{"categories": [3, 1, 2]}'))

        assert suggest_category("Duobe kelyje.") == [pothole, graffiti, other]

    def test_sends_the_description_and_categories(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """The request carries the key, model, numbered list and description."""
        _ = _category("Graffiti")
        fake = _patch_post(monkeypatch, _messages_response('{"categories": [1]}'))

        _ = suggest_category("Grafitis ant sienos.")

        [call] = fake.calls
        assert call["url"] == "https://api.anthropic.com/v1/messages"
        headers = cast("dict[str, str]", call["headers"])
        assert headers["x-api-key"] == API_KEY
        body = cast("dict[str, object]", json.loads(cast("str", call["data"])))
        assert body["model"] == CATEGORY_SUGGESTION_MODEL
        assert "1: Graffiti - Graffiti problems." in str(body["system"])
        assert "Grafitis ant sienos." in str(body["messages"])

    def test_drops_unknown_and_duplicate_numbers(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Out-of-range, repeated and non-integer numbers are ignored."""
        graffiti = _category("Graffiti")
        pothole = _category("Pothole")
        _ = _patch_post(
            monkeypatch,
            _messages_response('{"categories": [0, 2, 2, 99, "1", true, 1]}'),
        )

        assert suggest_category("Duobe.") == [pothole, graffiti]

    def test_truncates_to_the_limit(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Never return more than `limit` categories."""
        graffiti = _category("Graffiti")
        _ = _category("Other")
        _ = _category("Pothole")
        _ = _patch_post(monkeypatch, _messages_response('{"categories": [1, 2, 3]}'))

        assert suggest_category("Grafitis.", limit=1) == [graffiti]

    def test_returns_nothing_without_an_api_key(
        self,
        monkeypatch: pytest.MonkeyPatch,
        settings: Settings,
    ) -> None:
        """Without a key the API isn't called at all."""
        settings.ANTHROPIC_API_KEY = ""
        _ = _category("Graffiti")
        fake = _patch_post(monkeypatch, _messages_response('{"categories": [1]}'))

        assert suggest_category("Grafitis.") == []
        assert fake.calls == []

    @pytest.mark.parametrize("description", ["", "   \n"])
    def test_returns_nothing_for_a_blank_description(
        self,
        monkeypatch: pytest.MonkeyPatch,
        description: str,
    ) -> None:
        """There is nothing to classify, so the API isn't called."""
        _ = _category("Graffiti")
        fake = _patch_post(monkeypatch, _messages_response('{"categories": [1]}'))

        assert suggest_category(description) == []
        assert fake.calls == []

    def test_returns_nothing_without_any_categories(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """With nothing configured there is nothing to rank."""
        fake = _patch_post(monkeypatch, _messages_response('{"categories": [1]}'))

        assert suggest_category("Duobe.") == []
        assert fake.calls == []

    def test_returns_nothing_when_the_request_fails(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Network errors and timeouts don't propagate."""
        _ = _category("Graffiti")
        _ = _patch_post(monkeypatch, requests.Timeout("timed out"))

        assert suggest_category("Grafitis.") == []

    def test_returns_nothing_on_an_api_error(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """An error status (e.g. overloaded) doesn't propagate."""
        _ = _category("Graffiti")
        error = {"type": "error", "error": {"type": "overloaded_error"}}
        _ = _patch_post(monkeypatch, _FakeResponse(529, error))

        assert suggest_category("Grafitis.") == []

    @pytest.mark.parametrize(
        "text",
        ["not json", '["1"]', '{"categories": "1"}', '{"other": [1]}'],
    )
    def test_returns_nothing_for_an_unusable_reply(
        self,
        monkeypatch: pytest.MonkeyPatch,
        text: str,
    ) -> None:
        """A reply that isn't the expected JSON shape yields no suggestion."""
        _ = _category("Graffiti")
        _ = _patch_post(monkeypatch, _messages_response(text))

        assert suggest_category("Grafitis.") == []

    def test_returns_nothing_without_a_text_block(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """E.g. a refusal, whose content carries no answer."""
        _ = _category("Graffiti")
        _ = _patch_post(
            monkeypatch,
            _FakeResponse(HTTPStatus.OK, {"content": [], "stop_reason": "refusal"}),
        )

        assert suggest_category("Grafitis.") == []


@pytest.mark.django_db
class TestSuggestCategoryLabel:
    """Tests for `suggest_category_label`."""

    def test_names_the_top_suggestion(self, category: Category) -> None:
        """The label is the most likely category's name."""
        other = _category("Other")

        assert suggest_category_label([category, other]) == "Pothole"

    def test_returns_none_without_suggestions(self) -> None:
        """No AI suggestion means no label."""
        assert suggest_category_label([]) is None


class TestDetectAbuse:
    """Tests for `detect_abuse`."""

    def test_never_flags_while_stubbed(self) -> None:
        """Abuse screening is deferred, so nothing is flagged."""
        upload = SimpleUploadedFile("p.jpg", b"bytes", content_type="image/jpeg")

        assert detect_abuse("A pothole.", [upload]) is False
