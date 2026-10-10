// TODO(api-gap): frontend stand-ins for things the API doesn't provide yet.
// See "API gaps" in planning/FRONTEND_PLAN.md. Delete each helper once its endpoint exists.

import type { Category, ProblemUrgency } from "../api";

export interface Analysis {
  categoryId: string;
  urgency: ProblemUrgency;
  title: string;
  description: string;
  address: string;
  nearSensitive: boolean;
  /** Shown when the type couldn't be recognised from the text. */
  note?: string;
}

const KEYWORDS: [RegExp, string][] = [
  [/duob/i, "Duobė"],
  [/įtrūk|grindin|plyš/i, "Kelio įtrūkimas"],
  [/šiukš|konteiner|atliek/i, "Šiukšlės"],
  [/žibint|apšviet|tamsu/i, "Apšvietimas"],
  [/perėj|ženkl|šviesofor|eism/i, "Eismo saugumas"],
  [/triukš|garsiai/i, "Triukšmas"],
  [/grafit|išdauž|vandal|sulauž/i, "Vandalizmas"],
  [/medi|šak|želdin|krūm/i, "Medžiai ir želdiniai"],
];

const ADDRESS = /([A-ZĄČĘĖĮŠŲŪŽ][a-ząčęėįšųūž]+(?:\s[A-ZĄČĘĖĮŠŲŪŽ][a-ząčęėįšųūž]+)?\s(?:g\.|pr\.|al\.|skg\.)(?:\s?\d+[a-zA-Z]?(?:[–-]\d+)?)?)/;
const SENSITIVE = /mokykl|darželi|ligonin|žaidimų aikštel/i;
const DANGER = /pavoj|sužeis|vaik|gili|nesimato|griūv/i;

function sentence(text: string): string {
  const first = text.trim().split(/(?<=[.!?])\s/)[0].replace(/[.!?]$/, "");
  const capped = first.charAt(0).toUpperCase() + first.slice(1);
  return capped.length <= 45 ? capped : `${capped.slice(0, 44)}…`;
}

/**
 * Stand-in for POST /reports/analyze: keyword matching on the user's text.
 * It doesn't look at photos, so the UI calls it a suggestion, not AI. (The
 * backend separately asks Claude for a category when the report is submitted.)
 */
export async function analyzeReport(
  text: string,
  categories: Category[],
  signal: AbortSignal,
): Promise<Analysis> {
  await new Promise<void>((resolve, reject) => {
    // Brief pause so the step change is visible rather than a flash.
    const timer = setTimeout(resolve, 300);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

  const name = KEYWORDS.find(([re]) => re.test(text))?.[1];
  const category = categories.find((c) => c.name === name) ?? categories.find((c) => c.name === "Kita") ?? categories[0];
  const address = text.match(ADDRESS)?.[1] ?? "";
  const textWithoutAddress = address ? text.replace(address, "").replace(/^[\s,.–-]+|[\s,.–-]+$/g, "") : text;
  const urgency: ProblemUrgency = DANGER.test(text) ? "dangerous_to_life" : category.default_urgency;

  return {
    categoryId: category.id,
    urgency,
    title: name && textWithoutAddress ? sentence(textWithoutAddress) : category.name,
    description: textWithoutAddress,
    address,
    nearSensitive: SENSITIVE.test(text),
    note: name ? undefined : "Iš aprašymo tipo neatpažinome — pasirinkite jį žemiau.",
  };
}
