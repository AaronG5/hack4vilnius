"""Smoke tests verifying the Django project boots and routes correctly."""

from http import HTTPStatus

import pytest
from django.test import Client


@pytest.mark.django_db
def test_admin_root_redirects_anonymous_user_to_login(client: Client) -> None:
    """An anonymous request to the admin index should redirect to the login page."""
    response = client.get("/admin/")
    assert response.status_code == HTTPStatus.FOUND
    assert response["Location"] == "/admin/login/?next=/admin/"


@pytest.mark.django_db
def test_admin_login_page_renders(client: Client) -> None:
    """The admin login page should render successfully for anonymous users."""
    response = client.get("/admin/login/")
    assert response.status_code == HTTPStatus.OK
