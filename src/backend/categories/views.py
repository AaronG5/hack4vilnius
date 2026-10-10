"""Views for listing categories."""

from typing import final

from categories.models import Category
from categories.serializers import CategorySerializer
from rest_framework.permissions import AllowAny
from vilnius_backend.generic_views import DefaultListAPIView


@final
class CategoryListView(DefaultListAPIView[Category]):
    """`GET /api/categories` — list available problem categories."""

    permission_classes = (AllowAny,)
    serializer_class = CategorySerializer
    queryset = Category.objects.select_related("institution").all()
