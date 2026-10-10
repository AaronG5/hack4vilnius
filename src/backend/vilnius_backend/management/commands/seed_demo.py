"""
Seed the reference data the app can't work without, plus optional examples.

`GET /categories` and `GET /districts` back the report form and the map, and
a `Problem` can't exist without a `Category`, so a fresh database leaves the
frontend with an empty map and no way to report anything. This command fills
in that reference data (institutions, categories, the 21 Vilnius seniūnijos,
badges, challenges), and with `--with-examples` also creates the nine example
problems the frontend's MSW mocks serve, so the real API and the mock API show
the same city.

Everything is keyed by name and re-applied on every run, so it is safe to
re-run after changing the data here.
"""

import datetime as dt
import json
from pathlib import Path
from typing import TYPE_CHECKING, Final, NamedTuple, TypedDict, cast, final, override

import problems.services as problem_services
import validations.services as validation_services
from badges.models import Badge
from categories.models import Category
from challenges.models import Challenge
from districts.models import District
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from institutions.models import Institution
from problems.models import Problem
from reports.models import Report
from users.models import User
from validations.models import Validation
from vilnius_backend.choices import ChallengeStatus, ProblemStatus, ProblemUrgency

if TYPE_CHECKING:
    from argparse import ArgumentParser


class _CategorySeed(NamedTuple):
    """A problem category and the institution that handles it."""

    name: str
    urgency: str
    institution: str | None


class _BadgeSeed(NamedTuple):
    """A badge users can earn."""

    name: str
    description: str
    criteria: str
    validations: int | None


class _ChallengeSeed(NamedTuple):
    """A challenge, dated relative to today so it is always in season."""

    name: str
    description: str
    started_days_ago: int
    ends_in_days: int
    reward_points: int
    categories: tuple[str, ...]


class _ExampleSeed(NamedTuple):
    """An example problem, with how many residents answered it since."""

    title: str
    category: str
    urgency: str
    detail: str
    address: str
    longitude: float
    latitude: float
    age_hours: float
    still_there: int
    fixed: int
    status: str


class _DistrictShape(TypedDict):
    """One district in `seed_data/vilnius_districts.json`."""

    name: str
    ring: list[list[float]]


class _DistrictDocument(TypedDict):
    """The `seed_data/vilnius_districts.json` document as a whole."""

    attribution: str
    city: str
    districts: list[_DistrictShape]


_SEED_DATA_DIR: Final = Path(__file__).resolve().parents[2] / "seed_data"
_DISTRICTS_PATH: Final = _SEED_DATA_DIR / "vilnius_districts.json"

_INSTITUTIONS: Final[tuple[tuple[str, str], ...]] = (
    ("Grinda", "info@grinda.lt"),
    ("Gatvių apšvietimas", "info@apsvietimas.lt"),
    ("VASA", "info@vasa.lt"),
    ("Susisiekimo paslaugos", "info@judu.lt"),
)

_CATEGORIES: Final[tuple[_CategorySeed, ...]] = (
    _CategorySeed("Duobė", ProblemUrgency.URGENT, "Grinda"),
    _CategorySeed("Kelio įtrūkimas", ProblemUrgency.URGENT, "Grinda"),
    _CategorySeed("Šiukšlės", ProblemUrgency.CAN_WAIT, "VASA"),
    _CategorySeed("Apšvietimas", ProblemUrgency.URGENT, "Gatvių apšvietimas"),
    _CategorySeed(
        "Eismo saugumas",
        ProblemUrgency.DANGEROUS_TO_LIFE,
        "Susisiekimo paslaugos",
    ),
    _CategorySeed("Triukšmas", ProblemUrgency.CAN_WAIT, None),
    _CategorySeed("Vandalizmas", ProblemUrgency.CAN_WAIT, None),
    _CategorySeed("Medžiai ir želdiniai", ProblemUrgency.CAN_WAIT, None),
    _CategorySeed("Kita", ProblemUrgency.CAN_WAIT, None),
)

_BADGES: Final[tuple[_BadgeSeed, ...]] = (
    _BadgeSeed(
        "Pirmasis pranešėjas",
        "Pirmas pranešimas",
        "Pateikti pirmą pranešimą",
        None,
    ),
    _BadgeSeed("Tiesos tikrintojas", "5 patikrinimai", "Patikrinti 5 problemas", 5),
    _BadgeSeed("Žiemos sargas", "Sezono iššūkis", "Dalyvauti sezono iššūkyje", None),
)

