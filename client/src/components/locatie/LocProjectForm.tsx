import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LocProject, LocProjectLocation, LocProjectWriteInput, LocProjectStatus,
  Klant, Location, AvailabilityState,
  fetchLocProject, createLocProject, updateLocProject, deleteLocProject,
  fetchKlanten, fetchKlant, fetchLocations, fetchLocation,
} from '../../api';
import { useToast } from '../ui/Toast';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { todayYmd, toDateInput, daysBetween, fmtEur } from './locProjectHelpers';

interface Props {
  projectId: number | 'new';
  onBack: () => void;
  onCreated: (id: number) => void;
  onDeleted: () => void;
  onOpenLocation: (id: number) => void;
}

interface TabData {
  key: string;                // Stabiele React key — wijzigt niet bij reorder.
  locationId: number | null;
  locationCodeInput: string;
  locationData: Location | null;
  startDate: string;
  endDate: string;
  available: AvailabilityState;
  actionOpen: boolean;
  actionLabel: string;
  opmerkingen: string;
}

// Layout-stijl gelijk aan Planning → Projecten (donkere cards + donkere inputs)
const inputClass = 'w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px] placeholder-[rgba(255,255,255,0.3)] focus:outline-none focus:border-accent-teal';
const areaClass = 'w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px] placeholder-[rgba(255,255,255,0.3)] focus:outline-none focus:border-accent-teal';
const cardClass = 'bg-bg-surface rounded-[12px] border border-[rgba(255,255,255,0.08)] p-6';
const labelClass = 'block text-text-secondary text-sm mb-1';
const subHeadingClass = 'text-md font-semibold text-text-primary mt-6 mb-3';

let tabKeyCounter = 0;
const nextKey = () => `tab-${Date.now()}-${tabKeyCounter++}`;

function emptyTab(): TabData {
  const today = todayYmd();
  return {
    key: nextKey(),
    locationId: null,
    locationCodeInput: '',
    locationData: null,
    startDate: today,
    endDate: today,
    available: 'unknown',
    actionOpen: false,
    actionLabel: '',
    opmerkingen: '',
  };
}


function tabColor(t: TabData): string {
  if (t.actionOpen) return 'bg-orange-500/20 ring-orange-500/60 text-orange-200';
  if (t.available === 'yes') return 'bg-green-500/20 ring-green-500/60 text-green-200';
  if (t.available === 'no') return 'bg-red-500/20 ring-red-500/60 text-red-200';
  return 'bg-[rgba(255,255,255,0.06)] ring-[rgba(255,255,255,0.15)] text-[rgba(255,255,255,0.7)]';
}

function tabColorActive(t: TabData): string {
  if (t.actionOpen) return 'bg-orange-500/40 ring-orange-400 text-orange-100';
  if (t.available === 'yes') return 'bg-green-500/40 ring-green-400 text-green-100';
  if (t.available === 'no') return 'bg-red-500/40 ring-red-400 text-red-100';
  return 'bg-[rgba(255,255,255,0.15)] ring-[rgba(255,255,255,0.3)] text-white';
}

function fromLocProjectLocation(l: LocProjectLocation): TabData {
  const today = todayYmd();
  return {
    key: nextKey(),
    locationId: l.locationId,
    locationCodeInput: l.location?.code ?? '',
    locationData: l.location ?? null,
    startDate: toDateInput(l.startDate) || today,
    endDate: toDateInput(l.endDate) || today,
    available: l.available,
    actionOpen: l.actionOpen,
    actionLabel: l.actionLabel ?? '',
    opmerkingen: l.opmerkingen,
  };
}

