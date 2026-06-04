/**
 * Formatteert een Nederlands telefoonnummer na invoer.
 *
 * 0624349111       → 06 24 34 91 11
 * 0031624349111    → +31 6 24 34 91 11
 * +31624349111     → +31 6 24 34 91 11
 * 0201234567       → 020 123 45 67   (3-cijferig netnummer)
 * 0101234567       → 010 123 45 67
 */
export function formatPhone(raw: string): string {
  if (!raw) return raw;

  // Verwijder alles behalve cijfers en + prefix
  const stripped = raw.replace(/[^\d+]/g, '');

  // 0031... → +31...
  let normalized = stripped;
  if (/^0031/.test(normalized)) {
    normalized = '+31' + normalized.slice(4);
  }

  // +31 internationaal formaat
  if (/^\+31\d+$/.test(normalized)) {
    const rest = normalized.slice(3).replace(/^0/, '');
    if (/^\d{9}$/.test(rest)) {
      // +31 X XX XX XX XX
      return `+31 ${rest[0]} ${rest.slice(1, 3)} ${rest.slice(3, 5)} ${rest.slice(5, 7)} ${rest.slice(7, 9)}`;
    }
  }

  // Alleen cijfers van hier af
  const digits = normalized.replace(/\D/g, '');

  // 06XXXXXXXX — mobiel
  if (/^06\d{8}$/.test(digits)) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
  }

  // 3-cijferig netnummer: 010, 020, 030, 040, 070, 076, 079, etc.
  if (/^0[123456789]\d{8}$/.test(digits) && /^0[^6]/.test(digits)) {
    const area = digits.slice(0, 3);
    const local = digits.slice(3);
    // local = 7 digits → XXX XX XX
    return `${area} ${local.slice(0, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)}`;
  }

  // 4-cijferig netnummer: 0X1X XXXXXX (bijv. 0111, 0512)
  if (/^0\d{9}$/.test(digits)) {
    const area = digits.slice(0, 4);
    const local = digits.slice(4);
    // local = 6 digits → XXX XXX
    return `${area} ${local.slice(0, 3)} ${local.slice(3, 6)}`;
  }

  // Geen matching formaat — retourneer ongewijzigd
  return raw;
}
