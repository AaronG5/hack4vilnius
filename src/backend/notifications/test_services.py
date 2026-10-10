"""Tests for notification fan-out on a problem status change."""

import pytest
from notifications.constants import EVENT_STATUS_CHANGED
from notifications.models import Notification
from notifications.services import notify_problem_status_change
from problems.models import Problem
from reports.models import Report
from users.models import User
from validations.models import Validation
from vilnius_backend.choices import ProblemStatus

REPORTER_AND_VALIDATOR = 2


@pytest.mark.django_db
class TestNotifyProblemStatusChange:
    """Tests for `notify_problem_status_change`."""

    def test_notifies_reporters_and_validators(
        self,
        problem: Problem,
        report: Report,
        validation: Validation,
    ) -> None:
        """Everyone involved with the problem gets exactly one notification."""
        created = notify_problem_status_change(problem)

        assert len(created) == REPORTER_AND_VALIDATOR
        notified = set(
            Notification.objects.values_list("user_id", flat=True),
        )
        assert notified == {report.user.pk, validation.user.pk}

    def test_notifies_a_doubly_involved_user_once(
        self,
        problem: Problem,
        user: User,
    ) -> None:
        """Someone who both reported and validated isn't notified twice."""
        _ = Report.objects.create(
            description="A pothole.",
            user=user,
            problem=problem,
        )
        _ = Validation.objects.create(
            is_valid=True,
            description="Still here.",
            user=user,
            problem=problem,
        )

        created = notify_problem_status_change(problem)

        assert len(created) == 1

    def test_records_the_event_type_and_new_status(
        self,
        problem: Problem,
        report: Report,
    ) -> None:
        """The message says what happened, in Lithuanian, and names the problem."""
        del report
        problem.status = ProblemStatus.ONGOING
        problem.save(update_fields=["status"])

        created = notify_problem_status_change(problem)

        assert created[0].event_type == EVENT_STATUS_CHANGED
        assert created[0].message.startswith("Darbai prasidėjo!")
        assert problem.category.name in created[0].message
        assert created[0].problem == problem

    def test_names_the_problem_by_its_title(
        self,
        problem: Problem,
        report: Report,
    ) -> None:
        """A problem with a title is named by it rather than its category."""
        del report
        problem.title = "Gili duobė"
        problem.status = ProblemStatus.COMPLETED
        problem.save(update_fields=["title", "status"])

        created = notify_problem_status_change(problem)

        assert created[0].message.startswith("Sutvarkyta! ")
        assert "„Gili duobė“" in created[0].message

    def test_nobody_involved_means_no_notifications(self, problem: Problem) -> None:
        """A problem with no reports or validations notifies nobody."""
        assert notify_problem_status_change(problem) == []
