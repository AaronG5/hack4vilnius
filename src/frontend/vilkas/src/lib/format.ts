// Lithuanian number/time formatting helpers.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Pick the Lithuanian plural form for n.
 * forms: [1 / 21 / 31…, 2–9 / 22–29…, 0 / 10–20 / 30…], e.g. ["problemą", "problemas", "problemų"].
 */
export function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

/** "3 balsai", "1 balsas". */
export function count(n: number, forms: [string, string, string]): string {
  return `${n} ${plural(n, forms)}`;
}

/** Calendar days between two times, by local midnight. */
function calendarDays(time: number, now: number): number {
  const day = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  return Math.round((day(now) - day(time)) / DAY);
}

/** Relative time: "ką tik", "prieš 12 min.", "prieš 3 val.", "vakar", "prieš 5 d.", then the date. */
export function ago(time: number, now = Date.now()): string {
  const diff = Math.max(0, now - time);
  if (diff < MINUTE) return "ką tik";
  if (diff < HOUR) return `prieš ${Math.floor(diff / MINUTE)} min.`;
  if (diff < DAY) return `prieš ${Math.floor(diff / HOUR)} val.`;
  const days = calendarDays(time, now);
  if (days <= 1) return "vakar";
  return days < 30 ? `prieš ${days} d.` : shortDate(time);
}

const MONTHS = ["saus.", "vas.", "kov.", "bal.", "geg.", "birž.", "liep.", "rugp.", "rugs.", "spal.", "lapkr.", "gruod."];

/** "spal. 6" (browsers format lt-LT short months as "10-06", so months are spelled out here). */
export function shortDate(time: number): string {
  const d = new Date(time);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length ? (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase() : "AŠ";
}
