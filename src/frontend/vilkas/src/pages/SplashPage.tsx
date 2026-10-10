// Board 0 · Įkėlimo ekranas — creates an anonymous session, then opens the map.

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createSession, getToken } from "../api";
import { Logo } from "../components/Logo";
import "./SplashPage.css";

const MIN_SPLASH_MS = 1200;

export function SplashPage() {
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const session = getToken() ? Promise.resolve() : createSession().then(() => undefined);
    const minDelay = new Promise((resolve) => setTimeout(resolve, MIN_SPLASH_MS));
    Promise.allSettled([session, minDelay]).then(() => navigate("/map", { replace: true }));
  }, [navigate]);

  return (
    <main className="splash" aria-busy="true">
      <div className="splash__logo">
        <Logo />
      </div>
      <span className="splash__name">vilkas</span>
      <span className="splash__tagline">Vilniaus problemų radaras</span>
      <span className="splash__progress" role="progressbar" aria-label="Įkeliama">
        <span />
      </span>
      <span className="splash__footer">Vilniaus miesto savivaldybė</span>
    </main>
  );
}
