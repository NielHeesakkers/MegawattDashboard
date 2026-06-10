import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Project, ProjectLocation, ProjectWriteInput, ProjectStatus,
  Klant, Location, AvailabilityState, Toeleverancier, Specialisme, Supercharger, ProjectPreferences,
  fetchProject, createProject, updateProject, updateProjectShare, deleteProject, fetchProjectPreferences,
  fetchKlanten, fetchLocations, fetchLocation, fetchToeleveranciers, fetchSpecialismes, fetchSuperchargers,
} from '../../api';
import { formatPhone } from '../../shared/phone';
import { useToast } from '../ui/Toast';
import { useAutoSave, SaveIndicator } from '../../hooks/useAutoSave';
import { todayYmd, toDateInput, daysBetween, fmtEur, dateRange, fmtShortDate } from './locProjectHelpers';
import ProjectFilesSection from './ProjectFilesSection';
import LocatieMap from './LocatieMap';
import ProjectForm from '../admin/ProjectForm';

interface Props {
  projectId: number | 'new';
  onCreated: (id: number) => void;
  onDeleted: () => void;
  onOpenLocation: (id: number) => void;
}

/** Per-locatie supercharger-rij met availability per datum. */
interface TabSupercharger {
  superchargerId: number;
  /** key = ISO-date 'YYYY-MM-DD', value = beschikbaar/ingezet */
  availability: Record<string, boolean>;
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
  superchargers: TabSupercharger[];
  superchargersOpen: boolean;
}

// Layout-stijl gelijk aan Planning → Projecten (donkere cards + donkere inputs)
const inputClass = 'w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px] placeholder-[rgba(255,255,255,0.3)] focus:outline-none focus:border-accent-teal';
// Zelfde stijl maar zónder w-full, voor flex-rijen (deel-link) waar breedtes via flex bepaald worden.
const inputClassFlex = 'px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px] placeholder-[rgba(255,255,255,0.3)] focus:outline-none focus:border-accent-teal';
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
    superchargers: [],
    superchargersOpen: false,
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

function parseAvailability(raw: string | undefined): Record<string, boolean> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.warn('[parseAvailability] availability is geen object:', raw);
      return {};
    }
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) out[k] = !!v;
    return out;
  } catch (err) {
    console.warn('[parseAvailability] kon niet parsen:', raw, err);
    return {};
  }
}

/** Stabiele JSON-string voor dirty-vergelijking — sorteert keys zodat insertion-order niet uitmaakt. */
function stableAvailabilityJson(av: Record<string, boolean>): string {
  const keys = Object.keys(av).sort();
  const out: Record<string, boolean> = {};
  for (const k of keys) out[k] = av[k];
  return JSON.stringify(out);
}

function fromProjectLocation(l: ProjectLocation): TabData {
  const today = todayYmd();
  const scs: TabSupercharger[] = (l.superchargers ?? []).map((s) => ({
    superchargerId: s.superchargerId,
    availability: parseAvailability(s.availability),
  }));
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
    superchargers: scs,
    superchargersOpen: scs.length > 0,
  };
}

