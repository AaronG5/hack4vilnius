"""Serializers for registration, login, Google sign-in and user profiles."""

from typing import TYPE_CHECKING, cast, final, override

from districts.models import District
from districts.serializers import DistrictSerializer
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from users.models import User

if TYPE_CHECKING:
    from rest_framework.request import Request


@final
class UserRefSerializer(serializers.Serializer[User]):
    """
    Minimal public reference to a user (id and name only).

    Per the "need to know basis" practice: full user records (email, trust
    score, points) are only exposed to the user themself, via
    `UserProfileSerializer`.
    """

    id: serializers.IntegerField = serializers.IntegerField(read_only=True)
    name: serializers.CharField = serializers.CharField(
        source="display_name",
        read_only=True,
    )


@final
class UserProfileSerializer(serializers.Serializer[User]):
    """The current user's own profile: full `User` contract shape."""

    id: serializers.IntegerField = serializers.IntegerField(read_only=True)
    name: serializers.CharField = serializers.CharField(source="display_name")
    email: serializers.EmailField = serializers.EmailField()
    role: serializers.CharField = serializers.CharField(read_only=True)
    trust_score: serializers.FloatField = serializers.FloatField(read_only=True)
    points: serializers.IntegerField = serializers.IntegerField(read_only=True)
    district: DistrictSerializer = DistrictSerializer(read_only=True)
    created_at: serializers.DateTimeField = serializers.DateTimeField(
        source="date_joined",
        read_only=True,
    )


@final
class UserProfileUpdateSerializer(serializers.Serializer[User]):
    """Partial update of the current user's own profile fields."""

    name: serializers.CharField = serializers.CharField(
        source="display_name",
        required=False,
    )
    email: serializers.EmailField = serializers.EmailField(required=False)
    # Explicitly parameterized: `PrimaryKeyRelatedField(...)` is typed as
    # returning either a single or a many-related field, and only the type
    # argument pins down the model the related field is over.
    district = serializers.PrimaryKeyRelatedField[District](
        queryset=District.objects.all(),
        required=False,
        allow_null=True,
    )

    @override
    def update(self, instance: User, validated_data: dict[str, object]) -> User:
        """Apply only the fields the client actually sent."""
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save(update_fields=list(validated_data.keys()))
        return instance


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
    user: UserProfileSerializer = UserProfileSerializer()
