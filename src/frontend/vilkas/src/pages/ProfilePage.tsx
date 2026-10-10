// Profilis from the demo: impact, stats, badges, Vilnius landmark collection, prizes, own reports.

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUserBadges, listBadges, updateCurrentUser, type District } from "../api";
import { useApi } from "../hooks/useApi";
import { ProblemItem } from "../components/ProblemItem";
import { earnedLandmarks, LANDMARKS, level, myDistrict, type Landmark } from "../lib/activity";
import { initials, plural, shortDate } from "../lib/format";
import { myActivity } from "../lib/problemModel";
import { useAppState } from "../state/appState";
import "./ProfilePage.css";

// TODO(api-gap): partner prizes and redeeming (GET /rewards, POST /rewards/{id}/redeem).
// Until partners are signed up, the section says so instead of listing invented offers.

const LOCK = "M7 11V8a5 5 0 0 1 10 0v3 M5 11h14v10H5z";

/** Icon path and colour for each badge rule. */
const BADGE_LOOK: Record<string, [string, string]> = {
  first_report: ["M12 21s-6-5.6-6-10a6 6 0 0 1 12 0c0 4.4-6 10-6 10z M12 8.5 a2 2 0 1 0 .01 0", "var(--red)"],
  proven_answers: ["M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z M9 12l2 2 4-4", "var(--green)"],
  challenge: ["M12 2v20 M4 6l16 12 M20 6L4 18", "var(--btn)"],
  "": ["M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z", "var(--lav)"],
};

