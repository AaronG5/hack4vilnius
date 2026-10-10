"""Views for listing, reading and updating problems."""

from typing import TYPE_CHECKING, cast, final, override

from districts.services import get_district_for_point
from notifications.services import notify_problem_status_change
from problems.models import Problem
from problems.serializers import (
    ProblemDetailSerializer,
    ProblemSerializer,
    ProblemStatusUpdateSerializer,
)
from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from users.permissions import IsCityAdministratorOrStaff
from vilnius_backend.generic_views import (
    DefaultListAPIView,
    DefaultRetrieveAPIView,
)

if TYPE_CHECKING:
    from collections.abc import Mapping

    from django.db.models import QuerySet
    from rest_framework.utils.serializer_helpers import ReturnDict


@final
class ProblemListView(DefaultListAPIView[Problem]):
    """
    `GET /api/problems` — list problems.

    Filterable by `status`, `urgency` and `category` directly; `district`
    is filtered in Python since a problem's district isn't stored, only
    computed from its `location` (see `districts.services`).
    """

    permission_classes = (AllowAny,)
    serializer_class = ProblemSerializer

    @override
    def get_queryset(self) -> "QuerySet[Problem]":
        """Apply the `status`/`urgency`/`category`/`district` query filters."""
        params = self.request.query_params
        queryset = Problem.objects.select_related("category", "institution")

        status_param = params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)

        urgency_param = params.get("urgency")
        if urgency_param:
            queryset = queryset.filter(urgency=urgency_param)

        category_param = params.get("category")
        if category_param:
            queryset = queryset.filter(category_id=category_param)

        district_param = params.get("district")
        if district_param:
            matching_ids = [
                problem.id
                for problem in queryset
                if (
                    district := get_district_for_point(
                        cast("Mapping[str, object]", problem.location),
                    )
                )
                is not None
                and str(district.id) == district_param
            ]
            queryset = queryset.filter(id__in=matching_ids)

        return queryset


@final
class ProblemDetailView(DefaultRetrieveAPIView[Problem]):
    """`GET /api/problems/{id}` — problem details, reports and validations."""

    permission_classes = (AllowAny,)
    serializer_class = ProblemDetailSerializer
    lookup_url_kwarg = "id"
    queryset = Problem.objects.select_related(
        "category", "institution"
    ).prefetch_related(
        "reports__media",
        "reports__user",
        "validations__media",
        "validations__user",
    )


@final
class ProblemStatusUpdateView(APIView):
    """`PUT /api/problems/{id}/status` — admin/institution updates status."""

    permission_classes = (IsCityAdministratorOrStaff,)

    def put(self, request: Request, id: str) -> Response:  # noqa: A002
        """Validate and apply the new status, notifying involved users."""
        problem = get_object_or_404(
            Problem.objects.select_related("category", "institution"),
            pk=id,
        )
        serializer = ProblemStatusUpdateSerializer(data=request.data)
        _ = serializer.is_valid(raise_exception=True)
        new_status = cast("str", serializer.validated_data["status"])

        problem.status = new_status
        problem.save(update_fields=["status", "updated_at"])
        _ = notify_problem_status_change(problem)

        output = ProblemSerializer(problem)
        return Response(
            cast("ReturnDict[str, object]", output.data),
            status=status.HTTP_200_OK,
        )
