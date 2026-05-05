import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Strip diacritics + non-letters, take first 3 letters uppercase. "Amsterdam" -> "AMS".
export function cityPrefix(city: string | null | undefined): string | null {
  if (!city) return null;
  const cleaned = city
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
  if (cleaned.length < 3) return null;
  return cleaned.slice(0, 3);
}

// Genereer volgende locatiecode voor deze stad-prefix, bv. AMS_001, AMS_002.
// Fallback-prefix "LOC" wanneer de stad onbekend of te kort is.
export async function generateLocationCode(city: string | null | undefined): Promise<string> {
  const prefix = cityPrefix(city) ?? 'LOC';
  const existing = await prisma.location.findMany({
    where: { code: { startsWith: `${prefix}_` } },
    select: { code: true },
  });
  let maxSeq = 0;
  for (const row of existing) {
    if (!row.code) continue;
    const m = row.code.match(/_(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxSeq) maxSeq = n;
    }
  }
  const next = String(maxSeq + 1).padStart(3, '0');
  return `${prefix}_${next}`;
}
