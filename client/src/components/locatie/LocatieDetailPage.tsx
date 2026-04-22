import { useEffect, useState } from 'react';
import { useToast } from '../ui/Toast';
import {
  fetchLocation, createLocation, updateLocation, deleteLocation, geocodeLocation,
  Location, LocationWriteInput, OmgevingType, Orientatie,
} from '../../api';
import LocatieMap from './LocatieMap';

interface Props { locationId: number | 'new'; onBack: () => void; onDeleted: () => void; }

type FormState = LocationWriteInput & { lat: number | null; lng: number | null };

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
  };
}

export default function LocatieDetailPage({ locationId, onBack, onDeleted }: Props) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [originalLocation, setOriginalLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(locationId !== 'new');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (locationId === 'new') return;
    fetchLocation(locationId).then((loc) => { setOriginalLocation(loc); setForm(fromLocation(loc)); }).finally(() => setLoading(false));
  }, [locationId]);

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
      const { lat: _la, lng: _ln, ...writeInput } = form;
      if (locationId === 'new') {
        const created = await createLocation(writeInput);
        toast.success('Locatie opgeslagen');
        setOriginalLocation(created);
        setForm(fromLocation(created));
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
    setForm((f) => ({ ...f, lat: result.lat, lng: result.lng }));
    if (result.found) toast.success('Coördinaten bijgewerkt');
    else toast.error('Adres niet gevonden');
  };

  if (loading) return <div className="p-8 text-[rgba(255,255,255,0.5)]">Laden…</div>;

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mb-8">
      <h2 className="text-[13px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.6)] mb-3">{title}</h2>
      {children}
    </section>
  );

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label className="flex flex-col gap-1.5 mb-3">
      <span className="text-[12px] text-[rgba(255,255,255,0.6)]">{label}</span>
      {children}
    </label>
  );

  const inputClass = 'h-10 px-3 rounded-lg bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.08)] text-white text-[14px] placeholder-[rgba(255,255,255,0.3)] focus:outline-none focus:ring-[rgba(255,255,255,0.2)]';
  const areaClass = 'px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.08)] text-white text-[14px] placeholder-[rgba(255,255,255,0.3)] focus:outline-none focus:ring-[rgba(255,255,255,0.2)]';

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="sticky top-0 z-20 -mx-6 px-6 py-3 mb-6 bg-[rgba(15,31,29,0.95)] backdrop-blur border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between">
        <button onClick={onBack} className="text-accent text-sm hover:opacity-80 cursor-pointer">← Terug</button>
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
          <Field label="Land"><input className={inputClass} value={form.land} onChange={(e) => set('land', e.target.value)} placeholder="Nederland" /></Field>
        </div>
        <Field label="Adres">
          <textarea className={areaClass} rows={2} value={form.adres} onChange={(e) => set('adres', e.target.value)} />
        </Field>
        <div className="flex gap-3 mb-3">
          <button onClick={reGeocode} className="h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.06)] ring-1 ring-[rgba(255,255,255,0.15)] text-white text-[12px] hover:bg-[rgba(255,255,255,0.12)] cursor-pointer">Geocode adres</button>
        </div>
        <LocatieMap lat={form.lat} lng={form.lng} address={form.adres} />
      </Section>

      <Section title="Omgeving">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Omgevingstype">
            <select className={inputClass} value={form.omgevingType} onChange={(e) => set('omgevingType', e.target.value as OmgevingType)}>
              <option value="centrum">Centrum</option>
              <option value="winkelstraat">Winkelstraat</option>
              <option value="park">Park</option>
              <option value="plein">Plein</option>
              <option value="stationsplein">Stationsplein</option>
            </select>
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
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer"><input type="radio" checked={form.eigendomType === 'particulier'} onChange={() => set('eigendomType', 'particulier')} /> Particulier</label>
            <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer"><input type="radio" checked={form.eigendomType === 'gemeentelijk'} onChange={() => set('eigendomType', 'gemeentelijk')} /> Gemeentelijk</label>
          </div>
        </Field>
      </Section>

      <Section title="Notities">
        <textarea className={areaClass} rows={5} value={form.notities} onChange={(e) => set('notities', e.target.value)} placeholder="Vrije tekst…" />
      </Section>

      {locationId !== 'new' && originalLocation && (
        <p className="text-[11px] text-[rgba(255,255,255,0.3)]">Contactpersonen, kosten en foto's komen in Task 16-18.</p>
      )}
    </div>
  );
}