# The names are matched verbatim by the frontend (src/data/challengeMeta.ts),
# which supplies each challenge's colours, rules and leaderboard.
_CHALLENGES: Final[tuple[_ChallengeSeed, ...]] = (
    _ChallengeSeed(
        "Duobių medžioklė prieš žiemą",
        "Visas miestas kartu patikrina 1 000 duobių, kol neprasidėjo šalčiai.",
        9,
        12,
        100,
        ("Duobė",),
    ),
    _ChallengeSeed(
        "Rajonų aktyvumo iššūkis",
        "Kuris rajonas sutvarkys didžiausią dalį pranešimų?",
        9,
        21,
        200,
        (),
    ),
    _ChallengeSeed(
        "Moksleivių pilietiškumo iššūkis",
        "Klasės komanda tikrina problemas pakeliui į mokyklą.",
        39,
        71,
        150,
        (),
    ),
    _ChallengeSeed(
        "Vienaragių aktyvumo iššūkis",
        "Technologijų įmonių komandos varžosi, kuri daugiau prisideda prie miesto.",
        9,
        51,
        150,
        (),
    ),
    _ChallengeSeed(
        "Dviračių takų patikra",
        "Pažymėkite problemas ant miesto dviračių takų.",
        9,
        21,
        80,
        (),
    ),
    _ChallengeSeed(
        "Mano kiemo iššūkis",
        "Kaimynai drauge peržiūri savo kiemą.",
        9,
        36,
        120,
        (),
    ),
)

# The demo's example problems, at their real (geocoded) coordinates. `Problem`
# carries no title, address or "near a school" flag yet (planning/
# FRONTEND_PLAN.md > API gaps), so the title opens the report's description and
# the address closes it — which is where the frontend reads them from.
_EXAMPLES: Final[tuple[_ExampleSeed, ...]] = (
    _ExampleSeed(
        "Gili duobė dešinėje juostoje",
        "Duobė",
        ProblemUrgency.DANGEROUS_TO_LIFE,
        "Automobiliai apvažiuoja duobę prie autobusų stotelės.",
        "Kalvarijų g. 98",
        25.28334,
        54.70495,
        3 * 24,
        5,
        0,
        ProblemStatus.CONFIRMED,
    ),
    _ExampleSeed(
        "Pavojinga perėja be apšvietimo",
        "Eismo saugumas",
        ProblemUrgency.DANGEROUS_TO_LIFE,
        "Vakare pėsčiųjų beveik nesimato.",
        "Kalvarijų g. 23",
        25.28197,
        54.69559,
        9 * 24,
        7,
        0,
        ProblemStatus.CONFIRMED,
    ),
    _ExampleSeed(
        "Perpildyti konteineriai",
        "Šiukšlės",
        ProblemUrgency.URGENT,
        "Šiukšlės krenta ant šaligatvio.",
        "Antakalnio g. 17",
        25.3116,
        54.70005,
        2 * 24,
        3,
        0,
        ProblemStatus.ONGOING,
    ),
    _ExampleSeed(
        "Neveikiantis gatvės žibintas",
        "Apšvietimas",
        ProblemUrgency.URGENT,
        "Žibintas neveikia jau kelias savaites.",
        "Ateities g. 31",
        25.25396,
        54.73467,
        14 * 24,
        2,
        1,
        ProblemStatus.CONFIRMED,
    ),
    _ExampleSeed(
        "Išdaužyta grindinio danga",
        "Kelio įtrūkimas",
        ProblemUrgency.URGENT,
        "Trūksta kelių grindinio akmenų.",
        "Pilies g. 22",
        25.28939,
        54.68264,
        6 * 24,
        4,
        0,
        ProblemStatus.ONGOING,
    ),
    _ExampleSeed(
        "Nuvirtęs kelio ženklas",
        "Eismo saugumas",
        ProblemUrgency.URGENT,
        "Ženklas guli ant šaligatvio.",
        "Konstitucijos pr. 7",
        25.27794,
        54.69642,
        3,
        0,
        0,
        ProblemStatus.UNCONFIRMED,
    ),
    _ExampleSeed(
        "Išmėtytos statybinės atliekos",
        "Šiukšlės",
        ProblemUrgency.CAN_WAIT,
        "Krūva plytų ir maišų prie kelio.",
        "Ozo g. 25",
        25.26314,
        54.71051,
        20,
        0,
        0,
        ProblemStatus.UNCONFIRMED,
    ),
    _ExampleSeed(
        "Duobių sankaupa",
        "Duobė",
        ProblemUrgency.DANGEROUS_TO_LIFE,
        "Keletas duobių iš eilės.",
        "Savanorių pr. 40-60",
        25.24805,
        54.6724,
        11 * 24,
        6,
        0,
        ProblemStatus.CONFIRMED,
    ),
    _ExampleSeed(
        "Grafitis ant mokyklos tvoros",
        "Vandalizmas",
        ProblemUrgency.CAN_WAIT,
        "Užpaišyta tvora.",
        "Žirmūnų g. 70",
        25.3026,
        54.71882,
        5 * 24,
        1,
        3,
        ProblemStatus.COMPLETED,
    ),
)

