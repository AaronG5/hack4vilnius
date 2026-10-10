// MSW handlers implementing api/openapi.yaml (+ the api-gap extensions) against an
// in-memory copy of the fixtures.

import { http, HttpResponse, type PathParams } from "msw";
import type {
  ModerationFlagUpdate,
  Problem,
  ProblemStatusUpdate,
  ProblemUrgency,
  Report,
  User,
  UserUpdate,
  Validation,
} from "../api";
import { URGENCIES_DESC } from "../lib/labels";
import * as fx from "./fixtures";

// Matches the API whatever origin/base URL the client is configured with.
const API = "*/api";

const POINTS = { report: 20, validation: 10, photo: 10 };

/** One passer-by shouldn't decide a problem's fate on their own. */
const DECIDING_ANSWERS = 2;

function createDb() {
  return {
    ...structuredClone({
      user: fx.currentUser,
      problems: fx.problems,
      reports: fx.reports,
      validations: fx.validations,
      challenges: fx.challenges,
      notifications: fx.notifications,
      flags: fx.moderationFlags,
      earnedBadges: fx.earnedBadges,
    }),
    joined: new Set<string>([fx.challenges[0].id, fx.challenges[1].id]),
    myUrgency: new Map<string, ProblemUrgency>(),
  };
}

export let db = createDb();

/** Restore the in-memory data to the fixtures (used between tests). */
export function resetDb(): void {
  db = createDb();
}

let counter = 1000;
const newId = (kind: string) => fx.mockId(kind, ++counter);

const notFound = () => HttpResponse.json({ detail: "Nerasta." }, { status: 404 });
const unauthorized = () => HttpResponse.json({ detail: "Reikia prisijungti." }, { status: 401 });

function isAuthed(request: Request): boolean {
  return /^Token \S+$/.test(request.headers.get("Authorization") ?? "");
}

function idParam(params: PathParams): string {
  return String(params.id);
}

function withMyVote(problem: Problem): Problem {
  return { ...problem, my_urgency_vote: db.myUrgency.get(problem.id) ?? null };
}

function mediaFrom(form: FormData, by: User) {
  return form
    .getAll("media")
    .filter((m): m is File => m instanceof File)
    .map((file) => ({
      id: newId("m"),
      type: file.type.startsWith("video")
        ? ("video" as const)
        : file.type.startsWith("audio")
          ? ("audio" as const)
          : ("photo" as const),
      file_url: URL.createObjectURL(file),
      created_at: new Date().toISOString(),
      uploaded_by: { id: by.id, name: by.name || "Jūs" },
    }));
}

/** Read a report's flat latitude/longitude form fields, if it carries them. */
function coordinates(form: FormData): [number, number] | undefined {
  const latitude = Number(form.get("latitude"));
  const longitude = Number(form.get("longitude"));
  if (!form.has("latitude") || !form.has("longitude") || Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return undefined;
  }
  return [longitude, latitude];
}

function me() {
  return { id: db.user.id, name: db.user.name || "Jūs" };
}

function forbiddenUnlessStaff() {
  return db.user.role === "staff"
    ? null
    : HttpResponse.json({ detail: "Neturite teisių." }, { status: 403 });
}

