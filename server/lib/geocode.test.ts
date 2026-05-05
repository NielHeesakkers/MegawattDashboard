import { describe, it, expect } from 'vitest';
import { landToIso, formatAddress } from './geocode';

describe('landToIso', () => {
  it('maps known Dutch country names to ISO alpha-2', () => {
    expect(landToIso('Nederland')).toBe('nl');
    expect(landToIso('België')).toBe('be');
    expect(landToIso('Duitsland')).toBe('de');
    expect(landToIso('Frankrijk')).toBe('fr');
    expect(landToIso('Verenigd Koninkrijk')).toBe('gb');
  });

  it('accepts België/Belgie with and without diacritic', () => {
    expect(landToIso('Belgie')).toBe('be');
  });

  it('returns null for unknown or empty input', () => {
    expect(landToIso('Atlantis')).toBeNull();
    expect(landToIso('')).toBeNull();
    expect(landToIso(null)).toBeNull();
    expect(landToIso(undefined)).toBeNull();
  });
});

describe('formatAddress', () => {
  it('joins road + house + postcode + city in Dutch conventional order', () => {
    expect(formatAddress({ road: 'Kalverstraat', houseNumber: '114', postcode: '1012 PK', city: 'Amsterdam' })).toBe('Kalverstraat 114, 1012 PK Amsterdam');
  });

  it('skips empty parts gracefully', () => {
    expect(formatAddress({ road: 'Centraal Station', houseNumber: '', postcode: '', city: 'Amsterdam' })).toBe('Centraal Station, Amsterdam');
    expect(formatAddress({ road: '', houseNumber: '', postcode: '1012 PK', city: 'Amsterdam' })).toBe('1012 PK Amsterdam');
  });

  it('returns empty string when no parts', () => {
    expect(formatAddress({ road: '', houseNumber: '', postcode: '', city: '' })).toBe('');
  });
});
