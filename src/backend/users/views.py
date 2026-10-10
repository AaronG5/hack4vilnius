"""Registration, login, logout and Google sign-in endpoints."""

from collections.abc import Callable, Mapping
from typing import cast, final

from django.conf import settings
from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from users.anonymous import AnonymousIdentityMixin
from users.models import User
from users.openapi import OpenApiParameter, OpenApiResponse, extend_schema
from users.serializers import (
    AuthResponseSerializer,
    GoogleAuthSerializer,
    LoginSerializer,
    RegisterSerializer,
    UserSerializer,
)

_ANON_COOKIE_PARAMETER = OpenApiParameter(
    name=cast("str", settings.ANONYMOUS_IDENTITY_COOKIE_NAME),
    type=str,
    location=OpenApiParameter.COOKIE,
    required=False,
    description=(
        "Anonymous-visitor identity cookie (set automatically by prior "
        "requests). If present, its data is attributed to this account."
    ),
)

_VerifyOAuth2Token = Callable[[str, google_requests.Request, str], Mapping[str, object]]


def _authenticated_response(user: User, status_code: int) -> Response:
    token, _created = Token.objects.get_or_create(user=user)
    key = cast("str", token.key)
    data = cast("dict[str, object]", UserSerializer(user).data)
    return Response({"token": key, "user": data}, status=status_code)


@final
class RegisterView(AnonymousIdentityMixin):
    """Create an account with an email and password."""

    permission_classes = (AllowAny,)

    @extend_schema(
        summary="Register with email and password",
        description="Create an account directly with an email and password.",
        parameters=[_ANON_COOKIE_PARAMETER],
        request=RegisterSerializer,
        responses={
            201: AuthResponseSerializer,
            400: OpenApiResponse(
                description="Invalid data: duplicate email or a weak password.",
            ),
        },
    )
    def post(self, request: Request) -> Response:
        """Create the account and return an auth token for it."""
        serializer = RegisterSerializer(data=request.data)
        _ = serializer.is_valid(raise_exception=True)
        user = serializer.save()
        if self.anonymous_identity is not None:
            self.anonymous_identity.claim(user)
        return _authenticated_response(user, status.HTTP_201_CREATED)


@final
class LoginView(AnonymousIdentityMixin):
    """Log in with an email and password."""

    permission_classes = (AllowAny,)

    @extend_schema(
        summary="Log in with email and password",
        description="Authenticate with an email and password.",
        parameters=[_ANON_COOKIE_PARAMETER],
        request=LoginSerializer,
        responses={
            200: AuthResponseSerializer,
            400: OpenApiResponse(
                description="Invalid credentials or an inactive/Google-only account.",
            ),
        },
    )
    def post(self, request: Request) -> Response:
        """Validate credentials and return an auth token for the account."""
        serializer = LoginSerializer(data=request.data, context={"request": request})
        _ = serializer.is_valid(raise_exception=True)
        user = cast("User", serializer.validated_data["user"])
        if self.anonymous_identity is not None:
            self.anonymous_identity.claim(user)
        return _authenticated_response(user, status.HTTP_200_OK)


@final
class LogoutView(APIView):
    """Log out the current session and revoke its API token."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(
        summary="Log out",
        description="Revoke the current user's API token.",
        request=None,
        responses={
            204: OpenApiResponse(description="Token revoked."),
            401: OpenApiResponse(description="Missing or invalid token."),
        },
    )
    def post(self, request: Request) -> Response:
        """Revoke the current user's API token."""
        _ = Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@final
class GoogleAuthView(AnonymousIdentityMixin):
    """Register or log in using a Google ID token (Sign in with Google)."""

    permission_classes = (AllowAny,)

    @extend_schema(
        summary="Register or log in with Google",
        description=(
            "Verify a Google-issued ID token (Sign in with Google) and create or "
            "log into the account with the matching email."
        ),
        parameters=[_ANON_COOKIE_PARAMETER],
        request=GoogleAuthSerializer,
        responses={
            200: AuthResponseSerializer,
            201: AuthResponseSerializer,
            401: OpenApiResponse(
                description="Invalid, expired or unverified Google ID token.",
            ),
            503: OpenApiResponse(description="Google sign-in is not configured."),
        },
    )
    def post(self, request: Request) -> Response:
        """Verify the Google ID token and return an auth token for the account."""
        serializer = GoogleAuthSerializer(data=request.data)
        _ = serializer.is_valid(raise_exception=True)
        id_token_value = cast("str", serializer.validated_data["id_token"])

        client_id = cast("str", settings.GOOGLE_OAUTH_CLIENT_ID)
        if not client_id:
            return Response(
                {"detail": "Google sign-in is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        verify = cast("_VerifyOAuth2Token", google_id_token.verify_oauth2_token)
        try:
            payload = verify(id_token_value, google_requests.Request(), client_id)
        except (GoogleAuthError, ValueError):
            return Response(
                {"detail": "Invalid or expired Google ID token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        email = payload.get("email")
        google_sub = payload.get("sub")
        if (
            not isinstance(email, str)
            or not payload.get("email_verified")
            or not isinstance(google_sub, str)
        ):
            return Response(
                {"detail": "Google account has no verified email address."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        user, created = _get_or_create_google_user(email, google_sub, payload)
        if self.anonymous_identity is not None:
            self.anonymous_identity.claim(user)
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return _authenticated_response(user, status_code)


def _get_or_create_google_user(
    email: str,
    google_sub: str,
    payload: Mapping[str, object],
) -> tuple[User, bool]:
    try:
        return User.objects.get(google_sub=google_sub), False
    except User.DoesNotExist:
        pass

    name = payload.get("name", "")
    display_name = name if isinstance(name, str) else ""

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        user = User.objects.create_user(
            email=email,
            password=None,
            google_sub=google_sub,
            display_name=display_name,
        )
        return user, True

    user.google_sub = google_sub
    user.save(update_fields=["google_sub"])
    return user, False
