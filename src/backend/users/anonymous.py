"""
Cookie-tracked anonymous identities, merged into a `User` on login/register.

Mix `AnonymousIdentityMixin` into any `APIView` that anonymous visitors may
hit. It attaches `self.anonymous_identity` for the duration of the request
(creating one and issuing its cookie if none was presented yet), and the view
calls `self.anonymous_identity.claim(user)` once that visitor registers or
logs in - see `users.models.AnonymousIdentity.claim`.
"""

from typing import cast, override

from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from users.models import AnonymousIdentity

_COOKIE_SALT = "users.anonymous_identity"


def _cookie_name() -> str:
    return cast("str", settings.ANONYMOUS_IDENTITY_COOKIE_NAME)


def _cookie_max_age() -> int:
    return cast("int", settings.ANONYMOUS_IDENTITY_COOKIE_MAX_AGE)


def get_identity_from_cookie(request: Request) -> AnonymousIdentity | None:
    """Resolve the identity named by the request's signed cookie, if any."""
    raw_id = request.get_signed_cookie(
        _cookie_name(),
        default=None,
        salt=_COOKIE_SALT,
        max_age=_cookie_max_age(),
    )
    if raw_id is None:
        return None
    try:
        return AnonymousIdentity.objects.get(pk=raw_id)
    except (AnonymousIdentity.DoesNotExist, ValueError):
        return None


def set_identity_cookie(response: Response, identity: AnonymousIdentity) -> None:
    """Issue a signed cookie naming `identity` on `response`."""
    response.set_signed_cookie(
        _cookie_name(),
        str(identity.id),
        salt=_COOKIE_SALT,
        max_age=_cookie_max_age(),
        httponly=True,
        samesite="Lax",
        secure=not cast("bool", settings.DEBUG),
    )


class AnonymousIdentityMixin(APIView):
    """Attach and manage a cookie-tracked `AnonymousIdentity` for a view."""

    anonymous_identity: AnonymousIdentity | None = None
    _issue_new_anonymous_cookie: bool = False

    @override
    def initial(self, request: Request, *args: object, **kwargs: object) -> None:
        """Resolve the request's anonymous identity, creating one if needed."""
        super().initial(request, *args, **kwargs)
        if request.user.is_authenticated:
            return

        identity = get_identity_from_cookie(request)
        if identity is None or identity.is_claimed:
            identity = AnonymousIdentity.objects.create()
            self._issue_new_anonymous_cookie = True
        self.anonymous_identity = identity

    @override
    def finalize_response(
        self,
        request: Request,
        response: Response,
        *args: object,
        **kwargs: object,
    ) -> Response:
        """Set or clear the anonymous identity cookie on the way out."""
        response = super().finalize_response(request, response, *args, **kwargs)
        identity = self.anonymous_identity
        if identity is not None and identity.is_claimed:
            response.delete_cookie(_cookie_name())
        elif self._issue_new_anonymous_cookie and identity is not None:
            set_identity_cookie(response, identity)
        return response
