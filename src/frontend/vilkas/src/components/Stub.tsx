// Placeholder for pages not built yet; shows which design board it maps to.

import { Link } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import "./Stub.css";

interface StubProps {
  board: string;
  title: string;
  withNav?: boolean;
}

export function Stub({ board, title, withNav = false }: StubProps) {
  return (
    <main className="stub">
      <span className="stub__board">Board {board}</span>
      <h1>{title}</h1>
      <p>Šis puslapis dar kuriamas.</p>
      <Link to="/map">← Į žemėlapį</Link>
      {withNav && <BottomNav />}
    </main>
  );
}
