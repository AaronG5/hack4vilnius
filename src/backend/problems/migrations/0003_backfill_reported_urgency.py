"""Give problems that predate `reported_urgency` the urgency they have now."""

from typing import TYPE_CHECKING, final

from django.db import migrations, models

if TYPE_CHECKING:
    from django.apps.registry import Apps
    from django.db.backends.base.schema import BaseDatabaseSchemaEditor


def backfill(apps: "Apps", schema_editor: "BaseDatabaseSchemaEditor") -> None:
    """Treat an existing problem's urgency as what it was reported with."""
    del schema_editor
    problem = apps.get_model("problems", "Problem")
    _ = problem.objects.filter(reported_urgency="").update(
        reported_urgency=models.F("urgency"),
    )


@final
class Migration(migrations.Migration):
    """Data-only: the field itself is added by 0002."""

    dependencies = (
        ("problems", "0002_problem_reported_urgency_alter_problem_urgency"),
    )

    operations = (migrations.RunPython(backfill, migrations.RunPython.noop),)
