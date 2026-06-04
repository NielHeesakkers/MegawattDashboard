import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Klant, Activation, Supercharger, ProjectStatus,
  fetchKlanten, fetchProject, fetchSuperchargers,
  createProject, updateProject,
  createActivation, updateActivation, deleteActivation,
} from '../../api';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

const toDateInput = (d: string | null | undefined) => {
  if (!d) return '';
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

interface ScheduleItem { time: string; wat: string; wie: string; bijzonderheden: string }
interface ClothingData { megawatt: string[]; self: string[]; info: string }

const emptyClothing = (): ClothingData => ({ megawatt: [], self: [], info: '' });

function parseClothing(raw: string | null): ClothingData {
  if (!raw) return emptyClothing();
  try {
    const parsed = JSON.parse(raw);
    return { megawatt: parsed.megawatt || [], self: parsed.self || [], info: parsed.info || '' };
  } catch {
    // Legacy: plain text → put in megawatt list
    return { megawatt: raw.split('\n').filter(Boolean), self: [], info: '' };
  }
}

function parseMessages(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* not JSON */ }
  return raw ? [raw] : [];
}

interface SettingData { algemeen: string; letOp: string }

const emptySetting = (): SettingData => ({ algemeen: '', letOp: '' });

function parseSetting(raw: string | null): SettingData {
  if (!raw) return emptySetting();
  try {
    const parsed = JSON.parse(raw);
    return { algemeen: parsed.algemeen || '', letOp: parsed.letOp || '' };
  } catch {
    // Legacy: plain text → put in algemeen
    return { algemeen: raw, letOp: '' };
  }
}

function parseStoreList(raw: string | null): { winkel: string; adres: string }[] {
  if (!raw) return [{ winkel: '', adres: '' }];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: Record<string, string>) => ({
        winkel: item.winkel || '',
        adres: item.adres || '',
      }));
    }
  } catch { /* not JSON — legacy plain text */ }
  // Legacy: plain text → each line as a winkel entry
  const lines = raw.split('\n').filter(Boolean);
  if (lines.length === 0) return [{ winkel: '', adres: '' }];
  return lines.map((line) => ({ winkel: line.trim(), adres: '' }));
}

interface ActivationFormData {
  location: string;
  locationLat: number | null;
  locationLon: number | null;
  locationZoom: number | null;
  date: string;
  startTime: string;
  endTime: string;
  scheduleItems: ScheduleItem[];
  tasks: string[];
  storeList: { winkel: string; adres: string }[];
  photoRequirements: string;
  extraInfo: string;
  locationInfo: string;
  target: string;
  staff: { superchargerId: number; role: string }[];
}

const emptyScheduleItem = (): ScheduleItem => ({ time: '12:00', wat: '', wie: '', bijzonderheden: '' });

const emptyActivationForm = (): ActivationFormData => ({
  location: '', locationLat: null, locationLon: null, locationZoom: null, date: '', startTime: '12:00', endTime: '12:00',
  scheduleItems: [emptyScheduleItem()], tasks: [''], storeList: [{ winkel: '', adres: '' }],
  photoRequirements: '', extraInfo: '', locationInfo: '', target: '', staff: [],
});

function activationToForm(a: Activation): ActivationFormData {
  let scheduleItems: ScheduleItem[] = [];
  try {
    const parsed = JSON.parse(a.scheduleItems || '[]');
    // Migrate old format (time/description) to new format (time/wat/wie/bijzonderheden)
    scheduleItems = parsed.map((item: Record<string, string>) => ({
      time: item.time || '',
      wat: item.wat || item.description || '',
      wie: item.wie || '',
      bijzonderheden: item.bijzonderheden || '',
    }));
  } catch { /* empty */ }
  if (scheduleItems.length === 0) scheduleItems = [emptyScheduleItem()];
  return {
    location: a.location || '',
    locationLat: a.locationLat ?? null,
    locationLon: a.locationLon ?? null,
    locationZoom: a.locationZoom ?? null,
    date: toDateInput(a.date),
    startTime: a.startTime || '',
    endTime: a.endTime || '',
    scheduleItems,
    tasks: parseMessages(a.tasks),
    storeList: parseStoreList(a.storeList),
    photoRequirements: a.photoRequirements || '',
    extraInfo: a.extraInfo || '',
    locationInfo: a.evaluationLink || '',
    target: a.target || '',
    staff: (a.staff || []).map((s) => ({ superchargerId: s.superchargerId, role: s.role })),
  };
}

interface ProjectFormProps {
  projectId?: number;
  onBack?: () => void;
  onCreated?: (id: number) => void;
  /** Wanneer true: verberg de project-basis-fields en toon alleen de Activaties + Senior-evaluatie sectie. */
  showOnlyActivations?: boolean;
}

const inputClass = "w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]";

// Generate time options in 15-minute intervals (00:00 - 23:45)
const timeOptions: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    timeOptions.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}
const textareaClass = `${inputClass} min-h-[40px] resize-none overflow-hidden`;
const labelClass = "block text-text-secondary text-sm mb-1";

// Auto-scaling textarea handler
const autoResize = (e: React.FormEvent<HTMLTextAreaElement>) => {
  const t = e.currentTarget;
  t.style.height = 'auto';
  t.style.height = t.scrollHeight + 'px';
};

// Auto-resize on mount/value change
function AutoTextarea({ value, onChange, placeholder, className }: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      onInput={autoResize}
      placeholder={placeholder}
      rows={1}
      className={className || textareaClass}
    />
  );
}

// Reusable list-with-plus component
function ListInput({ items, onChange, placeholder }: { items: string[]; onChange: (items: string[]) => void; placeholder?: string }) {
  // Always show at least 1 row
  const rows = items.length > 0 ? items : [''];
  const update = (idx: number, value: string) => {
    const next = [...rows];
    next[idx] = value;
    onChange(next);
  };
  const remove = (idx: number) => {
    if (rows.length <= 1) { onChange(['']); return; }
    onChange(rows.filter((_, i) => i !== idx));
  };
  const add = () => onChange([...rows, '']);

  return (
    <div>
      {rows.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2 mb-1.5">
          <input type="text" value={item} onChange={(e) => update(idx, e.target.value)} placeholder={placeholder} className={inputClass} />
          {rows.length > 1 && (
            <button type="button" onClick={() => remove(idx)} className="text-red-400 hover:opacity-80 text-sm shrink-0 cursor-pointer">✕</button>
          )}
        </div>
      ))}
      <button type="button" onClick={add} className="text-accent-teal text-sm hover:opacity-80 cursor-pointer">+</button>
    </div>
  );
}

// ─── Star Rating Component ───────────────────────────────────────
function StarRating({ value, onChange, max = 10 }: { value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="cursor-pointer text-xl leading-none transition-colors"
          style={{ color: n <= value ? '#facc15' : 'rgba(255,255,255,0.2)' }}
          title={String(n)}
        >
          {n <= value ? '\u2605' : '\u2606'}
        </button>
      ))}
      {value > 0 && <span className="text-text-secondary text-sm ml-2 self-center">{value}/{max}</span>}
    </div>
  );
}

