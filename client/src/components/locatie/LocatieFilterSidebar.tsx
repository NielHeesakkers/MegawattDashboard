import type { Location } from '../../api';
import {
  STROOMVOORZIENING_PRESETS,
  DOELGROEP_PRESETS,
  EVENT_TYPE_PRESETS,
  AANVRAAGTIJD_OPTIONS,
  VOLUME_SAMPLING_OPTIONS,
  AANVRAAGTIJD_ORDER,
  VOLUME_SAMPLING_ORDER,
} from './locatieKenmerken';

export const M2_BUCKETS: ReadonlyArray<{ key: string; label: string; min: number; max: number | null }> = [
  { key: '≤10', label: '≤ 10 m²', min: 0, max: 10 },
  { key: '20', label: '11 – 25 m²', min: 11, max: 25 },
  { key: '40', label: '26 – 50 m²', min: 26, max: 50 },
  { key: '80', label: '51 – 100 m²', min: 51, max: 100 },
  { key: '150', label: '101 – 200 m²', min: 101, max: 200 },
  { key: '200+', label: '> 200 m²', min: 201, max: null },
];

export function bucketOf(m2: number): string {
  for (const b of M2_BUCKETS) {
    if (m2 >= b.min && (b.max === null || m2 <= b.max)) return b.key;
  }
  return M2_BUCKETS[0].key;
}

export interface LocatieFilters {
  landen: string[];
  m2Buckets: string[];
  geschiktVoor: Array<'activatie' | 'sampling'>;
  voorzieningen: Array<'stroom' | 'verlichting' | 'vergunning' | 'truck'>;
  eigendom: Array<'particulier' | 'gemeentelijk' | 'bedrijf'>;
  stroomvoorziening: string[];
  aanvraagtijd: string[];
  volumeSampling: string[];
  doelgroepen: string[];
  eventTypes: string[];
}

export const EMPTY_FILTERS: LocatieFilters = { landen: [], m2Buckets: [], geschiktVoor: [], voorzieningen: [], eigendom: [], stroomvoorziening: [], aanvraagtijd: [], volumeSampling: [], doelgroepen: [], eventTypes: [] };

export function applyFilters(locations: Location[], f: LocatieFilters, search: string): Location[] {
  const q = search.trim().toLowerCase();
  return locations.filter((loc) => {
    if (q) {
      const hay = [loc.naam, loc.adres, loc.land].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.landen.length && !f.landen.includes(loc.land)) return false;
    if (f.m2Buckets.length) {
      if (!f.m2Buckets.includes(bucketOf(loc.m2 ?? 0))) return false;
    }
    if (f.geschiktVoor.includes('activatie') && !loc.geschiktActivatie) return false;
    if (f.geschiktVoor.includes('sampling') && !loc.geschiktSampling) return false;
    if (f.voorzieningen.includes('stroom') && !loc.stroom) return false;
    if (f.voorzieningen.includes('verlichting') && !loc.verlichting) return false;
    if (f.voorzieningen.includes('vergunning') && loc.vergunningNodig) return false;
    if (f.voorzieningen.includes('truck') && !loc.truckBereikbaar) return false;
    if (f.eigendom.length && !f.eigendom.includes(loc.eigendomType)) return false;
    // match-any: locatie heeft minstens één geselecteerde waarde
    if (f.stroomvoorziening.length && !f.stroomvoorziening.some((v) => (loc.stroomvoorzieningTypes ?? []).includes(v))) return false;
    if (f.doelgroepen.length && !f.doelgroepen.some((v) => (loc.doelgroepen ?? []).includes(v))) return false;
    if (f.eventTypes.length && !f.eventTypes.some((v) => (loc.eventTypes ?? []).includes(v))) return false;
    // volume sampling: drempel ≤ (gekozen klasse én alles eronder; net als aanvraagtijd)
    if (f.volumeSampling.length) {
      const locIdx = VOLUME_SAMPLING_ORDER.indexOf(loc.volumeSampling);
      const maxSel = Math.max(...f.volumeSampling.map((v) => VOLUME_SAMPLING_ORDER.indexOf(v)));
      if (locIdx < 0 || locIdx > maxSel) return false;
    }
    // aanvraagtijd: drempel ≤ (binnen X weken; locatie niet langzamer dan de hoogste selectie)
    if (f.aanvraagtijd.length) {
      const locIdx = AANVRAAGTIJD_ORDER.indexOf(loc.aanvraagtijd);
      const maxSel = Math.max(...f.aanvraagtijd.map((v) => AANVRAAGTIJD_ORDER.indexOf(v)));
      if (locIdx < 0 || locIdx > maxSel) return false;
    }
    return true;
  });
}

