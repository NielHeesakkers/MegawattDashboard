import { useEffect, useState } from 'react';
import { useToast } from '../ui/Toast';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import {
  fetchLocation, createLocation, updateLocation, deleteLocation, geocodeLocation,
  Location, LocationWriteInput, OmgevingType, Orientatie, LocationPhoto,
} from '../../api';
import LocatieMap from './LocatieMap';
import LocatieContactsSection from './LocatieContactsSection';
import LocatieCostsSection from './LocatieCostsSection';
import LocatiePhotoManager from './LocatiePhotoManager';

interface Props { locationId: number | 'new'; onBack: () => void; onDeleted: () => void; onCreated: (id: number) => void; }

const inputClass = 'h-10 px-3 rounded-lg bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.08)] text-white text-[14px] placeholder-[rgba(255,255,255,0.3)] focus:outline-none focus:ring-[rgba(255,255,255,0.2)]';
const areaClass = 'px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.08)] text-white text-[14px] placeholder-[rgba(255,255,255,0.3)] focus:outline-none focus:ring-[rgba(255,255,255,0.2)]';

const EUROPESE_LANDEN_PRIO = ['Nederland', 'België', 'Duitsland'];
const EUROPESE_LANDEN_REST = [
  'Albanië', 'Andorra', 'Bosnië en Herzegovina', 'Bulgarije', 'Cyprus', 'Denemarken', 'Estland',
  'Finland', 'Frankrijk', 'Griekenland', 'Hongarije', 'IJsland', 'Ierland', 'Italië', 'Kosovo',
  'Kroatië', 'Letland', 'Liechtenstein', 'Litouwen', 'Luxemburg', 'Malta', 'Moldavië', 'Monaco',
  'Montenegro', 'Noord-Macedonië', 'Noorwegen', 'Oekraïne', 'Oostenrijk', 'Polen', 'Portugal',
  'Roemenië', 'San Marino', 'Servië', 'Slovenië', 'Slowakije', 'Spanje', 'Tsjechië', 'Turkije',
  'Vaticaanstad', 'Verenigd Koninkrijk', 'Wit-Rusland', 'Zweden', 'Zwitserland',
];

const OMGEVING_PRESETS: Array<{ key: string; label: string }> = [
  { key: 'centrum', label: 'Centrum' },
  { key: 'winkelstraat', label: 'Winkelstraat' },
  { key: 'park', label: 'Park' },
  { key: 'plein', label: 'Plein' },
  { key: 'stationsplein', label: 'Stationsplein' },
];

interface AddressParts { straat: string; huisnummer: string; postcode: string; plaats: string; }

function parseAddress(adres: string): AddressParts {
  const parts = adres.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    // Part 1: straat + huisnummer
    const first = parts[0].match(/^(.+?)\s+(\d+[a-zA-Z\-]*)\s*$/);
    const straat = first ? first[1] : parts[0];
    const huisnummer = first ? first[2] : '';
    // Part 2: postcode (NL/BE/DE patterns) + plaats
    const second = parts[1].match(/^(\d{4}\s?[A-Z]{0,2}|\d{4,5})\s+(.+)$/i);
    const postcode = second ? second[1] : '';
    const plaats = second ? second[2] : parts[1];
    return { straat, huisnummer, postcode, plaats };
  }
  // Fallback: one part, probeer huisnummer achteraan
  const m = adres.match(/^(.+?)\s+(\d+[a-zA-Z\-]*)\s*$/);
  if (m) return { straat: m[1], huisnummer: m[2], postcode: '', plaats: '' };
  return { straat: adres, huisnummer: '', postcode: '', plaats: '' };
}

function formatAddressParts(p: AddressParts): string {
  const line1 = [p.straat, p.huisnummer].filter(Boolean).join(' ').trim();
  const line2 = [p.postcode, p.plaats].filter(Boolean).join(' ').trim();
  return [line1, line2].filter(Boolean).join(', ');
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-[13px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.6)] mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 mb-3">
      <span className="text-[12px] text-[rgba(255,255,255,0.6)]">{label}</span>
      {children}
    </label>
  );
}

type FormState = LocationWriteInput & { lat: number | null; lng: number | null; photos: LocationPhoto[] };

