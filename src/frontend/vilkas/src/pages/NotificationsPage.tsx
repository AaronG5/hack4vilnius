// Board 5 · status-change and "still there?" notifications, as in-app cards.
// Tapping one marks it read and opens its problem.

import { useNavigate } from "react-router-dom";
import type { Notification } from "../api";
import { CheckIcon, PinIcon, StarIcon } from "../components/icons";
import { ago } from "../lib/format";
import { useAppState } from "../state/appState";
import "./NotificationsPage.css";

const KIND: Record<string, { color: string; ink: string; Icon: typeof PinIcon }> = {
  validation_requested: { color: "var(--red)", ink: "#fff", Icon: PinIcon },
  status_changed: { color: "var(--green)", ink: "#fff", Icon: CheckIcon },
  points_awarded: { color: "var(--lime)", ink: "var(--chip-ink)", Icon: StarIcon },
};

/**
 * First sentence is the headline; the rest is the body (the API sends one message string).
 * Prefers "?"/"!" so abbreviations like "tšk." don't cut the headline short.
 */
function split(message: string): [string, string] {
  const match = message.match(/^(.+?[?!])\s+(.*)$/s) ?? message.match(/^(.+?\.)\s+(.*)$/s);
  return match ? [match[1].replace(/\.$/, ""), match[2]] : [message, ""];
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, markRead, loaded } = useAppState();
  const unread = notifications.filter((n) => !n.read).length;
  const sorted = [...notifications].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  const open = (n: Notification) => {
    if (!n.read) void markRead(n.id);
    if (n.problem) navigate(`/problems/${n.problem}`);
  };

  return (
    <main className="app-main">
      <h1 className="pg">Pranešimai</h1>
      <p className="pgsub">{unread ? `${unread} neperskaityti` : "Visi perskaityti"}</p>

      {!loaded ? (
        <div className="card empty">Įkeliama…</div>
      ) : sorted.length ? (
        <div className="list">
          {sorted.map((n) => {
            const kind = KIND[n.event_type] ?? KIND.validation_requested;
            const [title, body] = split(n.message);
            return (
              <button
                key={n.id}
                type="button"
                className={`notif${n.read ? " read" : ""}`}
                onClick={() => open(n)}
                aria-label={`${n.read ? "" : "Neperskaitytas: "}${n.message}`}
              >
                <span className="notif-ic" style={{ background: kind.color, color: kind.ink }}>
                  <kind.Icon size={20} />
                </span>
                <span className="notif-body">
                  <span className="notif-meta">
                    <span>VILKAS</span>
                    <span>{ago(Date.parse(n.created_at)).replace("ką tik", "dabar")}</span>
                  </span>
                  <b>{title}</b>
                  {body && <span className="notif-text">{body}</span>}
                </span>
                {!n.read && <span className="notif-dot" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="card empty">Pranešimų dar nėra.</div>
      )}

      <p className="notif-note">
        Pranešimai siunčiami tik kai esate šalia nepatvirtintos ar senos problemos — ne dažniau kaip 2 kartus per dieną.
      </p>
    </main>
  );
}