function isEmpty(f: LocatieFilters): boolean {
  return !f.landen.length && !f.m2Buckets.length && !f.geschiktVoor.length && !f.voorzieningen.length && !f.eigendom.length && !f.stroomvoorziening.length && !f.aanvraagtijd.length && !f.volumeSampling.length && !f.doelgroepen.length && !f.eventTypes.length;
}

interface Props {
  filters: LocatieFilters;
  onChange: (f: LocatieFilters) => void;
  availableLanden: string[];
  availableM2Buckets: string[];
  resultCount: number;
}

export default function LocatieFilterSidebar({ filters, onChange, availableLanden, availableM2Buckets, resultCount }: Props) {
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

      {availableM2Buckets.length > 0 && (
        <Section title="Oppervlak">
          {M2_BUCKETS.filter((b) => availableM2Buckets.includes(b.key)).map((b) => (
            <Check key={b.key} checked={filters.m2Buckets.includes(b.key)} onClick={() => toggle('m2Buckets', b.key)} label={b.label} />
          ))}
        </Section>
      )}

      <Section title="Geschikt voor">
        <Check checked={filters.geschiktVoor.includes('activatie')} onClick={() => toggle('geschiktVoor', 'activatie')} label="Activatie" />
        <Check checked={filters.geschiktVoor.includes('sampling')} onClick={() => toggle('geschiktVoor', 'sampling')} label="Mass sampling" />
      </Section>

      <Section title="Voorzieningen">
        <Check checked={filters.voorzieningen.includes('stroom')} onClick={() => toggle('voorzieningen', 'stroom')} label="Stroom aanwezig" />
        <Check checked={filters.voorzieningen.includes('verlichting')} onClick={() => toggle('voorzieningen', 'verlichting')} label="Verlichting aanwezig" />
        <Check checked={filters.voorzieningen.includes('vergunning')} onClick={() => toggle('voorzieningen', 'vergunning')} label="Vergunning vrij" />
        <Check checked={filters.voorzieningen.includes('truck')} onClick={() => toggle('voorzieningen', 'truck')} label="Bakwagen-bereikbaar" />
      </Section>

      <Section title="Type">
        <Check checked={filters.eigendom.includes('particulier')} onClick={() => toggle('eigendom', 'particulier')} label="Particulier" />
        <Check checked={filters.eigendom.includes('gemeentelijk')} onClick={() => toggle('eigendom', 'gemeentelijk')} label="Gemeentelijk" />
        <Check checked={filters.eigendom.includes('bedrijf')} onClick={() => toggle('eigendom', 'bedrijf')} label="Bedrijf" />
      </Section>

      <Section title="Stroomvoorziening">
        {STROOMVOORZIENING_PRESETS.map((o) => (
          <Check key={o.key} checked={filters.stroomvoorziening.includes(o.key)} onClick={() => toggle('stroomvoorziening', o.key)} label={o.label} />
        ))}
      </Section>

      <Section title="Aanvraagtijd">
        {AANVRAAGTIJD_OPTIONS.map((o) => (
          <Check key={o.key} checked={filters.aanvraagtijd.includes(o.key)} onClick={() => toggle('aanvraagtijd', o.key)} label={o.label} />
        ))}
      </Section>

      <Section title="Volume sampling">
        {VOLUME_SAMPLING_OPTIONS.map((o) => (
          <Check key={o.key} checked={filters.volumeSampling.includes(o.key)} onClick={() => toggle('volumeSampling', o.key)} label={o.label} />
        ))}
      </Section>

      <Section title="Doelgroep">
        {DOELGROEP_PRESETS.map((o) => (
          <Check key={o.key} checked={filters.doelgroepen.includes(o.key)} onClick={() => toggle('doelgroepen', o.key)} label={o.label} />
        ))}
      </Section>

      <Section title="Event type">
        {EVENT_TYPE_PRESETS.map((o) => (
          <Check key={o.key} checked={filters.eventTypes.includes(o.key)} onClick={() => toggle('eventTypes', o.key)} label={o.label} />
        ))}
      </Section>
    </aside>
  );
}
