// TODO(api-gap): presentation and leaderboard data for challenges that the API's
// Challenge/ChallengeDetail don't carry yet (tag, colours, rules, prize, leaderboard rows).
// Matched to API challenges by name; unknown challenges get a generic look.

export type ChallengeKey = "sezonas" | "rajonai" | "mokiniai" | "vienaragiai" | "dviraciai" | "kiemai";

/** Leaderboard row: rank, name, note, value, is-mine. */
export type BoardRow = [string, string, string, string, boolean?];

export interface ChallengeMeta {
  key: ChallengeKey;
  seasonal?: boolean;
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
  cta: [string, string];
  /** Joining needs a class/company code. */
  code?: boolean;
}

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

/** Demo presentation for a known challenge; the district race is computed from live problems. */
export function challengeMeta(key: ChallengeKey, ctx: { myDistrict: string; table: DistrictRow[]; myDistrictActs: number }): ChallengeMeta {
  switch (key) {
    case "sezonas":
      return {
        key, seasonal: true, tag: "Sezono iššūkis", color: "var(--navy)", ink: "#fff", time: "Liko 12 dienų", short: "", pct: 0,
        progLabel: "", yours: "", board: "", rows: [], rules: [], prize: "Prizas: ribotas ženklelis „Žiemos sargas“ visiems dalyviams", cta: ["Dalyvauti", "Dalyvaujate"],
      };
    case "rajonai": {
      const rank = ctx.table.findIndex((r) => r.name === ctx.myDistrict) + 1;
      const mine = ctx.table[rank - 1];
      return {
        key, tag: "Rajonų varžytynės", color: "var(--red)", ink: "#fff", time: "Spalis · liko 21 d.",
        short: `${ctx.myDistrict} — ${rank} vieta · ${mine?.pct ?? 0} % sutvarkyta`, pct: mine?.pct ?? 0,
        progLabel: `${ctx.myDistrict} — sutvarkyta`,
        yours: `Jūsų veiksmai rajone: ${ctx.myDistrictActs}. Jūsų rajonas nustatomas pagal paskutinį veiksmą.`,
        board: "Rajonų lentelė · sutvarkyta dalis",
        rows: ctx.table.map((r, i) => [String(i + 1), r.name, r.name === ctx.myDistrict ? `Jūsų rajonas · ${r.total} pran.` : `${r.total} pran.`, `${r.pct} %`, r.name === ctx.myDistrict]),
        rules: ["Praneškite ir tikrinkite problemas savo rajone.", "Sutvarkyta laikoma, kai bent 2 gyventojai tai patvirtina.", "Lentelė atnaujinama iš karto."],
        prize: "Laimėjęs rajonas renka, kuris kiemas ar skveras bus sutvarkytas pirmas kitą pavasarį.",
        cta: ["Dalyvauti už savo rajoną", `Dalyvaujate už ${ctx.myDistrict}`],
      };
    }
    case "mokiniai":
      return {
        key, tag: "Mokykloms", color: "var(--pink)", ink: "#3C3C3C", time: "Iki gruodžio 20 d.",
        short: "Klasių komandos · 1 vieta: Žalgirio progimn. 8b", pct: 62, progLabel: "Klasės tikslas: 300 tšk.",
        yours: "Prisijunkite su klasės kodu, kurį duoda mokytojas.", board: "Klasių lentelė",
        rows: [["1", "Žalgirio progimn. · 8b", "", "186"], ["2", "Antakalnio gimn. · 2c", "", "171"], ["3", "Šv. Kristoforo gimn. · 1a", "", "142"], ["4", "Licėjus · 3b", "", "128"], ["5", "Žirmūnų gimn. · 1d", "", "97"]],
        rules: ["Mokytojas sukuria klasės kodą, mokiniai prisijungia.", "Tikrinkite problemas pakeliui į mokyklą — tik šalia vietos.", "Valandos automatiškai suskaičiuojamos klasės vadovui."],
        prize: "Laimėjusi klasė — ekskursija į Savivaldybę ir susitikimas su meru.", cta: ["Prisijungti su klasės kodu", "Prisijungta prie klasės"], code: true,
      };
    case "vienaragiai":
      return {
        key, tag: "Įmonėms", color: "var(--lav)", ink: "#3C3C3C", time: "Spalis–lapkritis · liko 38 d.",
        short: "Įmonių komandos · 1 vieta: Nord Security", pct: 58, progLabel: "Bendras įmonių tikslas: 3 000 patikrinimų",
        yours: "Prisijunkite su įmonės kodu, kurį gauna jūsų koordinatorius.", board: "Įmonių lentelė · taškai 100 darbuotojų",
        rows: [["1", "Nord Security", "38 dalyviai", "436"], ["2", "Vinted", "52 dalyviai", "412"], ["3", "Oxylabs", "27 dalyviai", "371"], ["4", "Kilo Health", "31 dalyvis", "298"], ["5", "Revolut Vilnius", "19 dalyvių", "214"]],
        rules: ["Įmonės koordinatorius gauna komandos kodą ir pasidalina juo su kolegomis.", "Taškai skaičiuojami 100 darbuotojų — mažos įmonės turi tokias pat galimybes.", "Įmonė gauna savanorystės ataskaitą savo tvarumo (ESG) ataskaitai."],
        prize: "Laimėjusi įmonė su savivaldybe surengia savanorystės dieną ir sutvarko pasirinktą skverą.", cta: ["Prisijungti su įmonės kodu", "Prisijungta prie įmonės komandos"], code: true,
      };
    case "dviraciai":
      return {
        key, tag: "Teminis", color: "var(--green)", ink: "#fff", time: "Iki spalio 31 d.",
        short: "Patikrinta 38 iš 120 km takų", pct: 32, progLabel: "Patikrinta takų", yours: "Artimiausias takas — Neries krantinė.",
        board: "Daugiausia patikrinę",
        rows: [["1", "Rūta V.", "Žvėrynas", "14 km"], ["2", "Paulius D.", "Žirmūnai", "11 km"], ["3", "Greta S.", "Antakalnis", "9 km"], ["4", "Lukas B.", "Šnipiškės", "6 km"]],
        rules: ["Įjunkite „Važiuoju“ režimą — programėlė seka maršrutą.", "Sustoję vienu paspaudimu pažymėkite problemą.", "Patikrintas takas nusidažo žaliai visiems."],
        prize: "Dalyviams — 30 nemokamų dviračių nuomos minučių.", cta: ["Prisijungti", "Dalyvaujate"],
      };
    case "kiemai":
      return {
        key, tag: "Bendrijoms", color: "var(--peach)", ink: "#3C3C3C", time: "Iki lapkričio 15 d.",
        short: "14 namų bendrijų dalyvauja", pct: 18, progLabel: "Bendrijų tikslas: 80", yours: "Užtenka 3 kaimynų, kad kiemas dalyvautų.",
        board: "Kiemų lentelė",
        rows: [["1", "Kareivių g. 8 bendrija", "Žirmūnai", "23"], ["2", "Šeškinės g. 12", "Šeškinė", "19"], ["3", "Antakalnio g. 46", "Antakalnis", "17"], ["4", "Žirmūnų g. 70", "Žirmūnai", "9"]],
        rules: ["Sukurkite kiemo komandą ir pakvieskite bent 3 kaimynus.", "Kartu pažymėkite kiemo problemas — jos keliauja seniūnijai.", "Taškai skiriami už sutvarkytas problemas."],
        prize: "Laimėjęs kiemas gauna naujus suolus arba gėlių sodinimo talką su seniūnija.", cta: ["Sukurti kiemo komandą", "Komanda sukurta"],
      };
  }
}

export const GOALS = {
  check: { label: "Tikrinti problemas", hint: "„Ar vis dar yra?“ pakeliui", unit: "patikrinimų", types: ["still", "fixed"] },
  report: { label: "Pranešti naujas", hint: "Duobės, šiukšlės, apšvietimas…", unit: "pranešimų", types: ["report"] },
  fixed: { label: "Patvirtinti sutvarkymus", hint: "Pažymėti, kad problema sutvarkyta", unit: "patvirtintų sutvarkymų", types: ["fixed"] },
} as const;

export type GoalKey = keyof typeof GOALS;
