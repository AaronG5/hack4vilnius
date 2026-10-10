// TODO(api-gap): GET /institutions (with scope and workload) doesn't exist yet.
// Stand-in list from design board 10; names match the API's Institution records where they exist.

export interface InstitutionInfo {
  name: string;
  scope: string;
  load: string;
  contact: string;
  /** Category names this institution usually handles (drives the AI suggestion). */
  handles: string[];
}

export const INSTITUTIONS: InstitutionInfo[] = [
  { name: "Gatvių apšvietimas", scope: "Gatvių žibintai, perėjų apšvietimas", load: "18 aktyvių užduočių · vid. 2,1 d.", contact: "info@apsvietimas.lt", handles: ["Apšvietimas"] },
  { name: "Grinda", scope: "Gatvių danga, ženklinimas, duobės, valymas", load: "42 aktyvios užduotys · vid. 4,3 d.", contact: "info@grinda.lt", handles: ["Duobė", "Kelio įtrūkimas"] },
  { name: "Susisiekimo paslaugos", scope: "Eismo organizavimas, šviesoforai, ženklai", load: "9 aktyvios užduotys · vid. 6,0 d.", contact: "info@judu.lt", handles: ["Eismo saugumas"] },
  { name: "Vilniaus vandenys", scope: "Vandentiekis, nuotekos, šulinių dangčiai", load: "23 aktyvios užduotys · vid. 3,2 d.", contact: "info@vv.lt", handles: [] },
  { name: "VASA", scope: "Atliekos, konteineriai, didžiosios atliekos", load: "31 aktyvi užduotis · vid. 1,8 d.", contact: "info@vasa.lt", handles: ["Šiukšlės"] },
  { name: "Seniūnija", scope: "Želdiniai, kiemai, smulkūs darbai, vandalizmas", load: "12 aktyvių užduočių · vid. 5,4 d.", contact: "seniunija@vilnius.lt", handles: ["Medžiai ir želdiniai", "Vandalizmas", "Triukšmas", "Kita"] },
];

/** Suggested institution: the category's own institution from the API, else the stand-in mapping. */
export function suggestedInstitution(category: string, apiInstitution?: string | null): string | undefined {
  if (apiInstitution && INSTITUTIONS.some((i) => i.name === apiInstitution)) return apiInstitution;
  return INSTITUTIONS.find((i) => i.handles.includes(category))?.name;
}
