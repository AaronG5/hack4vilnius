// TODO(api-gap): GET /institutions (with scope and workload: active tasks, average resolve time) doesn't exist yet.
// Stand-in list from design board 10; names match the API's Institution records where they exist.

export interface InstitutionInfo {
  name: string;
  scope: string;
  contact: string;
  /** Category names this institution usually handles (drives the AI suggestion). */
  handles: string[];
}

export const INSTITUTIONS: InstitutionInfo[] = [
  { name: "Gatvių apšvietimas", scope: "Gatvių žibintai, perėjų apšvietimas", contact: "info@apsvietimas.lt", handles: ["Apšvietimas"] },
  { name: "Grinda", scope: "Gatvių danga, ženklinimas, duobės, valymas", contact: "info@grinda.lt", handles: ["Duobė", "Kelio įtrūkimas"] },
  { name: "Susisiekimo paslaugos", scope: "Eismo organizavimas, šviesoforai, ženklai", contact: "info@judu.lt", handles: ["Eismo saugumas"] },
  { name: "Vilniaus vandenys", scope: "Vandentiekis, nuotekos, šulinių dangčiai", contact: "info@vv.lt", handles: [] },
  { name: "VASA", scope: "Atliekos, konteineriai, didžiosios atliekos", contact: "info@vasa.lt", handles: ["Šiukšlės"] },
  { name: "Seniūnija", scope: "Želdiniai, kiemai, smulkūs darbai, vandalizmas", contact: "seniunija@vilnius.lt", handles: ["Medžiai ir želdiniai", "Vandalizmas", "Triukšmas", "Kita"] },
];

/** Suggested institution: the category's own institution from the API, else the stand-in mapping. */
export function suggestedInstitution(category: string, apiInstitution?: string | null): string | undefined {
  if (apiInstitution && INSTITUTIONS.some((i) => i.name === apiInstitution)) return apiInstitution;
  return INSTITUTIONS.find((i) => i.handles.includes(category))?.name;
}
