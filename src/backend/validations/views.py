"""Views for submitting and listing validations for a problem."""

from typing import TYPE_CHECKING, cast, final, override

import validations.services as validation_services
from django.contrib.contenttypes.models import ContentType
from django.core.files.uploadedfile import UploadedFile
from django.shortcuts import get_object_or_404
from media_assets.models import Media
from media_assets.services import infer_media_type
from problems.models import Problem
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from users.models import User
from validations.models import Validation
from validations.serializers import ValidationCreateSerializer, ValidationSerializer
from vilnius_backend.generic_views import DefaultListCreateAPIView

if TYPE_CHECKING:
    from django.db.models import QuerySet
    from rest_framework.utils.serializer_helpers import ReturnDict


def _attach_media(
    validation: Validation, user: User, files: list[UploadedFile[bytes]]
) -> None:
    """Create a `Media` row for each uploaded file, attached to `validation`."""
    content_type = ContentType.objects.get_for_model(Validation)
    for uploaded_file in files:
        _ = Media.objects.create(
            type=infer_media_type(uploaded_file),
            file=uploaded_file,
            uploaded_by=user,
            content_type=content_type,
            object_id=validation.id,
        )


@final
class ValidationListCreateView(DefaultListCreateAPIView[Validation]):
    """`GET`/`POST /api/problems/{id}/validations`."""

    parser_classes = (MultiPartParser, FormParser)

    @override
    def get_permissions(self) -> list[BasePermission]:
        """Allow anyone to list, but require a token to submit a validation."""
        if self.request.method == "POST":
            return [IsAuthenticated()]
        return [AllowAny()]

    @override
    def get_serializer_class(
        self,
    ) -> type[ValidationCreateSerializer | ValidationSerializer]:
        """Use the write shape for `POST`, the read shape otherwise."""
        if self.request.method == "POST":
            return ValidationCreateSerializer
        return ValidationSerializer

    @override
    def get_queryset(self) -> "QuerySet[Validation]":
        """Return the validations belonging to the problem named in the URL."""
        problem_id = cast("str", self.kwargs["id"])
        _ = get_object_or_404(Problem, pk=problem_id)
        return Validation.objects.filter(problem_id=problem_id).select_related("user")

    @override
    def create(self, request: Request, *args: object, **kwargs: object) -> Response:
        """Validate the submission and save it against the URL's problem."""
        del args
        problem = get_object_or_404(Problem, pk=kwargs["id"])
        serializer = ValidationCreateSerializer(data=request.data)
        _ = serializer.is_valid(raise_exception=True)
        data = cast("dict[str, object]", serializer.validated_data)
        user = cast("User", request.user)
        files = cast("list[UploadedFile[bytes]]", data["media"])

        validation = Validation.objects.create(
            is_valid=cast("bool", data["is_valid"]),
            description=cast("str", data["description"]),
            user=user,
            problem=problem,
        )
        validation.points_awarded = validation_services.calculate_points(
            problem,
            validation,
        )
        validation.save(update_fields=["points_awarded"])
        _attach_media(validation, user, files)
        validation_services.evaluate_problem_validations(problem)

        output = ValidationSerializer(validation, context={"request": request})
        return Response(
            cast("ReturnDict[str, object]", output.data),
            status=status.HTTP_201_CREATED,
        )
