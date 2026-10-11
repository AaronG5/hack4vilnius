// Builds the demo's challenge cards from API challenges, live problems and the user's activity.

import { useCallback, useMemo, useState } from "react";
import { joinChallenge, leaveChallenge, listChallenges } from "../../api";
import { challengeKey, challengeMeta, GOALS, type BoardRow } from "../../data/challengeMeta";
import { useApi } from "../../hooks/useApi";
import { myDistrict } from "../../lib/activity";
import { count, shortDate } from "../../lib/format";
import { districtTable } from "../../lib/cityStats";
import { store, type PrivateChallenge } from "../../lib/localStore";
import { myActivity, type Activity } from "../../lib/problemModel";
import { useAppState } from "../../state/appState";

const DAY = 86_400_000;

export interface ChallengeCard {
  /** Route id: the API id, or "p:<code>" for private challenges. */
  id: string;
  apiId?: string;
  icon: string;
  title: string;
  desc: string;
  tag: string;
  color: string;
  ink: string;
  time: string;
  short: string;
  /** Progress bar; omitted when there's nothing real to measure. */
  pct?: number;
  /** The user's own actions that count towards this challenge. */
  mine: number;
  /** Seasonal: everyone's actions so far, and the city's goal. */
  city?: number;
  target?: number;
  progLabel: string;
  yours: string;
  board: string;
  rows: BoardRow[];
  /** Shown instead of the leaderboard while it has no rows. */
  boardEmpty?: string;
  rules: string[];
  prize: string;
  cta?: [string, string];
  joined: boolean;
  /** Points each participant with at least one action gets when it ends. */
  reward?: number;
  /** How many have joined (public challenges). */
  participants?: number;
  seasonal?: boolean;
  priv?: PrivateChallenge;
}

function privateCard(p: PrivateChallenge, acts: Activity[], myName: string): ChallengeCard {
  const goal = GOALS[p.goal];
  const mine = acts.filter((a) => a.at >= p.created && (goal.types as readonly string[]).includes(a.type)).length;
  const left = Math.max(0, Math.ceil((p.created + p.dur * DAY - Date.now()) / DAY));
  return {
    id: `p:${p.code}`,
    icon: "mano",
    title: p.name,
    desc: `Kiekvienas dalyvis siekia ${p.target} ${goal.unit}. Prisijungti galima tik su kodu.`,
    tag: "Privatus · jūsų",
    color: "var(--lime)",
    ink: "#3C3C3C",
    time: left ? `Liko ${left} d.` : "Baigėsi",
    short: `1 dalyv. · jūs ${mine}/${p.target}`,
    pct: Math.min(100, Math.round((mine / p.target) * 100)),
    mine,
    progLabel: `Jūsų tikslas: ${p.target} ${goal.unit}`,
    yours:
      mine >= p.target
        ? "Tikslas pasiektas – ženklelis „Draugų komanda“ jūsų!"
        : `Liko ${p.target - mine}. Žemėlapyje įjunkite filtrą „Nepatvirtintos“.`,
    board: "Dalyviai",
    rows: [["1", myName || "Jūs", "Kūrėjas", String(mine), true]],
    rules: [
      "Pasidalinkite kodu su draugais – jie įveda jį skiltyje „Iššūkiai“.",
      "Skaičiuojami tik veiksmai nuo iššūkio pradžios.",
      "Visi, pasiekę tikslą, gauna ženklelį „Draugų komanda“.",
    ],
    prize: "Ženklelis „Draugų komanda“ visiems, pasiekusiems tikslą.",
    joined: true,
    priv: p,
  };
}

/** "Liko 12 dienų", "Paskutinė diena", "Prasideda spal. 15", "Baigėsi". */
function timeLeft(start: number, end: number, now: number): string {
  if (now < start) return `Prasideda ${shortDate(start)}`;
  const days = Math.ceil((end - now) / DAY);
  if (days <= 0) return "Baigėsi";
  return days === 1 ? "Paskutinė diena" : `Liko ${count(days, ["diena", "dienos", "dienų"])}`;
}

