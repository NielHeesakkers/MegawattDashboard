// Nominatim (OpenStreetMap) geocoder met eenvoudige rate-limit (1 req/sec).
// Nominatim policy: https://operations.osmfoundation.org/policies/nominatim/

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'Megawatt Dashboard (familie@heesakkers.com)';
const MIN_INTERVAL_MS = 1100;

let lastCallAt = 0;
let queue: Promise<unknown> = Promise.resolve();

// Nederlandse landnaam → ISO 3166-1 alpha-2 (lowercase, voor Nominatim countrycodes)
const LAND_TO_ISO: Record<string, string> = {
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

export function landToIso(land: string | null | undefined): string | null {
  if (!land) return null;
  return LAND_TO_ISO[land] ?? null;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  road: string;
  houseNumber: string;
  postcode: string;
  city: string;
}

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  house_number?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
}

export function formatAddress(p: { road: string; houseNumber: string; postcode: string; city: string }): string {
  const line1 = [p.road, p.houseNumber].filter(Boolean).join(' ').trim();
  const line2 = [p.postcode, p.city].filter(Boolean).join(' ').trim();
  return [line1, line2].filter(Boolean).join(', ');
}

export async function geocode(address: string, land?: string | null): Promise<GeocodeResult | null> {
  const run = async (): Promise<GeocodeResult | null> => {
    const wait = Math.max(0, lastCallAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();

    const iso = landToIso(land);
    const countryParam = iso ? `&countrycodes=${iso}` : '';
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=1${countryParam}`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) return null;
      const data = (await res.json()) as Array<{ lat: string; lon: string; address?: NominatimAddress }>;
      if (!data.length) return null;
      const m = data[0];
      const a = m.address ?? {};
      return {
        lat: parseFloat(m.lat),
        lng: parseFloat(m.lon),
        road: a.road ?? a.pedestrian ?? '',
        houseNumber: a.house_number ?? '',
        postcode: a.postcode ?? '',
        city: a.city ?? a.town ?? a.village ?? a.municipality ?? '',
      };
    } catch {
      return null;
    }
  };

  queue = queue.then(run, run);
  return queue as Promise<GeocodeResult | null>;
}

export interface SuggestResult {
  display_name: string;
  lat: number;
  lng: number;
}

// Address autocomplete via Nominatim, door dezelfde rate-limit-queue zodat we OSM policy respecteren.
export async function suggest(query: string, land?: string | null, limit = 5): Promise<SuggestResult[]> {
  if (!query || query.trim().length < 3) return [];
  const run = async (): Promise<SuggestResult[]> => {
    const wait = Math.max(0, lastCallAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();

    const iso = landToIso(land);
    const countryParam = iso ? `&countrycodes=${iso}` : '';
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=${limit}&addressdetails=1${countryParam}`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) return [];
      const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
      return data.map((m) => ({ display_name: m.display_name, lat: parseFloat(m.lat), lng: parseFloat(m.lon) }));
    } catch {
      return [];
    }
  };

  queue = queue.then(run, run);
  return queue as Promise<SuggestResult[]>;
}
