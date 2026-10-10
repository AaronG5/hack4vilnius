"""Tests for the shared model conventions every app builds on."""

import uuid

import pytest
from badges.models import Badge, UserBadge
from categories.models import Category
from challenges.models import Challenge
from districts.models import District
from django.db import IntegrityError
from django.db.models import ProtectedError
from institutions.models import Institution
from media_assets.models import Media
from moderation.models import ModerationFlag
from problems.models import Problem
from reports.models import Report
from users.models import User
from validations.models import Validation

NON_CONSECUTIVE_ID_MODELS = [
    District,
    Institution,
    Category,
    Problem,
    Report,
    Validation,
    Media,
    Badge,
    UserBadge,
    Challenge,
    ModerationFlag,
]


@pytest.mark.django_db
class TestNonConsecutiveIds:
    """planning/ARCHITECTURE.md: ids must not be guessable from each other."""

    def test_every_model_uses_a_uuid_primary_key(self) -> None:
        """No app model may fall back to a sequential integer id."""
        for model in NON_CONSECUTIVE_ID_MODELS:
            field = model._meta.pk  # noqa: SLF001
            assert field is not None, model.__name__
            assert field.name == "id", model.__name__
            assert field.get_internal_type() == "UUIDField", model.__name__

    def test_ids_are_not_sequential(self, category: Category) -> None:
        """Two problems created in a row get unrelated ids."""
        first = Problem.objects.create(
            status="unconfirmed",
            urgency="urgent",
            legitimacy_score=50.0,
            location={"type": "Point", "coordinates": [25.28, 54.69]},
            category=category,
        )
        second = Problem.objects.create(
            status="unconfirmed",
            urgency="urgent",
            legitimacy_score=50.0,
            location={"type": "Point", "coordinates": [25.29, 54.70]},
            category=category,
        )

        assert isinstance(first.id, uuid.UUID)
        assert first.id != second.id


@pytest.mark.django_db
class TestModelStrings:
    """`__str__` is what the admin and shell show, so it should be readable."""

    def test_district(self, district: District) -> None:
        """A district reads as its name."""
        assert str(district) == "Senamiestis"

    def test_institution(self, institution: Institution) -> None:
        """An institution reads as its name."""
        assert str(institution) == institution.name

    def test_category(self, category: Category) -> None:
        """A category reads as its name."""
        assert str(category) == "Pothole"

    def test_problem(self, problem: Problem) -> None:
        """A problem reads as its category and status."""
        assert str(problem) == "Pothole (unconfirmed)"

    def test_report(self, report: Report) -> None:
        """A report reads as its id."""
        assert str(report) == str(report.id)

    def test_validation(self, validation: Validation) -> None:
        """A validation reads as its id."""
        assert str(validation) == str(validation.id)

    def test_badge(self, badge: Badge) -> None:
        """A badge reads as its name."""
        assert str(badge) == "Senamiestis Scout"

    def test_user_badge(self, user: User, badge: Badge) -> None:
        """An award reads as who earned what."""
        award = UserBadge.objects.create(user=user, badge=badge)

        assert str(award) == f"{user} earned {badge}"

    def test_challenge(self, challenge: Challenge) -> None:
        """A challenge reads as its name."""
        assert str(challenge) == "Spring Clean-up"

    def test_moderation_flag(self, moderation_flag: ModerationFlag) -> None:
        """A flag reads as its id."""
        assert str(moderation_flag) == str(moderation_flag.id)


@pytest.mark.django_db
class TestRelationships:
    """Tests for the relationships planning/ARCHITECTURE.md describes."""

    def test_reports_and_validations_hang_off_a_problem(
        self,
        problem: Problem,
        report: Report,
        validation: Validation,
    ) -> None:
        """A problem is built up from its reports and validations."""
        assert list(Report.objects.filter(problem=problem)) == [report]
        assert list(Validation.objects.filter(problem=problem)) == [validation]

    def test_media_attaches_to_either_a_report_or_a_validation(
        self,
        user: User,
        report: Report,
        validation: Validation,
    ) -> None:
        """One `Media` model serves both parents via its generic relation."""
        report.media.create(type="photo", file="media/r.jpg", uploaded_by=user)
        validation.media.create(type="video", file="media/v.mp4", uploaded_by=user)

        assert report.media.count() == 1
        assert validation.media.count() == 1

    def test_a_user_cannot_earn_the_same_badge_twice(
        self,
        user: User,
        badge: Badge,
    ) -> None:
        """The award table is unique per user and badge."""
        _ = UserBadge.objects.create(user=user, badge=badge)

        with pytest.raises(IntegrityError, match="UNIQUE constraint"):
            _ = UserBadge.objects.create(user=user, badge=badge)

    def test_deleting_a_problem_removes_its_reports(
        self,
        problem: Problem,
        report: Report,
    ) -> None:
        """Reports don't outlive the problem they describe."""
        _, _deleted = problem.delete()

        assert not Report.objects.filter(pk=report.pk).exists()

    def test_a_category_in_use_cannot_be_deleted(
        self,
        category: Category,
        problem: Problem,
    ) -> None:
        """Categories are protected so problems can't lose their classification."""
        del problem

        with pytest.raises(ProtectedError, match=r"protected foreign keys"):
            _ = category.delete()
