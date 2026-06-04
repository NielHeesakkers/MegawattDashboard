// Pure helpers voor LocProjectForm — geëxtraheerd zodat ze los testbaar zijn.

export function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export function toDateInput(s: string | null): string {
  if (!s) return '';
  return s.slice(0, 10);
}

export function daysBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start), e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  const diff = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 0;
}

export function fmtEur(cents: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export type AvailabilityState = 'yes' | 'no' | 'unknown';

export function normalizeAvailability(v: unknown): AvailabilityState {
  return v === 'yes' || v === 'no' ? v : 'unknown';
}

/** Lokale Y-M-D string van een Date — vermijdt timezone-shifts van toISOString. */
function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Genereer YYYY-MM-DD strings van start tot end (inclusief). Werkt in lokale tijd. */
export function dateRange(start: string, end: string): string[] {
  if (!start || !end) return [];
  // Parse als YYYY-MM-DD string in lokale tijd (gebruik componenten, niet `new Date(string)`).
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return [];
  const s = new Date(sy, sm - 1, sd);
  const e = new Date(ey, em - 1, ed);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || s > e) return [];
  const out: string[] = [];
  const cur = new Date(s);
  while (cur <= e) {
    out.push(toLocalYmd(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** dd/mm korte weergave van een YYYY-MM-DD string. */
export function fmtShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}
