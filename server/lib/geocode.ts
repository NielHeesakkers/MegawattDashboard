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
}

export async function geocode(address: string): Promise<GeocodeResult | null> {
  const run = async (): Promise<GeocodeResult | null> => {
    const wait = Math.max(0, lastCallAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();

    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(address)}&format=json&limit=1`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) return null;
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (!data.length) return null;
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch {
      return null;
    }
  };

  queue = queue.then(run, run);
  return queue as Promise<GeocodeResult | null>;
}
