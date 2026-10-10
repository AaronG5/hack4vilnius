"""URL routes for the users app."""

from django.urls import path
from users.views import GoogleAuthView, LoginView, LogoutView, RegisterView

app_name = "users"

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("google/", GoogleAuthView.as_view(), name="google"),
    # api/openapi.yaml spells these without a trailing slash, and `APPEND_SLASH`
    # can't redirect a POST without losing its body, so both forms are routed.
    path("login", LoginView.as_view(), name="login-no-slash"),
    path("logout", LogoutView.as_view(), name="logout-no-slash"),
]
