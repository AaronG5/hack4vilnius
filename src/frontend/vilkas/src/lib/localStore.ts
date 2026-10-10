// Browser-local stand-ins (per-viewer only), as the demo uses when it has no shared database.
// TODO(api-gap): joined challenges and private challenges belong on the server.

import type { GoalKey } from "../data/challengeMeta";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode): state lasts for this page load only.
  }
}

export interface PrivateChallenge {
  code: string;
  name: string;
  goal: GoalKey;
  target: number;
  /** Days. */
  dur: number;
  created: number;
  ownerName: string;
}

/** TODO(api-gap): POST /problems/{id}/assignments — kept per browser until it exists. */
export interface Assignment {
  institutions: string[];
  due: number;
  note: string;
  at: number;
}

export const store = {
  assignments: () => read<Record<string, Assignment>>("vilkas.assignments", {}),
  setAssignments: (v: Record<string, Assignment>) => write("vilkas.assignments", v),
  joined: () => read<Record<string, boolean>>("vilkas.joined", { rajonai: true, sezonas: true }),
  setJoined: (v: Record<string, boolean>) => write("vilkas.joined", v),
  privateChallenges: () => read<PrivateChallenge[]>("vilkas.private", []),
  setPrivateChallenges: (v: PrivateChallenge[]) => write("vilkas.private", v),
};

export function newChallengeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPRSTUVZ23456789";
  let code = "DRG-";
  for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}
