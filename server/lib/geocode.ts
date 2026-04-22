// Nominatim (OpenStreetMap) geocoder met eenvoudige rate-limit (1 req/sec).
// Nominatim policy: https://operations.osmfoundation.org/policies/nominatim/

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'Megawatt Dashboard (familie@heesakkers.com)';
const MIN_INTERVAL_MS = 1100;

let lastCallAt = 0;
let queue: Promise<unknown> = Promise.resolve();

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

export async function geocode(address: string): Promise<GeocodeResult | null> {
  const run = async (): Promise<GeocodeResult | null> => {
    const wait = Math.max(0, lastCallAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();

    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=1`;
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