export const handlers = [
  // -- session ---------------------------------------------------------------
  http.post(`${API}/session`, () =>
    HttpResponse.json({ token: "mock-anon-token", user: db.user }, { status: 201 }),
  ),
  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    if (!body.email || !body.password) {
      return HttpResponse.json({ detail: "Neteisingi prisijungimo duomenys." }, { status: 400 });
    }
    return HttpResponse.json({ token: "mock-user-token", user: db.user });
  }),
  http.post(`${API}/auth/logout`, ({ request }) =>
    isAuthed(request) ? new HttpResponse(null, { status: 204 }) : unauthorized(),
  ),

  // -- users -----------------------------------------------------------------
  http.get(`${API}/users/me`, ({ request }) =>
    isAuthed(request) ? HttpResponse.json(db.user) : unauthorized(),
  ),
  http.put(`${API}/users/me`, async ({ request }) => {
    if (!isAuthed(request)) return unauthorized();
    const update = (await request.json()) as UserUpdate;
    const district = update.district
      ? fx.districts.find((d) => d.id === update.district)
      : db.user.district;
    db.user = { ...db.user, ...update, district };
    return HttpResponse.json(db.user);
  }),
  http.get(`${API}/users/me/badges`, ({ request }) =>
    isAuthed(request) ? HttpResponse.json(db.earnedBadges) : unauthorized(),
  ),

  // -- problems --------------------------------------------------------------
  http.get(`${API}/problems`, ({ request }) => {
    const q = new URL(request.url).searchParams;
    const list = db.problems.filter(
      (p) =>
        (!q.get("status") || p.status === q.get("status")) &&
        (!q.get("urgency") || p.urgency === q.get("urgency")) &&
        (!q.get("category") || p.category.id === q.get("category")),
    );
    return HttpResponse.json(list.map(withMyVote));
  }),
  http.get(`${API}/problems/:id`, ({ params }) => {
    const problem = db.problems.find((p) => p.id === idParam(params));
    if (!problem) return notFound();
    return HttpResponse.json({
      ...withMyVote(problem),
      reports: db.reports.filter((r) => r.problem === problem.id),
      validations: db.validations.filter((v) => v.problem === problem.id),
    });
  }),
  http.put(`${API}/problems/:id/status`, async ({ request, params }) => {
    if (!isAuthed(request)) return unauthorized();
    const problem = db.problems.find((p) => p.id === idParam(params));
    if (!problem) return notFound();
    const { status } = (await request.json()) as ProblemStatusUpdate;
    problem.status = status;
    problem.updated_at = new Date().toISOString();
    return HttpResponse.json(withMyVote(problem));
  }),
  http.get(`${API}/problems/:id/validations`, ({ params }) => {
    const id = idParam(params);
    if (!db.problems.some((p) => p.id === id)) return notFound();
    return HttpResponse.json(db.validations.filter((v) => v.problem === id));
  }),
  http.post(`${API}/problems/:id/validations`, async ({ request, params }) => {
    if (!isAuthed(request)) return unauthorized();
    const problem = db.problems.find((p) => p.id === idParam(params));
    if (!problem) return notFound();
    // One answer per person per problem, and it is final.
    if (db.validations.some((v) => v.problem === problem.id && v.user.id === db.user.id)) {
      return HttpResponse.json({ detail: "Jūs jau atsakėte į šį pranešimą." }, { status: 409 });
    }
    const form = await request.formData();
    const media = mediaFrom(form, db.user);
    const urgency = (form.get("urgency") as ProblemUrgency | null) || undefined;
    const points = POINTS.validation + (media.length ? POINTS.photo : 0);
    const validation: Validation = {
      id: newId("v"),
      is_valid: form.get("is_valid") === "true",
      description: String(form.get("description") ?? ""),
      urgency: urgency ?? "",
      points_awarded: points,
      user: me(),
      problem: problem.id,
      media,
      created_at: new Date().toISOString(),
    };
    db.validations = db.validations.concat(validation);
    db.user.points += points;
    if (urgency) {
      // An answer is also an urgency vote; the problem follows the majority,
      // ties going to the more severe (as the backend does).
      const votes = { ...problem.urgency_votes, [urgency]: (problem.urgency_votes?.[urgency] ?? 0) + 1 };
      problem.urgency_votes = votes;
      problem.urgency = URGENCIES_DESC.reduce((best, k) => ((votes[k] ?? 0) > (votes[best] ?? 0) ? k : best), URGENCIES_DESC[0]);
      db.myUrgency.set(problem.id, urgency);
    }
    // Two answers that agree, and more of them than the other way, decide the
    // status — while it is still the residents' to decide (as the backend does).
    const answers = db.validations.filter((v) => v.problem === problem.id);
    const confirming = answers.filter((v) => v.is_valid).length;
    const disputing = answers.length - confirming;
    if (["unconfirmed", "confirmed", "canceled"].includes(problem.status)) {
      if (confirming >= DECIDING_ANSWERS && confirming > disputing) problem.status = "confirmed";
      else if (disputing >= DECIDING_ANSWERS && disputing > confirming) problem.status = "canceled";
    }
    return HttpResponse.json(validation, { status: 201 });
  }),

  // -- reports ---------------------------------------------------------------
  http.post(`${API}/reports`, async ({ request }) => {
    if (!isAuthed(request)) return unauthorized();
    const form = await request.formData();
    const description = String(form.get("description") ?? "");
    if (!description) {
      return HttpResponse.json({ detail: "Aprašymas privalomas." }, { status: 400 });
    }
    const existingId = form.get("problem");
    let problem = existingId ? db.problems.find((p) => p.id === existingId) : undefined;
    if (!problem) {
      const category = fx.categories.find((c) => c.id === form.get("category")) ?? fx.categories.at(-1)!;
      const urgency = (form.get("urgency") as ProblemUrgency | null) ?? category.default_urgency;
      const at = coordinates(form);
      const now = new Date().toISOString();
      problem = {
        id: newId("p"),
        status: "unconfirmed",
        urgency,
        legitimacy_score: 70,
        location: at ? { type: "Point", coordinates: at } : db.problems[0].location,
        category,
        institution: null,
        created_at: now,
        updated_at: now,
        title: String(form.get("title") ?? "") || category.name,
        address: String(form.get("address") ?? ""),
        near_sensitive: form.get("near_sensitive") === "true",
        urgency_votes: { [urgency]: 1 },
        my_urgency_vote: null,
      } satisfies Problem;
      db.problems.unshift(problem);
    }
    const report: Report = {
      id: newId("r"),
      description,
      ai_category_suggestion: problem.category.name,
      ai_abuse_flag: false,
      user: me(),
      problem: problem.id,
      media: mediaFrom(form, db.user),
      has_moderation_flag: false,
      created_at: new Date().toISOString(),
    };
    db.reports.push(report);
    db.user.points += POINTS.report;
    return HttpResponse.json(report, { status: 201 });
  }),
  http.get(`${API}/reports/:id`, ({ request, params }) => {
    if (!isAuthed(request)) return unauthorized();
    const report = db.reports.find((r) => r.id === idParam(params));
    return report ? HttpResponse.json(report) : notFound();
  }),

  // -- geocoding -------------------------------------------------------------
  http.get(`${API}/geocode`, ({ request }) => {
    if (!isAuthed(request)) return unauthorized();
    const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
    if (q.length < 3) {
      return HttpResponse.json({ detail: "Užklausa per trumpa." }, { status: 400 });
    }
    // The fixtures' own addresses stand in for the geocoder.
    const matches = db.problems
      .filter((p) => (p.address ?? "").toLowerCase().includes(q.toLowerCase()))
      .slice(0, 5)
      .map((p) => ({
        address: p.address ?? "",
        locality: "Vilnius",
        latitude: p.location.coordinates[1],
        longitude: p.location.coordinates[0],
      }));
    return HttpResponse.json(matches);
  }),

  // -- reference data --------------------------------------------------------
  http.get(`${API}/categories`, () => HttpResponse.json(fx.categories)),
  http.get(`${API}/districts`, () => HttpResponse.json(fx.districts)),
  http.get(`${API}/badges`, () => HttpResponse.json(fx.badges)),

  // -- challenges ------------------------------------------------------------
  http.get(`${API}/challenges`, () => HttpResponse.json(db.challenges.map(fx.challengeSummary))),
  http.get(`${API}/challenges/:id`, ({ params }) => {
    const challenge = db.challenges.find((c) => c.id === idParam(params));
    return challenge ? HttpResponse.json(challenge) : notFound();
  }),
  http.post(`${API}/challenges/:id/join`, ({ request, params }) => {
    if (!isAuthed(request)) return unauthorized();
    const challenge = db.challenges.find((c) => c.id === idParam(params));
    if (!challenge) return notFound();
    if (!db.joined.has(challenge.id)) {
      db.joined.add(challenge.id);
      challenge.participant_count = (challenge.participant_count ?? 0) + 1;
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // -- notifications ---------------------------------------------------------
  http.get(`${API}/notifications`, ({ request }) =>
    isAuthed(request) ? HttpResponse.json(db.notifications) : unauthorized(),
  ),
  http.put(`${API}/notifications/:id/read`, ({ request, params }) => {
    if (!isAuthed(request)) return unauthorized();
    const notification = db.notifications.find((n) => n.id === idParam(params));
    if (!notification) return notFound();
    notification.read = true;
    return HttpResponse.json(notification);
  }),

  // -- moderation ------------------------------------------------------------
  http.get(`${API}/moderation/flags`, ({ request }) => {
    if (!isAuthed(request)) return unauthorized();
    return forbiddenUnlessStaff() ?? HttpResponse.json(db.flags);
  }),
  http.put(`${API}/moderation/flags/:id`, async ({ request, params }) => {
    if (!isAuthed(request)) return unauthorized();
    const forbidden = forbiddenUnlessStaff();
    if (forbidden) return forbidden;
    const flag = db.flags.find((f) => f.id === idParam(params));
    if (!flag) return notFound();
    const { status } = (await request.json()) as ModerationFlagUpdate;
    Object.assign(flag, {
      status,
      reviewed_by: me(),
      reviewed_at: new Date().toISOString(),
    });
    return HttpResponse.json(flag);
  }),
];
