import type { Location } from '../../api';

export interface LocatieFilters {
  landen: string[];
  m2Buckets: Array<'≤10' | '20' | '40' | '60+'>;
  geschiktVoor: Array<'activatie' | 'sampling'>;
  voorzieningen: Array<'stroom' | 'verlichting' | 'vergunning' | 'truck'>;
  eigendom: Array<'particulier' | 'gemeentelijk'>;
}

export const EMPTY_FILTERS: LocatieFilters = { landen: [], m2Buckets: [], geschiktVoor: [], voorzieningen: [], eigendom: [] };

export function applyFilters(locations: Location[], f: LocatieFilters, search: string): Location[] {
  const q = search.trim().toLowerCase();
  return locations.filter((loc) => {
    if (q) {
      const hay = [loc.naam, loc.adres, loc.land].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.landen.length && !f.landen.includes(loc.land)) return false;
    if (f.m2Buckets.length) {
      const m2 = loc.m2 ?? 0;
      const bucket = m2 <= 10 ? '≤10' : m2 <= 25 ? '20' : m2 <= 50 ? '40' : '60+';
      if (!f.m2Buckets.includes(bucket as any)) return false;
    }
    if (f.geschiktVoor.includes('activatie') && !loc.geschiktActivatie) return false;
    if (f.geschiktVoor.includes('sampling') && !loc.geschiktSampling) return false;
    if (f.voorzieningen.includes('stroom') && !loc.stroom) return false;
    if (f.voorzieningen.includes('verlichting') && !loc.verlichting) return false;
    if (f.voorzieningen.includes('vergunning') && !loc.vergunningNodig) return false;
    if (f.voorzieningen.includes('truck') && !loc.truckBereikbaar) return false;
    if (f.eigendom.length && !f.eigendom.includes(loc.eigendomType)) return false;
    return true;
  });
}

function isEmpty(f: LocatieFilters): boolean {
  return !f.landen.length && !f.m2Buckets.length && !f.geschiktVoor.length && !f.voorzieningen.length && !f.eigendom.length;
}

interface Props {
  filters: LocatieFilters;
  onChange: (f: LocatieFilters) => void;
  availableLanden: string[];
  resultCount: number;
}

export default function LocatieFilterSidebar({ filters, onChange, availableLanden, resultCount }: Props) {
  const toggle = <K extends keyof LocatieFilters>(key: K, value: LocatieFilters[K][number]) => {
    const current = filters[key] as string[];
    const next = current.includes(value as string) ? current.filter((v) => v !== value) : [...current, value as string];
    onChange({ ...filters, [key]: next } as LocatieFilters);
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.4)] mb-2">{title}</div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );

  const Check = ({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) => (
    <label className="flex items-center gap-2 text-[13px] text-[rgba(255,255,255,0.8)] cursor-pointer hover:text-white">
      <input type="checkbox" checked={checked} onChange={onClick} className="accent-accent-teal" />
      {label}
    </label>
  );

  return (
    <aside className="w-56 flex-shrink-0 p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[13px] text-[rgba(255,255,255,0.6)]">{resultCount} locaties</span>
        {!isEmpty(filters) && (
          <button onClick={() => onChange(EMPTY_FILTERS)} className="text-[11px] text-accent hover:opacity-80 cursor-pointer">Wissen</button>
        )}
      </div>

      <Section title="Land">
        {availableLanden.map((l) => (
          <Check key={l} checked={filters.landen.includes(l)} onClick={() => toggle('landen', l)} label={l} />
        ))}
      </Section>

      <Section title="Oppervlak">
        {(['≤10', '20', '40', '60+'] as const).map((b) => (
          <Check key={b} checked={filters.m2Buckets.includes(b)} onClick={() => toggle('m2Buckets', b)} label={`${b} m²`} />
        ))}
      </Section>

      <Section title="Geschikt voor">
        <Check checked={filters.geschiktVoor.includes('activatie')} onClick={() => toggle('geschiktVoor', 'activatie')} label="Activatie" />
        <Check checked={filters.geschiktVoor.includes('sampling')} onClick={() => toggle('geschiktVoor', 'sampling')} label="Mass sampling" />
      </Section>

      <Section title="Voorzieningen">
        <Check checked={filters.voorzieningen.includes('stroom')} onClick={() => toggle('voorzieningen', 'stroom')} label="Stroom aanwezig" />
        <Check checked={filters.voorzieningen.includes('verlichting')} onClick={() => toggle('voorzieningen', 'verlichting')} label="Verlichting" />
        <Check checked={filters.voorzieningen.includes('vergunning')} onClick={() => toggle('voorzieningen', 'vergunning')} label="Vergunning nodig" />
        <Check checked={filters.voorzieningen.includes('truck')} onClick={() => toggle('voorzieningen', 'truck')} label="Bakwagen-bereikbaar" />
      </Section>

      <Section title="Type">
        <Check checked={filters.eigendom.includes('particulier')} onClick={() => toggle('eigendom', 'particulier')} label="Particulier" />
        <Check checked={filters.eigendom.includes('gemeentelijk')} onClick={() => toggle('eigendom', 'gemeentelijk')} label="Gemeentelijk" />
      </Section>
    </aside>
  );
}