export default function LocProjectForm({ projectId, onCreated, onDeleted, onOpenLocation }: Props) {
  const toast = useToast();
  const [klanten, setKlanten] = useState<Klant[]>([]);
  const [allToeleveranciers, setAllToeleveranciers] = useState<Toeleverancier[]>([]);
  const [allSuperchargers, setAllSuperchargers] = useState<Supercharger[]>([]);
  const [allSpecialismes, setAllSpecialismes] = useState<Specialisme[]>([]);
  const [selectedToeleverancierIds, setSelectedToeleverancierIds] = useState<Array<number | null>>([]);
  const [toeleverancierPhones, setToeleverancierPhones] = useState<string[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(projectId !== 'new');
  const [klantId, setKlantId] = useState<number | ''>('');
  const [projectNumber, setProjectNumber] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [notities, setNotities] = useState('');
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [activeTabIdx, setActiveTabIdx] = useState<number>(0);
  const [projectOpen, setProjectOpen] = useState(true);
  const [locOpen, setLocOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(true);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [sharePasswordInput, setSharePasswordInput] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [preferences, setPreferences] = useState<ProjectPreferences>({});
  const dragFromRef = useRef<number | null>(null);

  // Initial load: klanten, locations, project (if editing)
  useEffect(() => {
    (async () => {
      const [k, locs, toels, specs, scs] = await Promise.all([fetchKlanten(), fetchLocations(), fetchToeleveranciers(), fetchSpecialismes(), fetchSuperchargers()]);
      setKlanten(k);
      setLocations(locs);
      setAllToeleveranciers(toels);
      setAllSpecialismes(specs);
      setAllSuperchargers(scs);
      if (projectId !== 'new') {
        try {
          const p = await fetchProject(projectId);
          setProject(p);
          setKlantId(p.klantId);
          setProjectNumber(p.projectNumber);
          setName(p.name ?? '');
          setStatus(p.status);
          setSelectedToeleverancierIds((p.toeleveranciers ?? []).map((t) => t.toeleverancierId));
          setToeleverancierPhones((p.toeleveranciers ?? []).map((t) => t.telefoon ?? ''));
          setNotities(p.notities ?? '');
          setTabs((p.locations ?? []).map(fromProjectLocation));
          setShareToken(p.locationShareToken ?? null);
          setSharePasswordInput(p.locationSharePassword ?? '');
          setActiveTabIdx(0);
        } finally { setLoading(false); }
      }
    })();
  }, [projectId]);

  useEffect(() => {
    if (typeof projectId !== 'number') return;
    fetchProjectPreferences(projectId).then(setPreferences).catch(() => {});
  }, [projectId]);

  // ── Deelbare locatie-link ──────────────────────────────────────────────────
  const projId = typeof projectId === 'number' ? projectId : null;
  const shareUrl = shareToken ? `${window.location.origin}/locaties/deel/${shareToken}` : '';

  const applyShare = async (body: { password?: string | null }) => {
    if (projId == null) return;
    setShareBusy(true);
    try {
      const r = await updateProjectShare(projId, body);
      setShareToken(r.shareToken);
      setSharePasswordInput(r.password ?? '');
    } catch {
      toast.error('Kon deel-instelling niet opslaan');
    } finally {
      setShareBusy(false);
    }
  };

  const copyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1500);
    } catch { /* clipboard niet beschikbaar */ }
  };

  const baseDirty = useMemo(() => {
    if (projectId === 'new') {
      return !!(klantId || projectNumber || name || notities || tabs.length > 0 || selectedToeleverancierIds.length > 0);
    }
    if (!project) return false;
    const origToelIds = [...((project.toeleveranciers ?? []).map((t) => t.toeleverancierId))].sort((a, b) => a - b);
    const curToelIds = selectedToeleverancierIds.filter((id): id is number => id !== null).sort((a, b) => a - b);
    const origToelPhones = (project.toeleveranciers ?? []).map((t) => t.telefoon ?? '').join(',');
    const curToelPhones = selectedToeleverancierIds.map((_, i) => toeleverancierPhones[i] ?? '').join(',');
    return (
      project.klantId !== klantId ||
      project.projectNumber !== projectNumber ||
      (project.name ?? '') !== name ||
      project.status !== status ||
      (project.notities ?? '') !== notities ||
      JSON.stringify(origToelIds) !== JSON.stringify(curToelIds) ||
      origToelPhones !== curToelPhones ||
      JSON.stringify((project.locations ?? []).map((l) => ({
        locationId: l.locationId, startDate: toDateInput(l.startDate), endDate: toDateInput(l.endDate),
        available: l.available, actionOpen: l.actionOpen, actionLabel: l.actionLabel ?? '', opmerkingen: l.opmerkingen,
        superchargers: (l.superchargers ?? []).map((s) => ({ id: s.superchargerId, av: stableAvailabilityJson(parseAvailability(s.availability)) })),
      }))) !== JSON.stringify(tabs.map((t) => ({
        locationId: t.locationId, startDate: t.startDate, endDate: t.endDate,
        available: t.available, actionOpen: t.actionOpen, actionLabel: t.actionLabel, opmerkingen: t.opmerkingen,
        superchargers: t.superchargers.map((s) => ({ id: s.superchargerId, av: stableAvailabilityJson(s.availability) })),
      })))
    );
  }, [project, projectId, klantId, projectNumber, name, status, notities, tabs, selectedToeleverancierIds]);

  // (auto-save vervangt de unsaved-changes prompt)
  void baseDirty;

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
    // Validatie — alleen saven als minimum vereist is
    if (!klantId || !projectNumber.trim()) return;
    const input: ProjectWriteInput = {
      klantId: Number(klantId),
      projectNumber: projectNumber.trim(),
      name: name.trim() || null,
      status,
      notities,
      locations: tabs.filter((t) => t.locationId !== null).map((t) => ({
        locationId: t.locationId!,
        startDate: t.startDate || null,
        endDate: t.endDate || null,
        available: t.available,
        actionOpen: t.actionOpen,
        actionLabel: t.actionLabel.trim() || null,
        opmerkingen: t.opmerkingen,
        superchargers: t.superchargers.map((s) => ({
          superchargerId: s.superchargerId,
          availability: s.availability,
        })),
      })),
      toeleverancierIds: selectedToeleverancierIds
        .map((id, i) => id !== null ? { id, telefoon: toeleverancierPhones[i]?.trim() || null } : null)
        .filter((r): r is { id: number; telefoon: string | null } => r !== null),
    };
    if (projectId === 'new') {
      const created = await createProject(input);
      onCreated(created.id);
    } else {
      const updated = await updateProject(projectId, input);
      setProject(updated);
    }
  };

  // Auto-save data — sluit pure UI-state uit (key, locationCodeInput, superchargersOpen)
  // zodat collapse/expand of typen-zonder-resolve geen save triggert.
  const tabsForSave = useMemo(
    () => tabs.map((t) => ({
      locationId: t.locationId,
      startDate: t.startDate,
      endDate: t.endDate,
      available: t.available,
      actionOpen: t.actionOpen,
      actionLabel: t.actionLabel,
      opmerkingen: t.opmerkingen,
      superchargers: t.superchargers.map((s) => ({ id: s.superchargerId, av: stableAvailabilityJson(s.availability) })),
    })),
    [tabs],
  );

  // Auto-save bij elke wijziging — alleen als minimum vereist gevuld is
  const saveStatus = useAutoSave(
    { klantId, projectNumber, name, status, notities, tabsForSave, selectedToeleverancierIds, toeleverancierPhones },
    save,
    { enabled: !!klantId && !!projectNumber.trim() }
  );

  const del = async () => {
    if (projectId === 'new') return;
    if (!confirm('Project verwijderen?')) return;
    await deleteProject(projectId);
    toast.success('Project verwijderd');
    onDeleted();
  };

  const headerTitle = useMemo(() => {
    const klant = klanten.find((k) => k.id === Number(klantId));
    const parts = [projectNumber, klant?.name, name].filter(Boolean);
    return parts.length ? parts.join('_') : 'Nieuw project';
  }, [projectNumber, klantId, klanten, name]);

  const active = tabs[activeTabIdx] ?? null;

  if (loading) return <div className="px-6 py-8 text-text-muted">Laden…</div>;

  return (
    <div className="px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary truncate">{headerTitle}</h1>
        <SaveIndicator status={saveStatus} />
      </div>

      {/* Project form — één card met collapsible subsecties, gelijk aan Planning → Projecten */}
      <div className={`${cardClass} mb-6`}>
        {/* Projectgegevens header — titel links, status pulldown rechts */}
        <div className="flex items-center gap-3 mb-4">
          <button type="button" onClick={() => setProjectOpen(!projectOpen)} className="flex items-center gap-2 flex-1 text-left cursor-pointer">
            <svg width="12" height="12" viewBox="0 0 12 12" className={`text-text-secondary transition-transform ${projectOpen ? 'rotate-90' : ''}`}><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <h2 className="text-lg font-semibold text-text-primary">Projectgegevens</h2>
          </button>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            onClick={(e) => e.stopPropagation()}
            className={`h-8 px-3 rounded-full text-[12px] font-medium ring-1 cursor-pointer focus:outline-none transition-colors ${
              status === 'active'
                ? 'bg-accent-teal/20 text-accent-teal ring-accent-teal/40'
                : status === 'completed'
                ? 'bg-gray-500/15 text-gray-300 ring-gray-500/30'
                : 'bg-red-500/15 text-red-300 ring-red-500/30'
            }`}
          >
            <option value="active">Lopend</option>
            <option value="completed">Gearchiveerd</option>
            <option value="cancelled">Afgewezen</option>
          </select>
        </div>
        <div style={{ display: projectOpen ? 'block' : 'none' }}>
          {/* Projectnr + Klant + Projectnaam op één rij; vaste breedtes zodat alles netjes links uitlijnt */}
          <div className="grid grid-cols-1 md:grid-cols-[9ch_25ch_25ch] gap-4">
            <div>
              <label className={labelClass}>Projectnr.</label>
              <input className={inputClass} value={projectNumber} onChange={(e) => setProjectNumber(e.target.value)} placeholder="Projectnr" />
            </div>
            <div>
              <label className={labelClass}>Klant</label>
              <select className={inputClass} value={klantId} onChange={(e) => setKlantId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">— Kies klant —</option>
                {[...klanten].sort((a, b) => a.name.localeCompare(b.name, 'nl')).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Projectnaam</label>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Naam van het project" />
            </div>
          </div>

          {/* Toeleveranciers — rij-gebaseerd, zelfde structuur als Contact. Pulldown groepeert per specialisme. */}
          <h3 className={subHeadingClass}>Toeleveranciers</h3>
          {allToeleveranciers.length === 0 ? (
            <p className="text-sm text-white/30 italic">Nog geen toeleveranciers aangemaakt.</p>
          ) : (
            <div className="space-y-3">
              {selectedToeleverancierIds.map((tId, i) => {
                const t = allToeleveranciers.find((x) => x.id === tId);
                const primary = t?.contacts?.[0];
                const email = primary?.email ?? t?.email ?? '';
                const defaultTelefoon = primary?.telefoon ?? '';
                const telefoon = toeleverancierPhones[i] ?? defaultTelefoon;

                // Toeleveranciers die NIET door andere rijen geselecteerd zijn (incl. huidige rij blijft beschikbaar)
                const usedByOthers = selectedToeleverancierIds.filter((_, j) => j !== i);
                const available = allToeleveranciers.filter((x) => !usedByOthers.includes(x.id));

                const sortedSpecs = [...allSpecialismes].sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
                const orphans = available.filter((x) => (x.specialismes ?? []).length === 0);

                return (
                  <div key={i}>
                    <div className="grid grid-cols-1 md:grid-cols-[25ch_50ch_12ch_auto] gap-2 items-stretch">
                      <select
                        className={inputClass}
                        value={tId || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) return;
                          const newId = Number(v);
                          setSelectedToeleverancierIds(selectedToeleverancierIds.map((x, j) => j === i ? newId : x));
                          // Reset phone override when switching toeleverancier
                          const phones = [...toeleverancierPhones];
                          phones[i] = '';
                          setToeleverancierPhones(phones);
                        }}
                      >
                        <option value="" disabled>— Kies toeleverancier —</option>
                        {sortedSpecs.map((spec) => {
                          const matching = available
                            .filter((x) => (x.specialismes ?? []).some((s) => s.specialismeId === spec.id))
                            .sort((a, b) => a.name.localeCompare(b.name, 'nl'));
                          if (matching.length === 0) return null;
                          return (
                            <optgroup key={spec.id} label={spec.naam}>
                              {matching.map((x) => (
                                <option key={`${spec.id}-${x.id}`} value={x.id}>{x.name}</option>
                              ))}
                            </optgroup>
                          );
                        })}
                        {orphans.length > 0 && (
                          <optgroup label="Zonder specialisme">
                            {[...orphans].sort((a, b) => a.name.localeCompare(b.name, 'nl')).map((x) => (
                              <option key={x.id} value={x.id}>{x.name}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      {email ? (
                        <a
                          href={`mailto:${email}`}
                          className={`${inputClass} flex items-center truncate hover:border-accent-teal hover:text-accent-teal transition-colors`}
                          title={email}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {email}
                        </a>
                      ) : (
                        <input type="email" className={inputClass} value="" readOnly placeholder="Email" />
                      )}
                      <input
                        type="tel"
                        className={inputClass}
                        value={telefoon}
                        placeholder={defaultTelefoon || 'Telefoon'}
                        onChange={(e) => {
                          const phones = [...toeleverancierPhones];
                          phones[i] = e.target.value;
                          setToeleverancierPhones(phones);
                        }}
                        onBlur={(e) => {
                          const f = formatPhone(e.target.value);
                          if (f !== e.target.value) {
                            const phones = [...toeleverancierPhones];
                            phones[i] = f;
                            setToeleverancierPhones(phones);
                          }
                        }}
                      />
                      <div className="flex items-center md:pr-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedToeleverancierIds(selectedToeleverancierIds.filter((_, j) => j !== i));
                            setToeleverancierPhones(toeleverancierPhones.filter((_, j) => j !== i));
                          }}
                          title="Verwijder toeleverancier"
                          className="w-10 h-full rounded-[8px] bg-green-900/60 hover:bg-red-500/80 text-green-200 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9M18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397M4.772 5.79c.34-.059.68-.114 1.022-.165M18.16 5.79c-.34-.059-.68-.114-1.022-.165M15.14 5.625v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setSelectedToeleverancierIds([...selectedToeleverancierIds, null]);
                  setToeleverancierPhones([...toeleverancierPhones, '']);
                }}
                disabled={selectedToeleverancierIds.length >= allToeleveranciers.length}
                className="px-3 py-1.5 rounded-[6px] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] text-text-secondary hover:text-white text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + Toeleverancier toevoegen
              </button>
            </div>
          )}

          {/* Deelbare locatie-link voor de klant (alleen-lezen overzicht) */}
          <h3 className={subHeadingClass}>Deelbare locatie-link</h3>
          {projId == null ? (
            <p className="text-sm text-white/30 italic">De deel-link verschijnt zodra het project is opgeslagen (kies klant + projectnr.).</p>
          ) : !shareToken ? (
            <p className="text-sm text-white/30 italic">De deel-link wordt aangemaakt…</p>
          ) : (
            <div className="flex items-center gap-2 rounded-[10px] border border-[rgba(45,212,191,0.25)] bg-[rgba(45,212,191,0.06)] p-3">
              <input
                readOnly
                value={shareUrl}
                onFocus={(e) => e.target.select()}
                className={`${inputClassFlex} flex-1 min-w-0 font-mono text-[12px]`}
              />
              <input
                type="text"
                name="megawatt-share-pw"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore
                value={sharePasswordInput}
                onChange={(e) => setSharePasswordInput(e.target.value)}
                placeholder="Optioneel wachtwoord"
                className={`${inputClassFlex} w-[220px] shrink-0`}
              />
              <button
                type="button"
                disabled={shareBusy}
                onClick={() => applyShare({ password: sharePasswordInput.trim() || null })}
                className="shrink-0 px-3 py-2 rounded-[8px] bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.15)] text-white text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Bewaar
              </button>
              <button
                type="button"
                onClick={copyShareLink}
                className="shrink-0 px-3 py-2 rounded-[8px] bg-accent-teal text-[#1a3a38] text-sm font-semibold hover:opacity-85 cursor-pointer"
              >
                {shareCopied ? 'Gekopieerd ✓' : 'Kopieer'}
              </button>
            </div>
          )}
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
          superchargers={allSuperchargers}
          projectId={projectId}
          voters={active.locationId != null ? (preferences[active.locationId] ?? []) : []}
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

      {/* Activaties + Senior-evaluatie — tijdelijk verborgen; haal `false &&` weg om weer te tonen */}
      {false && typeof projectId === 'number' && (
        <ProjectForm projectId={projectId as number} showOnlyActivations />
      )}

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

      {/* Bottom bar: opslaan-status links, verwijder rechts (alleen bij bestaand project) */}
      <div className="flex items-center pt-5 border-t border-[rgba(255,255,255,0.08)]">
        <SaveIndicator status={saveStatus} />
        {projectId !== 'new' && (
          <button
            type="button"
            onClick={del}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916" /></svg>
            Verwijderen
          </button>
        )}
      </div>
    </div>
  );
}

interface LocTabPanelProps {
  tab: TabData;
  locations: Location[];
  superchargers: Supercharger[];
  projectId: number | 'new';
  voters: Array<{ name: string; email: string }>;
  onPatch: (patch: Partial<TabData>) => void;
  onSelectSuggestion: (loc: Location) => void;
  onCodeChange: (code: string) => void;
  onOpenLocation: (id: number) => void;
}

function LocTabPanel({ tab, locations, superchargers, projectId, voters, onPatch, onSelectSuggestion, onCodeChange, onOpenLocation }: LocTabPanelProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestions = useMemo(() => {
    const q = tab.locationCodeInput.trim().toUpperCase();
    // Lege input → volledige lijst (verschijnt bij focus); typen filtert.
    const matches = q
      ? locations.filter((l) => l.code?.toUpperCase().startsWith(q) || l.naam.toUpperCase().includes(q))
      : locations;
    return [...matches].sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '') || a.naam.localeCompare(b.naam));
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

      {/* Samenvatting (1/3) + Map (2/3) naast elkaar */}
      {tab.locationData && (
        <div className="mb-4 grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
          <div className="p-4 rounded-lg bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.06)]">
            {tab.locationData.photos && tab.locationData.photos.length > 0 ? (
              <img
                src={`/uploads/Locaties/${tab.locationData.id}/${(tab.locationData.photos.find((p) => p.isMain) ?? tab.locationData.photos[0]).filename}`}
                alt=""
                className="w-full aspect-video rounded-lg object-cover ring-1 ring-[rgba(255,255,255,0.08)] mb-3"
              />
            ) : (
              <div className="w-full aspect-video rounded-lg bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.06)] mb-3" />
            )}
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
            {voters.length > 0 && (
              <p className="text-[13px] mt-2">
                <span className="text-accent-teal font-medium">★ Voorkeur: {voters.length}</span>
                <span className="text-[rgba(255,255,255,0.55)]"> — {voters.map((v) => v.name).join(', ')}</span>
              </p>
            )}
          </div>

          <LocatieMap
            lat={tab.locationData.lat}
            lng={tab.locationData.lng}
            address={tab.locationData.adres}
            heightClass="h-full min-h-[200px]"
          />
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
          Inschatting kosten per dag: <span className="text-white font-semibold">{fmtEur(dailyCents)}</span>
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

      {/* Bestanden — alleen bij bestaand project */}
      {typeof projectId === 'number' && (
        <div className="mb-4">
          <label className="block text-[12px] text-[rgba(255,255,255,0.6)] mb-2">Bestanden</label>
          <ProjectFilesSection projectId={projectId} />
        </div>
      )}

      {/* Superchargers — tijdelijk verborgen; haal `false &&` weg om weer te tonen */}
      {false && (
      <div className="mb-4">
        {!tab.superchargersOpen ? (
          <button
            type="button"
            onClick={() => onPatch({ superchargersOpen: true })}
            className="flex items-center gap-1.5 h-7 px-3 rounded-lg ring-1 ring-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.5)] text-[12px] font-medium hover:bg-accent hover:text-[#1a3a38] hover:ring-accent transition-all duration-150 cursor-pointer"
          >
            + Superchargers
          </button>
        ) : (
          <SuperchargersBlock
            tab={tab}
            allSuperchargers={superchargers}
            onPatch={onPatch}
          />
        )}
      </div>
      )}

      {/* Opmerkingen */}
      <div>
        <label className="block text-[12px] text-[rgba(255,255,255,0.6)] mb-1">Opmerkingen</label>
        <textarea className={areaClass} rows={4} value={tab.opmerkingen} onChange={(e) => onPatch({ opmerkingen: e.target.value })} placeholder="bv. telefonisch contact 20-4, belt terug…" />
      </div>
    </div>
  );
}

// ── Superchargers per locatie ──────────────────────────────────────────────
interface SuperchargersBlockProps {
  tab: TabData;
  allSuperchargers: Supercharger[];
  onPatch: (patch: Partial<TabData>) => void;
}

function SuperchargersBlock({ tab, allSuperchargers, onPatch }: SuperchargersBlockProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const days = useMemo(() => dateRange(tab.startDate, tab.endDate), [tab.startDate, tab.endDate]);

  const usedIds = new Set(tab.superchargers.map((s) => s.superchargerId));
  const available = useMemo(
    () => allSuperchargers
      .filter((sc) => !usedIds.has(sc.id))
      .filter((sc) => !searchQuery || `${sc.firstName} ${sc.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())),
    [allSuperchargers, usedIds, searchQuery],
  );

  const addSc = (id: number) => {
    if (usedIds.has(id)) return;
    const updated = [...tab.superchargers, { superchargerId: id, availability: {} }];
    onPatch({ superchargers: updated });
    setSearchQuery('');
  };
  const removeSc = (id: number) => {
    onPatch({ superchargers: tab.superchargers.filter((s) => s.superchargerId !== id) });
  };
  const toggleAvail = (scId: number, date: string) => {
    onPatch({
      superchargers: tab.superchargers.map((s) =>
        s.superchargerId === scId
          ? { ...s, availability: { ...s.availability, [date]: !s.availability[date] } }
          : s,
      ),
    });
  };

  return (
    <div className="rounded-[10px] bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.06)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[14px] font-semibold text-text-primary">Superchargers</h3>
        <button
          type="button"
          onClick={() => {
            // Alleen inklappen — data blijft staan. Voor wissen: verwijder eerst rijen via × in tabel.
            if (tab.superchargers.length > 0
              && !confirm('Sectie inklappen? De toegevoegde superchargers blijven bewaard.')) return;
            onPatch({ superchargersOpen: false });
          }}
          className="text-text-muted hover:text-text-primary text-xs cursor-pointer"
          title="Sectie inklappen"
        >
          ✕
        </button>
      </div>

      {days.length === 0 && (
        <p className="text-text-muted text-sm italic mb-3">
          {tab.superchargers.length === 0
            ? 'Stel eerst een datum-bereik in (Van/Tot) om dagen te tonen.'
            : 'Geen datum-bereik ingesteld — vul Van/Tot in om dagen-checkboxes te tonen.'}
        </p>
      )}

      {/* Tabel: rijen = superchargers, kolommen = dagen + verwijder-actie */}
      {tab.superchargers.length > 0 && (
        <div className="overflow-x-auto mb-3">
          <table className="w-auto border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                <th className="text-left px-2 py-1.5 text-text-secondary font-medium whitespace-nowrap min-w-[12rem]">Naam</th>
                {days.map((d) => (
                  <th key={d} className="px-2 py-1.5 text-text-secondary font-medium whitespace-nowrap text-center w-[3.5rem]">
                    {fmtShortDate(d)}
                  </th>
                ))}
                <th className="px-2 py-1.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {tab.superchargers.map((s) => {
                const sc = allSuperchargers.find((x) => x.id === s.superchargerId);
                const name = sc ? `${sc.firstName} ${sc.lastName}` : `#${s.superchargerId}`;
                return (
                  <tr key={s.superchargerId} className="border-t border-[rgba(255,255,255,0.04)]">
                    <td className="px-2 py-1.5 text-text-primary whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full overflow-hidden bg-[rgba(255,255,255,0.05)] shrink-0 flex items-center justify-center">
                          {sc?.photo ? (
                            <img src={sc.photo} alt={name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] text-text-secondary">{sc ? sc.firstName[0] + sc.lastName[0] : '?'}</span>
                          )}
                        </div>
                        <span>{name}</span>
                      </div>
                    </td>
                    {days.map((d) => {
                      const checked = !!s.availability[d];
                      return (
                        <td key={d} className="px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAvail(s.superchargerId, d)}
                            className="w-4 h-4 cursor-pointer accent-accent-teal"
                          />
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeSc(s.superchargerId)}
                        className="text-text-muted hover:text-red-400 text-sm cursor-pointer"
                        title="Verwijder supercharger"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add supercharger */}
      {!searchOpen ? (
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          disabled={allSuperchargers.length === 0 || tab.superchargers.length >= allSuperchargers.length}
          className="px-3 py-1.5 rounded-[6px] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] text-text-secondary hover:text-white text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Supercharger toevoegen
        </button>
      ) : (
        <div className="relative max-w-xs">
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); }
              if (e.key === 'Enter' && available.length > 0) { e.preventDefault(); addSc(available[0].id); }
            }}
            onBlur={() => setTimeout(() => { setSearchOpen(false); setSearchQuery(''); }, 150)}
            placeholder="Zoek supercharger…"
            className={`${inputClass} text-sm`}
          />
          <div className="absolute top-full left-0 mt-1 w-full bg-bg-surface border border-[rgba(255,255,255,0.12)] rounded-lg shadow-xl z-10 max-h-[200px] overflow-y-auto">
            {available.length === 0 ? (
              <div className="px-3 py-2 text-text-secondary text-sm">Geen resultaten</div>
            ) : (
              available.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addSc(sc.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[rgba(255,255,255,0.06)] text-left cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-[rgba(255,255,255,0.08)] shrink-0 flex items-center justify-center">
                    {sc.photo ? (
                      <img src={sc.photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[9px] text-text-secondary">{sc.firstName[0]}{sc.lastName[0]}</span>
                    )}
                  </div>
                  <span className="text-text-primary text-sm flex-1 truncate">{sc.firstName} {sc.lastName}</span>
                  <span className="text-text-secondary text-xs shrink-0">{sc.function}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
