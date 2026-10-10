"""Tests for the anonymous-identity cookie helpers."""

import uuid
from typing import cast

import pytest
from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response as DrfResponse
from rest_framework.test import APIRequestFactory
from users.anonymous import get_identity_from_cookie, set_identity_cookie
from users.models import AnonymousIdentity


def _cookie_name() -> str:
    return cast("str", settings.ANONYMOUS_IDENTITY_COOKIE_NAME)


def _signed_cookie_value(identity: AnonymousIdentity) -> str:
    """Produce the signed cookie value `set_identity_cookie` would send."""
    response = DrfResponse()
    set_identity_cookie(response, identity)
    return response.cookies[_cookie_name()].value


def _request_with_cookie(value: str | None) -> Request:
    request = APIRequestFactory().get("/")
    if value is not None:
        request.COOKIES[_cookie_name()] = value
    return request


@pytest.mark.django_db
class TestGetIdentityFromCookie:
    """Tests for `get_identity_from_cookie`."""

    def test_resolves_a_validly_signed_cookie(self) -> None:
        """A genuine cookie resolves back to the identity that issued it."""
        identity = AnonymousIdentity.objects.create()
        request = _request_with_cookie(_signed_cookie_value(identity))

        assert get_identity_from_cookie(request) == identity

    def test_returns_none_when_no_cookie_is_present(self) -> None:
        """No cookie means no identity, not an error."""
        request = _request_with_cookie(None)

        assert get_identity_from_cookie(request) is None

    def test_returns_none_for_a_tampered_cookie(self) -> None:
        """A cookie whose signature doesn't match its value is rejected."""
        identity = AnonymousIdentity.objects.create()
        tampered = _signed_cookie_value(identity) + "tampered"
        request = _request_with_cookie(tampered)

        assert get_identity_from_cookie(request) is None

    def test_returns_none_for_an_unknown_identity(self) -> None:
        """A validly-signed cookie for an id no longer in the database."""
        never_saved = AnonymousIdentity(id=uuid.uuid4())
        request = _request_with_cookie(_signed_cookie_value(never_saved))

        assert get_identity_from_cookie(request) is None


@pytest.mark.django_db
class TestSetIdentityCookie:
    """Tests for `set_identity_cookie`."""

    def test_sets_an_httponly_cookie(self) -> None:
        """The cookie is not readable from client-side JavaScript."""
        identity = AnonymousIdentity.objects.create()
        response = DrfResponse()

        set_identity_cookie(response, identity)

        assert response.cookies[_cookie_name()]["httponly"]

    def test_the_cookie_value_cannot_be_forged(self) -> None:
        """Swapping in a different id without the signature is rejected."""
        identity = AnonymousIdentity.objects.create()
        other = AnonymousIdentity.objects.create()
        response = DrfResponse()
        set_identity_cookie(response, identity)
        signed_value = response.cookies[_cookie_name()].value

        forged = signed_value.replace(str(identity.id), str(other.id))
        request = _request_with_cookie(forged)

        assert get_identity_from_cookie(request) is None
