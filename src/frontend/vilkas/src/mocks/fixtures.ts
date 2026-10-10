// Typed sample data served by the MSW handlers in development and tests.
// Shapes follow api/openapi.yaml; values follow the design boards.

import type {
  Badge,
  Category,
  Challenge,
  ChallengeDetail,
  District,
  EarnedBadge,
  Institution,
  ModerationFlag,
  Notification,
  Problem,
  ProblemDetail,
  Report,
  User,
  UserRef,
  Validation,
} from "../api";

/** Deterministic uuid for fixtures, e.g. mockId("p", 1) → 00000000-0000-4000-0070-000000000001. */
export function mockId(kind: string, n: number): string {
  const prefix = kind.charCodeAt(0).toString(16).padStart(4, "0");
  return `00000000-0000-4000-${prefix}-${String(n).padStart(12, "0")}`;
}

const NOW = "2026-10-10T09:00:00Z";

function box(lng: number, lat: number, d = 0.01): District["boundary"] {
  return {
    type: "Polygon",
    coordinates: [
      [
        [lng - d, lat - d],
        [lng + d, lat - d],
        [lng + d, lat + d],
        [lng - d, lat + d],
        [lng - d, lat - d],
      ],
    ],
  };
}

export const institutions: Institution[] = [
  { id: mockId("i", 1), name: "Grinda", contact_info: "info@grinda.lt" },
  { id: mockId("i", 2), name: "Gatvių apšvietimas", contact_info: "info@apsvietimas.lt" },
  { id: mockId("i", 3), name: "VASA", contact_info: "info@vasa.lt" },
  { id: mockId("i", 4), name: "Susisiekimo paslaugos", contact_info: "info@judu.lt" },
];

export const categories: Category[] = [
  { id: mockId("c", 1), name: "Duobė", description: "Duobės ir pažeista kelio danga", icon: "/icons/pothole.svg", default_urgency: "urgent", institution: institutions[0] },
  { id: mockId("c", 2), name: "Šiukšlės", description: "Šiukšlės ir perpildyti konteineriai", icon: "/icons/trash.svg", default_urgency: "can_wait", institution: institutions[2] },
  { id: mockId("c", 3), name: "Apšvietimas", description: "Neveikiantys gatvių žibintai", icon: "/icons/light.svg", default_urgency: "urgent", institution: institutions[1] },
  { id: mockId("c", 4), name: "Eismo saugumas", description: "Pavojingos perėjos, ženklai", icon: "/icons/traffic.svg", default_urgency: "dangerous_to_life", institution: institutions[3] },
  { id: mockId("c", 5), name: "Triukšmas", description: "Triukšmas naktį", icon: "/icons/noise.svg", default_urgency: "can_wait" },
];

export const districts: District[] = [
  { id: mockId("d", 1), name: "Žirmūnai", boundary: box(25.295, 54.708), city: "Vilnius" },
  { id: mockId("d", 2), name: "Antakalnis", boundary: box(25.315, 54.7), city: "Vilnius" },
  { id: mockId("d", 3), name: "Naujamiestis", boundary: box(25.265, 54.678), city: "Vilnius" },
  { id: mockId("d", 4), name: "Senamiestis", boundary: box(25.287, 54.681), city: "Vilnius" },
  { id: mockId("d", 5), name: "Šnipiškės", boundary: box(25.28, 54.698), city: "Vilnius" },
  { id: mockId("d", 6), name: "Pašilaičiai", boundary: box(25.225, 54.735), city: "Vilnius" },
];

export const currentUser: User = {
  id: mockId("u", 1),
  name: "Aistė T.",
  email: "aiste@example.lt",
  role: "regular_user",
  trust_score: 0.92,
  points: 1240,
  district: districts[0],
  created_at: "2026-03-14T10:00:00Z",
};

const neighbours: UserRef[] = [
  { id: mockId("u", 2), name: "Paulius D." },
  { id: mockId("u", 3), name: "Greta S." },
  { id: mockId("u", 4), name: "Lukas B." },
];

export const problems: Problem[] = [
  { id: mockId("p", 1), status: "confirmed", urgency: "dangerous_to_life", legitimacy_score: 94, location: { type: "Point", coordinates: [25.2932, 54.7101] }, category: categories[0], institution: null, created_at: "2026-10-06T08:12:00Z", updated_at: "2026-10-09T18:40:00Z" },
  { id: mockId("p", 2), status: "confirmed", urgency: "dangerous_to_life", legitimacy_score: 91, location: { type: "Point", coordinates: [25.2985, 54.7062] }, category: categories[3], institution: null, created_at: "2026-10-06T07:30:00Z", updated_at: "2026-10-10T07:15:00Z" },
  { id: mockId("p", 3), status: "unconfirmed", urgency: "urgent", legitimacy_score: 72, location: { type: "Point", coordinates: [25.2876, 54.7048] }, category: categories[0], institution: null, created_at: "2026-10-09T16:00:00Z", updated_at: "2026-10-09T16:00:00Z" },
  { id: mockId("p", 4), status: "unconfirmed", urgency: "can_wait", legitimacy_score: 64, location: { type: "Point", coordinates: [25.2952, 54.7084] }, category: categories[1], institution: null, created_at: "2026-10-10T07:40:00Z", updated_at: "2026-10-10T07:40:00Z" },
  { id: mockId("p", 5), status: "ongoing", urgency: "urgent", legitimacy_score: 88, location: { type: "Point", coordinates: [25.3004, 54.7031] }, category: categories[2], institution: institutions[1], created_at: "2026-10-01T19:00:00Z", updated_at: "2026-10-08T10:00:00Z" },
  { id: mockId("p", 6), status: "completed", urgency: "urgent", legitimacy_score: 90, location: { type: "Point", coordinates: [25.2895, 54.7046] }, category: categories[0], institution: institutions[0], created_at: "2026-09-27T12:00:00Z", updated_at: "2026-10-09T14:00:00Z" },
];

