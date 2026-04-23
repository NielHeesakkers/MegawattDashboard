import { describe, it, expect } from 'vitest';
import { cityPrefix } from './locationCode';

describe('cityPrefix', () => {
  it('returns first 3 uppercase letters', () => {
    expect(cityPrefix('Amsterdam')).toBe('AMS');
    expect(cityPrefix('Rotterdam')).toBe('ROT');
    expect(cityPrefix('eindhoven')).toBe('EIN');
  });

  it('strips diacritics', () => {
    expect(cityPrefix('Wenen')).toBe('WEN');
    expect(cityPrefix('München')).toBe('MUN');
    expect(cityPrefix('Malmö')).toBe('MAL');
    expect(cityPrefix('Zürich')).toBe('ZUR');
  });

  it('strips non-letters then takes 3', () => {
    expect(cityPrefix("'s-Hertogenbosch")).toBe('SHE');
    expect(cityPrefix('1e-kwartiers')).toBe('EKW');
  });

  it('returns null when input is empty or nullish', () => {
    expect(cityPrefix('')).toBeNull();
    expect(cityPrefix(null)).toBeNull();
    expect(cityPrefix(undefined)).toBeNull();
  });

  it('returns null when result has fewer than 3 letters', () => {
    expect(cityPrefix('NY')).toBeNull();
    expect(cityPrefix('A B')).toBeNull();
    expect(cityPrefix('--')).toBeNull();
  });
});
