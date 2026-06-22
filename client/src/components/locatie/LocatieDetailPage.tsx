import { useEffect, useRef, useState } from 'react';
import { useToast } from '../ui/Toast';
import { useAutoSave, SaveIndicator } from '../../hooks/useAutoSave';
import {
  fetchLocation, createLocation, updateLocation, deleteLocation, suggestAdres, AdresSuggestion,
  Location, LocationWriteInput, OmgevingType, Orientatie, EigendomType, LocationPhoto,
} from '../../api';
import { EUROPESE_LANDEN_PRIO, EUROPESE_LANDEN_REST } from '../../shared/countries';
import {
  STROOMVOORZIENING_PRESETS, AANVRAAGTIJD_OPTIONS, VOLUME_SAMPLING_OPTIONS,
  DOELGROEP_PRESETS, EVENT_TYPE_PRESETS, Optie,
} from './locatieKenmerken';
import LocatieMap from './LocatieMap';
import LocatieContactsSection from './LocatieContactsSection';
import LocatieCostsSection from './LocatieCostsSection';
import LocatiePhotoManager from './LocatiePhotoManager';

interface Props { locationId: number | 'new'; onBack: () => void; onDeleted: () => void; onCreated: (id: number) => void; }

const inputClass = 'h-10 px-3 rounded-lg bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.08)] text-white text-[14px] placeholder-[rgba(255,255,255,0.3)] focus:outline-none focus:ring-[rgba(255,255,255,0.2)]';
const areaClass = 'px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.08)] text-white text-[14px] placeholder-[rgba(255,255,255,0.3)] focus:outline-none focus:ring-[rgba(255,255,255,0.2)]';


