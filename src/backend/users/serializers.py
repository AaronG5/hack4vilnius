"""Serializers for registration, login and Google sign-in."""

from typing import TYPE_CHECKING, cast, final, override

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from users.models import User

if TYPE_CHECKING:
    from rest_framework.request import Request


@final
class UserSerializer(serializers.Serializer[User]):
    """Public representation of a user."""

    id: serializers.IntegerField = serializers.IntegerField(read_only=True)
    email: serializers.EmailField = serializers.EmailField(read_only=True)
    display_name: serializers.CharField = serializers.CharField(read_only=True)


@final
class RegisterSerializer(serializers.Serializer[User]):
    """Create a new account from an email and password."""

    email: serializers.EmailField = serializers.EmailField(
        validators=[UniqueValidator(queryset=User.objects.all())],
    )
    password: serializers.CharField = serializers.CharField(
        write_only=True,
        validators=[validate_password],
    )
    display_name: serializers.CharField = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )

    @override
    def create(self, validated_data: dict[str, str]) -> User:
        """Create the user with a properly hashed password."""
        return User.objects.create_user(**validated_data)


@final
class LoginSerializer(serializers.Serializer[User]):
    """Authenticate an existing account by email and password."""

    email: serializers.EmailField = serializers.EmailField()
    password: serializers.CharField = serializers.CharField(write_only=True)

    @override
    def validate(self, attrs: dict[str, str]) -> dict[str, str | User]:
        """Authenticate the given email and password, attaching the user."""
        request = cast("Request", self.context["request"])
        user = authenticate(
            request,
            username=attrs["email"],
            password=attrs["password"],
        )
        if user is None or not isinstance(user, User):
            msg = "No active account found with the given credentials."
            raise serializers.ValidationError(msg, code="authorization")
        result: dict[str, str | User] = dict(attrs)
        result["user"] = user
        return result


@final
class GoogleAuthSerializer(serializers.Serializer[User]):
    """Register or log in using a Google-issued ID token."""

    id_token: serializers.CharField = serializers.CharField(write_only=True)


@final
class AuthResponseSerializer(serializers.Serializer[User]):
    """Documents the `{token, user}` envelope returned by the auth endpoints."""

    token: serializers.CharField = serializers.CharField()
    user: UserSerializer = UserSerializer()
