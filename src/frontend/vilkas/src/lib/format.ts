// Lithuanian number/time formatting helpers.

const HOUR = 3_600_000;
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

/** Demo-style relative time: "ką tik", "prieš 3 val.", "vakar", "prieš 5 d.". */
export function ago(time: number, now = Date.now()): string {
  const diff = now - time;
  const days = Math.floor(diff / DAY);
  if (days <= 0) {
    const hours = Math.floor(diff / HOUR);
    return hours <= 0 ? "ką tik" : `prieš ${hours} val.`;
  }
  return days === 1 ? "vakar" : `prieš ${days} d.`;
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
