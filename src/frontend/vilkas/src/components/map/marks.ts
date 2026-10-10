// Pin swatches, shared by the map legend and the map filter tabs so they always match.

import type { CSSProperties } from "react";

export type MarkKind = "new" | "confirmed" | "work" | "fixed" | "checked";

export const MARKS: Record<MarkKind, { style: CSSProperties; glyph?: string }> = {
  new: { style: { background: "var(--red-deep)", boxShadow: "0 0 0 3px rgba(126,35,36,.25)" }, glyph: "?" },
  confirmed: { style: { background: "var(--red)" } },
  work: { style: { background: "var(--yellow)" } },
  fixed: { style: { background: "var(--green)" } },
  checked: { style: { background: "#9A9A9A" } },
};
