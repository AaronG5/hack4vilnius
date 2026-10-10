"""URL routes for the categories app."""

from categories.views import CategoryListView
from django.urls import path

app_name = "categories"

urlpatterns = [
    path("categories", CategoryListView.as_view(), name="list"),
]
