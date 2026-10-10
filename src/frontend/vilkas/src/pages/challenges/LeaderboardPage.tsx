// Lyderiai: residents ranked by points, city-wide or in your district.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getLeaderboard, type LeaderboardEntry } from "../../api";
import { BackIcon } from "../../components/icons";
import { useApi } from "../../hooks/useApi";
import { useAppState } from "../../state/appState";
import "./challenges.css";

/** How a resident is named on the board; anonymous accounts have no name yet. */
function boardName(entry: LeaderboardEntry): string {
  return entry.user.name || `Miesto agentas #${entry.user.id}`;
}

function Row({ entry, mine }: { entry: LeaderboardEntry; mine: boolean }) {
  return (
    <div className={`lrow${mine ? " me" : ""}`}>
      <span className={`rk${entry.rank === 1 ? " first" : mine ? " mine" : ""}`}>{entry.rank}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 600 }}>
          {boardName(entry)}
          {mine && " (jūs)"}
        </span>
        {entry.district && (
          <>
            <br />
            <span className="m" style={{ fontSize: 11, fontWeight: 600 }}>
              {entry.district.name}
            </span>
          </>
        )}
      </span>
      <b>{entry.points} tšk.</b>
    </div>
  );
}

export function LeaderboardPage() {
  const navigate = useNavigate();
  const { me } = useAppState();
  const myDistrict = me?.district;
  const [scope, setScope] = useState<"city" | "district">("city");
  const district = scope === "district" ? myDistrict?.id : undefined;
  const { data, loading, error } = useApi(
    (signal) => getLeaderboard({ district, limit: 50 }, signal),
    `leaderboard-${district ?? "city"}-${me?.points ?? 0}`,
  );
  const entries = data?.entries ?? [];
  const mineId = me?.id;
  const meOutside = data?.me && !entries.some((e) => e.user.id === mineId);

  return (
    <main className="app-main">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" className="backbtn" aria-label="Atgal į iššūkius" onClick={() => navigate("/challenges")}>
          <BackIcon size={20} />
        </button>
        <h1 className="pg">Lyderiai</h1>
      </div>
      <p className="pgsub">Taškai skiriami už pasitvirtinusius pranešimus ir atsakymus.</p>

      <div className="seg" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 12 }} role="group" aria-label="Lentelė">
        <button type="button" aria-pressed={scope === "city"} onClick={() => setScope("city")}>
          Visas miestas
        </button>
        <button type="button" aria-pressed={scope === "district"} disabled={!myDistrict} onClick={() => setScope("district")}>
          {myDistrict?.name ?? "Mano rajonas"}
        </button>
      </div>
      {!myDistrict && (
        <p className="m" style={{ marginTop: 8 }}>
          Rajono lentelei pasirinkite savo rajoną{" "}
          <button type="button" className="btn link" style={{ height: "auto", padding: 0 }} onClick={() => navigate("/profile")}>
            profilyje
          </button>
          .
        </p>
      )}

      <div className="card" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {loading && !data ? (
          <span className="m">Įkeliama…</span>
        ) : error ? (
          <span className="m">Nepavyko įkelti lentelės.</span>
        ) : entries.length ? (
          <>
            {entries.map((e) => (
              <Row key={e.user.id} entry={e} mine={e.user.id === mineId} />
            ))}
            {meOutside && data?.me && (
              <>
                <span className="m" style={{ textAlign: "center" }}>
                  …
                </span>
                <Row entry={data.me} mine />
              </>
            )}
          </>
        ) : (
          <span className="m">
            {scope === "district" ? "Šiame rajone taškų dar niekas negavo." : "Taškų dar niekas negavo."} Pirmieji pasitvirtinę pranešimai
            ir atsakymai atsidurs čia.
          </span>
        )}
      </div>
    </main>
  );
}
