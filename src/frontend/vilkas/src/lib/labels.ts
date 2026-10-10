import type { ProblemUrgency } from "../api";

/** Most severe first, as the demo orders its tie-breaks. */
export const URGENCIES_DESC: ProblemUrgency[] = ["dangerous_to_life", "urgent", "can_wait"];
export const URGENCIES: ProblemUrgency[] = ["can_wait", "urgent", "dangerous_to_life"];

export const URGENCY_LABEL: Record<ProblemUrgency, string> = {
  can_wait: "Gali palaukti",
  urgent: "Skubu",
  dangerous_to_life: "Pavojinga gyvybei",
};

export const URGENCY_HINT: Record<ProblemUrgency, string> = {
  can_wait: "trukdo, bet nekenkia",
  urgent: "reikia sutvarkyti greitai",
  dangerous_to_life: "gali sužaloti žmones",
};