function emptyForm(): FormState {
  return {
    naam: '', land: 'Nederland', adres: '',
    lat: null, lng: null,
    omgevingType: 'centrum', orientatie: 'N', eigendomType: 'particulier',
    vergunningNodig: false, vergunningLink: null, truckBereikbaar: false,
    geschiktActivatie: false, geschiktSampling: false,
    stroom: false, verlichting: false,
    lengte: null, breedte: null, m2: null,
    notities: '',
    contacts: [],
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
    geschiktActivatie: loc.geschiktActivatie, geschiktSampling: loc.geschiktSampling,
    stroom: loc.stroom, verlichting: loc.verlichting,
    lengte: loc.lengte, breedte: loc.breedte, m2: loc.m2,
    notities: loc.notities,
    contacts: loc.contacts.map(({ id: _i, locationId: _l, order: _o, ...rest }) => rest),
    costs: loc.costs.map(({ id: _i, locationId: _l, order: _o, ...rest }) => rest),
    photos: loc.photos,
  };
}

export default function LocatieDetailPage({ locationId, onBack, onDeleted, onCreated }: Props) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [originalLocation, setOriginalLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(locationId !== 'new');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (locationId === 'new') return;
    fetchLocation(locationId).then((loc) => { setOriginalLocation(loc); setForm(fromLocation(loc)); }).finally(() => setLoading(false));
  }, [locationId]);

  const isDirty = (() => {
    const normalize = (s: FormState) => JSON.stringify({ ...s, photos: null, lat: null, lng: null });
    if (locationId === 'new') {
      return normalize(form) !== normalize(emptyForm());
    }
    if (!originalLocation) return false;
    return normalize(form) !== normalize(fromLocation(originalLocation));
  })();

  useUnsavedChanges(isDirty);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const onLengteBreedteChange = (lengte: number | null, breedte: number | null) => {
    setForm((f) => ({
      ...f,
      lengte, breedte,
      m2: (lengte != null && breedte != null) ? +(lengte * breedte).toFixed(2) : f.m2,
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const { lat: _la, lng: _ln, photos: _ph, ...writeInput } = form;
      if (locationId === 'new') {
        const created = await createLocation(writeInput);
        toast.success('Locatie opgeslagen');
        onCreated(created.id);
      } else {
        const updated = await updateLocation(locationId, writeInput);
        setOriginalLocation(updated);
        setForm(fromLocation(updated));
        toast.success('Wijzigingen opgeslagen');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Opslaan mislukt');
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (locationId === 'new') return;
    if (!confirm('Weet je zeker dat je deze locatie wilt verwijderen?')) return;
    await deleteLocation(locationId);
    toast.success('Locatie verwijderd');
    onDeleted();
  };

  const reGeocode = async () => {
    if (locationId === 'new') { toast.error('Sla eerst op voordat je kunt geocoden'); return; }
    const result = await geocodeLocation(locationId);
    setForm((f) => ({ ...f, lat: result.lat, lng: result.lng, adres: result.found ? result.adres : f.adres }));
    if (result.found) toast.success('Adres en coördinaten bijgewerkt');
    else toast.error('Adres niet gevonden');
  };

  if (loading) return <div className="p-8 text-[rgba(255,255,255,0.5)]">Laden…</div>;

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="sticky top-0 z-20 -mx-6 px-6 py-3 mb-6 bg-[rgba(15,31,29,0.95)] backdrop-blur border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between">
        <button onClick={() => {
          if (isDirty && !confirm('Je hebt niet-opgeslagen wijzigingen. Toch terug?')) return;
          onBack();
        }} className="text-accent text-sm hover:opacity-80 cursor-pointer">← Terug</button>
        <h1 className="text-white font-semibold truncate">{form.naam || 'Nieuwe locatie'}</h1>
        <div className="flex gap-2">
          {locationId !== 'new' && (
            <button onClick={del} className="h-9 px-3 rounded-lg bg-red-500/10 ring-1 ring-red-500/20 text-red-400 text-[13px] font-medium hover:bg-red-500/20 cursor-pointer">Verwijderen</button>
          )}
          <button onClick={save} disabled={saving} className="h-9 px-4 rounded-lg bg-accent-teal text-[#1a3a38] text-[13px] font-semibold hover:opacity-85 cursor-pointer disabled:opacity-50">
            {saving ? 'Opslaan…' : 'Opslaan'}
          </button>
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
          {(() => {
            const addr = parseAddress(form.adres);
            const upd = (patch: Partial<AddressParts>) => set('adres', formatAddressParts({ ...addr, ...patch }));
            return (
              <div className="grid grid-cols-12 gap-2">
                <input className={`${inputClass} col-span-5`} placeholder="Straat" value={addr.straat} onChange={(e) => upd({ straat: e.target.value })} />
                <input className={`${inputClass} col-span-2`} placeholder="Nr." value={addr.huisnummer} onChange={(e) => upd({ huisnummer: e.target.value })} />
                <input className={`${inputClass} col-span-2`} placeholder="Postcode" value={addr.postcode} onChange={(e) => upd({ postcode: e.target.value })} />
                <input className={`${inputClass} col-span-3`} placeholder="Plaats" value={addr.plaats} onChange={(e) => upd({ plaats: e.target.value })} />
              </div>
            );
          })()}
        </Field>
        <div className="flex gap-3 mb-3">
          <button onClick={reGeocode} className="h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.06)] ring-1 ring-[rgba(255,255,255,0.15)] text-white text-[12px] hover:bg-[rgba(255,255,255,0.12)] cursor-pointer">Geocode adres</button>
        </div>
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
          <Field label="Oriëntatie">
            <select className={inputClass} value={form.orientatie} onChange={(e) => set('orientatie', e.target.value as Orientatie)}>
              {(['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW'] as const).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Geschikt voor">
        <label className="flex items-center gap-2 text-[14px] text-white mb-2 cursor-pointer">
          <input type="checkbox" checked={form.geschiktActivatie} onChange={(e) => set('geschiktActivatie', e.target.checked)} /> Activatie
        </label>
        <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer">
          <input type="checkbox" checked={form.geschiktSampling} onChange={(e) => set('geschiktSampling', e.target.checked)} /> Mass sampling
        </label>
      </Section>

      <Section title="Afmetingen">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Lengte (m)"><input type="number" className={inputClass} value={form.lengte ?? ''} onChange={(e) => onLengteBreedteChange(e.target.value ? +e.target.value : null, form.breedte)} /></Field>
          <Field label="Breedte (m)"><input type="number" className={inputClass} value={form.breedte ?? ''} onChange={(e) => onLengteBreedteChange(form.lengte, e.target.value ? +e.target.value : null)} /></Field>
          <Field label="m² (handmatig overschrijfbaar)"><input type="number" className={inputClass} value={form.m2 ?? ''} onChange={(e) => set('m2', e.target.value ? +e.target.value : null)} /></Field>
        </div>
      </Section>

      <Section title="Voorzieningen">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer"><input type="checkbox" checked={form.stroom} onChange={(e) => set('stroom', e.target.checked)} /> Stroom aanwezig</label>
          <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer"><input type="checkbox" checked={form.verlichting} onChange={(e) => set('verlichting', e.target.checked)} /> Verlichting</label>
          <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer"><input type="checkbox" checked={form.truckBereikbaar} onChange={(e) => set('truckBereikbaar', e.target.checked)} /> Bereikbaar met bakwagen</label>
          <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer"><input type="checkbox" checked={form.vergunningNodig} onChange={(e) => set('vergunningNodig', e.target.checked)} /> Vergunning nodig</label>
        </div>
        {form.vergunningNodig && (
          <Field label="Link waar vergunning aan te vragen"><input className={inputClass} value={form.vergunningLink ?? ''} onChange={(e) => set('vergunningLink', e.target.value || null)} placeholder="https://..." /></Field>
        )}
        <Field label="Eigendomstype">
          <div className="flex gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer"><input type="radio" checked={form.eigendomType === 'particulier'} onChange={() => set('eigendomType', 'particulier')} /> Particulier</label>
            <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer"><input type="radio" checked={form.eigendomType === 'gemeentelijk'} onChange={() => set('eigendomType', 'gemeentelijk')} /> Gemeentelijk</label>
            <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer"><input type="radio" checked={form.eigendomType === 'bedrijf'} onChange={() => set('eigendomType', 'bedrijf' as any)} /> Bedrijf</label>
          </div>
        </Field>
      </Section>

      <Section title="Notities">
        <textarea className={areaClass} rows={5} value={form.notities} onChange={(e) => set('notities', e.target.value)} placeholder="Vrije tekst…" />
      </Section>

      <Section title="Contactpersonen">
        <LocatieContactsSection contacts={form.contacts} onChange={(contacts) => set('contacts', contacts)} />
      </Section>

      <Section title="Kosten">
        <LocatieCostsSection costs={form.costs} onChange={(costs) => set('costs', costs)} />
      </Section>

      {locationId !== 'new' && typeof locationId === 'number' && (
        <Section title="Foto's">
          <LocatiePhotoManager locationId={locationId} photos={form.photos} onChange={(photos) => set('photos', photos)} />
        </Section>
      )}
    </div>
  );
}
