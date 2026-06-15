import { useEffect, useState, useMemo } from 'react';
import { fetchLocations, Location, fetchProjects, addLocationToProject, Project } from '../../api';
import { LocatieFilters, EMPTY_FILTERS, applyFilters, bucketOf, M2_BUCKETS } from './LocatieFilterSidebar';
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

  const isEmpty = !filters.landen.length && !filters.m2Buckets.length && !filters.geschiktVoor.length && !filters.voorzieningen.length && !filters.eigendom.length;

  function toggleFilter<K extends keyof LocatieFilters>(key: K, value: LocatieFilters[K][number]) {
    const current = filters[key] as string[];
    const next = current.includes(value as string) ? current.filter(v => v !== value) : [...current, value as string];
    setFilters({ ...filters, [key]: next } as LocatieFilters);
  }

  const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} className={`px-2.5 h-7 rounded-full text-[12px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
      active ? 'bg-accent-teal text-[#1a3a38]'
             : 'bg-[rgba(255,255,255,0.05)] ring-1 ring-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.55)] hover:text-white hover:bg-[rgba(255,255,255,0.1)]'
    }`}>
      {children}
    </button>
  );

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

      {/* Filter chips bovenaan */}
      <div className="space-y-2 mb-5 pb-4 border-b border-[rgba(255,255,255,0.08)]">
        {landen.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.4)] w-20">Land</span>
            {landen.map(l => <Chip key={l} active={filters.landen.includes(l)} onClick={() => toggleFilter('landen', l)}><span className="mr-1">{landToFlag(l)}</span>{l}</Chip>)}
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.4)] w-20">m²</span>
          {M2_BUCKETS.map(b => <Chip key={b.key} active={filters.m2Buckets.includes(b.key)} onClick={() => toggleFilter('m2Buckets', b.key)}>{b.label}</Chip>)}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.4)] w-20">Geschikt</span>
          <Chip active={filters.geschiktVoor.includes('activatie')} onClick={() => toggleFilter('geschiktVoor', 'activatie')}>Activatie</Chip>
          <Chip active={filters.geschiktVoor.includes('sampling')} onClick={() => toggleFilter('geschiktVoor', 'sampling')}>Mass sampling</Chip>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.4)] w-20">Voorzien.</span>
          <Chip active={filters.voorzieningen.includes('stroom')} onClick={() => toggleFilter('voorzieningen', 'stroom')}>Stroom</Chip>
          <Chip active={filters.voorzieningen.includes('verlichting')} onClick={() => toggleFilter('voorzieningen', 'verlichting')}>Verlichting</Chip>
          <Chip active={filters.voorzieningen.includes('vergunning')} onClick={() => toggleFilter('voorzieningen', 'vergunning')}>Vergunning vrij</Chip>
          <Chip active={filters.voorzieningen.includes('truck')} onClick={() => toggleFilter('voorzieningen', 'truck')}>Bakwagen</Chip>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.4)] w-20">Eigendom</span>
          <Chip active={filters.eigendom.includes('particulier')} onClick={() => toggleFilter('eigendom', 'particulier')}>Particulier</Chip>
          <Chip active={filters.eigendom.includes('gemeentelijk')} onClick={() => toggleFilter('eigendom', 'gemeentelijk')}>Gemeentelijk</Chip>
          <Chip active={filters.eigendom.includes('bedrijf')} onClick={() => toggleFilter('eigendom', 'bedrijf')}>Bedrijf</Chip>
          {!isEmpty && (
            <button onClick={() => setFilters(EMPTY_FILTERS)} className="ml-auto text-[rgba(255,255,255,0.4)] hover:text-white text-[12px] cursor-pointer">
              Wis filters
            </button>
          )}
        </div>
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
                        {loc.stad}
                        {loc.land && <span className="text-[14px]" title={loc.land}>{landToFlag(loc.land)}</span>}
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

      {/* Suppress voor M2_BUCKETS bucket helper niet gebruikt */}
      <div className="hidden">{bucketOf(0)}</div>

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
