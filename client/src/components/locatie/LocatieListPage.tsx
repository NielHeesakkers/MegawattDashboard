import { useEffect, useState, useMemo } from 'react';
import { fetchLocations, Location, fetchProjects, addLocationToProject, Project } from '../../api';
import { LocatieFilters, EMPTY_FILTERS, applyFilters, M2_BUCKETS } from './LocatieFilterSidebar';
import {
  STROOMVOORZIENING_PRESETS, DOELGROEP_PRESETS, EVENT_TYPE_PRESETS,
  AANVRAAGTIJD_OPTIONS, VOLUME_SAMPLING_OPTIONS,
} from './locatieKenmerken';
import { landToFlag } from '../../shared/countries';
import { useToast } from '../ui/Toast';

interface Props {
  onOpenDetail: (id: number | 'new') => void;
}

type SortKey = 'code' | 'naam' | 'stad' | 'm2';
type SortDir = 'asc' | 'desc';

export default function LocatieListPage({ onOpenDetail }: Props) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<LocatieFilters>(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>('naam');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [activeProjects, setActiveProjects] = useState<Project[]>([]);
  const [ctx, setCtx] = useState<{ x: number; y: number; loc: Location } | null>(null);
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    fetchLocations().then(setLocations).finally(() => setLoading(false));
    // De backend levert lopende projecten al in de handmatige volgorde (zelfde als de Projecten-lijst).
    fetchProjects('active').then(setActiveProjects).catch(() => {});
  }, []);

  // Sluit het rechtsklik-menu bij klik elders of Escape.
  useEffect(() => {
    if (!ctx) return;
    const close = () => setCtx(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCtx(null); };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', onKey); };
  }, [ctx]);

  // Sluit een open filter-popover bij klik elders of Escape.
  useEffect(() => {
    if (!openFilter) return;
    const close = () => setOpenFilter(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenFilter(null); };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', onKey); };
  }, [openFilter]);

  const addToProject = async (project: Project, loc: Location) => {
    setCtx(null);
    try {
      const r = await addLocationToProject(project.id, loc.id);
      if (r.already) toast.success(`"${loc.naam || 'Locatie'}" zat al in ${project.projectNumber}`);
      else toast.success(`"${loc.naam || 'Locatie'}" toegevoegd aan ${project.projectNumber}`);
    } catch {
      toast.error('Toevoegen aan project mislukt');
    }
  };

  const landen = useMemo(() => [...new Set(locations.map((l) => l.land).filter(Boolean))].sort(), [locations]);
  const filtered = useMemo(() => applyFilters(locations, filters, ''), [locations, filters]);
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'code') cmp = (a.code || '').localeCompare(b.code || '', 'nl');
    else if (sortKey === 'naam') cmp = (a.naam || '').localeCompare(b.naam || '', 'nl');
    else if (sortKey === 'stad') cmp = (a.stad || '').localeCompare(b.stad || '', 'nl');
    else if (sortKey === 'm2') cmp = (a.m2 ?? 0) - (b.m2 ?? 0);
    return sortDir === 'asc' ? cmp : -cmp;
  }), [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };
  const SortIcon = ({ column }: { column: SortKey }) =>
    sortKey !== column ? null : <span className="text-accent-teal ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>;

  const isEmpty = !filters.landen.length && !filters.m2Buckets.length && !filters.geschiktVoor.length && !filters.voorzieningen.length && !filters.eigendom.length
    && !filters.stroomvoorziening.length && !filters.aanvraagtijd.length && !filters.volumeSampling.length && !filters.doelgroepen.length && !filters.eventTypes.length;

  const toggleGroup = (key: keyof LocatieFilters, value: string) => {
    const current = filters[key] as string[];
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
    setFilters({ ...filters, [key]: next } as LocatieFilters);
  };

  type FilterOption = { value: string; label: string; flag?: string };
  type FilterGroup = { key: keyof LocatieFilters; label: string; options: FilterOption[] };
  const filterGroups: FilterGroup[] = useMemo(() => [
    { key: 'landen', label: 'Land', options: landen.map(l => ({ value: l, label: l, flag: landToFlag(l) })) },
    { key: 'm2Buckets', label: 'Oppervlak', options: M2_BUCKETS.map(b => ({ value: b.key, label: b.label })) },
    { key: 'geschiktVoor', label: 'Geschikt', options: [{ value: 'activatie', label: 'Activatie' }, { value: 'sampling', label: 'Mass sampling' }] },
    { key: 'voorzieningen', label: 'Voorzieningen', options: [{ value: 'stroom', label: 'Stroom' }, { value: 'verlichting', label: 'Verlichting' }, { value: 'vergunning', label: 'Vergunning vrij' }, { value: 'truck', label: 'Bakwagen' }] },
    { key: 'eigendom', label: 'Eigendom', options: [{ value: 'particulier', label: 'Particulier' }, { value: 'gemeentelijk', label: 'Gemeentelijk' }, { value: 'bedrijf', label: 'Bedrijf' }] },
    { key: 'stroomvoorziening', label: 'Stroom', options: STROOMVOORZIENING_PRESETS.map(o => ({ value: o.key, label: o.label })) },
    { key: 'aanvraagtijd', label: 'Aanvraag', options: AANVRAAGTIJD_OPTIONS.map(o => ({ value: o.key, label: o.label })) },
    { key: 'volumeSampling', label: 'Volume', options: VOLUME_SAMPLING_OPTIONS.map(o => ({ value: o.key, label: o.label })) },
    { key: 'doelgroepen', label: 'Doelgroep', options: DOELGROEP_PRESETS.map(o => ({ value: o.key, label: o.label })) },
    { key: 'eventTypes', label: 'Event', options: EVENT_TYPE_PRESETS.map(o => ({ value: o.key, label: o.label })) },
  ], [landen]);
  const activeCount = filterGroups.reduce((a, g) => a + (filters[g.key] as string[]).length, 0);

  return (
    <div className="px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-white">
          Locaties <span className="text-[rgba(255,255,255,0.4)] text-base font-normal">({filtered.length})</span>
        </h1>
        <button
          onClick={() => onOpenDetail('new')}
          className="flex items-center gap-1.5 h-7 px-3 rounded-lg ring-1 ring-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.5)] text-[12px] font-medium hover:bg-accent hover:text-[#1a3a38] hover:ring-accent transition-all duration-150 cursor-pointer"
        >
          + Locatie
        </button>
      </div>

      {/* Filterbalk: pillen met multiselect-popovers + actieve-filter breadcrumb */}
      <div className="mb-4 pb-4 border-b border-[rgba(255,255,255,0.08)]">
        <div className="flex items-center gap-2 flex-wrap">
          {filterGroups.map(g => {
            const sel = filters[g.key] as string[];
            const open = openFilter === g.key;
            return (
              <div key={g.key} className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setOpenFilter(open ? null : g.key); }}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium ring-1 transition-colors cursor-pointer ${
                    sel.length ? 'ring-accent-teal text-accent-teal bg-accent-teal/10'
                               : 'ring-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.6)] bg-[rgba(255,255,255,0.05)] hover:text-white'
                  }`}
                >
                  {g.label}
                  {sel.length > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-accent-teal text-[#1a3a38] text-[10px] font-bold">{sel.length}</span>
                  )}
                  <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                </button>
                {open && (
                  <div onClick={(e) => e.stopPropagation()} className="absolute z-30 mt-1 left-0 w-56 max-h-72 overflow-auto rounded-lg ring-1 ring-[rgba(255,255,255,0.15)] bg-bg-surface shadow-xl p-1.5">
                    {g.options.length === 0 ? (
                      <div className="px-2 py-1.5 text-[12px] text-[rgba(255,255,255,0.4)]">Geen opties</div>
                    ) : g.options.map(o => {
                      const on = sel.includes(o.value);
                      return (
                        <button key={o.value} onClick={() => toggleGroup(g.key, o.value)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] text-left transition-colors ${on ? 'text-accent-teal' : 'text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.05)]'}`}>
                          <span className={`w-4 h-4 rounded flex items-center justify-center ring-1 shrink-0 ${on ? 'bg-accent-teal ring-accent-teal text-[#1a3a38]' : 'ring-[rgba(255,255,255,0.25)]'}`}>
                            {on && <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                          </span>
                          {o.flag && <span>{o.flag}</span>}
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!isEmpty && (
          <div className="flex items-center gap-2 flex-wrap mt-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.4)]">Actief ({activeCount})</span>
            {filterGroups.flatMap(g => (filters[g.key] as string[]).map(v => {
              const opt = g.options.find(o => o.value === v);
              return (
                <span key={g.key + v} className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1 rounded-full bg-accent-teal text-[#1a3a38] text-[12px] font-medium">
                  {opt?.label ?? v}
                  <button onClick={() => toggleGroup(g.key, v)} aria-label="Verwijder filter" className="w-4 h-4 rounded-full flex items-center justify-center bg-black/15 hover:bg-black/30 cursor-pointer leading-none">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </span>
              );
            }))}
            <span className="text-[12px] text-[rgba(255,255,255,0.4)]">· {sorted.length} {sorted.length === 1 ? 'resultaat' : 'resultaten'}</span>
            <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-[12px] text-accent-teal hover:opacity-80 cursor-pointer">Wis alles</button>
          </div>
        )}
      </div>

      {/* Tabel */}
      {loading ? (
        <div className="text-[rgba(255,255,255,0.4)] text-sm py-12 text-center">Laden…</div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-[rgba(255,255,255,0.5)] mb-4">{locations.length === 0 ? 'Nog geen locaties' : 'Geen resultaten met deze filters'}</p>
          {locations.length === 0 && (
            <button onClick={() => onOpenDetail('new')} className="h-10 px-6 rounded-lg bg-accent-teal text-[#1a3a38] font-semibold hover:opacity-85 cursor-pointer">+ Voeg eerste locatie toe</button>
          )}
        </div>
      ) : (
        <div className="bg-bg-surface rounded-[12px] border border-[rgba(255,255,255,0.08)] overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.08)]">
                <th className="w-10 px-3 py-3"></th>
                <th className="hidden sm:table-cell text-left px-3 py-3 text-text-secondary text-sm font-medium cursor-pointer select-none hover:text-text-primary whitespace-nowrap" onClick={() => toggleSort('code')}>Code <SortIcon column="code" /></th>
                <th className="text-left px-3 py-3 text-text-secondary text-sm font-medium cursor-pointer select-none hover:text-text-primary whitespace-nowrap" onClick={() => toggleSort('naam')}>Naam <SortIcon column="naam" /></th>
                <th className="hidden md:table-cell text-left px-3 py-3 text-text-secondary text-sm font-medium cursor-pointer select-none hover:text-text-primary whitespace-nowrap" onClick={() => toggleSort('stad')}>Plaats <SortIcon column="stad" /></th>
                <th className="hidden lg:table-cell text-left px-3 py-3 text-text-secondary text-sm font-medium cursor-pointer select-none hover:text-text-primary whitespace-nowrap" onClick={() => toggleSort('m2')}>m² <SortIcon column="m2" /></th>
                <th className="hidden xl:table-cell text-left px-3 py-3 text-text-secondary text-sm font-medium whitespace-nowrap">Eigenschappen</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((loc) => {
                const photo = loc.photos.find(p => p.isMain) ?? loc.photos[0];
                const chips: string[] = [];
                if (loc.geschiktActivatie) chips.push('Activatie');
                if (loc.geschiktSampling) chips.push('Sampling');
                if (loc.geschiktHotspot) chips.push('Hotspot');
                if (loc.stroom) chips.push('Stroom');
                return (
                  <tr key={loc.id} onClick={() => onOpenDetail(loc.id)} onContextMenu={(e) => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, loc }); }} className="h-14 border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.04)] cursor-pointer transition-colors align-middle">
                    <td className="px-3 py-2">
                      <div className="w-9 h-9 rounded overflow-hidden bg-[rgba(255,255,255,0.05)] shrink-0">
                        {photo ? (
                          <img src={`/uploads/Locaties/${loc.id}/${encodeURIComponent(photo.filename)}`} alt={loc.naam || ''} loading="lazy" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[rgba(255,255,255,0.2)]">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" /></svg>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-3 py-2"><span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-accent-teal/15 text-accent-teal">{loc.code || '—'}</span></td>
                    <td className="px-3 py-2"><span className="text-accent-teal font-medium whitespace-nowrap">{loc.naam || 'Naamloos'}</span></td>
                    <td className="hidden md:table-cell px-3 py-2 text-text-secondary whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        {loc.land && <span className="text-[14px]" title={loc.land}>{landToFlag(loc.land)}</span>}
                        {loc.stad}
                      </span>
                    </td>
                    <td className="hidden lg:table-cell px-3 py-2 text-text-secondary whitespace-nowrap">{loc.m2 ?? '—'}</td>
                    <td className="hidden xl:table-cell px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {chips.map(c => <span key={c} className="px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.7)] text-[10px] font-medium whitespace-nowrap">{c}</span>)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Rechtsklik-menu: locatie aan een lopend project toevoegen */}
      {ctx && (
        <div
          className="fixed z-[200] min-w-[240px] max-w-[300px] bg-bg-surface rounded-xl ring-1 ring-[rgba(255,255,255,0.14)] shadow-2xl overflow-hidden"
          style={{ top: Math.min(ctx.y, window.innerHeight - 340), left: Math.min(ctx.x, window.innerWidth - 300) }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.4)] border-b border-[rgba(255,255,255,0.08)]">
            Toevoegen aan project
          </div>
          {activeProjects.length === 0 ? (
            <div className="px-3 py-3 text-[13px] text-[rgba(255,255,255,0.4)]">Geen lopende projecten</div>
          ) : (
            <div className="max-h-72 overflow-y-auto py-1">
              {activeProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToProject(p, ctx.loc)}
                  className="w-full text-left px-3 py-2 hover:bg-[rgba(255,255,255,0.06)] cursor-pointer"
                >
                  <div className="text-white text-[13px] truncate">{[p.projectNumber, p.klant?.name, p.name].filter(Boolean).join('_')}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