function LandmarkIcon({ landmark, size, locked }: { landmark: Landmark; size: number; locked: boolean }) {
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} aria-hidden="true">
      <path fill={locked ? "#B9B9B9" : "var(--red)"} fillRule="evenodd" d={landmark.d} />
    </svg>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { me, views, districts, notifications, reload, toast } = useAppState();
  const [editing, setEditing] = useState(false);
  const points = me?.points ?? 0;

  const acts = useMemo(() => myActivity(views, me?.id), [views, me?.id]);
  const mine = views.filter((v) => v.mine);
  const voted = views.filter((v) => v.myVote);
  const helped = mine.filter((v) => v.isFixed).length + voted.filter((v) => v.isFixed).length;
  // Trust: how often your "fixed / still there" answers agree with the outcome.
  // Agreement with the neighbours: did the rest of the street answer the same way?
  const agree = voted.filter((v) => (v.myVote === "yes") === v.yesVotes >= v.noVotes).length;
  const trust = voted.length ? `${Math.round((agree / voted.length) * 100)} %` : "–";
  const checks = acts.filter((a) => a.type !== "report").length;
  const earned = earnedLandmarks(acts);
  const earnedIds = new Set(earned.map((e) => e.landmark.id));
  const areas = [...new Set(LANDMARKS.map((l) => l.area))];

  // Badges are awarded by the backend; reload them when points or notifications change.
  const { data: allBadges } = useApi((signal) => listBadges(signal), "badges");
  const { data: earnedBadges } = useApi((signal) => getCurrentUserBadges(signal), `my-badges-${points}-${notifications.length}`);
  const badgeIds = new Set((earnedBadges ?? []).map((e) => e.badge.id));
  const badges = (allBadges ?? []).map((b) => {
    const look = BADGE_LOOK[b.rule ?? ""] ?? BADGE_LOOK[""];
    return { id: b.id, name: b.name, has: badgeIds.has(b.id), icon: look[0], color: look[1], hint: b.description };
  });

  return (
    <main className="app-main">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="avatar">{initials(me?.name ?? "")}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="pg" style={{ fontSize: 24 }}>
            {me?.name || (me ? `Miesto agentas #${me.id}` : "Miesto agentas")}
          </h1>
          <p className="pgsub" style={{ margin: 0 }}>
            {[level(points), me?.district?.name ?? myDistrict(acts), `${points} tšk.`].filter(Boolean).join(" · ")}
          </p>
        </div>
        {!editing && (
          <button type="button" className="btn link" style={{ height: 36 }} onClick={() => setEditing(true)}>
            Keisti
          </button>
        )}
      </div>

      {editing ? (
        <ProfileForm
          name={me?.name ?? ""}
          districtId={me?.district?.id ?? ""}
          districts={districts}
          onCancel={() => setEditing(false)}
          onSave={async (update) => {
            try {
              await updateCurrentUser(update);
              await reload();
              setEditing(false);
              toast("Profilis išsaugotas");
            } catch {
              toast("Nepavyko išsaugoti – pabandykite dar kartą");
            }
          }}
        />
      ) : (
        !me?.name && (
          <button type="button" className="card" style={{ marginTop: 12, textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit" }} onClick={() => setEditing(true)}>
            <b>Kaip jus vadinti?</b>
            <br />
            <span className="m">Vardas matomas iššūkių lentelėse ir prie jūsų patikrinimų. Galite nurodyti ir savo rajoną.</span>
          </button>
        )
      )}

      <section className="redcard">
        <span className="tag" style={{ background: "#fff", color: "var(--red)", alignSelf: "flex-start" }}>
          Jūsų indėlis
        </span>
        <b style={{ fontSize: 22, lineHeight: 1.2 }}>
          {helped
            ? `Jūsų veiksmai padėjo sutvarkyti ${helped} ${plural(helped, ["problemą", "problemas", "problemų"])}`
            : "Praneškite ar patikrinkite – ir čia matysite savo poveikį"}
        </b>
        <small>Taškai skiriami, kai jūsų pranešimas ar atsakymas pasitvirtina: +20 už patvirtintą pranešimą, +10 už teisingą atsakymą.</small>
      </section>

      <div className="grid3" style={{ marginTop: 10 }}>
        <div className="card stat">
          <b>{mine.length}</b>Pranešimai
        </div>
        <div className="card stat">
          <b>{checks}</b>Patikrinimai
        </div>
        <div className="card stat">
          <b>{trust}</b>Patikimumas
        </div>
      </div>

      <h2 className="sec">Ženkleliai</h2>
      <div className="grid3">
        {badges.map(({ id, name, has, icon, color, hint }) => (
          <div key={id} className={`card badge${has ? "" : " locked"}`} title={hint}>
            <span className="bic" style={{ background: has ? color : "var(--surface-2)", color: has ? "#fff" : "var(--muted)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={has ? icon : LOCK} />
              </svg>
            </span>
            <b>{name}</b>
            {!has && <small>{hint}</small>}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 className="sec" style={{ margin: 0 }}>
            Vilniaus kolekcija
          </h2>
          <span className="tag" style={{ background: "var(--red)", color: "#fff" }}>
            {earned.length} / {LANDMARKS.length}
          </span>
        </div>
        <p className="m" style={{ margin: "6px 0 10px" }}>
          Praneškite arba patikrinkite problemą šalia objekto – ženklelis atsiras kolekcijoje.
        </p>
        {areas.map((area) => {
          const ls = LANDMARKS.filter((l) => l.area === area);
          return (
            <div key={area}>
              <div style={{ fontSize: 13, fontWeight: 700, margin: "12px 0 6px" }}>
                {area} <span className="m">{ls.filter((l) => earnedIds.has(l.id)).length} / {ls.length}</span>
              </div>
              <div className="lmgrid">
                {ls.map((l) => {
                  const e = earned.find((x) => x.landmark.id === l.id);
                  return (
                    <div key={l.id} className={`lm${e ? "" : " locked"}`} title={l.name}>
                      <LandmarkIcon landmark={l} size={56} locked={!e} />
                      <span>{l.name}</span>
                      {e ? (
                        <em>{shortDate(e.at)}</em>
                      ) : (
                        <i aria-label="neatrakinta">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                            <path d={LOCK} />
                          </svg>
                        </i>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="sec">Partnerių prizai</h2>
      <div className="card" style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span className="tag ex" style={{ flexShrink: 0 }}>
          Netrukus
        </span>
        <span className="m">Surinktus taškus galėsite iškeisti į miesto partnerių pasiūlymus. Taškai kaupiasi jau dabar.</span>
      </div>

      <h2 className="sec">Mano pranešimai</h2>
      {mine.length ? (
        <div className="list">
          {mine.map((v) => (
            <ProblemItem key={v.id} view={v} onOpen={(id) => navigate(`/problems/${id}`)} />
          ))}
        </div>
      ) : (
        <div className="card empty">Dar nepranešėte apie jokią problemą.</div>
      )}
    </main>
  );
}

function ProfileForm({
  name: initialName,
  districtId: initialDistrict,
  districts,
  onCancel,
  onSave,
}: {
  name: string;
  districtId: string;
  districts: District[];
  onCancel: () => void;
  onSave: (update: { name: string; district?: string }) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [district, setDistrict] = useState(initialDistrict);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    await onSave({ name: name.trim(), ...(district ? { district } : {}) });
    setBusy(false);
  };

  return (
    <form
      className="card"
      style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label className="fld">
        Vardas
        <input className="inp" autoFocus maxLength={60} placeholder="Pvz.: Rūta V." value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="fld">
        Jūsų rajonas
        <select className="inp" value={district} onChange={(e) => setDistrict(e.target.value)}>
          <option value="">Nustatyti pagal mano veiksmus</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <div className="row">
        <button type="submit" className="btn" style={{ flex: 1 }} disabled={busy || !name.trim()}>
          {busy ? "Saugoma…" : "Išsaugoti"}
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>
          Atšaukti
        </button>
      </div>
    </form>
  );
}
