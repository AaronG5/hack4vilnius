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
  /** 0–100, how sure the category is. */
  confidence: number;
  source: "photo" | "text";
  /** Shown when the stand-in can't do what the real AI would. */
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

/** Stand-in for POST /reports/analyze: keyword matching on the user's text. */
export async function analyzeReport(
  text: string,
  hasPhoto: boolean,
  categories: Category[],
  signal: AbortSignal,
): Promise<Analysis> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 1200);
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
    confidence: name ? 82 : 35,
    source: hasPhoto ? "photo" : "text",
    note: hasPhoto
      ? "Nuotraukų atpažinimas bus prijungtas kartu su serveriu — kol kas DI remiasi tik jūsų tekstu. Patikrinkite tipą."
      : undefined,
  };
}
