import { scoreClass, type ProblemView } from "../lib/problemModel";

function statusText(v: ProblemView): string {
  if (v.myVote) return v.myVote === "yes" ? "atsakėte: problema yra" : "atsakėte: problemos nėra";
  if (v.status === "new") return "laukia patvirtinimo";
  if (v.status === "work") return "sprendžiama";
  if (v.isFixed) return "sutvarkyta";
  return `${v.confirms} patvirt.`;
}

export function ProblemItem({ view: v, onOpen }: { view: ProblemView; onOpen: (id: string) => void }) {
  return (
    <button type="button" className="item" onClick={() => onOpen(v.id)}>
      {v.thumb ? (
        <img className="thumb" src={v.thumb} alt="" />
      ) : (
        <span className="thumb" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="10" r="3" />
            <path d="M12 21s-7-6.5-7-11a7 7 0 0114 0c0 4.5-7 11-7 11z" />
          </svg>
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="t">{v.title}</span>
        <br />
        <span className="m">
          {v.district} · {v.category} · {statusText(v)}
        </span>
      </span>
      <span className={`score ${scoreClass(v)}`}>{v.isFixed ? "✓" : v.score}</span>
    </button>
  );
}