export function useChallenges() {
  const { views, districts, me, toast, reload } = useAppState();
  const { data: apiChallenges, loading, reload: reloadChallenges } = useApi((signal) => listChallenges(signal), "challenges");
  // Joined state comes from the API; this holds a tap's result until the list reloads.
  const [joined, setJoined] = useState<Record<string, boolean>>({});
  const [privates, setPrivates] = useState(store.privateChallenges);
  // One reference time per page view, so deadlines and windows agree.
  const [now] = useState(() => Date.now());

  const acts = useMemo(() => myActivity(views, me?.id), [views, me?.id]);

  const cards = useMemo(() => {

    const md = me?.district?.name ?? myDistrict(acts);
    const table = districtTable(views, districts.map((d) => d.name));
    const publicCards: ChallengeCard[] = (apiChallenges ?? [])
      .filter((c) => c.status !== "ended")
      .map((c) => {
        const key = challengeKey(c.name);
        const meta = key ? challengeMeta(key) : undefined;
        const start = Date.parse(c.start_date);
        const end = Date.parse(c.end_date) + DAY;
        // Only actions since the challenge started, in its categories when it has any.
        const cats = new Set((c.categories ?? []).map((x) => x.name));
        const counts = (category: string, at: number) => at >= start && at < end && (!cats.size || cats.has(category));
        const mine = acts.filter((a) => counts(a.category, a.at)).length;
        const base = {
          id: c.id,
          apiId: c.id,
          icon: key ?? "kita",
          title: c.name,
          desc: c.description,
          tag: meta?.tag ?? "Iššūkis",
          color: meta?.color ?? "var(--lav)",
          ink: meta?.ink ?? "#3C3C3C",
          time: timeLeft(start, end, now),
          mine,
          rules: meta?.rules ?? [],
          prize: meta?.prize ?? "",
          reward: c.reward_points,
          cta: meta?.cta ?? (["Dalyvauti", "Dalyvaujate"] as [string, string]),
          joined: joined[c.id] ?? Boolean(c.joined),
          participants: c.participant_count,
          seasonal: meta?.seasonal,
          board: "",
          rows: [] as BoardRow[],
          progLabel: "Jūsų veiksmai nuo pradžios",
          yours: "",
          // Paid when the challenge ends, to participants with at least one action (challenges/services.py).
          short: `Jūsų veiksmai: ${mine} · +${c.reward_points} tšk. dalyviams`,
        };

        if (meta?.seasonal) {
          // Everyone's reports and answers in the challenge's categories since it started.
          let city = 0;
          for (const v of views) {
            if (cats.size && !cats.has(v.category)) continue;
            for (const r of v.detail.reports) if (counts(v.category, Date.parse(r.created_at))) city++;
            for (const val of v.detail.validations) if (counts(v.category, Date.parse(val.created_at))) city++;
          }
          const target = meta.cityTarget ?? 0;
          return { ...base, city, target, pct: target ? Math.min(100, Math.round((city / target) * 100)) : undefined, progLabel: "Visas miestas" };
        }

        if (key === "rajonai") {
          const rank = table.findIndex((r) => r.name === md) + 1;
          const row = table[rank - 1];
          const inDistrict = acts.filter((a) => a.district === md && counts(a.category, a.at)).length;
          // Districts with reports, plus yours; the rest are all "0 %" and say nothing.
          const shown = table.map((r, i) => ({ r, rank: i + 1 })).filter(({ r }) => r.total > 0 || r.name === md);
          return {
            ...base,
            short: md ? `${md} – ${rank} vieta · ${row.pct} % sutvarkyta` : "Jūsų rajonas nustatomas pagal pirmą veiksmą",
            pct: md ? row.pct : undefined,
            progLabel: md ? `${md} – sutvarkyta` : "Jūsų veiksmai",
            yours: md
              ? `Jūsų veiksmai rajone: ${inDistrict}. Jūsų rajonas nustatomas pagal paskutinį veiksmą.`
              : "Praneškite arba patikrinkite problemą – rajonas bus nustatytas pagal jos vietą.",
            board: "Rajonų lentelė · sutvarkyta dalis",
            boardEmpty: "Pranešimų dar nėra – lentelė atsiras po pirmųjų.",
            rows: shown.map(({ r, rank: n }): BoardRow => [String(n), r.name, r.name === md ? `Jūsų rajonas · ${r.total} pran.` : `${r.total} pran.`, `${r.pct} %`, r.name === md]),
            cta: ["Dalyvauti už savo rajoną", md ? `Dalyvaujate už ${md}` : "Dalyvaujate"] as [string, string],
          };
        }

        if (meta?.teams) return { ...base, board: meta.teams.board, boardEmpty: meta.teams.empty, yours: meta.teams.how };
        return base;
      });
    return [...privates.map((p) => privateCard(p, acts, me?.name ?? "")), ...publicCards];
  }, [apiChallenges, acts, views, districts, joined, privates, me?.name, me?.district?.name, now]);

  const toggleJoin = useCallback(
    async (card: ChallengeCard) => {
      if (!card.apiId) return;
      const join = !card.joined;
      setJoined((all) => ({ ...all, [card.id]: join }));
      try {
        await (join ? joinChallenge(card.apiId) : leaveChallenge(card.apiId));
      } catch {
        setJoined((all) => ({ ...all, [card.id]: !join }));
        toast(join ? "Nepavyko prisijungti – pabandykite dar kartą" : "Nepavyko – pabandykite dar kartą");
        return;
      }
      toast(join ? "Prisijungėte!" : "Nebedalyvaujate");
      reloadChallenges();
      // Joining can earn a badge, which arrives as a notification.
      await reload();
    },
    [toast, reload, reloadChallenges],
  );

  const savePrivates = useCallback((next: PrivateChallenge[]) => {
    setPrivates(next);
    store.setPrivateChallenges(next);
  }, []);

  return { cards, acts, loading, toggleJoin, privates, savePrivates };
}
