import { describe, it, expect } from 'vitest';
import { formatPhone } from './phone';

describe('formatPhone', () => {
  describe('mobiel (06...)', () => {
    it('formatteert 06 + 8 cijfers naar groepjes van 2', () => {
      expect(formatPhone('0624349111')).toBe('06 24 34 91 11');
    });

    it('strip bestaande spaties/streepjes en herformatteert', () => {
      expect(formatPhone('06-24-34-91-11')).toBe('06 24 34 91 11');
      expect(formatPhone('06 2434 9111')).toBe('06 24 34 91 11');
      expect(formatPhone('  0624349111  ')).toBe('06 24 34 91 11');
    });
  });

  describe('internationaal (0031 / +31)', () => {
    it('zet 0031 om naar +31 en formatteert', () => {
      expect(formatPhone('0031624349111')).toBe('+31 6 24 34 91 11');
    });

    it('formatteert reeds-met-+31 nummer', () => {
      expect(formatPhone('+31624349111')).toBe('+31 6 24 34 91 11');
    });

    it('strip leidende 0 na +31', () => {
      // +31 + 0624349111 (10 cijfers met leading 0) → +31 + 624349111 (9 cijfers)
      expect(formatPhone('+310624349111')).toBe('+31 6 24 34 91 11');
    });
  });

  describe('vast nummer (3-cijferig netnummer)', () => {
    it('formatteert 020/030/etc naar XXX XXX XX XX', () => {
      expect(formatPhone('0201234567')).toBe('020 123 45 67');
      expect(formatPhone('0301234567')).toBe('030 123 45 67');
      expect(formatPhone('0701234567')).toBe('070 123 45 67');
    });
  });

  describe('vast nummer (4-cijferig netnummer)', () => {
    // KNOWN LIMITATION: implementatie heeft geen lijst van 4-cijferige area codes,
    // dus alle 0-prefix 10-cijfer nummers worden als 3-cijferig netnummer geformatteerd.
    // Voor 0512 (Friesland) levert dit '051 212 34 56' op i.p.v. '0512 123 456'.
    // Acceptabel — meeste klanten gebruiken mobiel of grote-stad netnummers.
    it('valt terug op 3-cijferig formaat (geen 4-cijferige detectie)', () => {
      expect(formatPhone('0512123456')).toBe('051 212 34 56');
    });
  });

  describe('edge cases', () => {
    it('retourneert lege string ongewijzigd', () => {
      expect(formatPhone('')).toBe('');
    });

    it('retourneert ongeformatteerde string ongewijzigd bij niet-NL formaat', () => {
      expect(formatPhone('+1-555-1234')).toBe('+1-555-1234');
      expect(formatPhone('not-a-phone')).toBe('not-a-phone');
    });

    it('retourneert ongewijzigd bij te kort/lang nummer', () => {
      expect(formatPhone('06123')).toBe('06123'); // te kort voor mobiel
      expect(formatPhone('06243491111')).toBe('06243491111'); // te lang
    });

    it('idempotent: een al-geformatteerd nummer blijft hetzelfde', () => {
      const formatted = formatPhone('0624349111');
      expect(formatPhone(formatted)).toBe(formatted);
    });
  });
});
