// Typed sample data served by the MSW handlers in development and tests.
// Shapes follow api/openapi.yaml (+ optional api-gap fields); content follows the demo's examples.

import type {
  Badge,
  Category,
  ChallengeDetail,
  Challenge,
  District,
  EarnedBadge,
  Institution,
  ModerationFlag,
  Notification,
  Problem,
  ProblemStatus,
  ProblemUrgency,
  Report,
  User,
  UserRef,
  Validation,
} from "../api";
import { toLngLat, type XY } from "../lib/cityMap";

/** Deterministic uuid for fixtures, e.g. mockId("p", 1) → 00000000-0000-4000-0070-000000000001. */
export function mockId(kind: string, n: number): string {
  const prefix = kind.charCodeAt(0).toString(16).padStart(4, "0");
  return `00000000-0000-4000-${prefix}-${String(n).padStart(12, "0")}`;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

export const institutions: Institution[] = [
  { id: mockId("i", 1), name: "Grinda", contact_info: "info@grinda.lt" },
  { id: mockId("i", 2), name: "Gatvių apšvietimas", contact_info: "info@apsvietimas.lt" },
  { id: mockId("i", 3), name: "VASA", contact_info: "info@vasa.lt" },
  { id: mockId("i", 4), name: "Susisiekimo paslaugos", contact_info: "info@judu.lt" },
];

const CATEGORY_DEFS: [string, ProblemUrgency, Institution | undefined][] = [
  ["Duobė", "urgent", institutions[0]],
  ["Kelio įtrūkimas", "urgent", institutions[0]],
  ["Šiukšlės", "can_wait", institutions[2]],
  ["Apšvietimas", "urgent", institutions[1]],
  ["Eismo saugumas", "dangerous_to_life", institutions[3]],
  ["Triukšmas", "can_wait", undefined],
  ["Vandalizmas", "can_wait", undefined],
  ["Medžiai ir želdiniai", "can_wait", undefined],
  ["Kita", "can_wait", undefined],
];

export const categories: Category[] = CATEGORY_DEFS.map(([name, urgency, institution], i) => ({
  id: mockId("c", i + 1),
  name,
  description: name,
  icon: `/icons/category-${i + 1}.svg`,
  default_urgency: urgency,
  ...(institution ? { institution } : {}),
}));

const category = (name: string) => categories.find((c) => c.name === name)!;

// Schematic district polygons from the demo, stored as real coordinates.
const DISTRICT_POLYS: [string, XY[]][] = [
  ["Pašilaičiai", [[0, 0], [130, 0], [130, 215], [0, 235]]],
  ["Šnipiškės", [[130, 0], [250, 0], [250, 205], [200, 228], [130, 215]]],
  ["Žirmūnai", [[250, 0], [400, 0], [400, 210], [320, 200], [250, 205]]],
  ["Antakalnis", [[320, 200], [400, 210], [400, 440], [300, 440], [300, 260]]],
  ["Senamiestis", [[130, 215], [200, 228], [250, 205], [320, 200], [300, 260], [300, 440], [170, 440], [170, 240]]],
  ["Naujamiestis", [[0, 235], [130, 215], [170, 240], [170, 440], [0, 440]]],
];

export const districts: District[] = DISTRICT_POLYS.map(([name, poly], i) => ({
  id: mockId("d", i + 1),
  name,
  city: "Vilnius",
  boundary: { type: "Polygon", coordinates: [[...poly, poly[0]].map(toLngLat)] },
}));

export const currentUser: User = {
  id: mockId("u", 1),
  name: "",
  email: "",
  role: "regular_user",
  trust_score: 0,
  points: 0,
  created_at: new Date().toISOString(),
};

const NAMES = ["Rūta V.", "Paulius D.", "Greta S.", "Lukas B.", "Agnė J.", "Tomas K.", "Ieva M.", "Mantas P.", "Eglė R.", "Jonas A."];
export const neighbours: UserRef[] = NAMES.map((name, i) => ({ id: mockId("u", i + 2), name }));

interface Example {
  title: string;
  category: string;
  urgency: ProblemUrgency;
  description: string;
  address: string;
  urgN?: Partial<Record<ProblemUrgency, number>>;
  nearSensitive: boolean;
  at: XY;
  age: number;
  still: number;
  fixed: number;
  status: ProblemStatus;
}

// The demo's example problems (severity maža/vidutinė/didelė → can_wait/urgent/dangerous_to_life).
const EXAMPLES: Example[] = [
  { title: "Gili duobė dešinėje juostoje", category: "Duobė", urgency: "dangerous_to_life", description: "Automobiliai apvažiuoja duobę prie autobusų stotelės.", address: "Kalvarijų g. 98", urgN: { dangerous_to_life: 3, urgent: 2 }, nearSensitive: true, at: [300, 120], age: 3 * DAY, still: 5, fixed: 0, status: "confirmed" },
  { title: "Pavojinga perėja be apšvietimo", category: "Eismo saugumas", urgency: "dangerous_to_life", description: "Vakare pėsčiųjų beveik nesimato.", address: "Kalvarijų g. 23", urgN: { dangerous_to_life: 5, urgent: 1 }, nearSensitive: true, at: [200, 150], age: 9 * DAY, still: 7, fixed: 0, status: "confirmed" },
  { title: "Perpildyti konteineriai", category: "Šiukšlės", urgency: "urgent", description: "Šiukšlės krenta ant šaligatvio.", address: "Antakalnio g. 17", nearSensitive: false, at: [350, 280], age: 2 * DAY, still: 3, fixed: 0, status: "ongoing" },
  { title: "Neveikiantis gatvės žibintas", category: "Apšvietimas", urgency: "urgent", description: "Žibintas neveikia jau kelias savaites.", address: "Ateities g. 31", urgN: { can_wait: 1, urgent: 1 }, nearSensitive: false, at: [60, 80], age: 14 * DAY, still: 2, fixed: 1, status: "confirmed" },
  { title: "Išdaužyta grindinio danga", category: "Kelio įtrūkimas", urgency: "urgent", description: "Trūksta kelių grindinio akmenų.", address: "Pilies g. 22", nearSensitive: false, at: [250, 300], age: 6 * DAY, still: 4, fixed: 0, status: "ongoing" },
  { title: "Nuvirtęs kelio ženklas", category: "Eismo saugumas", urgency: "urgent", description: "Ženklas guli ant šaligatvio.", address: "Konstitucijos pr. 7", nearSensitive: false, at: [215, 60], age: 3 * HOUR, still: 0, fixed: 0, status: "unconfirmed" },
  { title: "Išmėtytos statybinės atliekos", category: "Šiukšlės", urgency: "can_wait", description: "Krūva plytų ir maišų prie kelio.", address: "Ozo g. 25", nearSensitive: false, at: [150, 395], age: 20 * HOUR, still: 0, fixed: 0, status: "unconfirmed" },
  { title: "Duobių sankaupa", category: "Duobė", urgency: "dangerous_to_life", description: "Keletas duobių iš eilės.", address: "Savanorių pr. 40–60", nearSensitive: false, at: [95, 330], age: 11 * DAY, still: 6, fixed: 0, status: "confirmed" },
  { title: "Grafitis ant mokyklos tvoros", category: "Vandalizmas", urgency: "can_wait", description: "Užpaišyta tvora.", address: "Žirmūnų g. 70", nearSensitive: true, at: [330, 60], age: 5 * DAY, still: 1, fixed: 3, status: "completed" },
];

function urgencyVotes(ex: Example): Partial<Record<ProblemUrgency, number>> {
  const votes: Partial<Record<ProblemUrgency, number>> = { [ex.urgency]: 1 };
  for (const [k, n] of Object.entries(ex.urgN ?? {}) as [ProblemUrgency, number][]) {
    votes[k] = (votes[k] ?? 0) + n;
  }
  return votes;
}

export const problems: Problem[] = EXAMPLES.map((ex, i) => ({
  id: mockId("p", i + 1),
  status: ex.status,
  urgency: ex.urgency,
  legitimacy_score: 80,
  location: { type: "Point", coordinates: toLngLat(ex.at) },
  category: category(ex.category),
  institution: ex.status === "ongoing" ? (category(ex.category).institution ?? null) : null,
  created_at: ago(ex.age),
  updated_at: ago(ex.age / 2),
  title: ex.title,
  address: ex.address,
  near_sensitive: ex.nearSensitive,
  urgency_votes: urgencyVotes(ex),
}));

export const reports: Report[] = EXAMPLES.map((ex, i) => ({
  id: mockId("r", i + 1),
  description: ex.description,
  ai_category_suggestion: ex.category,
  ai_abuse_flag: false,
  user: neighbours[i % neighbours.length],
  problem: problems[i].id,
  media: [],
  has_moderation_flag: false,
  created_at: problems[i].created_at,
}));

let validationN = 0;
export const validations: Validation[] = EXAMPLES.flatMap((ex, i) => {
  const vote = (isValid: boolean, k: number): Validation => ({
    id: mockId("v", ++validationN),
    is_valid: isValid,
    description: isValid ? "Vis dar yra" : "Sutvarkyta",
    points_awarded: 10,
    user: neighbours[(i + k + 1) % neighbours.length],
    problem: problems[i].id,
    media: [],
    created_at: ago(ex.age * (1 - (k + 1) / (ex.still + ex.fixed + 2))),
  });
  return [
    ...Array.from({ length: ex.still }, (_, k) => vote(true, k)),
    ...Array.from({ length: ex.fixed }, (_, k) => vote(false, ex.still + k)),
  ];
});

export const badges: Badge[] = [
  { id: mockId("b", 1), name: "Pirmasis pranešėjas", description: "Pirmas pranešimas", icon: "/badges/first.svg", criteria: "Pateikti pirmą pranešimą", required_validation_count: null, district: null },
  { id: mockId("b", 2), name: "Tiesos tikrintojas", description: "5 patikrinimai", icon: "/badges/truth.svg", criteria: "Patikrinti 5 problemas", required_validation_count: 5, district: null },
  { id: mockId("b", 3), name: "Žiemos sargas", description: "Sezono iššūkis", icon: "/badges/winter.svg", criteria: "Dalyvauti sezono iššūkyje", required_validation_count: null, district: null },
];

export const earnedBadges: EarnedBadge[] = [];

export const challenges: ChallengeDetail[] = [
  { id: mockId("h", 1), name: "Duobių medžioklė prieš žiemą", description: "Visas miestas kartu patikrina 1 000 duobių, kol neprasidėjo šalčiai.", start_date: "2026-10-01", end_date: "2026-10-22", reward_points: 100, status: "active", categories: [category("Duobė")], participant_count: 1840, milestones: [{ label: "1 000 patikrinimų", target: 1000, reached: false }] },
  { id: mockId("h", 2), name: "Rajonų aktyvumo iššūkis", description: "Kuris rajonas sutvarkys didžiausią dalį pranešimų?", start_date: "2026-10-01", end_date: "2026-10-31", reward_points: 200, status: "active", participant_count: 5320, milestones: [] },
  { id: mockId("h", 3), name: "Moksleivių pilietiškumo iššūkis", description: "Klasės komanda tikrina problemas pakeliui į mokyklą.", start_date: "2026-09-01", end_date: "2026-12-20", reward_points: 150, status: "active", participant_count: 640, milestones: [] },
  { id: mockId("h", 4), name: "Vienaragių aktyvumo iššūkis", description: "Technologijų įmonių komandos varžosi, kuri daugiau prisideda prie miesto.", start_date: "2026-10-01", end_date: "2026-11-30", reward_points: 150, status: "active", participant_count: 167, milestones: [] },
  { id: mockId("h", 5), name: "Dviračių takų patikra", description: "Pažymėkite problemas ant miesto dviračių takų.", start_date: "2026-10-01", end_date: "2026-10-31", reward_points: 80, status: "active", participant_count: 210, milestones: [] },
  { id: mockId("h", 6), name: "Mano kiemo iššūkis", description: "Kaimynai drauge peržiūri savo kiemą.", start_date: "2026-10-01", end_date: "2026-11-15", reward_points: 120, status: "active", participant_count: 14, milestones: [] },
];

export function challengeSummary({ participant_count: _p, milestones: _m, ...rest }: ChallengeDetail): Challenge {
  return rest;
}

export const notifications: Notification[] = [
  { id: mockId("n", 1), message: "Duobė už 30 m — vis dar yra? Kalvarijų g. 98. Patikrinkite pakeliui ir gaukite +10 tšk.", event_type: "validation_requested", read: false, problem: problems[0].id, created_at: ago(10 * 60_000) },
  { id: mockId("n", 2), message: "Grafitis ant mokyklos tvoros pažymėtas kaip sutvarkytas. Ar patvirtinsite?", event_type: "status_changed", read: false, problem: problems[8].id, created_at: ago(DAY) },
];

export const moderationFlags: ModerationFlag[] = [
  { id: mockId("f", 1), reason: "Nuotraukoje matomas asmens veidas", status: "pending", report: reports[3].id, reviewed_by: null, reviewed_at: null },
];
