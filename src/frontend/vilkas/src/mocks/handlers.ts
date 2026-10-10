// MSW handlers implementing api/openapi.yaml (+ the api-gap extensions) against an
// in-memory copy of the fixtures.

import { http, HttpResponse, type PathParams } from "msw";
import type {
  GeoPoint,
  ModerationFlagUpdate,
  Problem,
  ProblemStatusUpdate,
  ProblemUrgency,
  Report,
  UrgencyVoteCreate,
  User,
  UserUpdate,
  Validation,
} from "../api";
import * as fx from "./fixtures";

// Matches the API whatever origin/base URL the client is configured with.
const API = "*/api";

const POINTS = { report: 20, validation: 10, photo: 10 };

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
    const form = await request.formData();
    const media = mediaFrom(form, db.user);
    // One answer per person: a new validation replaces the previous one.
    const previous = db.validations.find((v) => v.problem === problem.id && v.user.id === db.user.id);
    const points = previous ? 0 : POINTS.validation + (media.length ? POINTS.photo : 0);
    const validation: Validation = {
      id: previous?.id ?? newId("v"),
      is_valid: form.get("is_valid") === "true",
      description: String(form.get("description") ?? ""),
      points_awarded: points,
      user: me(),
      problem: problem.id,
      media: media.length ? media : (previous?.media ?? []),
      created_at: new Date().toISOString(),
    };
    db.validations = db.validations.filter((v) => v !== previous).concat(validation);
    db.user.points += points;
    if (problem.status === "unconfirmed" && validation.is_valid) problem.status = "confirmed";
    return HttpResponse.json(validation, { status: 201 });
  }),
  // TODO(api-gap): not in openapi.yaml yet.
  http.post(`${API}/problems/:id/urgency-votes`, async ({ request, params }) => {
    if (!isAuthed(request)) return unauthorized();
    const problem = db.problems.find((p) => p.id === idParam(params));
    if (!problem) return notFound();
    const { urgency } = (await request.json()) as UrgencyVoteCreate;
    const votes = { ...problem.urgency_votes };
    const previous = db.myUrgency.get(problem.id);
    if (previous) votes[previous] = Math.max(0, (votes[previous] ?? 1) - 1);
    votes[urgency] = (votes[urgency] ?? 0) + 1;
    problem.urgency_votes = votes;
    db.myUrgency.set(problem.id, urgency);
    return HttpResponse.json(withMyVote(problem));
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
      const location = form.get("location");
      const now = new Date().toISOString();
      problem = {
        id: newId("p"),
        status: "unconfirmed",
        urgency,
        legitimacy_score: 70,
        location: location ? (JSON.parse(String(location)) as GeoPoint) : db.problems[0].location,
        category,
        institution: null,
        created_at: now,
        updated_at: now,
        title: String(form.get("title") ?? "") || category.name,
        address: String(form.get("address") ?? ""),
        near_sensitive: form.get("near_sensitive") === "true",
        urgency_votes: { [urgency]: 1 },
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