// ─── Likert Table Component ──────────────────────────────────────
function LikertTable({ rows, columns, values, onChange }: {
  rows: string[];
  columns: string[];
  values: Record<string, number>;
  onChange: (row: string, col: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left text-text-secondary py-2 pr-4 font-normal"></th>
            {columns.map((c) => (
              <th key={c} className="text-center text-text-secondary py-2 px-2 font-normal min-w-[40px]">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row} className="border-t border-[rgba(255,255,255,0.06)]">
              <td className="text-text-primary py-2 pr-4 whitespace-nowrap">{row}</td>
              {columns.map((_, ci) => (
                <td key={ci} className="text-center py-2 px-2">
                  <input
                    type="radio"
                    name={`likert-${row}`}
                    checked={values[row] === ci + 1}
                    onChange={() => onChange(row, ci + 1)}
                    className="accent-accent-teal cursor-pointer w-4 h-4"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Evaluation Form Types & Defaults ────────────────────────────
interface SuperchargerEval {
  naam: string;
  cijfer: number;
  feedback: string;
}

interface EvalFormData {
  // Section 1
  functie: string;
  naamSenior: string;
  datumActivatie: string;
  plaatsActivatie: string;
  cijferWeer: number;
  beschrijvingDag: string;
  beschrijvingGoudbeer: string;
  // Section 2
  targetBehaald: string;
  targetTips: string;
  targetWaromNiet: string;
  aantalSamples: string;
  drukte: Record<string, number>;
  drukteToelichting: string;
  aanloop: number;
  aanloopToelichting: string;
  // Section 3
  locatieScore: number;
  locatieDoorloop: number;
  locatieOpnieuw: number;
  locatieFeedbackKeuze: string;
  locatieFeedback: string;
  // Section 4
  doelgroepAanwezig: number;
  doelgroepFeedbackKeuze: string;
  doelgroepFeedback: string;
  profielConsument: string;
  reactieConsument: string;
  vraagConsument: string;
  // Section 5
  materialenIngeladen: string;
  materialenOntbreken: string;
  materialenSchoon: string;
  beschadigingen: string;
  beschadigingenBeschrijving: string;
  materialenVervoer: number;
  feedbackSetting: string;
  // Section 6
  aantalSuperchargers: number;
  superchargerEvals: SuperchargerEval[];
}

const emptyEvalForm = (): EvalFormData => ({
  functie: '',
  naamSenior: '',
  datumActivatie: '',
  plaatsActivatie: '',
  cijferWeer: 0,
  beschrijvingDag: '',
  beschrijvingGoudbeer: '',
  targetBehaald: '',
  targetTips: '',
  targetWaromNiet: '',
  aantalSamples: '',
  drukte: { 'In de ochtend': 0, 'In de middag': 0, 'In de avond': 0 },
  drukteToelichting: '',
  aanloop: 0,
  aanloopToelichting: '',
  locatieScore: 0,
  locatieDoorloop: 0,
  locatieOpnieuw: 0,
  locatieFeedbackKeuze: '',
  locatieFeedback: '',
  doelgroepAanwezig: 0,
  doelgroepFeedbackKeuze: '',
  doelgroepFeedback: '',
  profielConsument: '',
  reactieConsument: '',
  vraagConsument: '',
  materialenIngeladen: '',
  materialenOntbreken: '',
  materialenSchoon: '',
  beschadigingen: '',
  beschadigingenBeschrijving: '',
  materialenVervoer: 0,
  feedbackSetting: '',
  aantalSuperchargers: 0,
  superchargerEvals: [],
});

export default function ProjectForm({ projectId, onBack, onCreated, showOnlyActivations }: ProjectFormProps = {}) {
  const params = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const id = projectId !== undefined ? String(projectId) : (params.id ?? params.projectId);
  const isEdit = Boolean(id);

  const [klanten, setKlanten] = useState<Klant[]>([]);
  const [superchargers, setSuperchargers] = useState<Supercharger[]>([]);
  const [form, setForm] = useState({
    klantId: 0,
    projectNumber: '',
    name: '',
    startDate: '',
    endDate: '',
    contactPerson: '',
    email: '',
    status: 'active' as ProjectStatus,
    campaignDescription: '',
    campaignMessages: [] as string[],
    campaignTargetAudience: '',
    clothing: emptyClothing(),
    setting: emptySetting(),
    extraInfo: '',
  });
  const [activations, setActivations] = useState<Activation[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [actForm, setActForm] = useState<ActivationFormData>(emptyActivationForm());
  const [saving, setSaving] = useState(false);
  const [savingActivation, setSavingActivation] = useState(false);
  const projectSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activationSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);
  const [deletingActivation, setDeletingActivation] = useState<Activation | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [staffSearchOpen, setStaffSearchOpen] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const staffSearchRef = useRef<HTMLInputElement>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [mapLocked, setMapLocked] = useState(false);
  const [pinLocked, setPinLocked] = useState(false);
  const locationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storeAddressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [storeAddressSuggestions, setStoreAddressSuggestions] = useState<{ display_name: string }[]>([]);
  const [activeStoreIdx, setActiveStoreIdx] = useState<number | null>(null);
  const [projectOpen, setProjectOpen] = useState(true);
  const [activationsOpen, setActivationsOpen] = useState(true);
  const [evaluationsOpen, setEvaluationsOpen] = useState(true);
  const [evalForm, setEvalForm] = useState<EvalFormData>(emptyEvalForm());
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const load = async () => {
      const [k, sc] = await Promise.all([fetchKlanten(), fetchSuperchargers()]);
      setKlanten(k);
      setSuperchargers(sc);

      if (id) {
        const project = await fetchProject(Number(id));
        setForm({
          klantId: project.klantId,
          projectNumber: project.projectNumber,
          name: project.name || '',
          startDate: toDateInput(project.startDate),
          endDate: toDateInput(project.endDate),
          contactPerson: project.contactPerson || '',
          email: project.email || '',
          status: project.status,
          campaignDescription: project.campaignDescription || '',
          campaignMessages: parseMessages(project.campaignMessage),
          campaignTargetAudience: project.campaignTargetAudience || '',
          clothing: parseClothing(project.clothing),
          setting: parseSetting(project.settingInstructions),
          extraInfo: project.extraInfo || '',
        });
        setActivations(project.activations || []);
        // Mark initial load done after a tick so auto-save doesn't fire on load
        setTimeout(() => { initialLoadDone.current = true; }, 500);
      }
    };
    initialLoadDone.current = false;
    load();
  }, [id]);

  // Sync activation form when switching tabs
  useEffect(() => {
    const current = activations[activeTab];
    if (current) {
      const f = activationToForm(current);
      setActForm(f);
      // If pin exists, use pin as center and lock; if only location text, no map
      if (f.locationLat !== null && f.locationLon !== null) {
        setMapCenter({ lat: f.locationLat, lon: f.locationLon });
        setMapLocked(true);
        setPinLocked(true);
      } else {
        setMapCenter(null);
        setMapLocked(false);
        setPinLocked(false);
      }
    }
  }, [activeTab, activations]);

  // Auto-save project (debounced 800ms)
  useEffect(() => {
    if (!initialLoadDone.current || !isEdit) return;
    if (projectSaveTimer.current) clearTimeout(projectSaveTimer.current);
    projectSaveTimer.current = setTimeout(() => { saveProject(); }, 800);
    return () => { if (projectSaveTimer.current) clearTimeout(projectSaveTimer.current); };
  }, [form]);

  // Auto-save activation (debounced 800ms)
  useEffect(() => {
    if (!initialLoadDone.current || !isEdit) return;
    if (activations.length === 0) return;
    if (activationSaveTimer.current) clearTimeout(activationSaveTimer.current);
    activationSaveTimer.current = setTimeout(() => { saveActivation(); }, 800);
    return () => { if (activationSaveTimer.current) clearTimeout(activationSaveTimer.current); };
  }, [actForm]);

  // Auto-generated display name
  const selectedKlant = klanten.find((k) => k.id === form.klantId);
  const displayName = [form.projectNumber, selectedKlant?.name, form.name]
    .filter(Boolean)
    .join('_');

  const handleKlantChange = (klantId: number) => {
    const klant = klanten.find((k) => k.id === klantId);
    setForm({
      ...form,
      klantId,
      contactPerson: klant?.contactPerson || '',
      email: klant?.email || '',
    });
  };

  // Serialize form to API format
  const serializeForm = () => {
    const { setting, campaignMessages, ...rest } = form;
    return {
      ...rest,
      campaignMessage: JSON.stringify(campaignMessages),
      clothing: JSON.stringify(form.clothing),
      settingInstructions: JSON.stringify(setting),
    };
  };

  const saveProject = async () => {
    if (!isEdit) return;
    setSaving(true);
    try {
      const payload = serializeForm();
      await updateProject(Number(id), payload);
    } catch {
      toast.error('Project opslaan mislukt');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEdit) {
      setSaving(true);
      try {
        const payload = serializeForm();
        const project = await createProject(payload);
        toast.success('Project aangemaakt');
        if (onCreated) {
          onCreated(project.id);
        } else {
          navigate(`/admin/projects/${project.id}`);
        }
      } catch {
        toast.error('Project opslaan mislukt');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleAddActivation = async () => {
    if (!id) return;
    try {
      const activation = await createActivation(Number(id), { location: '', date: null });
      setActivations([...activations, activation]);
      setActiveTab(activations.length);
      toast.success('Activatie toegevoegd');
    } catch {
      toast.error('Activatie toevoegen mislukt');
    }
  };

  const saveActivation = useCallback(async () => {
    const current = activations[activeTab];
    if (!current) return;
    setSavingActivation(true);
    try {
      const currentZoom = mapRef.current?.getZoom() ?? actForm.locationZoom;
      const storeListFiltered = actForm.storeList.filter(s => s.winkel.trim() || s.adres.trim());
      await updateActivation(current.id, {
        location: actForm.location,
        locationLat: actForm.locationLat,
        locationLon: actForm.locationLon,
        locationZoom: actForm.locationLat !== null ? currentZoom : null,
        date: actForm.date || null,
        startTime: actForm.startTime || null,
        endTime: actForm.endTime || null,
        scheduleItems: actForm.scheduleItems,
        tasks: JSON.stringify(actForm.tasks.filter(t => t.trim())),
        storeList: storeListFiltered.length > 0 ? JSON.stringify(storeListFiltered) : null,
        photoRequirements: actForm.photoRequirements || null,
        extraInfo: actForm.extraInfo || null,
        evaluationLink: actForm.locationInfo || null,
        target: actForm.target || null,
        staff: actForm.staff,
      });
    } catch {
      toast.error('Activatie opslaan mislukt');
    } finally {
      setSavingActivation(false);
    }
  }, [activations, activeTab, actForm, toast]);

  const handleDeleteActivation = async () => {
    if (!deletingActivation || activations.length <= 1) return;
    try {
      await deleteActivation(deletingActivation.id);
      const newActivations = activations.filter((a) => a.id !== deletingActivation.id);
      setActivations(newActivations);
      setActiveTab(Math.min(activeTab, newActivations.length - 1));
      toast.success('Activatie verwijderd');
    } catch {
      toast.error('Activatie verwijderen mislukt');
    }
  };

  const copyBriefingUrl = () => {
    const current = activations[activeTab];
    if (!current?.briefingToken) return;
    const url = `${window.location.origin}/briefing/${current.briefingToken}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  // Location search via Nominatim
  const searchLocation = (query: string) => {
    if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
    if (query.length < 3) { setLocationSuggestions([]); return; }
    locationDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=nl&limit=5&addressdetails=1`);
        const data = await res.json();
        setLocationSuggestions(data);
      } catch { setLocationSuggestions([]); }
    }, 300);
  };

  const handleLocationChange = (value: string) => {
    // Address changed → reset pin, map, lock
    setActForm({ ...actForm, location: value, locationLat: null, locationLon: null, locationZoom: null });
    setMapCenter(null);
    setMapLocked(false);
    setPinLocked(false);
    if (markerRef.current && mapRef.current) { markerRef.current.remove(); markerRef.current = null; }
    searchLocation(value);
  };

  const selectLocation = (suggestion: { display_name: string; lat: string; lon: string }) => {
    const lat = parseFloat(suggestion.lat);
    const lon = parseFloat(suggestion.lon);
    // Set center but NO pin yet — user must lock then click
    setActForm({ ...actForm, location: suggestion.display_name, locationLat: null, locationLon: null, locationZoom: null });
    setMapCenter({ lat, lon });
    setMapLocked(false);
    setPinLocked(false);
    if (markerRef.current && mapRef.current) { markerRef.current.remove(); markerRef.current = null; }
    setLocationSuggestions([]);
  };

  // Store address autocomplete via Nominatim
  const searchStoreAddress = (query: string, idx: number) => {
    if (storeAddressDebounceRef.current) clearTimeout(storeAddressDebounceRef.current);
    if (query.length < 3) { setStoreAddressSuggestions([]); setActiveStoreIdx(null); return; }
    setActiveStoreIdx(idx);
    storeAddressDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=nl&limit=5`);
        const data = await res.json();
        setStoreAddressSuggestions(data);
        setActiveStoreIdx(idx);
      } catch { setStoreAddressSuggestions([]); }
    }, 300);
  };

  const selectStoreAddress = (idx: number, displayName: string) => {
    const next = [...actForm.storeList];
    next[idx] = { ...next[idx], adres: displayName };
    setActForm({ ...actForm, storeList: next });
    setStoreAddressSuggestions([]);
    setActiveStoreIdx(null);
  };

  // Leaflet map: init when activations are available
  const hasActivations = activations.length > 0;
  useEffect(() => {
    if (!hasActivations) return;
    const timer = setTimeout(() => {
      if (!mapContainerRef.current || mapRef.current) return;
      const zoom = actForm.locationZoom ?? (mapCenter ? 15 : 8);
      const center: L.LatLngExpression = mapCenter
        ? [mapCenter.lat, mapCenter.lon]
        : [52.09, 5.12]; // Netherlands center
      const map = L.map(mapContainerRef.current, {
        center,
        zoom,
        zoomControl: !mapLocked,
        attributionControl: false,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
    }, 50);
    return () => { clearTimeout(timer); if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerRef.current = null; } };
  }, [hasActivations]);

  // Center map when mapCenter changes (after init) — only if position actually changed
  const prevMapCenterRef = useRef<{ lat: number; lon: number } | null>(null);
  useEffect(() => {
    if (!mapCenter) { prevMapCenterRef.current = null; return; }
    // Skip if center hasn't actually changed (e.g. after save/reload)
    const prev = prevMapCenterRef.current;
    if (prev && prev.lat === mapCenter.lat && prev.lon === mapCenter.lon) return;
    prevMapCenterRef.current = mapCenter;
    const trySetView = () => {
      const map = mapRef.current;
      if (map) {
        map.setView([mapCenter.lat, mapCenter.lon], actForm.locationZoom ?? 15);
      }
    };
    trySetView();
    const timer = setTimeout(trySetView, 100);
    return () => clearTimeout(timer);
  }, [mapCenter]);

  // Update map marker when pin lat/lon changes — retry if map not ready yet
  useEffect(() => {
    const updateMarker = () => {
      const map = mapRef.current;
      if (!map) return false;
      if (actForm.locationLat !== null && actForm.locationLon !== null) {
        const latlng: L.LatLngExpression = [actForm.locationLat, actForm.locationLon];
        if (markerRef.current) {
          markerRef.current.setLatLng(latlng);
        } else {
          markerRef.current = L.marker(latlng, {
            icon: L.divIcon({
              className: '',
              html: '<div style="width:24px;height:24px;background:#FFD700;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>',
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            }),
          }).addTo(map);
        }
      } else {
        if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
      }
      return true;
    };
    if (!updateMarker()) {
      const timer = setTimeout(updateMarker, 100);
      return () => clearTimeout(timer);
    }
  }, [actForm.locationLat, actForm.locationLon, hasActivations]);

  // Reverse geocode: update address from pin coordinates (format: "Stad, Straat Nummer")
  const reverseGeocode = useCallback(async (lat: number, lon: number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`);
      const data = await res.json();
      if (data.address) {
        const a = data.address;
        const city = a.city || a.town || a.village || a.municipality || '';
        const road = a.road || '';
        const number = a.house_number || '';
        const street = [road, number].filter(Boolean).join(' ');
        const location = [city, street].filter(Boolean).join(', ') || data.display_name;
        setActForm((prev) => ({ ...prev, location }));
      } else if (data.display_name) {
        setActForm((prev) => ({ ...prev, location: data.display_name }));
      }
    } catch { /* ignore */ }
  }, []);

  // Map click handler: places pin, locks it, and reverse geocodes address
  const handleMapClick = useCallback((e: L.LeafletMouseEvent) => {
    setActForm((prev) => ({ ...prev, locationLat: e.latlng.lat, locationLon: e.latlng.lng }));
    setPinLocked(true);
    reverseGeocode(e.latlng.lat, e.latlng.lng);
  }, [reverseGeocode]);

  // Lock/unlock controls — locked = completely frozen, no interaction at all
  useEffect(() => {
    const applyLock = () => {
      const map = mapRef.current;
      if (!map) return false;
      if (mapLocked) {
        map.dragging.disable();
        map.scrollWheelZoom.disable();
        map.doubleClickZoom.disable();
        map.touchZoom.disable();
        map.boxZoom.disable();
        map.keyboard.disable();
        if (map.zoomControl.getContainer()) map.zoomControl.remove();
        // Allow click to place/move pin only when pin is not locked
        if (!pinLocked) {
          map.on('click', handleMapClick);
        } else {
          map.off('click', handleMapClick);
        }
      } else {
        map.dragging.enable();
        map.scrollWheelZoom.enable();
        map.doubleClickZoom.enable();
        map.touchZoom.enable();
        map.boxZoom.enable();
        map.keyboard.enable();
        if (!map.zoomControl.getContainer()) {
          map.zoomControl.addTo(map);
        }
        map.off('click', handleMapClick);
      }
      return true;
    };
    if (!applyLock()) {
      const timer = setTimeout(applyLock, 100);
      return () => { clearTimeout(timer); mapRef.current?.off('click', handleMapClick); };
    }
    return () => { mapRef.current?.off('click', handleMapClick); };
  }, [mapLocked, pinLocked, handleMapClick, hasActivations]);

  // Schedule items helpers
  const addScheduleItem = () => {
    setActForm({ ...actForm, scheduleItems: [...actForm.scheduleItems, emptyScheduleItem()] });
  };
  const updateScheduleItem = (idx: number, field: keyof ScheduleItem, value: string) => {
    const items = [...actForm.scheduleItems];
    items[idx] = { ...items[idx], [field]: value };
    setActForm({ ...actForm, scheduleItems: items });
  };
  const removeScheduleItem = (idx: number) => {
    const remaining = actForm.scheduleItems.filter((_, i) => i !== idx);
    setActForm({ ...actForm, scheduleItems: remaining.length > 0 ? remaining : [emptyScheduleItem()] });
  };
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const reorderScheduleItems = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const items = [...actForm.scheduleItems];
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    setActForm({ ...actForm, scheduleItems: items });
  };

  // Staff helpers
  const addStaff = (superchargerId: number) => {
    if (actForm.staff.some((s) => s.superchargerId === superchargerId)) return;
    const sc = superchargers.find((s) => s.id === superchargerId);
    const role = sc?.function?.toLowerCase().includes('senior') ? 'senior' : 'supercharger';
    setActForm({ ...actForm, staff: [...actForm.staff, { superchargerId, role }] });
  };
  const removeStaff = (superchargerId: number) => {
    setActForm({ ...actForm, staff: actForm.staff.filter((s) => s.superchargerId !== superchargerId) });
  };
  const toggleStaffRole = (superchargerId: number) => {
    setActForm({
      ...actForm,
      staff: actForm.staff.map((s) =>
        s.superchargerId === superchargerId
          ? { ...s, role: s.role === 'senior' ? 'supercharger' : 'senior' }
          : s
      ),
    });
  };

  const availableSuperchargers = superchargers.filter(
    (sc) => !actForm.staff.some((s) => s.superchargerId === sc.id)
  );

  return (
    <div>
      {!showOnlyActivations && (
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">
          {isEdit ? displayName || form.projectNumber : 'Nieuw project'}
        </h1>
        <button
          onClick={() => onBack ? onBack() : navigate('/admin/projects')}
          className="px-4 py-2 rounded-[6px] text-text-secondary hover:text-text-primary border border-[rgba(255,255,255,0.12)] transition-colors cursor-pointer"
        >
          Terug
        </button>
      </div>
      )}

      {/* Project form */}
      {!showOnlyActivations && (
      <form onSubmit={handleSubmit} className="bg-bg-surface rounded-[12px] border border-[rgba(255,255,255,0.08)] p-6 mb-6">
        <button type="button" onClick={() => setProjectOpen(!projectOpen)} className="flex items-center gap-2 w-full text-left cursor-pointer mb-4">
          <svg width="12" height="12" viewBox="0 0 12 12" className={`text-text-secondary transition-transform ${projectOpen ? 'rotate-90' : ''}`}><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <h2 className="text-lg font-semibold text-text-primary">Projectgegevens</h2>
        </button>
        <div style={{ display: projectOpen ? 'block' : 'none' }}><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Klant *</label>
            <select value={form.klantId} onChange={(e) => handleKlantChange(Number(e.target.value))} required className={inputClass}>
              <option value={0} disabled>Selecteer een klant</option>
              {klanten.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Projectnummer *</label>
            <input type="text" value={form.projectNumber} onChange={(e) => setForm({ ...form, projectNumber: e.target.value })} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Projectnaam</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Naam van het project" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Startdatum *</label>
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Einddatum *</label>
            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Contactpersoon</label>
            <input type="text" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
          </div>
          {isEdit && (
            <div>
              <label className={labelClass}>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'completed' })} className={inputClass}>
                <option value="active">Actief</option>
                <option value="completed">Afgerond</option>
              </select>
            </div>
          )}
        </div>

        {/* Campagne informatie */}
        <h3 className="text-md font-semibold text-text-primary mt-6 mb-3">Campagne informatie</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelClass}>Campagne omschrijving</label>
            <AutoTextarea value={form.campaignDescription} onChange={(e) => setForm({ ...form, campaignDescription: e.target.value })} placeholder="Omschrijving van de campagne..." />
          </div>
          <div>
            <label className={labelClass}>Boodschap</label>
            <ListInput items={form.campaignMessages} onChange={(campaignMessages) => setForm({ ...form, campaignMessages })} placeholder="Boodschap..." />
          </div>
          <div>
            <label className={labelClass}>Doelgroep</label>
            <AutoTextarea value={form.campaignTargetAudience} onChange={(e) => setForm({ ...form, campaignTargetAudience: e.target.value })} placeholder="Doelgroep omschrijving..." />
          </div>
        </div>

        {/* Kleding */}
        <h3 className="text-md font-semibold text-text-primary mt-6 mb-3">Kleding</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Megawatt</label>
            <ListInput items={form.clothing.megawatt} onChange={(megawatt) => setForm({ ...form, clothing: { ...form.clothing, megawatt } })} placeholder="Kledingstuk..." />
          </div>
          <div>
            <label className={labelClass}>Zelf meenemen</label>
            <ListInput items={form.clothing.self} onChange={(self) => setForm({ ...form, clothing: { ...form.clothing, self } })} placeholder="Kledingstuk..." />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Info</label>
            <AutoTextarea value={form.clothing.info} onChange={(e) => setForm({ ...form, clothing: { ...form.clothing, info: e.target.value } })} placeholder="Extra kleding informatie..." />
          </div>
        </div>

        {/* Setting & veiligheidsinstructies */}
        <h3 className="text-md font-semibold text-text-primary mt-6 mb-3">Setting & veiligheidsinstructies</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Algemeen</label>
            <AutoTextarea value={form.setting.algemeen} onChange={(e) => setForm({ ...form, setting: { ...form.setting, algemeen: e.target.value } })} placeholder="Algemene instructies..." />
          </div>
          <div>
            <label className={labelClass}>Let op!</label>
            <AutoTextarea value={form.setting.letOp} onChange={(e) => setForm({ ...form, setting: { ...form.setting, letOp: e.target.value } })} placeholder="Belangrijke aandachtspunten..." />
          </div>
        </div>

        {/* Extra informatie */}
        <h3 className="text-md font-semibold text-text-primary mt-6 mb-3">Extra informatie</h3>
        <AutoTextarea value={form.extraInfo} onChange={(e) => setForm({ ...form, extraInfo: e.target.value })} placeholder="Aanvullende informatie..." />
        </div>

        {/* Auto-saved */}
      </form>
      )}

      {/* Activations: show als isEdit; lege state krijgt "+ Eerste activatie" knop */}
      {isEdit && activations.length === 0 && (
        <div className="bg-bg-surface rounded-[12px] border border-[rgba(255,255,255,0.08)] p-6 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">Activaties</h2>
            <button
              onClick={handleAddActivation}
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg ring-1 ring-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.5)] text-[12px] font-medium hover:bg-accent hover:text-[#1a3a38] hover:ring-accent transition-all duration-150 cursor-pointer"
            >
              + Eerste activatie aanmaken
            </button>
          </div>
          <p className="text-sm text-white/30 italic mt-3">Nog geen activaties — voeg er één toe om superchargers te kunnen koppelen.</p>
        </div>
      )}
      {isEdit && activations.length > 0 && (
        <div className="bg-bg-surface rounded-[12px] border border-[rgba(255,255,255,0.08)] p-6">
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={() => setActivationsOpen(!activationsOpen)} className="flex items-center gap-2 cursor-pointer">
              <svg width="12" height="12" viewBox="0 0 12 12" className={`text-text-secondary transition-transform ${activationsOpen ? 'rotate-90' : ''}`}><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <h2 className="text-lg font-semibold text-text-primary">Activaties</h2>
            </button>
            {activationsOpen && activations[activeTab]?.briefingToken && (
              <button
                onClick={copyBriefingUrl}
                className="flex items-center gap-1.5 h-7 px-3 rounded-lg ring-1 ring-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.5)] text-[12px] font-medium hover:bg-[rgba(255,255,255,0.12)] hover:text-white transition-all duration-150 cursor-pointer"
              >
                {copiedToken ? 'Gekopieerd!' : 'Briefing URL kopiëren'}
              </button>
            )}
          </div>
          <div style={{ display: activationsOpen ? 'block' : 'none' }}>

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-4 border-b border-[rgba(255,255,255,0.08)] pb-2 overflow-x-auto">
            {activations.map((activation, idx) => {
              const d = activation.date ? new Date(activation.date) : null;
              const dateStr = d ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` : '';
              const city = (activation.location || '').split(',')[0].trim();
              const raw = [city, dateStr].filter(Boolean).join(', ') || 'Nieuwe activatie';
              const label = raw.length > 17 ? raw.slice(0, 17) + '...' : raw;
              return (
                <button
                  key={activation.id}
                  onClick={() => setActiveTab(idx)}
                  className={`px-3 py-1.5 rounded-t-[6px] text-[14px] transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === idx
                      ? 'bg-accent-teal text-[#1a3a38] font-semibold'
                      : 'text-[rgba(255,255,255,0.6)] hover:text-[rgba(255,255,255,0.9)]'
                  }`}
                  title={raw}
                >
                  {label}
                </button>
              );
            })}
            <button onClick={handleAddActivation} className="px-3 py-1.5 text-accent-teal hover:opacity-80 text-[18px] cursor-pointer" title="Activatie toevoegen">+</button>
          </div>

          {/* Interactive map — always visible */}
          <div className="mb-4 relative">
            <div
              ref={mapContainerRef}
              className="rounded-[8px] overflow-hidden border border-[rgba(255,255,255,0.08)]"
              style={{ height: 400 }}
            />
            {mapCenter && (
              <div className="absolute top-3 right-3 z-[1000] flex gap-2">
                {/* Map lock/unlock */}
                <button
                  type="button"
                  onClick={() => {
                    if (mapLocked) {
                      // Unlock map → also unlock pin
                      setMapLocked(false);
                      setPinLocked(false);
                    } else {
                      setMapLocked(true);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-lg ${
                    mapLocked
                      ? 'bg-[rgba(0,0,0,0.7)] text-white border border-[rgba(255,255,255,0.2)]'
                      : 'bg-accent text-bg-dark'
                  }`}
                >
                  {mapLocked ? 'Aanpassen' : 'Vastzetten'}
                </button>
                {/* Pin lock/unlock — only shown when map is locked */}
                {mapLocked && (
                  <button
                    type="button"
                    onClick={() => setPinLocked(!pinLocked)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-lg ${
                      pinLocked
                        ? 'bg-[rgba(0,0,0,0.7)] text-white border border-[rgba(255,255,255,0.2)]'
                        : 'bg-accent text-bg-dark'
                    }`}
                  >
                    {pinLocked ? 'Pin verplaatsen' : 'Pin vastzetten'}
                  </button>
                )}
              </div>
            )}
            {mapLocked && !pinLocked && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] px-4 py-2 rounded-lg bg-[rgba(0,0,0,0.7)] text-white text-sm shadow-lg pointer-events-none">
                Klik op de kaart om pin te plaatsen
              </div>
            )}
          </div>

          {/* Locatie */}
          <div className="mb-4 relative">
            <label className={labelClass}>Locatie</label>
            <input
              type="text"
              value={actForm.location}
              onChange={(e) => handleLocationChange(e.target.value)}
              onBlur={() => setTimeout(() => setLocationSuggestions([]), 200)}
              placeholder="Zoek adres..."
              className={inputClass}
            />
            {locationSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-bg-surface border border-[rgba(255,255,255,0.12)] rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                {locationSuggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectLocation(s)}
                    className="w-full px-3 py-2 text-left text-text-primary text-sm hover:bg-[rgba(255,255,255,0.06)] cursor-pointer truncate"
                  >
                    {s.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Datum, Starttijd, Eindtijd */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className={labelClass}>Datum</label>
              <input type="date" value={actForm.date} onChange={(e) => setActForm({ ...actForm, date: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Starttijd</label>
              <select value={actForm.startTime} onChange={(e) => setActForm({ ...actForm, startTime: e.target.value })} className={inputClass}>
                <option value="">--:--</option>
                {Array.from({ length: 24 * 4 }, (_, i) => {
                  const h = String(Math.floor(i / 4)).padStart(2, '0');
                  const m = String((i % 4) * 15).padStart(2, '0');
                  return <option key={i} value={`${h}:${m}`}>{`${h}:${m}`}</option>;
                })}
              </select>
            </div>
            <div>
              <label className={labelClass}>Eindtijd</label>
              <select value={actForm.endTime} onChange={(e) => setActForm({ ...actForm, endTime: e.target.value })} className={inputClass}>
                <option value="">--:--</option>
                {Array.from({ length: 24 * 4 }, (_, i) => {
                  const h = String(Math.floor(i / 4)).padStart(2, '0');
                  const m = String((i % 4) * 15).padStart(2, '0');
                  return <option key={i} value={`${h}:${m}`}>{`${h}:${m}`}</option>;
                })}
              </select>
            </div>
          </div>

          {/* Team toewijzing */}
          <div className="mb-4">
            <label className={labelClass}>Team</label>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {actForm.staff.map((s) => {
                const sc = superchargers.find((x) => x.id === s.superchargerId);
                if (!sc) return null;
                return (
                  <div key={s.superchargerId} className="flex items-center gap-2 bg-[rgba(255,255,255,0.04)] rounded-lg px-3 py-1.5">
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-bg-surface shrink-0">
                      {sc.photo ? (
                        <img src={sc.photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-secondary text-[10px] font-medium">
                          {sc.firstName[0]}{sc.lastName[0]}
                        </div>
                      )}
                    </div>
                    <span className="text-text-primary text-sm">{sc.firstName} {sc.lastName}</span>
                    <button type="button" onClick={() => toggleStaffRole(s.superchargerId)} className={`text-xs px-1.5 py-0.5 rounded-full cursor-pointer ${s.role === 'senior' ? 'bg-amber-500/15 text-amber-400' : 'bg-accent-teal/15 text-accent-teal'}`}>
                      {s.role === 'senior' ? 'Senior' : 'SC'}
                    </button>
                    <button type="button" onClick={() => removeStaff(s.superchargerId)} className="text-red-400 hover:opacity-80 text-xs cursor-pointer">✕</button>
                  </div>
                );
              })}
              {/* Add button / Search */}
              <div className="relative">
                {!staffSearchOpen ? (
                  <button
                    type="button"
                    onClick={() => { setStaffSearchOpen(true); setStaffSearchQuery(''); setTimeout(() => staffSearchRef.current?.focus(), 50); }}
                    className="w-9 h-9 rounded-full border-2 border-dashed border-[rgba(255,255,255,0.2)] flex items-center justify-center text-[rgba(255,255,255,0.4)] hover:border-accent-teal hover:text-accent-teal transition-colors cursor-pointer"
                  >
                    <span className="text-lg leading-none">+</span>
                  </button>
                ) : (
                  <div className="relative">
                    <input
                      ref={staffSearchRef}
                      type="text"
                      value={staffSearchQuery}
                      onChange={(e) => setStaffSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') { setStaffSearchOpen(false); setStaffSearchQuery(''); }
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const q = staffSearchQuery.toLowerCase();
                          const match = availableSuperchargers.find((sc) =>
                            `${sc.firstName} ${sc.lastName}`.toLowerCase().includes(q)
                          );
                          if (match) { addStaff(match.id); setStaffSearchQuery(''); }
                        }
                      }}
                      onBlur={() => setTimeout(() => { setStaffSearchOpen(false); setStaffSearchQuery(''); }, 150)}
                      placeholder="Zoek supercharger..."
                      className={`${inputClass} !w-64 !py-1.5 text-sm`}
                    />
                    <div className="absolute top-full left-0 mt-1 w-64 bg-bg-surface border border-[rgba(255,255,255,0.12)] rounded-lg shadow-xl z-10 max-h-[200px] overflow-y-auto overflow-x-hidden">
                      {availableSuperchargers
                        .filter((sc) => !staffSearchQuery || `${sc.firstName} ${sc.lastName}`.toLowerCase().includes(staffSearchQuery.toLowerCase()))
                        .map((sc) => (
                          <button
                            key={sc.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { addStaff(sc.id); setStaffSearchQuery(''); staffSearchRef.current?.focus(); }}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[rgba(255,255,255,0.06)] text-left cursor-pointer min-w-0"
                          >
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-[rgba(255,255,255,0.08)] shrink-0">
                              {sc.photo ? (
                                <img src={sc.photo} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-text-secondary text-[9px] font-medium">
                                  {sc.firstName[0]}{sc.lastName[0]}
                                </div>
                              )}
                            </div>
                            <span className="text-text-primary text-sm truncate">{sc.firstName} {sc.lastName}</span>
                            <span className="text-text-secondary text-xs shrink-0">{sc.function}</span>
                          </button>
                        ))}
                      {availableSuperchargers.filter((sc) => !staffSearchQuery || `${sc.firstName} ${sc.lastName}`.toLowerCase().includes(staffSearchQuery.toLowerCase())).length === 0 && (
                        <div className="px-3 py-2 text-text-secondary text-sm">Geen resultaten</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dagindeling */}
          <div className="mb-4">
            <label className="text-text-primary font-semibold text-sm mb-2 block">Dagindeling</label>
            <div>
              <table className="w-full border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.12)]">
                    <th style={{ width: '28px' }}></th>
                    <th className="text-left text-text-secondary text-xs font-semibold uppercase tracking-wider py-2 pr-2" style={{ width: '14%' }}>Tijd</th>
                    <th className="text-left text-text-secondary text-xs font-semibold uppercase tracking-wider py-2 px-2" style={{ width: '28%' }}>Wat</th>
                    <th className="text-left text-text-secondary text-xs font-semibold uppercase tracking-wider py-2 px-2" style={{ width: '20%' }}>Wie</th>
                    <th className="text-left text-text-secondary text-xs font-semibold uppercase tracking-wider py-2 px-2">Bijzonderheden</th>
                    <th style={{ width: '20px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {actForm.scheduleItems.map((item, idx) => (
                    <tr
                      key={idx}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(idx)); setDragIdx(idx); }}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDragOverIdx(idx); }}
                      onDragLeave={(e) => { e.stopPropagation(); if (dragOverIdx === idx) setDragOverIdx(null); }}
                      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragIdx !== null && dragIdx !== idx) { reorderScheduleItems(dragIdx, idx); } setDragIdx(null); setDragOverIdx(null); }}
                      onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                      className={`border-b border-[rgba(255,255,255,0.06)] transition-opacity ${dragIdx === idx ? 'opacity-40' : ''} ${dragOverIdx === idx && dragIdx !== idx ? 'border-t-2 border-t-accent-teal' : ''}`}
                    >
                      <td className="py-1.5 pr-1 align-top pt-2.5 cursor-grab active:cursor-grabbing">
                        <span className="text-text-secondary text-xs select-none">&#8942;&#8942;</span>
                      </td>
                      <td className="py-1.5 pr-2 align-top">
                        <select value={item.time} onChange={(e) => updateScheduleItem(idx, 'time', e.target.value)} className={`${inputClass} !py-1.5`}>
                          <option value="">--:--</option>
                          {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td className="py-1.5 px-2 align-top">
                        <input type="text" value={item.wat} onChange={(e) => updateScheduleItem(idx, 'wat', e.target.value)} placeholder="Omschrijving" className={`${inputClass} !py-1.5`} />
                      </td>
                      <td className="py-1.5 px-2 align-top">
                        <select value={item.wie} onChange={(e) => updateScheduleItem(idx, 'wie', e.target.value)} className={`${inputClass} !py-1.5`}>
                          <option value="">Selecteer...</option>
                          {actForm.staff.length > 1 && <option value="Iedereen">Iedereen</option>}
                          {actForm.staff.map((s) => {
                            const sc = superchargers.find((x) => x.id === s.superchargerId);
                            if (!sc) return null;
                            const label = `${sc.firstName} ${sc.lastName}`;
                            return <option key={s.superchargerId} value={label}>{label} ({s.role === 'senior' ? 'Senior' : 'SC'})</option>;
                          })}
                        </select>
                      </td>
                      <td className="py-1.5 px-2 align-top">
                        <textarea
                          value={item.bijzonderheden}
                          onChange={(e) => updateScheduleItem(idx, 'bijzonderheden', e.target.value)}
                          placeholder="Bijzonderheden"
                          rows={1}
                          className={`${inputClass} !py-1.5 resize-none overflow-hidden`}
                          onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
                        />
                      </td>
                      <td className="py-1.5 align-top pt-2.5 text-right pr-0 whitespace-nowrap">
                        <button type="button" onClick={() => { const items = [...actForm.scheduleItems]; items.splice(idx + 1, 0, emptyScheduleItem()); setActForm({ ...actForm, scheduleItems: items }); }} className="text-accent-teal hover:opacity-80 text-sm cursor-pointer mr-1">+</button>
                        <button type="button" onClick={() => removeScheduleItem(idx)} className="text-red-400 hover:opacity-80 text-sm cursor-pointer">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Werkzaamheden */}
          <div className="mb-4">
            <label className={labelClass}>Werkzaamheden</label>
            <ListInput items={actForm.tasks} onChange={(tasks) => setActForm({ ...actForm, tasks })} placeholder="Werkzaamheid..." />
          </div>

          {/* Target */}
          <div className="mb-4">
            <label className={labelClass}>Target</label>
            <AutoTextarea value={actForm.target} onChange={(e) => setActForm({ ...actForm, target: e.target.value })} placeholder="Bijv. 14.000 samples, 18 displays..." />
          </div>

          {/* Extra informatie */}
          <div className="mb-4">
            <label className="text-text-primary font-semibold text-sm mb-2 block">Extra informatie</label>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Actiefoto eisen</label>
                <AutoTextarea value={actForm.photoRequirements} onChange={(e) => setActForm({ ...actForm, photoRequirements: e.target.value })} placeholder="Foto-eisen..." />
              </div>
              <div>
                <label className={labelClass}>Belangrijke informatie</label>
                <AutoTextarea value={actForm.extraInfo} onChange={(e) => setActForm({ ...actForm, extraInfo: e.target.value })} placeholder="Belangrijke informatie..." />
              </div>
              <div>
                <label className={labelClass}>Extra locatie informatie</label>
                <AutoTextarea value={actForm.locationInfo} onChange={(e) => setActForm({ ...actForm, locationInfo: e.target.value })} placeholder="Extra locatie informatie..." />
              </div>
            </div>
          </div>

          {/* Winkellijst */}
          <div className="mb-4">
            <label className="text-text-primary font-semibold text-sm mb-2 block">Winkellijst</label>
            <div>
              {actForm.storeList.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-1.5">
                  <input
                    type="text"
                    value={item.winkel}
                    onChange={(e) => {
                      const next = [...actForm.storeList];
                      next[idx] = { ...next[idx], winkel: e.target.value };
                      setActForm({ ...actForm, storeList: next });
                    }}
                    placeholder="Winkel"
                    className={`${inputClass} !w-[30%] shrink-0`}
                  />
                  <div className="relative flex-1 min-w-0">
                    <input
                      type="text"
                      value={item.adres}
                      onChange={(e) => {
                        const next = [...actForm.storeList];
                        next[idx] = { ...next[idx], adres: e.target.value };
                        setActForm({ ...actForm, storeList: next });
                        searchStoreAddress(e.target.value, idx);
                      }}
                      onBlur={() => setTimeout(() => { setStoreAddressSuggestions([]); setActiveStoreIdx(null); }, 200)}
                      placeholder="Adres"
                      className={inputClass}
                    />
                    {activeStoreIdx === idx && storeAddressSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-bg-surface border border-[rgba(255,255,255,0.12)] rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                        {storeAddressSuggestions.map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectStoreAddress(idx, s.display_name)}
                            className="w-full px-3 py-2 text-left text-text-primary text-sm hover:bg-[rgba(255,255,255,0.06)] cursor-pointer truncate"
                          >
                            {s.display_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {item.adres.trim() && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.adres)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] text-text-secondary hover:text-white transition-colors"
                      title="Open in Maps"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    </a>
                  )}
                  {actForm.storeList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = actForm.storeList.filter((_, i) => i !== idx);
                        setActForm({ ...actForm, storeList: next.length > 0 ? next : [{ winkel: '', adres: '' }] });
                      }}
                      className="text-red-400 hover:opacity-80 text-sm shrink-0 cursor-pointer"
                    >✕</button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setActForm({ ...actForm, storeList: [...actForm.storeList, { winkel: '', adres: '' }] })}
                className="text-accent-teal text-sm hover:opacity-80 cursor-pointer"
              >+</button>
            </div>
          </div>

          {/* Delete */}
          {activations.length > 1 && (
            <div className="flex items-center justify-end mt-4 pt-4 border-t border-[rgba(255,255,255,0.08)]">
              <button onClick={() => setDeletingActivation(activations[activeTab])} className="text-red-400 hover:opacity-80 text-sm cursor-pointer">
                Activatie verwijderen
              </button>
            </div>
          )}
          </div>
        </div>
      )}

      {/* Evaluaties */}
      {isEdit && (
        <div className="bg-bg-surface rounded-[12px] border border-[rgba(255,255,255,0.08)] p-6 mt-6">
          <button type="button" onClick={() => setEvaluationsOpen(!evaluationsOpen)} className="flex items-center gap-2 cursor-pointer">
            <svg width="12" height="12" viewBox="0 0 12 12" className={`text-text-secondary transition-transform ${evaluationsOpen ? 'rotate-90' : ''}`}><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <h2 className="text-lg font-semibold text-text-primary">Evaluaties</h2>
          </button>
          <div style={{ display: evaluationsOpen ? 'block' : 'none' }} className="mt-4 space-y-6">

            {/* ─── Section 1: Haribo Starmix sampling ─── */}
            <h4 className="text-md font-semibold text-text-primary mt-6 mb-3">Haribo Starmix sampling</h4>

            <div>
              <label className={labelClass}>Wat was je functie vandaag? *</label>
              <div className="flex gap-4 mt-1">
                {['Senior', 'Supercharger'].map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-text-primary text-sm cursor-pointer">
                    <input type="radio" name="eval-functie" value={opt} checked={evalForm.functie === opt} onChange={() => setEvalForm({ ...evalForm, functie: opt })} className="accent-accent-teal" />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Naam Senior (Voor + achternaam) *</label>
              <input type="text" value={evalForm.naamSenior} onChange={(e) => setEvalForm({ ...evalForm, naamSenior: e.target.value })} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Datum van activatie *</label>
              <input type="date" value={evalForm.datumActivatie} onChange={(e) => setEvalForm({ ...evalForm, datumActivatie: e.target.value })} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Plaats van activatie *</label>
              <input type="text" value={evalForm.plaatsActivatie} onChange={(e) => setEvalForm({ ...evalForm, plaatsActivatie: e.target.value })} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Welk cijfer geef je het weer vandaag? (1=slecht - 10=super) *</label>
              <StarRating value={evalForm.cijferWeer} onChange={(v) => setEvalForm({ ...evalForm, cijferWeer: v })} />
            </div>

            <div>
              <label className={labelClass}>Geef een duidelijke beschrijving van de dag van vandaag *</label>
              <AutoTextarea value={evalForm.beschrijvingDag} onChange={(e) => setEvalForm({ ...evalForm, beschrijvingDag: e.target.value })} placeholder="Beschrijf je dag..." />
            </div>

            <div>
              <label className={labelClass}>Beschrijf hoe het verliep met de Goudbeer tijdens de actiedag *</label>
              <input type="text" value={evalForm.beschrijvingGoudbeer} onChange={(e) => setEvalForm({ ...evalForm, beschrijvingGoudbeer: e.target.value })} className={inputClass} />
            </div>

            {/* ─── Section 2: Target ─── */}
            <h4 className="text-md font-semibold text-text-primary mt-6 mb-3">Target</h4>

            <div>
              <label className={labelClass}>Heb je de target behaald? *</label>
              <div className="flex gap-4 mt-1">
                {['Target is behaald', 'Target is niet behaald'].map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-text-primary text-sm cursor-pointer">
                    <input type="radio" name="eval-target" value={opt} checked={evalForm.targetBehaald === opt} onChange={() => setEvalForm({ ...evalForm, targetBehaald: opt })} className="accent-accent-teal" />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            {evalForm.targetBehaald === 'Target is behaald' && (
              <div>
                <label className={labelClass}>Wat goed! Tips & tricks voor de volgende keer? *</label>
                <AutoTextarea value={evalForm.targetTips} onChange={(e) => setEvalForm({ ...evalForm, targetTips: e.target.value })} placeholder="Tips & tricks..." />
              </div>
            )}

            {evalForm.targetBehaald === 'Target is niet behaald' && (
              <div>
                <label className={labelClass}>Wat jammer, kun je uitleggen waarom niet? *</label>
                <AutoTextarea value={evalForm.targetWaromNiet} onChange={(e) => setEvalForm({ ...evalForm, targetWaromNiet: e.target.value })} placeholder="Uitleg waarom target niet behaald..." />
              </div>
            )}

            <div>
              <label className={labelClass}>Hoeveel samples heb je uitgedeeld? *</label>
              <input type="text" inputMode="numeric" value={evalForm.aantalSamples} onChange={(e) => setEvalForm({ ...evalForm, aantalSamples: e.target.value })} className={inputClass} placeholder="Aantal" />
            </div>

            <div>
              <label className={labelClass}>Hoe was de drukte vandaag? (1=Ontzettend rustig, 5=Mega druk) *</label>
              <LikertTable
                rows={['In de ochtend', 'In de middag', 'In de avond']}
                columns={['1', '2', '3', '4', '5']}
                values={evalForm.drukte}
                onChange={(row, col) => setEvalForm({ ...evalForm, drukte: { ...evalForm.drukte, [row]: col } })}
              />
            </div>

            <div>
              <label className={labelClass}>Kan je je cijfer verklaren? *</label>
              <AutoTextarea value={evalForm.drukteToelichting} onChange={(e) => setEvalForm({ ...evalForm, drukteToelichting: e.target.value })} placeholder="Verklaring..." />
            </div>

            <div>
              <label className={labelClass}>Hoe was de aanloop? (1=Passanten liepen ons zo voorbij - 10=Passanten liepen massaal naar ons toe) *</label>
              <StarRating value={evalForm.aanloop} onChange={(v) => setEvalForm({ ...evalForm, aanloop: v })} />
            </div>

            <div>
              <label className={labelClass}>Kan je een verklaring geven voor je cijfer? *</label>
              <AutoTextarea value={evalForm.aanloopToelichting} onChange={(e) => setEvalForm({ ...evalForm, aanloopToelichting: e.target.value })} placeholder="Verklaring..." />
            </div>

            {/* ─── Section 3: Locatiemanagement ─── */}
            <h4 className="text-md font-semibold text-text-primary mt-6 mb-3">Locatiemanagement</h4>

            <div>
              <label className={labelClass}>Stond je op een goede locatie vandaag? (1=Slechtste locatie ever, 10=Perfect!) *</label>
              <StarRating value={evalForm.locatieScore} onChange={(v) => setEvalForm({ ...evalForm, locatieScore: v })} />
            </div>

            <div>
              <label className={labelClass}>Is dit een locatie met veel doorloop? (1=Geen mens, 10=Heeeel veel passanten)</label>
              <StarRating value={evalForm.locatieDoorloop} onChange={(v) => setEvalForm({ ...evalForm, locatieDoorloop: v })} />
            </div>

            <div>
              <label className={labelClass}>Zou je volgende keer weer op deze locatie staan? (1=Nee nooit, 10=Ja zeker weten)</label>
              <StarRating value={evalForm.locatieOpnieuw} onChange={(v) => setEvalForm({ ...evalForm, locatieOpnieuw: v })} />
            </div>

            <div>
              <label className={labelClass}>Heb je feedback over deze locatie?</label>
              <div className="flex gap-4 mt-1">
                {['Nee', 'Ja, ik heb wel feedback'].map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-text-primary text-sm cursor-pointer">
                    <input type="radio" name="eval-locatie-feedback" value={opt} checked={evalForm.locatieFeedbackKeuze === opt} onChange={() => setEvalForm({ ...evalForm, locatieFeedbackKeuze: opt })} className="accent-accent-teal" />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            {evalForm.locatieFeedbackKeuze === 'Ja, ik heb wel feedback' && (
              <div>
                <label className={labelClass}>Feedback over de locatie</label>
                <AutoTextarea value={evalForm.locatieFeedback} onChange={(e) => setEvalForm({ ...evalForm, locatieFeedback: e.target.value })} placeholder="Je feedback..." />
              </div>
            )}

            {/* ─── Section 4: De consument ─── */}
            <h4 className="text-md font-semibold text-text-primary mt-6 mb-3">De consument</h4>

            <div>
              <label className={labelClass}>Was de doelgroep aanwezig op de locatie? (1=Nee totaal verkeerd, 10=Ja 100% bereikt!) *</label>
              <StarRating value={evalForm.doelgroepAanwezig} onChange={(v) => setEvalForm({ ...evalForm, doelgroepAanwezig: v })} />
            </div>

            <div>
              <label className={labelClass}>Heb je feedback over het bereiken van de doelgroep? *</label>
              <div className="flex gap-4 mt-1">
                {['Nee', 'Ja'].map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-text-primary text-sm cursor-pointer">
                    <input type="radio" name="eval-doelgroep-feedback" value={opt} checked={evalForm.doelgroepFeedbackKeuze === opt} onChange={() => setEvalForm({ ...evalForm, doelgroepFeedbackKeuze: opt })} className="accent-accent-teal" />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            {evalForm.doelgroepFeedbackKeuze === 'Ja' && (
              <div>
                <label className={labelClass}>Feedback over het bereiken van de doelgroep</label>
                <AutoTextarea value={evalForm.doelgroepFeedback} onChange={(e) => setEvalForm({ ...evalForm, doelgroepFeedback: e.target.value })} placeholder="Je feedback..." />
              </div>
            )}

            <div>
              <label className={labelClass}>Profiel consument (% man, % vrouw) *</label>
              <AutoTextarea value={evalForm.profielConsument} onChange={(e) => setEvalForm({ ...evalForm, profielConsument: e.target.value })} placeholder="Bijv. 60% man, 40% vrouw..." />
            </div>

            <div>
              <label className={labelClass}>Meest voorkomende reactie consument? *</label>
              <AutoTextarea value={evalForm.reactieConsument} onChange={(e) => setEvalForm({ ...evalForm, reactieConsument: e.target.value })} placeholder="Meest voorkomende reactie..." />
            </div>

            <div>
              <label className={labelClass}>Meest voorkomende vraag consument? *</label>
              <input type="text" value={evalForm.vraagConsument} onChange={(e) => setEvalForm({ ...evalForm, vraagConsument: e.target.value })} className={inputClass} placeholder="Meest voorkomende vraag..." />
            </div>

            {/* ─── Section 5: Materialen ─── */}
            <h4 className="text-md font-semibold text-text-primary mt-6 mb-3">Materialen</h4>

            <div>
              <label className={labelClass}>Waren alle materialen juist ingeladen in de bakwagen? *</label>
              <div className="flex gap-4 mt-1">
                {['Ja, alle materialen aanwezig', 'Nee, er ontbraken materialen'].map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-text-primary text-sm cursor-pointer">
                    <input type="radio" name="eval-materialen-ingeladen" value={opt} checked={evalForm.materialenIngeladen === opt} onChange={() => setEvalForm({ ...evalForm, materialenIngeladen: opt })} className="accent-accent-teal" />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            {evalForm.materialenIngeladen === 'Nee, er ontbraken materialen' && (
              <div>
                <label className={labelClass}>Welke materialen ontbraken?</label>
                <AutoTextarea value={evalForm.materialenOntbreken} onChange={(e) => setEvalForm({ ...evalForm, materialenOntbreken: e.target.value })} placeholder="Beschrijf welke materialen ontbraken..." />
              </div>
            )}

            <div>
              <label className={labelClass}>Waren alle materialen schoon mee gegeven? *</label>
              <div className="flex flex-col gap-2 mt-1">
                {['Ja schoon', 'Nee niet helemaal schoon', 'Nee echt vies'].map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-text-primary text-sm cursor-pointer">
                    <input type="radio" name="eval-materialen-schoon" value={opt} checked={evalForm.materialenSchoon === opt} onChange={() => setEvalForm({ ...evalForm, materialenSchoon: opt })} className="accent-accent-teal" />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Zijn er beschadigingen aan het materiaal? *</label>
              <div className="flex flex-col gap-2 mt-1">
                {['Ja al voor activatie', 'Ja vandaag ontstaan', 'Nee geen beschadigingen'].map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-text-primary text-sm cursor-pointer">
                    <input type="radio" name="eval-beschadigingen" value={opt} checked={evalForm.beschadigingen === opt} onChange={() => setEvalForm({ ...evalForm, beschadigingen: opt })} className="accent-accent-teal" />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            {(evalForm.beschadigingen === 'Ja al voor activatie' || evalForm.beschadigingen === 'Ja vandaag ontstaan') && (
              <div>
                <label className={labelClass}>Beschrijving van de beschadigingen</label>
                <AutoTextarea value={evalForm.beschadigingenBeschrijving} onChange={(e) => setEvalForm({ ...evalForm, beschadigingenBeschrijving: e.target.value })} placeholder="Beschrijf de beschadigingen..." />
                <p className="text-text-secondary text-xs mt-1">Foto-upload wordt later toegevoegd</p>
              </div>
            )}

            <div>
              <label className={labelClass}>Waren de materialen goed te vervoeren? (1-10) *</label>
              <StarRating value={evalForm.materialenVervoer} onChange={(v) => setEvalForm({ ...evalForm, materialenVervoer: v })} />
            </div>

            <div>
              <label className={labelClass}>Feedback over de setting? *</label>
              <AutoTextarea value={evalForm.feedbackSetting} onChange={(e) => setEvalForm({ ...evalForm, feedbackSetting: e.target.value })} placeholder="Feedback over de setting..." />
            </div>

            {/* ─── Section 6: Team evaluatie vanuit Senior ─── */}
            <h4 className="text-md font-semibold text-text-primary mt-6 mb-3">Team evaluatie vanuit Senior</h4>

            <div>
              <label className={labelClass}>Uit hoeveel Superchargers bestond je team?</label>
              <div className="flex gap-3 mt-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="flex items-center gap-1.5 text-text-primary text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="eval-aantal-sc"
                      value={n}
                      checked={evalForm.aantalSuperchargers === n}
                      onChange={() => {
                        const current = evalForm.superchargerEvals;
                        const next: SuperchargerEval[] = Array.from({ length: n }, (_, i) =>
                          current[i] || { naam: '', cijfer: 0, feedback: '' }
                        );
                        setEvalForm({ ...evalForm, aantalSuperchargers: n, superchargerEvals: next });
                      }}
                      className="accent-accent-teal"
                    />
                    {n}
                  </label>
                ))}
              </div>
            </div>

            {evalForm.superchargerEvals.map((sc, idx) => (
              <div key={idx} className="bg-[rgba(0,0,0,0.15)] rounded-lg p-4 border border-[rgba(255,255,255,0.06)]">
                <p className="text-text-primary text-sm font-medium mb-3">Supercharger {idx + 1}</p>
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>Naam Supercharger</label>
                    <input
                      type="text"
                      value={sc.naam}
                      onChange={(e) => {
                        const next = [...evalForm.superchargerEvals];
                        next[idx] = { ...next[idx], naam: e.target.value };
                        setEvalForm({ ...evalForm, superchargerEvals: next });
                      }}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Cijfer voor functioneren (1-10)</label>
                    <StarRating
                      value={sc.cijfer}
                      onChange={(v) => {
                        const next = [...evalForm.superchargerEvals];
                        next[idx] = { ...next[idx], cijfer: v };
                        setEvalForm({ ...evalForm, superchargerEvals: next });
                      }}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Feedback</label>
                    <AutoTextarea
                      value={sc.feedback}
                      onChange={(e) => {
                        const next = [...evalForm.superchargerEvals];
                        next[idx] = { ...next[idx], feedback: e.target.value };
                        setEvalForm({ ...evalForm, superchargerEvals: next });
                      }}
                      placeholder="Feedback over deze Supercharger..."
                    />
                  </div>
                </div>
              </div>
            ))}

          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deletingActivation}
        onClose={() => setDeletingActivation(null)}
        onConfirm={handleDeleteActivation}
        title="Activatie verwijderen?"
        message={`Weet je zeker dat je activatie "${deletingActivation?.location || 'Nieuwe activatie'}" wilt verwijderen?`}
      />
    </div>
  );
}