# The neighbours who filed and answered the example problems. Their accounts
# have no usable password: they exist to give the examples authors.
_NEIGHBOURS: Final[tuple[str, ...]] = (
    "Rūta V.",
    "Paulius D.",
    "Greta S.",
    "Lukas B.",
    "Agnė J.",
    "Tomas K.",
    "Ieva M.",
    "Mantas P.",
    "Eglė R.",
    "Jonas A.",
)
_NEIGHBOUR_EMAIL: Final = "demo-neighbour-{index}@seed.hack4vilnius.local"


@final
class Command(BaseCommand):
    """`manage.py seed_demo [--with-examples]`."""

    help = "Seed reference data (and optionally example problems) for the frontend."

    @override
    def add_arguments(self, parser: "ArgumentParser") -> None:
        """Register the `--with-examples` switch."""
        _ = parser.add_argument(
            "--with-examples",
            action="store_true",
            help="Also create the nine example problems, with reports and answers.",
        )

    @override
    def handle(self, *args: object, **options: object) -> None:
        """Seed reference data, then example problems when asked."""
        del args
        with transaction.atomic():
            institutions = self._seed_institutions()
            categories = self._seed_categories(institutions)
            districts = self._seed_districts()
            badges = self._seed_badges()
            challenges = self._seed_challenges(categories)

        counts = {
            "institutions": len(institutions),
            "categories": len(categories),
            "districts": districts,
            "badges": badges,
            "challenges": challenges,
        }
        summary = ", ".join(f"{count} {label}" for label, count in counts.items())
        self.stdout.write(f"Reference data: {summary}.")

        if not options.get("with_examples"):
            self.stdout.write("Run with --with-examples to add example problems.")
            return

        with transaction.atomic():
            problems = self._seed_examples(categories)
        self.stdout.write(f"Examples: {problems} problems with reports and answers.")

    def _seed_institutions(self) -> dict[str, Institution]:
        """Create or update the institutions that fix problems."""
        institutions: dict[str, Institution] = {}
        for name, contact_info in _INSTITUTIONS:
            institution, _created = Institution.objects.update_or_create(
                name=name,
                defaults={"contact_info": contact_info},
            )
            institutions[name] = institution
        return institutions

    def _seed_categories(
        self,
        institutions: dict[str, Institution],
    ) -> dict[str, Category]:
        """Create or update the problem categories the report form offers."""
        categories: dict[str, Category] = {}
        for index, seed in enumerate(_CATEGORIES, start=1):
            category, _created = Category.objects.update_or_create(
                name=seed.name,
                defaults={
                    "description": seed.name,
                    "icon": f"/icons/category-{index}.svg",
                    "default_urgency": seed.urgency,
                    "institution": (
                        institutions[seed.institution] if seed.institution else None
                    ),
                },
            )
            categories[seed.name] = category
        return categories

    def _seed_districts(self) -> int:
        """Create or update the 21 Vilnius seniūnijos and their boundaries."""
        document = cast(
            "_DistrictDocument",
            json.loads(_DISTRICTS_PATH.read_text(encoding="utf-8")),
        )
        city = document["city"]
        for shape in document["districts"]:
            _district, _created = District.objects.update_or_create(
                name=shape["name"],
                city=city,
                defaults={
                    "boundary": {"type": "Polygon", "coordinates": [shape["ring"]]},
                },
            )
        return len(document["districts"])

    def _seed_badges(self) -> int:
        """Create or update the badges users can earn."""
        for index, seed in enumerate(_BADGES, start=1):
            _badge, _created = Badge.objects.update_or_create(
                name=seed.name,
                defaults={
                    "description": seed.description,
                    "icon": f"/badges/badge-{index}.svg",
                    "criteria": seed.criteria,
                    "required_validation_count": seed.validations,
                },
            )
        return len(_BADGES)

    def _seed_challenges(self, categories: dict[str, Category]) -> int:
        """Create or update the challenges, dated around today."""
        today = timezone.localdate()
        for seed in _CHALLENGES:
            challenge, _created = Challenge.objects.update_or_create(
                name=seed.name,
                defaults={
                    "description": seed.description,
                    "start_date": today - dt.timedelta(days=seed.started_days_ago),
                    "end_date": today + dt.timedelta(days=seed.ends_in_days),
                    "reward_points": seed.reward_points,
                    "status": ChallengeStatus.ACTIVE,
                },
            )
            challenge.categories.set([categories[name] for name in seed.categories])
        return len(_CHALLENGES)

    def _neighbours(self) -> list[User]:
        """Create or fetch the demo accounts that author the examples."""
        neighbours: list[User] = []
        for index, name in enumerate(_NEIGHBOURS, start=1):
            email = _NEIGHBOUR_EMAIL.format(index=index)
            user = User.objects.filter(email=email).first()
            if user is None:
                user = User.objects.create_user(email, display_name=name)
            elif user.display_name != name:
                user.display_name = name
                user.save(update_fields=["display_name"])
            neighbours.append(user)
        return neighbours

    def _seed_examples(self, categories: dict[str, Category]) -> int:
        """Create the example problems, each with a report and its answers."""
        neighbours = self._neighbours()
        now = timezone.now()
        # Re-running must not pile up duplicates, and an example problem's
        # reports and answers go with it.
        _ = Problem.objects.filter(reports__user__in=neighbours).delete()

        for index, example in enumerate(_EXAMPLES):
            category = categories[example.category]
            created_at = now - dt.timedelta(hours=example.age_hours)
            description = (
                f"{example.title}. {example.detail} Adresas: {example.address}."
            )
            problem = Problem.objects.create(
                status=example.status,
                urgency=example.urgency,
                legitimacy_score=problem_services.estimate_legitimacy_score(
                    category,
                    description,
                ),
                location={
                    "type": "Point",
                    "coordinates": [example.longitude, example.latitude],
                },
                category=category,
                # Only a problem somebody is already working on has an
                # institution attached.
                institution=(
                    category.institution
                    if example.status in {ProblemStatus.ONGOING}
                    else None
                ),
            )
            _ = Problem.objects.filter(id=problem.id).update(
                created_at=created_at,
                updated_at=now - dt.timedelta(hours=example.age_hours / 2),
            )
            report = Report.objects.create(
                description=description,
                user=neighbours[index % len(neighbours)],
                problem=problem,
            )
            _ = Report.objects.filter(id=report.id).update(created_at=created_at)
            self._seed_answers(problem, example, neighbours, index)

        return len(_EXAMPLES)

    def _seed_answers(
        self,
        problem: Problem,
        example: _ExampleSeed,
        neighbours: list[User],
        offset: int,
    ) -> None:
        """Add the "still there" and "fixed" answers an example collected."""
        answers = [True] * example.still_there + [False] * example.fixed
        spacing = example.age_hours / (len(answers) + 1)
        for position, is_valid in enumerate(answers, start=1):
            validation = Validation.objects.create(
                is_valid=is_valid,
                description="Vis dar yra" if is_valid else "Sutvarkyta",
                user=neighbours[(offset + position) % len(neighbours)],
                problem=problem,
            )
            validation.points_awarded = validation_services.calculate_points(
                problem,
                validation,
            )
            validation.save(update_fields=["points_awarded"])
            _ = Validation.objects.filter(id=validation.id).update(
                created_at=timezone.now()
                - dt.timedelta(hours=example.age_hours - position * spacing),
            )
