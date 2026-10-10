// Bottom sheet over a scrim, as the demo uses for the report flow and problem details.

import { useEffect, type ReactNode } from "react";
import "./Sheet.css";

interface SheetProps {
  label: string;
  onClose: () => void;
  children: ReactNode;
}

export function Sheet({ label, onClose, children }: SheetProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <span className="grab" aria-hidden="true" />
        {children}
      </div>
    </>
  );
}

export function Steps({ n }: { n: number }) {
  return (
    <div className="steps" aria-label={`${n} žingsnis iš 4`} role="img">
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={i <= n ? "on" : undefined} />
      ))}
    </div>
  );
}
