// Turns API problems into the view model the demo screens use: title, district,
// confirmations, votes, priority score and display status.

import type { District, ProblemDetail, ProblemUrgency, Uuid } from "../api";
import { districtOf, type LngLat } from "./geo";
import { URGENCIES_DESC } from "./labels";

const DAY = 86_400_000;

export type ViewStatus = "new" | "ok" | "urgent" | "work" | "fixed";
export type Vote = "still" | "fixed";

export interface PhotoEntry {
  src: string;
  at: number;
  /** What the uploader said: first report, "still there" or "fixed". */
  kind: "report" | Vote;
}

export interface ProblemView {
  id: Uuid;
  detail: ProblemDetail;
  title: string;
  category: string;
  description: string;
  address: string;
  district: string;
  /** [longitude, latitude] */
  at: LngLat;
  created: number;
  ageDays: number;
  photos: PhotoEntry[];
  thumb?: string;
  thumbAt?: number;
  /** Reports + "still there" answers. */
  confirms: number;
  stillVotes: number;
  fixedVotes: number;
  myVote?: Vote;
  mine: boolean;
  tally: Record<ProblemUrgency, number>;
  urgVotes: number;
  urgency: ProblemUrgency;
  myUrg?: ProblemUrgency;
  nearSensitive: boolean;
  score: number;
  status: ViewStatus;
  isFixed: boolean;
}

export const STATUS_LABEL: Record<ViewStatus, string> = {
  new: "nepatvirtinta",
  ok: "patvirtinta",
  urgent: "skubi",
  work: "sprendžiama",
  fixed: "sutvarkyta",
};

export const STATUS_TEXT: Record<ViewStatus, string> = {
  fixed: "Sutvarkyta (patvirtino gyventojai)",
  work: "Sprendžiama — savivaldybė jau dirba",
  new: "Laukia kaimynų patvirtinimo",
  urgent: "Skubi — aukštas prioritetas",
  ok: "Patvirtinta, laukia sprendimo",
};

// TODO(api-gap): priority_score should come from the backend. This is the demo's formula.
export function priorityScore(urgency: ProblemUrgency, confirms: number, nearSensitive: boolean, ageDays: number) {
  const severity = urgency === "dangerous_to_life" ? 3 : urgency === "urgent" ? 2 : 1;
  const raw = 12 + severity * 14 + Math.min(confirms, 10) * 6 + (nearSensitive ? 12 : 0) + Math.min(ageDays, 14) * 1.2;
  return Math.max(1, Math.min(99, Math.round(raw)));
}

function firstSentence(text: string): string {
  const sentence = text.split(/(?<=[.!?])\s/)[0].replace(/[.!?]$/, "");
  return sentence.length <= 45 ? sentence : `${sentence.slice(0, 44)}…`;
}

export function toView(p: ProblemDetail, meId: Uuid | undefined, districts: District[], now = Date.now()): ProblemView {
  const created = Date.parse(p.created_at);
  const ageDays = Math.max(0, (now - created) / DAY);
  const at = p.location.coordinates;

  const stillVotes = p.validations.filter((v) => v.is_valid).length;
  const fixedVotes = p.validations.length - stillVotes;
  const mineValidation = p.validations.find((v) => v.user.id === meId);

  const tally: Record<ProblemUrgency, number> = { can_wait: 0, urgent: 0, dangerous_to_life: 0 };
  if (p.urgency_votes) Object.assign(tally, p.urgency_votes);
  else tally[p.urgency] = 1;
  const urgVotes = tally.can_wait + tally.urgent + tally.dangerous_to_life;
  const urgency = URGENCIES_DESC.reduce((best, k) => (tally[k] > tally[best] ? k : best), URGENCIES_DESC[0]);

  const photos: PhotoEntry[] = [
    ...p.reports.flatMap((r) =>
      r.media.filter((m) => m.type === "photo").map((m) => ({ src: m.file_url, at: Date.parse(m.created_at), kind: "report" as const })),
    ),
    ...p.validations.flatMap((v) =>
      v.media
        .filter((m) => m.type === "photo")
        .map((m) => ({ src: m.file_url, at: Date.parse(m.created_at), kind: v.is_valid ? ("still" as const) : ("fixed" as const) })),
    ),
  ].sort((a, b) => a.at - b.at);
  const latest = photos.at(-1);

  const confirms = Math.max(1, p.reports.length) + stillVotes;
  const nearSensitive = p.near_sensitive ?? false;
  const score = priorityScore(urgency, confirms, nearSensitive, ageDays);
  const isFixed = p.status === "completed";
  const status: ViewStatus = isFixed
    ? "fixed"
    : p.status === "ongoing" || p.status === "pending"
      ? "work"
      : p.status === "unconfirmed"
        ? "new"
        : score >= 85
          ? "urgent"
          : "ok";

  const description = p.reports[0]?.description ?? "";
  return {
    id: p.id,
    detail: p,
    title: p.title || (description ? firstSentence(description) : p.category.name),
    category: p.category.name,
    description,
    address: p.address ?? "",
    district: districtOf(at, districts)?.name ?? "",
    at,
    created,
    ageDays,
    photos,
    thumb: latest?.src,
    thumbAt: latest?.at,
    confirms,
    stillVotes,
    fixedVotes,
    myVote: mineValidation ? (mineValidation.is_valid ? "still" : "fixed") : undefined,
    mine: p.reports.some((r) => r.user.id === meId),
    tally,
    urgVotes,
    urgency,
    myUrg: p.my_urgency_vote ?? undefined,
    nearSensitive,
    score,
    status,
    isFixed,
  };
}

export function scoreClass(v: ProblemView): string {
  const byStatus: Partial<Record<ViewStatus, string>> = { fixed: "s-ok", work: "s-work", new: "s-new", urgent: "s-hi" };
  return byStatus[v.status] ?? (v.score >= 50 ? "s-mid" : "s-lo");
}

export interface Activity {
  type: "report" | Vote;
  at: number;
  where: LngLat;
  category: string;
  district: string;
}

/** The current user's reports and answers, newest last (drives landmarks, weekly checks, challenges). */
export function myActivity(views: ProblemView[], meId: Uuid | undefined): Activity[] {
  if (!meId) return [];
  const acts: Activity[] = [];
  for (const v of views) {
    const base = { where: v.at, category: v.category, district: v.district };
    for (const r of v.detail.reports) if (r.user.id === meId) acts.push({ ...base, type: "report", at: Date.parse(r.created_at) });
    for (const val of v.detail.validations)
      if (val.user.id === meId) acts.push({ ...base, type: val.is_valid ? "still" : "fixed", at: Date.parse(val.created_at) });
  }
  return acts.sort((a, b) => a.at - b.at);
}
