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
