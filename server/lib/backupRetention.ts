// Retentie voor auto-backups (grandfather-father-son):
//  - laatste 30 dagen   → dagelijkse backup (laatste per dag)
//  - laatste 12 weken   → de zondag-backup (laatste per zondag)
//  - laatste 12 maanden → de backup op de laatste dag van de maand
// Een backup blijft bewaard als die in minstens één categorie valt.

const FILENAME_RE = /^megawatt-backup-(\d{2})-(\d{2})-(\d{4})_(\d{2})(\d{2})\.zip$/;

export const DAILY_KEEP = 30;
export const WEEKLY_KEEP = 12;
export const MONTHLY_KEEP = 12;

/** Parse `megawatt-backup-DD-MM-YYYY_HHMM.zip` → lokale Date, of null als het niet matcht. */
export function parseBackupDate(filename: string): Date | null {
  const m = FILENAME_RE.exec(filename);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, min] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
  return Number.isNaN(d.getTime()) ? null : d;
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const isLastDayOfMonth = (d: Date) =>
  d.getDate() === new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
const isSunday = (d: Date) => d.getDay() === 0;

interface Entry { name: string; date: Date }

/** Behoud per groep alleen de nieuwste backup, daarna de N meest recente groepen. */
function keepLatestOfRecentGroups(
  entries: Entry[],
  keyFn: (d: Date) => string,
  limit: number,
  keep: Set<string>,
) {
  const latest = new Map<string, Entry>();
  for (const e of entries) {
    const k = keyFn(e.date);
    const cur = latest.get(k);
    if (!cur || e.date.getTime() > cur.date.getTime()) latest.set(k, e);
  }
  [...latest.keys()]
    .sort()
    .reverse()
    .slice(0, limit)
    .forEach((k) => keep.add(latest.get(k)!.name));
}

/** Bepaal welke backup-bestandsnamen bewaard moeten blijven. */
export function selectBackupsToKeep(filenames: string[]): Set<string> {
  const entries: Entry[] = filenames
    .map((name) => ({ name, date: parseBackupDate(name) }))
    .filter((x): x is Entry => x.date !== null);

  const keep = new Set<string>();
  keepLatestOfRecentGroups(entries, dayKey, DAILY_KEEP, keep);
  keepLatestOfRecentGroups(entries.filter((e) => isSunday(e.date)), dayKey, WEEKLY_KEEP, keep);
  keepLatestOfRecentGroups(entries.filter((e) => isLastDayOfMonth(e.date)), monthKey, MONTHLY_KEEP, keep);
  return keep;
}
