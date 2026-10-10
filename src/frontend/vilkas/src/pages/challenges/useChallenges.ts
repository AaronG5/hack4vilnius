// Builds the demo's challenge cards from API challenges, live problems and the user's activity.

import { useCallback, useMemo, useState } from "react";
import { joinChallenge, listChallenges } from "../../api";
import { challengeKey, challengeMeta, GOALS, type BoardRow, type DistrictRow } from "../../data/challengeMeta";
import { useApi } from "../../hooks/useApi";
import { myDistrict } from "../../lib/activity";
import { store, type PrivateChallenge } from "../../lib/localStore";
import { myActivity, type Activity, type ProblemView } from "../../lib/problemModel";
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
  pct: number;
  progLabel: string;
  yours: string;
  board: string;
  rows: BoardRow[];
  rules: string[];
  prize: string;
  cta?: [string, string];
  joined: boolean;
  seasonal?: boolean;
  priv?: PrivateChallenge;
}

function districtTable(views: ProblemView[], districts: string[]): DistrictRow[] {
  return districts
    .map((name) => {
      const rs = views.filter((v) => v.district === name);
      const fixed = rs.filter((v) => v.isFixed).length;
      return { name, total: rs.length, pct: rs.length ? Math.round((fixed / rs.length) * 100) : 0 };
    })
    .sort((a, b) => b.pct - a.pct || b.total - a.total);
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
    progLabel: `Jūsų tikslas: ${p.target} ${goal.unit}`,
    yours:
      mine >= p.target
        ? "Tikslas pasiektas — ženklelis „Draugų komanda“ jūsų!"
        : `Liko ${p.target - mine}. Žemėlapyje įjunkite filtrą „Nepatvirtintos“.`,
    board: "Dalyviai",
    rows: [["1", myName || "Jūs", "Kūrėjas", String(mine), true]],
    rules: [
      "Pasidalinkite kodu su draugais — jie įveda jį skiltyje „Iššūkiai“.",
      "Skaičiuojami tik veiksmai nuo iššūkio pradžios.",
      "Visi, pasiekę tikslą, gauna ženklelį „Draugų komanda“.",
    ],
    prize: "Ženklelis „Draugų komanda“ visiems, pasiekusiems tikslą.",
    joined: true,
    priv: p,
  };
}

export function useChallenges() {
  const { views, districts, me, toast } = useAppState();
  const { data: apiChallenges, loading } = useApi((signal) => listChallenges(signal), "challenges");
  const [joined, setJoined] = useState(store.joined);
  const [privates, setPrivates] = useState(store.privateChallenges);

  const acts = useMemo(() => myActivity(views, me?.id), [views, me?.id]);

  const cards = useMemo(() => {
    const md = myDistrict(acts);
    const table = districtTable(views, districts.map((d) => d.name));
    const ctx = { myDistrict: md, table, myDistrictActs: acts.filter((a) => a.district === md).length };
    const publicCards: ChallengeCard[] = (apiChallenges ?? [])
      .filter((c) => c.status !== "ended")
      .map((c) => {
        const key = challengeKey(c.name);
        const meta = key ? challengeMeta(key, ctx) : undefined;
        return {
          id: c.id,
          apiId: c.id,
          icon: key ?? "kita",
          title: c.name,
          desc: c.description,
          tag: meta?.tag ?? "Iššūkis",
          color: meta?.color ?? "var(--lav)",
          ink: meta?.ink ?? "#3C3C3C",
          time: meta?.time ?? `Iki ${c.end_date}`,
          short: meta?.short ?? `+${c.reward_points} tšk.`,
          pct: meta?.pct ?? 0,
          progLabel: meta?.progLabel ?? "Eiga",
          yours: meta?.yours ?? "",
          board: meta?.board ?? "",
          rows: meta?.rows ?? [],
          rules: meta?.rules ?? [],
          prize: meta?.prize ?? `${c.reward_points} taškų dalyviams.`,
          cta: meta?.cta ?? ["Prisijungti", "Dalyvaujate"],
          joined: Boolean(joined[key ?? c.id]),
          seasonal: meta?.seasonal,
        };
      });
    return [...privates.map((p) => privateCard(p, acts, me?.name ?? "")), ...publicCards];
  }, [apiChallenges, acts, views, districts, joined, privates, me?.name]);

  const toggleJoin = useCallback(
    async (card: ChallengeCard) => {
      const key = challengeKey(card.title) ?? card.id;
      const next = { ...joined, [key]: !joined[key] };
      setJoined(next);
      store.setJoined(next);
      // TODO(api-gap): there is no leave endpoint; leaving is local only.
      if (next[key] && card.apiId) {
        try {
          await joinChallenge(card.apiId);
        } catch {
          toast("Nepavyko prisijungti — pabandykite dar kartą");
          return;
        }
      }
      toast(next[key] ? "Prisijungėte!" : "Nebedalyvaujate");
    },
    [joined, toast],
  );

  const savePrivates = useCallback((next: PrivateChallenge[]) => {
    setPrivates(next);
    store.setPrivateChallenges(next);
  }, []);

  return { cards, acts, loading, toggleJoin, privates, savePrivates };
}
