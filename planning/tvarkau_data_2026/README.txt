Tvarkau Vilnių reports, 2026
============================

Source: public API https://api-tvarkau.vilnius.lt/api/v2/problems
Scraped 2026-10-09. Vilnius only (cityId 1).
58,213 reports registered 2026-01-01 .. 2026-10-09, one row per report (deduplicated by problemId).

FILES
  tvarkau_2026.csv           Main data. UTF-8 with BOM, so it opens correctly in Excel.
                             Descriptions and answers can contain line breaks, so use a real CSV parser.
  problem_type_lookup.csv    problemTypeId -> problem type name, category, active/seasonal flags,
                             and number of 2026 reports per type.
  categories.json            Category ids and names (Pažeidimai, Eismas, Dangų remontas, ...).
  problem_types.json         Full problem type definitions for all municipalities (raw API).
  category_problem_types.json  Categories with their problem types nested (raw API).
  statuses.json              statusId: 1 = Registruota, 2 = Nagrinėjama, 3 = Išnagrinėta.
  cities.json                Municipality ids (raw API, includes base64 logos).

MAIN CSV COLUMNS
  problemId          Unique report id
  regNr              Official registration number
  regDate            When the report was submitted
  problemTypeId      Joins to problem_type_lookup.csv
  problemTypeString  Problem type name
  description        Citizen's text (Lithuanian)
  address, addressStreet, addressHouseNo, addressPostcode
  coordsGoogleLat/Lng  WGS84 coordinates
  coordsLksX/Y       LKS-94 coordinates
  statusId           See statuses.json
  problemExecutor    Department/eldership responsible
  answer, answeredBy, completeDate   Municipality's response, and when it was closed
  problemFileCount, answerFileCount  Number of photos attached by the citizen / by the municipality
  violationDatetime  Only filled for violation-type reports
  cityId, version    Always 1 here / API record version

NOTES
  - Some reports are repeated submissions: the same person sends the same text, location and photos
    several times within minutes. Each copy has its own problemId and regNr.
    Example: 15 copies at Vaduvos g. 41A on 2026-10-05.
  - Photos are not included. Each report's photo URLs come from
    GET /api/v2/problems/{problemId}. The URLs are pre-signed and expire after about 6 days.
