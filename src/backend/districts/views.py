"""Views for listing districts."""

from typing import final

from districts.models import District
from districts.serializers import DistrictSerializer
from rest_framework.permissions import AllowAny
from vilnius_backend.generic_views import DefaultListAPIView


@final
class DistrictListView(DefaultListAPIView[District]):
    """`GET /api/districts` — list districts and their boundaries."""

    permission_classes = (AllowAny,)
    serializer_class = DistrictSerializer
    queryset = District.objects.all()
