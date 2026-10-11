"""`manage.py settle_challenges`: pay the rewards of challenges that ended."""

from typing import final, override

from challenges.services import settle_ended_challenges
from django.core.management.base import BaseCommand


@final
class Command(BaseCommand):
    """Pay ended challenges' rewards; meant to run daily (e.g. from cron)."""

    help = "Pay the rewards of challenges that have ended, and mark them ended."

    @override
    def handle(self, *args: object, **options: object) -> None:
        """Settle every ended challenge and report how many rewards were paid."""
        del args, options
        paid = settle_ended_challenges()
        self.stdout.write(f"Paid {paid} challenge rewards.")
