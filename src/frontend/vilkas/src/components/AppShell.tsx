// Resident app frame from the demo: splash, header with points, scrolling main, FAB, bottom nav.
// Pages render once RootLayout has a session, so authenticated calls work on deep links.

import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAppState } from "../state/appState";
import { BellIcon, FlagIcon, MapIcon, PlusIcon, UserIcon } from "./icons";
import { Logo } from "./Logo";
import { useSession } from "../state/session";
import "./AppShell.css";

const SPLASH_MS = 1900;

const NAV = [
  { to: "/map", label: "Žemėlapis", Icon: MapIcon, match: (p: string) => p.startsWith("/map") || p.startsWith("/problems") },
  { to: "/challenges", label: "Iššūkiai", Icon: FlagIcon, match: (p: string) => p.startsWith("/challenges") },
  { to: "/profile", label: "Profilis", Icon: UserIcon, match: (p: string) => p.startsWith("/profile") },
];

export function AppShell() {
  const { ready, failed } = useSession();

  return (
    <div className="app">
      <Splash ready={ready} />
      <Header />
      {failed ? (
        <main className="app-main">
          <div className="card empty" role="alert">
            Nepavyko prisijungti prie serverio.{" "}
            <button type="button" className="btn link" onClick={() => window.location.reload()}>
              Bandyti dar kartą
            </button>
          </div>
        </main>
      ) : (
        ready && <Outlet />
      )}
      <BottomNav />
    </div>
  );
}

function Splash({ ready }: { ready: boolean }) {
  const [timeUp, setTimeUp] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimeUp(true), SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  const gone = dismissed || (timeUp && ready);
  useEffect(() => {
    if (!gone) return;
    const t = setTimeout(() => setRemoved(true), 500);
    return () => clearTimeout(t);
  }, [gone]);

  if (removed) return null;
  return (
    <div
      className={`splash${gone ? " gone" : ""}`}
      role="img"
      aria-label="Vilkas — Vilniaus problemų radaras"
      onClick={() => ready && setDismissed(true)}
    >
      <span className="wolf">
        <Logo size={132} />
      </span>
      <div className="word">vilkas</div>
      <div className="tag2">Vilniaus problemų radaras</div>
      <div className="load">
        <i />
      </div>
    </div>
  );
}

function Header() {
  const { me, notifications } = useAppState();
  const navigate = useNavigate();
  const onNotifications = useLocation().pathname === "/notifications";
  const unread = notifications.filter((n) => !n.read).length;
  return (
    <header className="top">
      <span className="brand">
        <Logo size={20} />
        vilkas
      </span>
      <span className="sub">
        Vilniaus problemų
        <br />
        radaras
      </span>
      <button
        type="button"
        className="bell"
        aria-label={unread ? `Pranešimai, ${unread} neperskaityti` : "Pranešimai"}
        aria-current={onNotifications ? "page" : undefined}
        onClick={() => navigate(onNotifications ? "/map" : "/notifications")}
      >
        <BellIcon size={20} />
        {unread > 0 && <span className="bell-count">{unread}</span>}
      </button>
      <span className="pts">{me?.points ?? 0} tšk.</span>
    </header>
  );
}

function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onMap = NAV[0].match(pathname);
  return (
    <>
      {onMap && (
        <button type="button" className="fab" aria-label="Pranešti apie problemą" onClick={() => navigate("/map/report")}>
          <PlusIcon size={36} />
        </button>
      )}
      <nav className="bottom" aria-label="Pagrindinis meniu">
        {NAV.map(({ to, label, Icon, match }) => (
          <button
            key={to}
            type="button"
            aria-current={match(pathname) ? "page" : undefined}
            onClick={() => navigate(to)}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>
    </>
  );
}
