import { describe, it, expect } from 'vitest';
import { parseBackupDate, selectBackupsToKeep, DAILY_KEEP, WEEKLY_KEEP, MONTHLY_KEEP } from './backupRetention';

function fname(d: Date, hhmm = '0300'): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `megawatt-backup-${dd}-${mm}-${yyyy}_${hhmm}.zip`;
}
const isSunday = (d: Date) => d.getDay() === 0;
const isMonthEnd = (d: Date) => d.getDate() === new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

// Eén dagelijkse backup per dag, `days` dagen terug vanaf `end` (inclusief).
function dailyBackups(end: Date, days: number): { all: string[]; dayBack: (n: number) => Date } {
  const dayBack = (n: number) => new Date(end.getFullYear(), end.getMonth(), end.getDate() - n);
  const all: string[] = [];
  for (let i = 0; i < days; i++) all.push(fname(dayBack(i)));
  return { all, dayBack };
}

describe('parseBackupDate', () => {
  it('parset het auto-backup formaat', () => {
    const d = parseBackupDate('megawatt-backup-09-06-2026_1138.zip');
    expect(d).not.toBeNull();
    expect([d!.getFullYear(), d!.getMonth(), d!.getDate()]).toEqual([2026, 5, 9]);
  });
  it('negeert niet-matchende namen', () => {
    expect(parseBackupDate('megawatt-backup-09-06-2026.zip')).toBeNull();
    expect(parseBackupDate('random.zip')).toBeNull();
  });
});

describe('selectBackupsToKeep', () => {
  const end = new Date(2026, 5, 9); // 9 juni 2026
  const { all, dayBack } = dailyBackups(end, 500);
  const keep = selectBackupsToKeep(all);
  const kept = [...keep].map((n) => parseBackupDate(n)!);

  it('houdt de 30 meest recente dagen', () => {
    for (let i = 0; i < DAILY_KEEP; i++) {
      expect(keep.has(fname(dayBack(i)))).toBe(true);
    }
  });

  it('houdt minstens 12 zondagen (laatste 12 weken)', () => {
    const sundayDays = new Set(kept.filter(isSunday).map((d) => d.toDateString()));
    expect(sundayDays.size).toBeGreaterThanOrEqual(WEEKLY_KEEP);
  });

  it('houdt precies 12 maand-einden', () => {
    const months = new Set(kept.filter(isMonthEnd).map((d) => `${d.getFullYear()}-${d.getMonth()}`));
    expect(months.size).toBe(MONTHLY_KEEP);
  });

  it('gooit een oude doordeweekse niet-maandeind weg', () => {
    // Zoek ~200 dagen terug een dag die geen zondag en geen maandeind is.
    let target: Date | null = null;
    for (let i = 200; i < 230; i++) {
      const d = dayBack(i);
      if (!isSunday(d) && !isMonthEnd(d)) { target = d; break; }
    }
    expect(target).not.toBeNull();
    expect(all).toContain(fname(target!));
    expect(keep.has(fname(target!))).toBe(false);
  });

  it('bewaart een zondag binnen 12 weken maar buiten 30 dagen', () => {
    let sun: Date | null = null;
    for (let i = 31; i <= 84; i++) {
      const d = dayBack(i);
      if (isSunday(d)) { sun = d; break; }
    }
    expect(sun).not.toBeNull();
    expect(keep.has(fname(sun!))).toBe(true);
  });

  it('totaal bewaard ligt tussen 30 en 54 (overlap tussen categorieën)', () => {
    expect(keep.size).toBeGreaterThan(DAILY_KEEP);
    expect(keep.size).toBeLessThanOrEqual(DAILY_KEEP + WEEKLY_KEEP + MONTHLY_KEEP);
  });

  it('houdt slechts één backup per dag ook bij meerdere per dag', () => {
    const twice = [fname(end, '0300'), fname(end, '1500'), ...all];
    const k = selectBackupsToKeep(twice);
    const todayKept = [...k].filter((n) => n.startsWith(fname(end).slice(0, -8)));
    expect(todayKept).toEqual([fname(end, '1500')]); // nieuwste van die dag
  });
});
