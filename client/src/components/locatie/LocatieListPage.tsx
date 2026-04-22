import { useEffect, useState, useMemo } from 'react';
import { fetchLocations, Location } from '../../api';
import LocatieCard from './LocatieCard';
import LocatieFilterSidebar, { LocatieFilters, EMPTY_FILTERS, applyFilters, bucketOf } from './LocatieFilterSidebar';

interface Props {
  onOpenDetail: (id: number | 'new') => void;
}

export default function LocatieListPage({ onOpenDetail }: Props) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<LocatieFilters>(EMPTY_FILTERS);

  useEffect(() => {
    fetchLocations().then(setLocations).finally(() => setLoading(false));
  }, []);

  const landen = useMemo(() => [...new Set(locations.map((l) => l.land).filter(Boolean))].sort(), [locations]);
  const availableM2Buckets = useMemo(() => {
    const seen = new Set<string>();
    for (const l of locations) if (l.m2 != null) seen.add(bucketOf(l.m2));
    return [...seen];
  }, [locations]);
  const filtered = useMemo(() => applyFilters(locations, filters, search), [locations, filters, search]);

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-white">Locaties</h1>
        <button
          onClick={() => onOpenDetail('new')}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-accent-teal text-[#1a3a38] text-[13px] font-semibold hover:opacity-85 transition-opacity cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Nieuwe locatie
        </button>
      </div>

      <input
        type="search"
        placeholder="Zoek op naam, adres of land…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full h-10 px-4 mb-4 rounded-lg bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.08)] text-white text-[14px] placeholder-[rgba(255,255,255,0.3)] focus:outline-none focus:ring-[rgba(255,255,255,0.2)]"
      />

      <div className="flex gap-6">
        <LocatieFilterSidebar filters={filters} onChange={setFilters} availableLanden={landen} availableM2Buckets={availableM2Buckets} resultCount={filtered.length} />

        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="text-[rgba(255,255,255,0.4)] text-sm">Laden…</div>
          ) : locations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-[rgba(255,255,255,0.5)] mb-4">Nog geen locaties</p>
              <button onClick={() => onOpenDetail('new')} className="h-10 px-6 rounded-lg bg-accent-teal text-[#1a3a38] font-semibold hover:opacity-85 cursor-pointer">
                + Voeg je eerste locatie toe
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-[rgba(255,255,255,0.4)] text-sm py-12 text-center">Geen locaties komen overeen met de filters.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filtered.map((loc) => (
                <LocatieCard key={loc.id} location={loc} onClick={() => onOpenDetail(loc.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
