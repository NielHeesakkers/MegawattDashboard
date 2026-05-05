import { describe, it, expect } from 'vitest';
import { daysBetween, fmtEur, toDateInput, normalizeAvailability } from './locProjectHelpers';

describe('daysBetween', () => {
  it('returns 1 for same day (inclusive)', () => {
    expect(daysBetween('2026-04-22', '2026-04-22')).toBe(1);
  });

  it('returns N+1 for N-day gap (inclusive)', () => {
    expect(daysBetween('2026-04-22', '2026-04-25')).toBe(4);
    expect(daysBetween('2026-04-22', '2026-04-23')).toBe(2);
  });

  it('returns 0 when end precedes start', () => {
    expect(daysBetween('2026-04-25', '2026-04-22')).toBe(0);
  });

  it('returns 0 when either is empty', () => {
    expect(daysBetween('', '2026-04-22')).toBe(0);
    expect(daysBetween('2026-04-22', '')).toBe(0);
    expect(daysBetween('', '')).toBe(0);
  });

  it('returns 0 for invalid dates', () => {
    expect(daysBetween('not-a-date', '2026-04-22')).toBe(0);
    expect(daysBetween('2026-04-22', 'invalid')).toBe(0);
  });

  it('handles month boundaries', () => {
    expect(daysBetween('2026-03-28', '2026-04-02')).toBe(6);
  });
});

describe('fmtEur', () => {
  it('formats cents as Dutch Euro', () => {
    expect(fmtEur(0).replace(/\u00A0/g, ' ')).toBe('€ 0,00');
    expect(fmtEur(180000).replace(/\u00A0/g, ' ')).toBe('€ 1.800,00');
    expect(fmtEur(720000).replace(/\u00A0/g, ' ')).toBe('€ 7.200,00');
  });

  it('handles negative amounts', () => {
    expect(fmtEur(-500).replace(/\u00A0/g, ' ')).toBe('€ -5,00');
  });
});

describe('toDateInput', () => {
  it('keeps first 10 chars of an ISO timestamp', () => {
    expect(toDateInput('2026-04-22T12:34:56.789Z')).toBe('2026-04-22');
    expect(toDateInput('2026-04-22')).toBe('2026-04-22');
  });

  it('returns empty for null/empty', () => {
    expect(toDateInput(null)).toBe('');
    expect(toDateInput('')).toBe('');
  });
});

describe('normalizeAvailability', () => {
  it('accepts yes/no verbatim', () => {
    expect(normalizeAvailability('yes')).toBe('yes');
    expect(normalizeAvailability('no')).toBe('no');
  });

  it('falls back to unknown for everything else', () => {
    expect(normalizeAvailability('unknown')).toBe('unknown');
    expect(normalizeAvailability('maybe')).toBe('unknown');
    expect(normalizeAvailability(null)).toBe('unknown');
    expect(normalizeAvailability(undefined)).toBe('unknown');
    expect(normalizeAvailability(42)).toBe('unknown');
  });
});
