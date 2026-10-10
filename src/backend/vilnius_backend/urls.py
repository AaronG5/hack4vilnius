"""
URL configuration for vilnius_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/

Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))

"""

from typing import cast

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from users.leaderboard import LeaderboardView
from users.views import ProfileView, SessionView
from vilnius_backend.views import ManualOpenApiSchemaView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("users.urls")),
    path("api/session", SessionView.as_view(), name="session"),
    path("api/users/me", ProfileView.as_view(), name="profile"),
    path("api/leaderboard", LeaderboardView.as_view(), name="leaderboard"),
    path("api/", include("districts.urls")),
    path("api/", include("categories.urls")),
    path("api/", include("problems.urls")),
    path("api/", include("reports.urls")),
    path("api/", include("validations.urls")),
    path("api/", include("badges.urls")),
    path("api/", include("challenges.urls")),
    path("api/", include("notifications.urls")),
    path("api/", include("moderation.urls")),
    path("api/", include("geocoding.urls")),
    path("api/openapi.yaml", ManualOpenApiSchemaView.as_view(), name="manual-schema"),
    path(
        "api/",
        SpectacularSwaggerView.as_view(
            url="/api/openapi.yaml",
            title="Hack4Vilnius API (contract)",
        ),
        name="manual-swagger-ui",
    ),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/schema/swagger-ui/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/schema/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
]

# `cast`s because django-stubs resolves project settings through
# `LazySettings.__getattr__`, which is typed `Any`.
if cast("bool", settings.DEBUG):
    urlpatterns += static(
        cast("str", settings.MEDIA_URL),
        document_root=cast("str", settings.MEDIA_ROOT),
    )
