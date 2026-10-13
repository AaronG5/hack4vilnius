// TODO(api-gap): presentation for challenges that the API's Challenge doesn't carry yet
// (kind, colours, rules, prize), and team leaderboards (no Team model yet).
// Matched to API challenges by name; unknown challenges get a generic look.

export type ChallengeKey = "sezonas" | "rajonai" | "mokiniai" | "vienaragiai" | "dviraciai" | "kiemai";

/** Leaderboard row: rank, name, note, value, is-mine. */
export type BoardRow = [string, string, string, string, boolean?];

export const CH_ICON: Record<ChallengeKey | "mano" | "kita", string> = {
  sezonas: "M12 2v20 M4 6l16 12 M20 6L4 18",
  rajonai: "M12 21s-6-5.6-6-10a6 6 0 0 1 12 0c0 4.4-6 10-6 10z M12 8.5 a2 2 0 1 0 0.01 0",
  mokiniai: "M2 9 L12 4 L22 9 L12 14 Z M6 11 V16 C 6 17.5 9 19 12 19 C 15 19 18 17.5 18 16 V11 M22 9 V14",
  vienaragiai: "M12 2 L16.5 21 H7.5 Z M9.6 12.5 L14.4 10.5 M8.8 16.5 L15.4 14 M10.5 8.5 L13.4 7.3",
  dviraciai:
    "M5.5 17.5 a3.5 3.5 0 1 0 0.01 0 M18.5 17.5 a3.5 3.5 0 1 0 0.01 0 M5.5 17.5 L9 10 H15 L18.5 17.5 M9 10 L12 17.5 L15 10 M8 7 H11",
  kiemai: "M3 11 L12 4 L21 11 M5 10 V20 H19 V10 M10 20 V14 H14 V20",
  mano: "M15 19c0-2.5-2-4-4.5-4h-3C5 15 3 16.5 3 19 M9 11.5a3.5 3.5 0 1 0 .01 0 M19 8v6 M16 11h6",
  kita: "M5 21V4 M5 4h12l-2.5 4L17 12H5",
};

const BY_NAME: Record<string, ChallengeKey> = {
  "Duobių medžioklė prieš žiemą": "sezonas",
  "Rajonų aktyvumo iššūkis": "rajonai",
  "Moksleivių pilietiškumo iššūkis": "mokiniai",
  "Vienaragių aktyvumo iššūkis": "vienaragiai",
  "Dviračių takų patikra": "dviraciai",
  "Mano kiemo iššūkis": "kiemai",
};

export function challengeKey(name: string): ChallengeKey | undefined {
  return BY_NAME[name];
}

export interface DistrictRow {
  name: string;
  total: number;
  pct: number;
}

/**
 * How a known challenge looks and reads. Only presentation lives here: every
 * number (deadline, progress, leaderboard) is computed from the API and live problems.
 */
export interface ChallengeMeta {
  seasonal?: boolean;
  tag: string;
  color: string;
  ink: string;
  rules: string[];
  prize: string;
  cta: [string, string];
  /** Shared goal for the whole city (seasonal), from the challenge's own description. */
  cityTarget?: number;
  /** Team challenges: what the leaderboard ranks, and what to say while there are no teams. */
  teams?: { board: string; empty: string; how: string };
}

