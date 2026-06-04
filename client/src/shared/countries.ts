// Gedeelde landenlijst + ISO 3166-1 alpha-2 mapping — single source of truth.
// Backend heeft een eigen, identieke kopie in server/lib/geocode.ts (kan niet
// importeren wegens client/server split). Wijzigingen moeten in beide.

export const EUROPESE_LANDEN_PRIO = ['Nederland', 'België', 'Duitsland'] as const;

export const EUROPESE_LANDEN_REST = [
  'Albanië', 'Andorra', 'Bosnië en Herzegovina', 'Bulgarije', 'Cyprus', 'Denemarken', 'Estland',
  'Finland', 'Frankrijk', 'Griekenland', 'Hongarije', 'IJsland', 'Ierland', 'Italië', 'Kosovo',
  'Kroatië', 'Letland', 'Liechtenstein', 'Litouwen', 'Luxemburg', 'Malta', 'Moldavië', 'Monaco',
  'Montenegro', 'Noord-Macedonië', 'Noorwegen', 'Oekraïne', 'Oostenrijk', 'Polen', 'Portugal',
  'Roemenië', 'San Marino', 'Servië', 'Slovenië', 'Slowakije', 'Spanje', 'Tsjechië', 'Turkije',
  'Vaticaanstad', 'Verenigd Koninkrijk', 'Wit-Rusland', 'Zweden', 'Zwitserland',
] as const;

// Land naam → vlag emoji (via ISO code → regional indicator symbols)
export function landToFlag(land: string | null | undefined): string {
  if (!land) return '';
  const iso = LAND_TO_ISO[land];
  if (!iso) return '';
  return iso.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export const LAND_TO_ISO: Record<string, string> = {
  'Nederland': 'nl', 'België': 'be', 'Belgie': 'be', 'Duitsland': 'de',
  'Albanië': 'al', 'Andorra': 'ad', 'Bosnië en Herzegovina': 'ba', 'Bulgarije': 'bg',
  'Cyprus': 'cy', 'Denemarken': 'dk', 'Estland': 'ee', 'Finland': 'fi',
  'Frankrijk': 'fr', 'Griekenland': 'gr', 'Hongarije': 'hu', 'IJsland': 'is',
  'Ierland': 'ie', 'Italië': 'it', 'Kosovo': 'xk', 'Kroatië': 'hr',
  'Letland': 'lv', 'Liechtenstein': 'li', 'Litouwen': 'lt', 'Luxemburg': 'lu',
  'Malta': 'mt', 'Moldavië': 'md', 'Monaco': 'mc', 'Montenegro': 'me',
  'Noord-Macedonië': 'mk', 'Noorwegen': 'no', 'Oekraïne': 'ua', 'Oostenrijk': 'at',
  'Polen': 'pl', 'Portugal': 'pt', 'Roemenië': 'ro', 'San Marino': 'sm',
  'Servië': 'rs', 'Slovenië': 'si', 'Slowakije': 'sk', 'Spanje': 'es',
  'Tsjechië': 'cz', 'Turkije': 'tr', 'Vaticaanstad': 'va',
  'Verenigd Koninkrijk': 'gb', 'Wit-Rusland': 'by', 'Zweden': 'se', 'Zwitserland': 'ch',
};