const OMGEVING_PRESETS: Array<{ key: string; label: string }> = [
  { key: 'centrum', label: 'Centrum' },
  { key: 'winkelstraat', label: 'Winkelstraat' },
  { key: 'park', label: 'Park' },
  { key: 'plein', label: 'Plein' },
  { key: 'stationsplein', label: 'Stationsplein' },
];


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-[13px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.6)] mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 mb-3 ${className}`}>
      <span className="text-[12px] text-[rgba(255,255,255,0.6)]">{label}</span>
      {children}
    </label>
  );
}

function MultiChips({
  options, values, onChange, allowCustom = false,
}: {
  options: ReadonlyArray<Optie>;
  values: string[];
  onChange: (next: string[]) => void;
  allowCustom?: boolean;
}) {
  const [customInput, setCustomInput] = useState('');

  const toggle = (key: string) => {
    onChange(values.includes(key) ? values.filter((v) => v !== key) : [...values, key]);
  };

  const addCustom = () => {
    const v = customInput.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setCustomInput('');
  };

  const presetKeys = new Set(options.map((o) => o.key));
  const customValues = values.filter((v) => !presetKeys.has(v));

  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {options.map((o) => (
        <label key={o.key} className="flex items-center gap-1.5 text-[13px] text-white cursor-pointer px-3 py-1.5 rounded-lg ring-1 transition-colors"
          style={{ background: values.includes(o.key) ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)', boxShadow: values.includes(o.key) ? '0 0 0 1px rgba(255,255,255,0.25)' : '0 0 0 1px rgba(255,255,255,0.08)' }}>
          <input type="checkbox" className="sr-only" checked={values.includes(o.key)} onChange={() => toggle(o.key)} />
          {o.label}
        </label>
      ))}
      {customValues.map((v) => (
        <span key={v} className="flex items-center gap-1.5 text-[13px] text-white px-3 py-1.5 rounded-lg ring-1"
          style={{ background: 'rgba(255,255,255,0.12)', boxShadow: '0 0 0 1px rgba(255,255,255,0.25)' }}>
          {v}
          <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="text-[rgba(255,255,255,0.5)] hover:text-white cursor-pointer leading-none">×</button>
        </span>
      ))}
      {allowCustom && (
        <input
          className={`${inputClass} h-8 text-[13px] w-32`}
          placeholder="anders…"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          onBlur={addCustom}
        />
      )}
    </div>
  );
}

type FormState = LocationWriteInput & { lat: number | null; lng: number | null; photos: LocationPhoto[] };

function emptyForm(): FormState {
  return {
    naam: '', land: 'Nederland', adres: '',
    lat: null, lng: null,
    omgevingType: 'centrum', orientatie: 'N', eigendomType: 'particulier',
    vergunningNodig: false, vergunningLink: null, truckBereikbaar: false,
    geschiktActivatie: false, geschiktSampling: false, geschiktHotspot: false, geschiktAnder: null,
    stroom: false, verlichting: false,
    stroomvoorzieningTypes: [], aanvraagtijd: '', volumeSampling: '', doelgroepen: [], eventTypes: [],
    lengte: null, breedte: null, m2: null,
    notities: '',
    contacts: [{ naam: '', email: null, telefoon: null, website: null, rol: null }],
    costs: [{ label: 'Locatiehuur', bedragCents: 0 }],
    photos: [],
  };
}

function fromLocation(loc: Location): FormState {
  return {
    naam: loc.naam, land: loc.land, adres: loc.adres,
    lat: loc.lat, lng: loc.lng,
    omgevingType: loc.omgevingType, orientatie: loc.orientatie, eigendomType: loc.eigendomType,
    vergunningNodig: loc.vergunningNodig, vergunningLink: loc.vergunningLink, truckBereikbaar: loc.truckBereikbaar,
    geschiktActivatie: loc.geschiktActivatie, geschiktSampling: loc.geschiktSampling, geschiktHotspot: loc.geschiktHotspot, geschiktAnder: loc.geschiktAnder,
    stroom: loc.stroom, verlichting: loc.verlichting,
    stroomvoorzieningTypes: loc.stroomvoorzieningTypes, aanvraagtijd: loc.aanvraagtijd, volumeSampling: loc.volumeSampling, doelgroepen: loc.doelgroepen, eventTypes: loc.eventTypes,
    lengte: loc.lengte, breedte: loc.breedte, m2: loc.m2,
    notities: loc.notities,
    contacts: loc.contacts.length === 0
      ? [{ naam: '', email: null, telefoon: null, website: null, rol: null }]
      : loc.contacts.map(({ id: _i, locationId: _l, order: _o, ...rest }) => rest),
    costs: loc.costs.map(({ id: _i, locationId: _l, order: _o, ...rest }) => rest),
    photos: loc.photos,
  };
}

export default function LocatieDetailPage({ locationId, onBack, onDeleted, onCreated }: Props) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [originalLocation, setOriginalLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(locationId !== 'new');
  const [adresSuggestions, setAdresSuggestions] = useState<AdresSuggestion[]>([]);
  const adresDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (locationId === 'new') return;
    fetchLocation(locationId).then((loc) => {
      setOriginalLocation(loc);
      setForm(fromLocation(loc));
    }).finally(() => setLoading(false));
  }, [locationId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const searchAdres = (query: string, land: string) => {
    if (adresDebounceRef.current) clearTimeout(adresDebounceRef.current);
    if (query.trim().length < 3) { setAdresSuggestions([]); return; }
    adresDebounceRef.current = setTimeout(async () => {
      try {
        const data = await suggestAdres(query, land);
        setAdresSuggestions(data);
      } catch { setAdresSuggestions([]); }
    }, 300);
  };

  const handleAdresChange = (value: string) => {
    setForm((f) => ({ ...f, adres: value, lat: null, lng: null }));
    searchAdres(value, form.land);
  };

  const selectAdres = (s: AdresSuggestion) => {
    setForm((f) => ({ ...f, adres: s.display_name, lat: s.lat, lng: s.lng }));
    setAdresSuggestions([]);
  };

  const onLengteBreedteChange = (lengte: number | null, breedte: number | null) => {
    setForm((f) => ({
      ...f,
      lengte, breedte,
      m2: (lengte != null && breedte != null) ? +(lengte * breedte).toFixed(2) : f.m2,
    }));
  };

  const save = async () => {
    if (!form.naam.trim()) return; // Geen lege locaties aanmaken
    const { lat: _la, lng: _ln, photos: _ph, ...writeInput } = form;
    if (locationId === 'new') {
      const created = await createLocation(writeInput);
      onCreated(created.id);
    } else {
      const updated = await updateLocation(locationId, writeInput);
      setOriginalLocation(updated);
    }
  };

  // Auto-save bij elke form-wijziging
  const saveStatus = useAutoSave(form, save, { enabled: !!form.naam.trim() });

  const del = async () => {
    if (locationId === 'new') return;
    if (!confirm('Weet je zeker dat je deze locatie wilt verwijderen?')) return;
    try {
      await deleteLocation(locationId);
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { error?: string; projects?: Array<{ projectNumber: string; name: string | null }> } } };
      if (err.response?.status === 409 && err.response.data?.projects) {
        const list = err.response.data.projects
          .map((p) => `• ${p.projectNumber}${p.name ? ` — ${p.name}` : ''}`)
          .join('\n');
        if (!confirm(`Deze locatie is gekoppeld aan:\n\n${list}\n\nBij verwijderen gaan ook de opmerkingen/data in die projecten voor deze locatie verloren. Toch doorgaan?`)) {
          return;
        }
        await deleteLocation(locationId, true);
      } else {
        toast.error(err.response?.data?.error || 'Verwijderen mislukt');
        return;
      }
    }
    toast.success('Locatie verwijderd');
    onDeleted();
  };


  if (loading) return <div className="p-8 text-[rgba(255,255,255,0.5)]">Laden…</div>;

  const projects = originalLocation?.projects ?? [];

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="sticky top-0 z-20 -mx-6 px-6 py-3 mb-6 bg-[rgba(15,31,29,0.95)] backdrop-blur border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between">
        <button onClick={() => {
          if (saveStatus === 'saving' && !confirm('Bezig met opslaan — toch terug?')) return;
          onBack();
        }} className="text-accent text-sm hover:opacity-80 cursor-pointer">← Terug</button>
        <h1 className="text-white font-semibold truncate flex items-center gap-2">
          {originalLocation?.code && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-accent-teal/20 text-accent-teal">{originalLocation.code}</span>
          )}
          {form.naam || 'Nieuwe locatie'}
        </h1>
        <div className="flex items-center gap-3">
          <SaveIndicator status={saveStatus} />
          {locationId !== 'new' && (
            <button onClick={del} className="h-9 px-3 rounded-lg bg-red-500/10 ring-1 ring-red-500/20 text-red-400 text-[13px] font-medium hover:bg-red-500/20 cursor-pointer">Verwijderen</button>
          )}
        </div>
      </div>

      <Section title="Algemeen">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Naam"><input className={inputClass} value={form.naam} onChange={(e) => set('naam', e.target.value)} /></Field>
          <Field label="Land">
            <select className={inputClass} value={form.land} onChange={(e) => set('land', e.target.value)}>
              {EUROPESE_LANDEN_PRIO.map((l) => <option key={l} value={l}>{l}</option>)}
              <option disabled>──────────</option>
              {EUROPESE_LANDEN_REST.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Adres">
          <div className="relative">
            <input
              className={`${inputClass} w-full`}
              placeholder={`Zoek adres in ${form.land}…`}
              value={form.adres}
              onChange={(e) => handleAdresChange(e.target.value)}
              onBlur={() => setTimeout(() => setAdresSuggestions([]), 200)}
            />
            {adresSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-bg-surface ring-1 ring-[rgba(255,255,255,0.12)] rounded-lg shadow-xl z-10 max-h-60 overflow-y-auto">
                {adresSuggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectAdres(s)}
                    className="w-full px-3 py-2 text-left text-white text-[13px] hover:bg-[rgba(255,255,255,0.08)] cursor-pointer truncate"
                  >
                    {s.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Field>
        <LocatieMap lat={form.lat} lng={form.lng} address={form.adres} />
      </Section>

      <Section title="Omgeving">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Omgevingstype">
            {(() => {
              const isCustom = !OMGEVING_PRESETS.some((p) => p.key === form.omgevingType);
              return (
                <>
                  <select
                    className={inputClass}
                    value={isCustom ? '__anders__' : form.omgevingType}
                    onChange={(e) => {
                      const v = e.target.value;
                      set('omgevingType', (v === '__anders__' ? '' : v) as OmgevingType);
                    }}
                  >
                    {OMGEVING_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                    <option value="__anders__">Andere…</option>
                  </select>
                  {isCustom && (
                    <input
                      className={`${inputClass} mt-2`}
                      placeholder="Beschrijf het omgevingstype"
                      value={form.omgevingType}
                      onChange={(e) => set('omgevingType', e.target.value as OmgevingType)}
                      autoFocus
                    />
                  )}
                </>
              );
            })()}
          </Field>
          <Field label="Aanlooprichting">
            {(() => {
              const DIRS = ['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW'];
              const isCustom = !DIRS.includes(form.orientatie);
              return (
                <>
                  <select
                    className={inputClass}
                    value={isCustom ? '__anders__' : form.orientatie}
                    onChange={(e) => {
                      const v = e.target.value;
                      set('orientatie', (v === '__anders__' ? '' : v) as Orientatie);
                    }}
                  >
                    {DIRS.map((o) => <option key={o} value={o}>{o}</option>)}
                    <option value="__anders__">Andere…</option>
                  </select>
                  {isCustom && (
                    <input
                      className={`${inputClass} mt-2`}
                      placeholder="Beschrijf de aanlooprichting"
                      value={form.orientatie}
                      onChange={(e) => set('orientatie', e.target.value as Orientatie)}
                      autoFocus
                    />
                  )}
                </>
              );
            })()}
          </Field>
        </div>
      </Section>

      <Section title="Geschikt voor">
        <div className="flex items-center gap-6 flex-wrap">
          <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer">
            <input type="checkbox" checked={form.geschiktActivatie} onChange={(e) => set('geschiktActivatie', e.target.checked)} /> Activatie
          </label>
          <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer">
            <input type="checkbox" checked={form.geschiktSampling} onChange={(e) => set('geschiktSampling', e.target.checked)} /> Mass sampling
          </label>
          <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer">
            <input type="checkbox" checked={form.geschiktHotspot} onChange={(e) => set('geschiktHotspot', e.target.checked)} /> Hotspot sampling
          </label>
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <span className="text-[14px] text-white whitespace-nowrap">Ander:</span>
            <input
              className={`${inputClass} flex-1 h-9`}
              placeholder="bv. Festivals, beurzen…"
              value={form.geschiktAnder ?? ''}
              onChange={(e) => set('geschiktAnder', e.target.value || null)}
            />
          </div>
        </div>
      </Section>

      <Section title="Afmetingen">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Lengte (m)"><input type="number" className={inputClass} value={form.lengte ?? ''} onChange={(e) => onLengteBreedteChange(e.target.value ? +e.target.value : null, form.breedte)} /></Field>
          <Field label="Breedte (m)"><input type="number" className={inputClass} value={form.breedte ?? ''} onChange={(e) => onLengteBreedteChange(form.lengte, e.target.value ? +e.target.value : null)} /></Field>
          <Field label="m² (handmatig overschrijfbaar)"><input type="number" className={inputClass} value={form.m2 ?? ''} onChange={(e) => set('m2', e.target.value ? +e.target.value : null)} /></Field>
        </div>
      </Section>

      <Section title="Voorzieningen">
        <div className="flex items-center gap-8 flex-wrap">
          <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer">
            <input type="checkbox" checked={form.stroom} onChange={(e) => {
              setForm((f) => ({ ...f, stroom: e.target.checked, stroomvoorzieningTypes: e.target.checked ? f.stroomvoorzieningTypes : [] }));
            }} /> Stroom aanwezig
          </label>
          <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer"><input type="checkbox" checked={form.verlichting} onChange={(e) => set('verlichting', e.target.checked)} /> Verlichting aanwezig</label>
          <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer"><input type="checkbox" checked={form.truckBereikbaar} onChange={(e) => set('truckBereikbaar', e.target.checked)} /> Bereikbaar met bakwagen</label>
        </div>
        {form.stroom && (
          <Field label="Stroomvoorziening" className="mt-3">
            <MultiChips
              options={STROOMVOORZIENING_PRESETS}
              values={form.stroomvoorzieningTypes}
              onChange={(v) => set('stroomvoorzieningTypes', v)}
              allowCustom
            />
          </Field>
        )}
      </Section>

      <Section title="Inzet & doelgroep">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Aanvraagtijd">
            <select className={inputClass} value={form.aanvraagtijd} onChange={(e) => set('aanvraagtijd', e.target.value)}>
              <option value="">—</option>
              {AANVRAAGTIJD_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Volume sampling (passanten/dag)">
            <select className={inputClass} value={form.volumeSampling} onChange={(e) => set('volumeSampling', e.target.value)}>
              <option value="">—</option>
              {VOLUME_SAMPLING_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Doelgroepen">
          <MultiChips
            options={DOELGROEP_PRESETS}
            values={form.doelgroepen}
            onChange={(v) => set('doelgroepen', v)}
            allowCustom
          />
        </Field>
        <Field label="Event type">
          <MultiChips
            options={EVENT_TYPE_PRESETS}
            values={form.eventTypes}
            onChange={(v) => set('eventTypes', v)}
            allowCustom
          />
        </Field>
      </Section>

      <Section title="Eigendomstype">
        {(() => {
          const EIG_PRESETS = ['particulier', 'gemeentelijk', 'bedrijf'];
          const isCustom = !EIG_PRESETS.includes(form.eigendomType);
          return (
            <div className="flex items-center gap-8 flex-wrap">
              <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer"><input type="radio" checked={form.eigendomType === 'particulier'} onChange={() => set('eigendomType', 'particulier')} /> Particulier</label>
              <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer"><input type="radio" checked={form.eigendomType === 'gemeentelijk'} onChange={() => set('eigendomType', 'gemeentelijk')} /> Gemeente</label>
              <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer"><input type="radio" checked={form.eigendomType === 'bedrijf'} onChange={() => set('eigendomType', 'bedrijf')} /> Bedrijf</label>
              <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer"><input type="radio" checked={isCustom} onChange={() => set('eigendomType', '' as EigendomType)} /> Anders</label>
              {isCustom && (
                <input
                  className={`${inputClass} flex-1 min-w-[160px] h-9`}
                  placeholder="Beschrijf het eigendomstype"
                  value={form.eigendomType}
                  onChange={(e) => set('eigendomType', e.target.value as EigendomType)}
                  autoFocus
                />
              )}
            </div>
          );
        })()}
      </Section>

      <Section title="Vergunning">
        <div className="flex items-center gap-8 flex-wrap mb-3">
          <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer"><input type="radio" checked={form.vergunningNodig === true} onChange={() => set('vergunningNodig', true)} /> Ja</label>
          <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer"><input type="radio" checked={form.vergunningNodig === false} onChange={() => { set('vergunningNodig', false); set('vergunningLink', null); }} /> Nee</label>
        </div>
        {form.vergunningNodig && (
          <Field label="Link waar vergunning aan te vragen"><input className={inputClass} value={form.vergunningLink ?? ''} onChange={(e) => set('vergunningLink', e.target.value || null)} placeholder="https://..." /></Field>
        )}
      </Section>

      <Section title="Contactpersonen">
        <LocatieContactsSection contacts={form.contacts} onChange={(contacts) => set('contacts', contacts)} />
      </Section>

      <Section title="Inschatting Kosten per dag">
        <LocatieCostsSection costs={form.costs} onChange={(costs) => set('costs', costs)} />
      </Section>

      {locationId !== 'new' && typeof locationId === 'number' && (
        <Section title="Foto's">
          <LocatiePhotoManager locationId={locationId} photos={form.photos} onChange={(photos) => set('photos', photos)} />
        </Section>
      )}

      <Section title="Projecten">
        {locationId === 'new' ? (
          <p className="text-[rgba(255,255,255,0.4)] text-[13px] italic">Projecten verschijnen hier nadat de locatie is opgeslagen en aan projecten is gekoppeld.</p>
        ) : projects.length === 0 ? (
          <p className="text-[rgba(255,255,255,0.4)] text-[13px] italic">Deze locatie is nog niet aan projecten gekoppeld.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {projects.map((lp) => (
              <li key={lp.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.08)]">
                <span className="text-[12px] font-mono text-accent-teal">{lp.project.projectNumber}</span>
                <span className="text-white text-[14px]">{lp.project.name || '—'}</span>
                <span className="text-[rgba(255,255,255,0.5)] text-[12px] ml-auto">{lp.project.klant.name}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Notities">
        <textarea className={`${areaClass} w-full`} rows={6} value={form.notities} onChange={(e) => set('notities', e.target.value)} placeholder="Vrije tekst…" />
      </Section>
    </div>
  );
}