const META: Record<ChallengeKey, ChallengeMeta> = {
  sezonas: {
    seasonal: true, tag: "Sezono iššūkis", color: "var(--navy)", ink: "#fff", cityTarget: 1000,
    rules: ["Praneškite apie duobes arba patikrinkite kitų pažymėtas.", "Skaičiuojami visų gyventojų veiksmai nuo iššūkio pradžios."],
    prize: "Prizas: ribotas ženklelis „Žiemos sargas“ visiems dalyviams", cta: ["Dalyvauti", "Dalyvaujate"],
  },
  rajonai: {
    tag: "Rajonų varžytynės", color: "var(--red)", ink: "#fff",
    rules: ["Praneškite ir tikrinkite problemas savo rajone.", "Rajonai lyginami pagal tai, kokia dalis pranešimų jau sutvarkyta.", "Lentelė atnaujinama iš karto."],
    prize: "Laimėjęs rajonas renka, kuris kiemas ar skveras bus sutvarkytas pirmas kitą pavasarį.",
    cta: ["Dalyvauti už savo rajoną", "Dalyvaujate"],
  },
  mokiniai: {
    tag: "Mokykloms", color: "var(--red-deep)", ink: "#fff",
    teams: { board: "Klasių lentelė", empty: "Klasių lentelė atsiras, kai prisijungs pirmosios klasės.", how: "Klasių kodai bus įjungti netrukus. Kol kas skaičiuojami jūsų veiksmai." },
    rules: ["Mokytojas sukuria klasės kodą, mokiniai prisijungia.", "Tikrinkite problemas pakeliui į mokyklą – tik būdami šalia vietos."],
    prize: "Laimėjusi klasė – ekskursija į Savivaldybę ir susitikimas su meru.", cta: ["Dalyvauti", "Dalyvaujate"],
  },
  vienaragiai: {
    tag: "Įmonėms", color: "var(--lav)", ink: "#3C3C3C",
    teams: { board: "Įmonių lentelė · taškai 100 darbuotojų", empty: "Įmonių lentelė atsiras, kai prisijungs pirmosios įmonės.", how: "Įmonių kodai bus įjungti netrukus. Kol kas skaičiuojami jūsų veiksmai." },
    rules: ["Įmonės koordinatorius gauna komandos kodą ir pasidalina juo su kolegomis.", "Taškai skaičiuojami 100 darbuotojų – mažos įmonės turi tokias pat galimybes.", "Įmonė gauna savanorystės ataskaitą savo tvarumo (ESG) ataskaitai."],
    prize: "Laimėjusi įmonė su savivaldybe surengia savanorystės dieną ir sutvarko pasirinktą skverą.", cta: ["Dalyvauti", "Dalyvaujate"],
  },
  dviraciai: {
    tag: "Teminis", color: "var(--green)", ink: "#fff",
    rules: ["Važiuodami dviračių takais sustokite ir pažymėkite problemą.", "Patikrinkite kitų pažymėtas problemas šalia takų."],
    prize: "Dalyviams – 30 nemokamų dviračių nuomos minučių.", cta: ["Dalyvauti", "Dalyvaujate"],
  },
  kiemai: {
    tag: "Bendrijoms", color: "var(--peach)", ink: "#3C3C3C",
    teams: { board: "Kiemų lentelė", empty: "Kiemų lentelė atsiras, kai susikurs pirmosios kiemų komandos.", how: "Kiemų komandos bus įjungtos netrukus. Kol kas skaičiuojami jūsų veiksmai." },
    rules: ["Sukurkite kiemo komandą ir pakvieskite bent 3 kaimynus.", "Kartu pažymėkite kiemo problemas – jos keliauja seniūnijai.", "Taškai skiriami už sutvarkytas problemas."],
    prize: "Laimėjęs kiemas gauna naujus suolus arba gėlių sodinimo talką su seniūnija.", cta: ["Dalyvauti", "Dalyvaujate"],
  },
};

export function challengeMeta(key: ChallengeKey): ChallengeMeta {
  return META[key];
}

export const GOALS = {
  check: { label: "Tikrinti problemas", hint: "„Ar problema yra?“ pakeliui", unit: "patikrinimų", types: ["yes", "no"] },
  report: { label: "Pranešti naujas", hint: "Duobės, šiukšlės, apšvietimas…", unit: "pranešimų", types: ["report"] },
  fixed: { label: "Paneigti pranešimus", hint: "Pažymėti, kad problemos nebėra", unit: "paneigimų", types: ["no"] },
} as const;

export type GoalKey = keyof typeof GOALS;
