"""Views for submitting and reading reports."""

from typing import TYPE_CHECKING, cast, final, override

import problems.services as problem_services
import reports.services as report_services
from categories.models import Category
from django.contrib.contenttypes.models import ContentType
from django.core.files.uploadedfile import UploadedFile
from media_assets.models import Media
from media_assets.services import infer_media_type
from problems.models import Problem
from reports.models import Report
from reports.serializers import ReportCreateSerializer, ReportSerializer
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from users.models import User
from vilnius_backend.choices import ProblemStatus, UserRole
from vilnius_backend.generic_views import (
    DefaultCreateAPIView,
    DefaultRetrieveAPIView,
)

if TYPE_CHECKING:
    from django.db.models import QuerySet
    from rest_framework.utils.serializer_helpers import ReturnDict


def _attach_media(report: Report, user: User, files: list[UploadedFile[bytes]]) -> None:
    """Create a `Media` row for each uploaded file, attached to `report`."""
    content_type = ContentType.objects.get_for_model(Report)
    for uploaded_file in files:
        _ = Media.objects.create(
            type=infer_media_type(uploaded_file),
            file=uploaded_file,
            uploaded_by=user,
            content_type=content_type,
            object_id=report.id,
        )


def _get_or_create_problem(
    *,
    existing: Problem | None,
    category: Category | None,
    description: str,
    latitude: float | None,
    longitude: float | None,
) -> Problem:
    """
    Resolve the problem a new report belongs to.

    Attaches to `existing` when the caller confirmed a duplicate; otherwise
    creates a new `Problem` at the given coordinates.
    """
    if existing is not None:
        return existing

    resolved_category = category or report_services.suggest_category(description)
    if resolved_category is None:
        msg = "No category could be determined for this report."
        raise ValueError(msg)

    location: dict[str, object] = {
        "type": "Point",
        "coordinates": [longitude, latitude],
    }
    duplicate = problem_services.find_duplicate_problem(location, resolved_category)
    if duplicate is not None:
        return duplicate

    return Problem.objects.create(
        status=ProblemStatus.UNCONFIRMED,
        urgency=problem_services.determine_urgency(resolved_category, description),
        legitimacy_score=problem_services.estimate_legitimacy_score(
            resolved_category,
            description,
        ),
        location=location,
        category=resolved_category,
    )


@final
class ReportCreateView(DefaultCreateAPIView[Report]):
    """`POST /api/reports` — submit a new report (media + description)."""

    permission_classes = (IsAuthenticated,)
    parser_classes = (MultiPartParser, FormParser)
    serializer_class = ReportCreateSerializer

    @override
    def create(self, request: Request, *args: object, **kwargs: object) -> Response:
        """Validate the submission, resolve/create its problem, and save it."""
        del args, kwargs
        serializer = ReportCreateSerializer(data=request.data)
        _ = serializer.is_valid(raise_exception=True)
        data = cast("dict[str, object]", serializer.validated_data)
        user = cast("User", request.user)
        description = cast("str", data["description"])
        files = cast("list[UploadedFile[bytes]]", data["media"])

        problem = _get_or_create_problem(
            existing=cast("Problem | None", data.get("problem")),
            category=cast("Category | None", data.get("category")),
            description=description,
            latitude=cast("float | None", data.get("latitude")),
            longitude=cast("float | None", data.get("longitude")),
        )

        report = Report.objects.create(
            description=description,
            ai_category_suggestion=report_services.suggest_category_label(description)
            or "",
            ai_abuse_flag=report_services.detect_abuse(description, files),
            user=user,
            problem=problem,
        )
        _attach_media(report, user, files)

        output = ReportSerializer(report, context={"request": request})
        return Response(
            cast("ReturnDict[str, object]", output.data),
            status=status.HTTP_201_CREATED,
        )


@final
class ReportDetailView(DefaultRetrieveAPIView[Report]):
    """
    `GET /api/reports/{id}` — report details.

    Need-to-know basis: a report is only visible to the user who filed it,
    or to staff/city administrators.
    """

    permission_classes = (IsAuthenticated,)
    serializer_class = ReportSerializer
    lookup_url_kwarg = "id"

    @override
    def get_queryset(self) -> "QuerySet[Report]":
        """Scope visible reports to the requester's own, unless staff/admin."""
        user = cast("User", self.request.user)
        queryset = Report.objects.select_related("user", "problem")
        if user.role in {UserRole.CITY_ADMINISTRATOR, UserRole.STAFF}:
            return queryset
        return queryset.filter(user=user)
