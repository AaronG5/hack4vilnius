"""Views for submitting and reading reports."""

from dataclasses import dataclass
from typing import TYPE_CHECKING, cast, final, override

import problems.services as problem_services
import reports.services as report_services
import users.services as user_services
from categories.models import Category
from categories.serializers import CategorySerializer
from django.contrib.contenttypes.models import ContentType
from django.core.files.uploadedfile import UploadedFile
from media_assets.models import Media
from media_assets.services import infer_media_type
from problems.models import Problem
from reports.models import Report
from reports.serializers import (
    ReportAnalyzeSerializer,
    ReportCreateSerializer,
    ReportSerializer,
)
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
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


@dataclass(frozen=True)
class _NewProblemDetails:
    """Where a new problem is, and what its reporter said besides the description."""

    latitude: float | None
    longitude: float | None
    title: str
    address: str
    urgency: str | None
    near_sensitive: bool


def _get_or_create_problem(
    *,
    existing: Problem | None,
    category: Category | None,
    description: str,
    details: _NewProblemDetails,
) -> Problem:
    """
    Resolve the problem a new report belongs to.

    Attaches to `existing` when the caller confirmed a duplicate; otherwise
    creates a new `Problem` at the given coordinates, in `category` or, if
    that is `None`, the deterministic default category.
    """
    if existing is not None:
        return existing

    resolved_category = category or report_services.default_category()
    if resolved_category is None:
        msg = "No category could be determined for this report."
        raise ValueError(msg)

    location: dict[str, object] = {
        "type": "Point",
        "coordinates": [details.longitude, details.latitude],
    }
    duplicate = problem_services.find_duplicate_problem(location, resolved_category)
    if duplicate is not None:
        return duplicate

    urgency = details.urgency or problem_services.determine_urgency(
        resolved_category,
        description,
    )
    return Problem.objects.create(
        status=ProblemStatus.UNCONFIRMED,
        urgency=urgency,
        reported_urgency=urgency,
        title=details.title,
        address=details.address,
        near_sensitive=details.near_sensitive,
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
        # One AI call per report: it picks the category when the user didn't,
        # and is recorded as `ai_category_suggestion` either way.
        suggestions = report_services.suggest_category(description)
        chosen_category = cast("Category | None", data.get("category"))

        problem = _get_or_create_problem(
            existing=cast("Problem | None", data.get("problem")),
            category=chosen_category or next(iter(suggestions), None),
            description=description,
            details=_NewProblemDetails(
                latitude=cast("float | None", data.get("latitude")),
                longitude=cast("float | None", data.get("longitude")),
                title=cast("str", data["title"]).strip(),
                address=cast("str", data["address"]).strip(),
                urgency=cast("str | None", data.get("urgency")),
                near_sensitive=cast("bool", data["near_sensitive"]),
            ),
        )

        report = Report.objects.create(
            description=description,
            ai_category_suggestion=report_services.suggest_category_label(suggestions)
            or "",
            ai_abuse_flag=report_services.detect_abuse(description, files),
            user=user,
            problem=problem,
        )
        _attach_media(report, user, files)
        user_services.award_points(user, user_services.REPORT_POINTS)

        output = ReportSerializer(report, context={"request": request})
        return Response(
            cast("ReturnDict[str, object]", output.data),
            status=status.HTTP_201_CREATED,
        )


@final
class ReportAnalyzeView(APIView):
    """
    `POST /api/reports/analyze` — suggest categories before a report is filed.

    Lets the report form offer a few likely categories instead of the full
    list. Authenticated: each call spends the AI provider's quota.
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request: Request) -> Response:
        """Return up to `limit` suggested categories, most likely first."""
        query = ReportAnalyzeSerializer(data=request.data)
        _ = query.is_valid(raise_exception=True)
        data = cast("dict[str, object]", query.validated_data)

        # Empty when the AI is unavailable: the form then shows every category.
        suggestions = report_services.suggest_category(
            cast("str", data["description"]),
            cast("int", data["limit"]),
        )
        categories = [
            cast("ReturnDict[str, object]", CategorySerializer(category).data)
            for category in suggestions
        ]
        return Response({"categories": categories}, status=status.HTTP_200_OK)


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
