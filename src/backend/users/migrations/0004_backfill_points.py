"""Credit points for reports and answers made before points were added up."""

from typing import TYPE_CHECKING, final

from django.db import migrations

if TYPE_CHECKING:
    from django.apps.registry import Apps
    from django.db.backends.base.schema import BaseDatabaseSchemaEditor

# `users.services.REPORT_POINTS` when this migration was written; a migration
# keeps its own copy so later changes to the reward don't rewrite history.
_REPORT_POINTS = 20


def backfill(apps: "Apps", schema_editor: "BaseDatabaseSchemaEditor") -> None:
    """Give each user who has none yet the points their past actions earned."""
    del schema_editor
    user_model = apps.get_model("users", "User")
    report_model = apps.get_model("reports", "Report")
    validation_model = apps.get_model("validations", "Validation")

    earned: dict[object, int] = {}
    for user_id in report_model.objects.values_list("user_id", flat=True):
        earned[user_id] = earned.get(user_id, 0) + _REPORT_POINTS
    for user_id, points in validation_model.objects.values_list(
        "user_id",
        "points_awarded",
    ):
        earned[user_id] = earned.get(user_id, 0) + int(points)

    for user_id, points in earned.items():
        _ = user_model.objects.filter(id=user_id, points=0).update(points=points)


@final
class Migration(migrations.Migration):
    """Data-only: points were stored but, until now, never added to."""

    dependencies = (
        ("users", "0003_user_district_user_points_user_role_user_trust_score"),
        ("reports", "0001_initial"),
        ("validations", "0003_alter_validation_description"),
    )

    operations = (migrations.RunPython(backfill, migrations.RunPython.noop),)