export default function LocProjectForm({ projectId, onBack, onCreated, onDeleted, onOpenLocation }: Props) {
  const toast = useToast();
  const [klanten, setKlanten] = useState<Klant[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [project, setProject] = useState<LocProject | null>(null);
  const [loading, setLoading] = useState(projectId !== 'new');
  const [saving, setSaving] = useState(false);
  const [klantId, setKlantId] = useState<number | ''>('');
  const [projectNumber, setProjectNumber] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<LocProjectStatus>('starten');
  const [contacts, setContacts] = useState<Array<{ mode: 'pulldown' | 'manual'; naam: string; email: string; telefoon: string }>>([{ mode: 'pulldown', naam: '', email: '', telefoon: '' }]);
  const [notities, setNotities] = useState('');
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [activeTabIdx, setActiveTabIdx] = useState<number>(0);
  const [klantContacts, setKlantContacts] = useState<Array<{ naam: string; email: string | null; telefoon: string | null }>>([]);
  const [projectOpen, setProjectOpen] = useState(true);
  const [locOpen, setLocOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(true);
  const dragFromRef = useRef<number | null>(null);

  // Initial load: klanten, locations, project (if editing)
  useEffect(() => {
    (async () => {
      const [k, locs] = await Promise.all([fetchKlanten(), fetchLocations()]);
      setKlanten(k);
      setLocations(locs);
      if (projectId !== 'new') {
        try {
          const p = await fetchLocProject(projectId);
          setProject(p);
          setKlantId(p.klantId);
          setProjectNumber(p.projectNumber);
          setName(p.name ?? '');
          setStatus(p.status);
          const rows = (p.contacts ?? []).map((c): { mode: 'pulldown' | 'manual'; naam: string; email: string; telefoon: string } => ({
            mode: 'pulldown',
            naam: c.naam,
            email: c.email ?? '',
            telefoon: c.telefoon ?? '',
          }));
          if (rows.length === 0 && (p.contactPerson || p.email || p.telefoon)) {
            rows.push({ mode: 'pulldown', naam: p.contactPerson ?? '', email: p.email ?? '', telefoon: p.telefoon ?? '' });
          }
          setContacts(rows.length ? rows : [{ mode: 'pulldown', naam: '', email: '', telefoon: '' }]);
          setNotities(p.notities ?? '');
          setTabs((p.locations ?? []).map(fromLocProjectLocation));
          setActiveTabIdx(0);
        } finally { setLoading(false); }
      }
    })();
  }, [projectId]);

  // Laad klant-contacts als klantId wijzigt zodat pulldowns actueel zijn.
  // Eerste contact-rij krijgt automatisch de eerste klant-contact (als die rij nog leeg is).
  useEffect(() => {
    if (!klantId) { setKlantContacts([]); return; }
    fetchKlant(klantId).then((k) => {
      const primary = (k.contacts && k.contacts.length > 0)
        ? k.contacts.map((c) => ({ naam: c.naam, email: c.email, telefoon: c.telefoon }))
        : [];
      if (primary.length === 0 && (k.contactPerson || k.email)) {
        primary.push({ naam: k.contactPerson ?? '', email: k.email, telefoon: null });
      }
      setKlantContacts(primary);
      // Auto-fill alleen bij nieuwe projecten — anders maakt dit form dirty direct na load
      // wanneer het bestaande project een lege primary contact-rij had.
      if (projectId === 'new' && primary.length > 0) {
        setContacts((prev) => {
          const first = prev[0];
          if (first && (first.naam || first.email || first.telefoon)) return prev;
          const copy = [...prev];
          copy[0] = { mode: 'pulldown', naam: primary[0].naam, email: primary[0].email ?? '', telefoon: primary[0].telefoon ?? '' };
          return copy;
        });
      }
    }).catch(() => setKlantContacts([]));
  }, [klantId]);

  const filledContacts = useMemo(
    () => contacts.filter((c) => c.naam.trim() || c.email.trim() || c.telefoon.trim()),
    [contacts],
  );

  const baseDirty = useMemo(() => {
    if (projectId === 'new') {
      return !!(klantId || projectNumber || name || filledContacts.length > 0 || notities || tabs.length > 0);
    }
    if (!project) return false;
    const origContacts = (project.contacts ?? []).map((c) => ({ naam: c.naam, email: c.email ?? '', telefoon: c.telefoon ?? '' }));
    return (
      project.klantId !== klantId ||
      project.projectNumber !== projectNumber ||
      (project.name ?? '') !== name ||
      project.status !== status ||
      (project.notities ?? '') !== notities ||
      JSON.stringify(origContacts) !== JSON.stringify(filledContacts) ||
      JSON.stringify((project.locations ?? []).map((l) => ({
        locationId: l.locationId, startDate: toDateInput(l.startDate), endDate: toDateInput(l.endDate),
        available: l.available, actionOpen: l.actionOpen, actionLabel: l.actionLabel ?? '', opmerkingen: l.opmerkingen,
      }))) !== JSON.stringify(tabs.map((t) => ({
        locationId: t.locationId, startDate: t.startDate, endDate: t.endDate,
        available: t.available, actionOpen: t.actionOpen, actionLabel: t.actionLabel, opmerkingen: t.opmerkingen,
      })))
    );
  }, [project, projectId, klantId, projectNumber, name, status, filledContacts, notities, tabs]);

  useUnsavedChanges(baseDirty);

  const updateTab = (idx: number, patch: Partial<TabData>) => {
    setTabs((ts) => ts.map((t, i) => i === idx ? { ...t, ...patch } : t));
  };

  const addTab = () => {
    setTabs((ts) => [...ts, emptyTab()]);
    setActiveTabIdx(tabs.length);
  };

  const removeTab = (idx: number) => {
    if (!confirm('Deze locatie-tab verwijderen?')) return;
    setTabs((ts) => ts.filter((_, i) => i !== idx));
    setActiveTabIdx((i) => Math.max(0, i >= idx ? i - 1 : i));
  };

  const handleDragStart = (idx: number) => (e: React.DragEvent) => {
    dragFromRef.current = idx;
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragFromRef.current;
    dragFromRef.current = null;
    if (from === null || from === idx) return;
    setTabs((ts) => {
      const copy = [...ts];
      const [moved] = copy.splice(from, 1);
      copy.splice(idx, 0, moved);
      return copy;
    });
    setActiveTabIdx(idx);
  };

  // Locatie zoeken op code (AMS_001) — kiest exact matchen bij typen.
  const resolveLocationByCode = (code: string): Location | null => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return null;
    return locations.find((l) => l.code?.toUpperCase() === trimmed) ?? null;
  };

  const onLocationCodeChange = (idx: number, code: string) => {
    updateTab(idx, { locationCodeInput: code });
    const match = resolveLocationByCode(code);
    if (match) {
      updateTab(idx, { locationId: match.id, locationData: match, locationCodeInput: match.code ?? code });
    } else {
      updateTab(idx, { locationId: null, locationData: null });
    }
  };

  // Bij expliciet selecteren uit suggesties verversen we ook de volledige locatiedata.
  const selectLocationSuggestion = async (idx: number, loc: Location) => {
    try {
      const full = await fetchLocation(loc.id);
      updateTab(idx, {
        locationId: full.id,
        locationData: full,
        locationCodeInput: full.code ?? '',
      });
    } catch {
      updateTab(idx, { locationId: loc.id, locationData: loc, locationCodeInput: loc.code ?? '' });
    }
  };

  const save = async () => {
    if (!klantId) { toast.error('Kies een klant'); return; }
    if (!projectNumber.trim()) { toast.error('Projectnummer is verplicht'); return; }
    setSaving(true);
    try {
      const input: LocProjectWriteInput = {
        klantId: Number(klantId),
        projectNumber: projectNumber.trim(),
        name: name.trim() || null,
        status,
        contacts: filledContacts.map((c) => ({
          naam: c.naam.trim(),
          email: c.email.trim() || null,
          telefoon: c.telefoon.trim() || null,
        })),
        notities,
        locations: tabs.filter((t) => t.locationId !== null).map((t) => ({
          locationId: t.locationId!,
          startDate: t.startDate || null,
          endDate: t.endDate || null,
          available: t.available,
          actionOpen: t.actionOpen,
          actionLabel: t.actionLabel.trim() || null,
          opmerkingen: t.opmerkingen,
        })),
      };
      if (projectId === 'new') {
        const created = await createLocProject(input);
        toast.success(`Project ${created.projectNumber} aangemaakt`);
        onCreated(created.id);
      } else {
        const updated = await updateLocProject(projectId, input);
        setProject(updated);
        toast.success('Wijzigingen opgeslagen');
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Opslaan mislukt');
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (projectId === 'new') return;
    if (!confirm('Project verwijderen?')) return;
    await deleteLocProject(projectId);
    toast.success('Project verwijderd');
    onDeleted();
  };

  const headerTitle = useMemo(() => {
    const klant = klanten.find((k) => k.id === Number(klantId));
    const parts = [projectNumber, klant?.name, name].filter(Boolean);
    return parts.length ? parts.join('_') : 'Nieuw project';
  }, [projectNumber, klantId, klanten, name]);

  const active = tabs[activeTabIdx] ?? null;

  if (loading) return <div className="mx-auto max-w-5xl px-6 py-8 text-text-muted">Laden…</div>;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary truncate">{headerTitle}</h1>
        <div className="flex items-center gap-2">
          {projectId !== 'new' && (
            <button onClick={del} className="px-4 py-2 rounded-[6px] text-red-400 hover:text-red-300 border border-red-500/30 hover:bg-red-500/10 transition-colors cursor-pointer">Verwijderen</button>
          )}
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-[6px] bg-accent-teal text-[#1a3a38] font-semibold hover:opacity-85 transition-opacity cursor-pointer disabled:opacity-50">
            {saving ? 'Opslaan…' : 'Opslaan'}
          </button>
          <button onClick={onBack} className="px-4 py-2 rounded-[6px] text-text-secondary hover:text-text-primary border border-[rgba(255,255,255,0.12)] transition-colors cursor-pointer">Terug</button>
        </div>
      </div>

      {/* Project form — één card met collapsible subsecties, gelijk aan Planning → Projecten */}
      <div className={`${cardClass} mb-6`}>
        {/* Projectgegevens */}
        <button type="button" onClick={() => setProjectOpen(!projectOpen)} className="flex items-center gap-2 w-full text-left cursor-pointer mb-4">
          <svg width="12" height="12" viewBox="0 0 12 12" className={`text-text-secondary transition-transform ${projectOpen ? 'rotate-90' : ''}`}><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <h2 className="text-lg font-semibold text-text-primary">Projectgegevens</h2>
        </button>
        <div style={{ display: projectOpen ? 'block' : 'none' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Klant *</label>
              <select className={inputClass} value={klantId} onChange={(e) => setKlantId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">— Kies klant —</option>
                {klanten.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Projectnummer * <span className="text-text-muted text-[11px] font-normal">(bv. 2026-042, zoals in Gripp)</span></label>
              <input className={inputClass} value={projectNumber} onChange={(e) => setProjectNumber(e.target.value)} placeholder="2026-042" />
            </div>
            <div>
              <label className={labelClass}>Projectnaam</label>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Naam van het project" />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as LocProjectStatus)}>
                <option value="starten">Starten</option>
                <option value="bezig">Bezig</option>
                <option value="afgerond">Afgerond</option>
              </select>
            </div>
          </div>

          {/* Contact — elke contactpersoon is één rij: [naam-pulldown/invoer | email | telefoon] */}
          <h3 className={subHeadingClass}>Contact</h3>
          <div className="space-y-3">
            {contacts.map((c, i) => {
              const usedNames = contacts.filter((_, j) => j !== i).map((x) => x.naam).filter(Boolean);
              const availableKlantContacts = klantContacts.filter((kc) => !usedNames.includes(kc.naam));
              const isPrimary = i === 0;
              const label = isPrimary ? 'Contactpersoon (primair)' : `Contactpersoon ${i + 1}`;
              // Als er geen klant-contacten meer beschikbaar zijn, dwing handmatig
              const effectiveMode = availableKlantContacts.length === 0 ? 'manual' : c.mode;
              return (
                <div key={i}>
                  <label className="text-text-secondary text-xs block mb-1">{label}</label>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-stretch">
                    {effectiveMode === 'pulldown' ? (
                      <select
                        className={inputClass}
                        value={availableKlantContacts.some((kc) => kc.naam === c.naam) ? c.naam : ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '__manual__') {
                            setContacts(contacts.map((x, j) => j === i ? { mode: 'manual', naam: '', email: '', telefoon: '' } : x));
                          } else {
                            const chosen = klantContacts.find((kc) => kc.naam === v);
                            if (chosen) {
                              setContacts(contacts.map((x, j) => j === i ? { mode: 'pulldown', naam: chosen.naam, email: chosen.email ?? '', telefoon: chosen.telefoon ?? '' } : x));
                            }
                          }
                        }}
                      >
                        {!availableKlantContacts.some((kc) => kc.naam === c.naam) && (
                          <option value="" disabled>— Kies contact —</option>
                        )}
                        {availableKlantContacts.map((kc) => <option key={kc.naam} value={kc.naam}>{kc.naam}</option>)}
                        <option value="__manual__">— Handmatig invoeren —</option>
                      </select>
                    ) : (
                      <div className="relative">
                        <input
                          className={`${inputClass} pr-9`}
                          placeholder="Naam"
                          value={c.naam}
                          onChange={(e) => setContacts(contacts.map((x, j) => j === i ? { ...x, naam: e.target.value } : x))}
                        />
                        {availableKlantContacts.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setContacts(contacts.map((x, j) => j === i ? { mode: 'pulldown', naam: '', email: '', telefoon: '' } : x))}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-white text-xs px-1 cursor-pointer"
                            title="Kies uit klant-contactpersonen"
                          >
                            ▾
                          </button>
                        )}
                      </div>
                    )}
                    <input
                      className={inputClass}
                      type="email"
                      placeholder="Email"
                      value={c.email}
                      onChange={(e) => setContacts(contacts.map((x, j) => j === i ? { ...x, email: e.target.value } : x))}
                    />
                    <input
                      className={inputClass}
                      type="tel"
                      placeholder="Telefoon"
                      value={c.telefoon}
                      onChange={(e) => setContacts(contacts.map((x, j) => j === i ? { ...x, telefoon: e.target.value } : x))}
                    />
                    {!isPrimary ? (
                      <div className="flex items-center md:pr-3">
                        <button
                          type="button"
                          onClick={() => setContacts(contacts.filter((_, j) => j !== i))}
                          title="Verwijder contactpersoon"
                          className="w-10 h-full rounded-[8px] bg-green-900/60 hover:bg-red-500/80 text-green-200 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9M18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397M4.772 5.79c.34-.059.68-.114 1.022-.165M18.16 5.79c-.34-.059-.68-.114-1.022-.165M15.14 5.625v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="w-10 hidden md:block md:pr-3" />
                    )}
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => {
                const usedNames = contacts.map((c) => c.naam).filter(Boolean);
                const nextAvailable = klantContacts.find((kc) => !usedNames.includes(kc.naam));
                if (nextAvailable) {
                  setContacts([...contacts, { mode: 'pulldown', naam: nextAvailable.naam, email: nextAvailable.email ?? '', telefoon: nextAvailable.telefoon ?? '' }]);
                } else {
                  setContacts([...contacts, { mode: 'manual', naam: '', email: '', telefoon: '' }]);
                }
              }}
              className="px-3 py-1.5 rounded-[6px] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] text-text-secondary hover:text-white text-sm cursor-pointer"
            >
              + Contactpersoon toevoegen
            </button>
          </div>
        </div>
      </div>

      {/* Locaties — aparte card met eigen collapsible */}
      <div className={`${cardClass} mb-6`}>
        <button type="button" onClick={() => setLocOpen(!locOpen)} className="flex items-center gap-2 w-full text-left cursor-pointer mb-4">
          <svg width="12" height="12" viewBox="0 0 12 12" className={`text-text-secondary transition-transform ${locOpen ? 'rotate-90' : ''}`}><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <h2 className="text-lg font-semibold text-text-primary">Locaties</h2>
          {tabs.length > 0 && <span className="text-text-muted text-sm font-normal">({tabs.length})</span>}
        </button>
        <div style={{ display: locOpen ? 'block' : 'none' }}>
        <div className="flex items-center gap-2 mb-4 overflow-x-auto px-0.5 py-1">
          {tabs.map((t, i) => (
            <div
              key={t.key}
              draggable
              onDragStart={handleDragStart(i)}
              onDragOver={handleDragOver}
              onDrop={handleDrop(i)}
              onClick={() => setActiveTabIdx(i)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ring-1 cursor-pointer whitespace-nowrap text-[12px] font-medium ${i === activeTabIdx ? tabColorActive(t) : tabColor(t)}`}
            >
              <span className="font-mono">{t.locationData?.code || t.locationCodeInput || '—'}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); removeTab(i); }} className="opacity-60 hover:opacity-100" title="Verwijderen">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
          <button type="button" onClick={addTab} className="flex items-center gap-1 h-8 px-3 rounded-lg bg-accent-teal text-[#1a3a38] text-[12px] font-semibold hover:opacity-85 cursor-pointer whitespace-nowrap">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Locatie toevoegen
          </button>
        </div>

        {active && <LocTabPanel
          tab={active}
          locations={locations}
          onPatch={(patch) => updateTab(activeTabIdx, patch)}
          onSelectSuggestion={(loc) => selectLocationSuggestion(activeTabIdx, loc)}
          onCodeChange={(code) => onLocationCodeChange(activeTabIdx, code)}
          onOpenLocation={onOpenLocation}
        />}

        {tabs.length === 0 && (
          <p className="text-text-muted text-sm italic">Klik "Locatie toevoegen" om te beginnen.</p>
        )}
        </div>
      </div>

      {/* Notities */}
      <div className={`${cardClass} mb-6`}>
        <button type="button" onClick={() => setNotesOpen(!notesOpen)} className="flex items-center gap-2 w-full text-left cursor-pointer mb-4">
          <svg width="12" height="12" viewBox="0 0 12 12" className={`text-text-secondary transition-transform ${notesOpen ? 'rotate-90' : ''}`}><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <h2 className="text-lg font-semibold text-text-primary">Notities</h2>
        </button>
        <div style={{ display: notesOpen ? 'block' : 'none' }}>
          <textarea className={areaClass} rows={6} value={notities} onChange={(e) => setNotities(e.target.value)} placeholder="Project-brede opmerkingen…" />
        </div>
      </div>
    </div>
  );
}

interface LocTabPanelProps {
  tab: TabData;
  locations: Location[];
  onPatch: (patch: Partial<TabData>) => void;
  onSelectSuggestion: (loc: Location) => void;
  onCodeChange: (code: string) => void;
  onOpenLocation: (id: number) => void;
}

function LocTabPanel({ tab, locations, onPatch, onSelectSuggestion, onCodeChange, onOpenLocation }: LocTabPanelProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestions = useMemo(() => {
    const q = tab.locationCodeInput.trim().toUpperCase();
    if (!q) return [];
    return locations
      .filter((l) => l.code?.toUpperCase().startsWith(q) || l.naam.toUpperCase().includes(q))
      .slice(0, 8);
  }, [locations, tab.locationCodeInput]);

  const dailyCents = (tab.locationData?.costs ?? []).reduce((s, c) => s + c.bedragCents, 0);
  const days = daysBetween(tab.startDate, tab.endDate);
  const totalCents = dailyCents * days;

  return (
    <div className="rounded-[8px] bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.06)] p-5">
      {/* Locatie selector */}
      <div className="flex items-end gap-3 mb-4">
        <div className="flex-1 relative">
          <label className="block text-[12px] text-[rgba(255,255,255,0.6)] mb-1">Locatie (code of naam)</label>
          <input
            className={inputClass}
            value={tab.locationCodeInput}
            onChange={(e) => { onCodeChange(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="bv. AMS_001"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-bg-surface ring-1 ring-[rgba(255,255,255,0.12)] rounded-lg shadow-xl z-10 max-h-60 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onSelectSuggestion(s); setShowSuggestions(false); }}
                  className="w-full px-3 py-2 text-left text-white text-[13px] hover:bg-[rgba(255,255,255,0.08)] cursor-pointer flex items-center gap-2"
                >
                  <span className="font-mono text-accent-teal">{s.code || '—'}</span>
                  <span>{s.naam}</span>
                  <span className="text-[rgba(255,255,255,0.4)] ml-auto text-[12px]">{s.stad || s.land}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          disabled={!tab.locationId}
          onClick={() => tab.locationId && onOpenLocation(tab.locationId)}
          className="h-10 px-4 rounded-lg bg-[rgba(255,255,255,0.06)] ring-1 ring-[rgba(255,255,255,0.15)] text-white text-[13px] hover:bg-[rgba(255,255,255,0.12)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          Ga naar locatie →
        </button>
      </div>

      {/* Samenvatting */}
      {tab.locationData && (
        <div className="mb-4 p-4 rounded-lg bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.06)]">
          <div className="flex items-start gap-4">
            {tab.locationData.photos && tab.locationData.photos.length > 0 ? (
              <img
                src={`/uploads/Locaties/${tab.locationData.id}/${(tab.locationData.photos.find((p) => p.isMain) ?? tab.locationData.photos[0]).filename}`}
                alt=""
                className="w-40 aspect-video rounded-lg object-cover ring-1 ring-[rgba(255,255,255,0.08)] shrink-0"
              />
            ) : (
              <div className="w-40 aspect-video rounded-lg bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.06)] shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-accent-teal/20 text-accent-teal">{tab.locationData.code ?? '—'}</span>
                <h3 className="text-white font-semibold truncate">{tab.locationData.naam}</h3>
              </div>
              <p className="text-[rgba(255,255,255,0.55)] text-[13px] truncate">{tab.locationData.adres}</p>
              <div className="flex gap-3 mt-2 flex-wrap text-[11px] text-[rgba(255,255,255,0.5)]">
                {tab.locationData.m2 && <span>{tab.locationData.m2} m²</span>}
                {tab.locationData.stroom && <span>• Stroom</span>}
                {tab.locationData.verlichting && <span>• Verlichting</span>}
                {tab.locationData.truckBereikbaar && <span>• Bakwagen</span>}
                {tab.locationData.geschiktActivatie && <span>• Activatie</span>}
                {tab.locationData.geschiktSampling && <span>• Sampling</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Datums + kosten */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-[rgba(255,255,255,0.6)]">Van</span>
          <input type="date" className={inputClass} value={tab.startDate} onChange={(e) => onPatch({ startDate: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-[rgba(255,255,255,0.6)]">Tot</span>
          <input type="date" className={inputClass} value={tab.endDate} onChange={(e) => onPatch({ endDate: e.target.value })} />
        </label>
      </div>

      <div className="mb-4 p-3 rounded-lg bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.06)] flex items-center justify-between text-[13px]">
        <div className="text-[rgba(255,255,255,0.7)]">
          Kosten per dag: <span className="text-white font-semibold">{fmtEur(dailyCents)}</span>
          {days > 0 && <span className="ml-3 text-[rgba(255,255,255,0.4)]">× {days} {days === 1 ? 'dag' : 'dagen'}</span>}
        </div>
        <div className="text-accent-teal font-semibold">Totaal: {fmtEur(totalCents)}</div>
      </div>

      {/* Acties */}
      <div className="mb-4">
        <label className="block text-[12px] text-[rgba(255,255,255,0.6)] mb-2">Actie openstaand</label>
        <div className="flex items-center gap-2 flex-wrap">
          {(['Contact opnemen', 'Terug bellen', 'Mail sturen'] as const).map((lbl) => {
            const isSelected = tab.actionOpen && tab.actionLabel === lbl;
            return (
              <button
                key={lbl}
                type="button"
                onClick={() => onPatch(isSelected ? { actionOpen: false, actionLabel: '' } : { actionOpen: true, actionLabel: lbl })}
                className={`h-8 px-3 rounded-lg ring-1 text-[12px] font-medium cursor-pointer ${
                  isSelected
                    ? 'bg-orange-500/30 ring-orange-400 text-orange-100'
                    : 'bg-[rgba(255,255,255,0.04)] ring-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.08)]'
                }`}
              >
                {lbl}
              </button>
            );
          })}
          <input
            className={`${inputClass} flex-1 min-w-[200px] h-8 text-[12px]`}
            placeholder="Andere actie…"
            value={!['Contact opnemen', 'Terug bellen', 'Mail sturen'].includes(tab.actionLabel) ? tab.actionLabel : ''}
            onChange={(e) => onPatch({ actionOpen: !!e.target.value, actionLabel: e.target.value })}
          />
          {tab.actionOpen && !['Contact opnemen', 'Terug bellen', 'Mail sturen'].includes(tab.actionLabel) && (
            <button type="button" onClick={() => onPatch({ actionOpen: false, actionLabel: '' })} className="h-8 px-3 rounded-lg bg-green-500/10 ring-1 ring-green-500/30 text-green-300 text-[12px] font-medium cursor-pointer">
              Actie afronden
            </button>
          )}
        </div>
      </div>

      {/* Beschikbaar */}
      <div className="mb-4">
        <label className="block text-[12px] text-[rgba(255,255,255,0.6)] mb-2">Beschikbaar voor dit project</label>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer">
            <input type="radio" checked={tab.available === 'yes'} onChange={() => onPatch({ available: 'yes' })} /> Ja
          </label>
          <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer">
            <input type="radio" checked={tab.available === 'no'} onChange={() => onPatch({ available: 'no' })} /> Nee
          </label>
          <label className="flex items-center gap-2 text-[14px] text-[rgba(255,255,255,0.5)] cursor-pointer">
            <input type="radio" checked={tab.available === 'unknown'} onChange={() => onPatch({ available: 'unknown' })} /> Onbekend
          </label>
        </div>
      </div>

      {/* Opmerkingen */}
      <div>
        <label className="block text-[12px] text-[rgba(255,255,255,0.6)] mb-1">Opmerkingen</label>
        <textarea className={areaClass} rows={4} value={tab.opmerkingen} onChange={(e) => onPatch({ opmerkingen: e.target.value })} placeholder="bv. telefonisch contact 20-4, belt terug…" />
      </div>
    </div>
  );
}