function photo(n: number, by: UserRef, at: string) {
  return { id: mockId("m", n), type: "photo" as const, file_url: `https://picsum.photos/seed/vilkas${n}/600/400`, created_at: at, uploaded_by: by };
}

export const reports: Report[] = problems.map((p, i) => ({
  id: mockId("r", i + 1),
  description:
    i === 0
      ? "Gili duobė dešinėje juostoje prie autobusų stotelės, automobiliai ją apvažiuoja."
      : `${p.category.name} — pranešta gyventojo.`,
  ai_category_suggestion: p.category.name,
  ai_abuse_flag: false,
  user: i === 0 ? { id: currentUser.id, name: currentUser.name } : neighbours[i % neighbours.length],
  problem: p.id,
  media: [photo(i + 1, neighbours[0], p.created_at)],
  has_moderation_flag: false,
  created_at: p.created_at,
}));

export const validations: Validation[] = [
  ...neighbours.map((user, i) => ({
    id: mockId("v", i + 1),
    is_valid: true,
    description: "Vis dar yra.",
    points_awarded: 10,
    user,
    problem: problems[0].id,
    media: [],
    created_at: `2026-10-0${7 + i}T17:00:00Z`,
  })),
];

export function problemDetail(problem: Problem): ProblemDetail {
  return {
    ...problem,
    reports: reports.filter((r) => r.problem === problem.id),
    validations: validations.filter((v) => v.problem === problem.id),
  };
}

export const badges: Badge[] = [
  { id: mockId("b", 1), name: "Pirmasis pranešėjas", description: "Pirmasis pranešimas", icon: "/badges/first.svg", criteria: "Pateikti pirmą pranešimą", required_validation_count: null, district: null },
  { id: mockId("b", 2), name: "Tiesos tikrintojas", description: "25 patikrinimai", icon: "/badges/truth.svg", criteria: "Patikrinti 25 problemas", required_validation_count: 25, district: null },
  { id: mockId("b", 3), name: "Žiemos žvalgas", description: "Sezoninis ženklelis", icon: "/badges/winter.svg", criteria: "Patikrinti 50 problemų iki gruodžio", required_validation_count: 50, district: null },
  { id: mockId("b", 4), name: "Rajono sargas", description: "Žirmūnų sargas", icon: "/badges/guard.svg", criteria: "Patikrinti 40 problemų savo rajone", required_validation_count: 40, district: districts[0] },
];

export const earnedBadges: EarnedBadge[] = [
  { badge: badges[0], earned_at: "2026-03-14T12:00:00Z" },
  { badge: badges[1], earned_at: "2026-08-02T12:00:00Z" },
  { badge: badges[3], earned_at: "2026-09-20T12:00:00Z" },
];

export const challenges: ChallengeDetail[] = [
  { id: mockId("h", 1), name: "Duobių medžioklė prieš žiemą", description: "Visas miestas kartu patikrina 1 000 duobių, kol neprasidėjo šalčiai.", start_date: "2026-10-01", end_date: "2026-10-22", reward_points: 100, status: "active", categories: [categories[0]], participant_count: 1840, milestones: [{ label: "640 iš 1 000 patikrinta", target: 1000, reached: false }] },
  { id: mockId("h", 2), name: "Rajonų aktyvumo iššūkis", description: "Kuris rajonas sutvarkys daugiausia problemų? Skaičiuojama sutvarkyta 10 tūkst. gyventojų, todėl maži rajonai turi tokias pat galimybes.", start_date: "2026-10-01", end_date: "2026-10-31", reward_points: 200, status: "active", participant_count: 5320, milestones: [] },
  { id: mockId("h", 3), name: "Moksleivių pilietiškumo iššūkis", description: "Klasės komanda tikrina problemas pakeliui į mokyklą ir saugo savo kvartalą.", start_date: "2026-09-01", end_date: "2026-12-20", reward_points: 150, status: "active", participant_count: 640, milestones: [] },
  { id: mockId("h", 4), name: "Dviračių takų patikra", description: "Važiuodami dviračiu ar paspirtuku pažymėkite problemas ant miesto dviračių takų.", start_date: "2026-10-01", end_date: "2026-10-31", reward_points: 80, status: "active", participant_count: 210, milestones: [] },
  { id: mockId("h", 5), name: "Vasaros parkų patikra", description: "Parkų suoliukai, takai ir žaidimų aikštelės.", start_date: "2026-06-01", end_date: "2026-08-31", reward_points: 120, status: "ended", participant_count: 980, milestones: [] },
];

export function challengeSummary({ participant_count: _p, milestones: _m, ...rest }: ChallengeDetail): Challenge {
  return rest;
}

export const notifications: Notification[] = [
  { id: mockId("n", 1), message: "Duobė už 30 m — vis dar yra? Kalvarijų g. 98. Patikrinkite pakeliui ir gaukite +10 tšk.", event_type: "validation_requested", read: false, problem: problems[0].id, created_at: NOW },
  { id: mockId("n", 2), message: "Jūsų pranešimas sutvarkytas! Grinda užlopė duobę Žirmūnų g. 70. Ar patvirtinsite?", event_type: "status_changed", read: false, problem: problems[5].id, created_at: "2026-10-09T15:00:00Z" },
];

export const moderationFlags: ModerationFlag[] = [
  { id: mockId("f", 1), reason: "Nuotraukoje matomas asmens veidas", status: "pending", report: reports[3].id, reviewed_by: null, reviewed_at: null },
];
