"""Role-based permissions shared across apps."""

from typing import TYPE_CHECKING, final, override

from rest_framework.permissions import BasePermission
from vilnius_backend.choices import UserRole

if TYPE_CHECKING:
    from rest_framework.request import Request
    from rest_framework.views import APIView

_STAFF_ROLES = frozenset({UserRole.CITY_ADMINISTRATOR, UserRole.STAFF})


@final
class IsCityAdministratorOrStaff(BasePermission):
    """Allows access only to city administrators and staff."""

    @override
    def has_permission(self, request: "Request", view: "APIView") -> bool:
        """Check the requester is authenticated with a privileged role."""
        del view
        user = request.user
        return (
            bool(user.is_authenticated) and getattr(user, "role", None) in _STAFF_ROLES
        )
