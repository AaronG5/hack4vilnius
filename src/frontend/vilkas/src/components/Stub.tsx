// Placeholder for screens not built yet; shows which reference screen it maps to.

import { Link } from "react-router-dom";

export function Stub({ board, title }: { board: string; title: string }) {
  return (
    <main className="app-main">
      <h1 className="pg">{title}</h1>
      <p className="pgsub">Šis ekranas dar kuriamas (dizaino lenta {board}).</p>
      <Link to="/map" className="btn ghost">
        Į žemėlapį
      </Link>
    </main>
  );
}
