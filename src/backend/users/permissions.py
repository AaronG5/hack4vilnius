"""Role-based permissions shared across apps."""

from typing import TYPE_CHECKING, cast, final, override

from django.conf import settings
from rest_framework.permissions import BasePermission
from vilnius_backend.choices import UserRole

if TYPE_CHECKING:
    from rest_framework.request import Request
    from rest_framework.views import APIView

_STAFF_ROLES = frozenset({UserRole.CITY_ADMINISTRATOR, UserRole.STAFF})


@final
class IsCityAdministratorOrStaff(BasePermission):
    """
    Allows access only to city administrators and staff.

    With `settings.CITY_TOOLS_FOR_EVERYONE` (the default while DEBUG is on),
    any authenticated user is let through instead, since the app has no
    staff login yet.
    """

    @override
    def has_permission(self, request: "Request", view: "APIView") -> bool:
        """Check the requester is authenticated with a privileged role."""
        del view
        user = request.user
        if not user.is_authenticated:
            return False
        if cast("bool", settings.CITY_TOOLS_FOR_EVERYONE):
            return True
        return getattr(user, "role", None) in _STAFF_ROLES
