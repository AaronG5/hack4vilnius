// TODO(api-gap): frontend stand-ins for things the API doesn't provide yet.
// See "API gaps" in planning/FRONTEND_PLAN.md. Delete each helper once its endpoint exists.

import { suggestCategories, type Category, type ProblemUrgency } from "../api";

export interface Analysis {
  categoryId: string;
  /** Category ids AI suggested, best first; empty when it gave none and keywords picked `categoryId`. */
  suggestions: string[];
  urgency: ProblemUrgency;
  title: string;
  description: string;
  address: string;
  nearSensitive: boolean;
  /** "ai": categories from POST /reports/analyze. "keywords": the stand-in below, used when AI gave none. */
  source: "ai" | "keywords";
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

/** AI's suggested categories for `text`, best first; empty when AI is off, unreachable or `text` is blank. */
async function aiSuggestions(text: string, categories: Category[], signal: AbortSignal): Promise<Category[]> {
  if (!text.trim()) return [];
  try {
    const suggested = await suggestCategories(text, 3, signal);
    // Only ids the form knows, so a stale category list can't select a missing button.
    return suggested.filter((s) => categories.some((c) => c.id === s.id));
  } catch (error) {
    if (signal.aborted) throw error;
    return [];
  }
}

/**
 * Pre-fill the report form from the user's text.
 *
 * Categories come from POST /reports/analyze, which asks Claude. When it
 * suggests none (no API key on the server, AI down, photo-only report)
 * keyword matching picks one. Photos aren't analysed.
 * TODO(api-gap): title, address, urgency and the sensitive-place flag are
 * still extracted here with regexes.
 */
export async function analyzeReport(
  text: string,
  categories: Category[],
  signal: AbortSignal,
): Promise<Analysis> {
  const suggested = await aiSuggestions(text, categories, signal);
  if (!suggested.length) {
    await new Promise<void>((resolve, reject) => {
      // Brief pause so the step change is visible rather than a flash.
      const timer = setTimeout(resolve, 300);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
  }

  const name = KEYWORDS.find(([re]) => re.test(text))?.[1];
  const category =
    suggested[0] ??
    categories.find((c) => c.name === name) ??
    categories.find((c) => c.name === "Kita") ??
    categories[0];
  const recognized = suggested.length > 0 || Boolean(name);
  const address = text.match(ADDRESS)?.[1] ?? "";
  const textWithoutAddress = address ? text.replace(address, "").replace(/^[\s,.–-]+|[\s,.–-]+$/g, "") : text;
  const urgency: ProblemUrgency = DANGER.test(text) ? "dangerous_to_life" : category.default_urgency;

  return {
    categoryId: category.id,
    suggestions: suggested.map((c) => c.id),
    urgency,
    title: recognized && textWithoutAddress ? sentence(textWithoutAddress) : category.name,
    description: textWithoutAddress,
    address,
    nearSensitive: SENSITIVE.test(text),
    source: suggested.length ? "ai" : "keywords",
    note: recognized ? undefined : "Iš aprašymo tipo neatpažinome — pasirinkite jį žemiau.",
  };
}
