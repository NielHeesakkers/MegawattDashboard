import { useEffect, useState } from 'react';
import { LocProject, fetchLocProjects, deleteLocProject } from '../../api';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

interface Props {
  onEdit: (id: number) => void;
  onNew: () => void;
}

type SortKey = 'projectNumber' | 'name' | 'klant' | 'locations' | 'status' | 'createdAt';
type SortDir = 'asc' | 'desc';

const STATUS_LABEL: Record<string, string> = {
  starten: 'Starten',
  bezig: 'Bezig',
  afgerond: 'Afgerond',
};

const STATUS_STYLE: Record<string, string> = {
  starten: 'bg-blue-500/15 text-blue-300 ring-blue-500/30',
  bezig: 'bg-accent-teal/20 text-accent-teal ring-accent-teal/40',
  afgerond: 'bg-gray-500/15 text-gray-300 ring-gray-500/30',
};

export default function LocProjectList({ onEdit, onNew }: Props) {
  const toast = useToast();
  const [projects, setProjects] = useState<LocProject[]>([]);
  const [deleting, setDeleting] = useState<LocProject | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('projectNumber');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const load = async () => setProjects(await fetchLocProjects());
  useEffect(() => { load(); }, []);

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteLocProject(deleting.id);
      toast.success(`Project "${deleting.projectNumber}" verwijderd`);
      await load();
    } catch {
      toast.error('Project verwijderen mislukt');
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return null;
    return <span className="text-accent-teal ml-1">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>;
  };

  const sorted = [...projects].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'projectNumber': cmp = a.projectNumber.localeCompare(b.projectNumber, 'nl'); break;
      case 'name': cmp = (a.name || '').localeCompare(b.name || '', 'nl'); break;
      case 'klant': cmp = (a.klant?.name || '').localeCompare(b.klant?.name || '', 'nl'); break;
      case 'locations': cmp = (a._count?.locations ?? 0) - (b._count?.locations ?? 0); break;
      case 'status': cmp = (a.status || '').localeCompare(b.status || ''); break;
      case 'createdAt': cmp = a.createdAt.localeCompare(b.createdAt); break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const thClass = 'text-left px-3 py-3 text-text-secondary text-sm font-medium cursor-pointer select-none hover:text-text-primary whitespace-nowrap';

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Projecten</h1>
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-accent-teal text-[#1a3a38] text-[13px] font-semibold hover:opacity-85 transition-opacity cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Nieuw project
        </button>
      </div>

      <div className="bg-bg-surface rounded-[12px] border border-[rgba(255,255,255,0.08)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[rgba(255,255,255,0.08)]">
              <th className={thClass} onClick={() => toggleSort('projectNumber')}>Projectnummer <SortIcon column="projectNumber" /></th>
              <th className={thClass} onClick={() => toggleSort('klant')}>Klant <SortIcon column="klant" /></th>
              <th className={thClass} onClick={() => toggleSort('name')}>Projectnaam <SortIcon column="name" /></th>
              <th className={thClass} onClick={() => toggleSort('locations')}>Locaties <SortIcon column="locations" /></th>
              <th className={thClass} onClick={() => toggleSort('status')}>Status <SortIcon column="status" /></th>
              <th className={thClass} onClick={() => toggleSort('createdAt')}>Aangemaakt <SortIcon column="createdAt" /></th>
              <th className="text-right px-3 py-3 text-text-secondary text-sm font-medium whitespace-nowrap">Acties</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]">
                <td className="px-3 py-2">
                  <button onClick={() => onEdit(p.id)} className="text-accent-teal hover:opacity-80 font-medium cursor-pointer whitespace-nowrap">
                    {p.projectNumber}
                  </button>
                </td>
                <td className="px-3 py-2 text-text-primary">{p.klant?.name || ''}</td>
                <td className="px-3 py-2">
                  <button onClick={() => onEdit(p.id)} className="text-text-primary hover:text-accent-teal cursor-pointer whitespace-nowrap">
                    {p.name || ''}
                  </button>
                </td>
                <td className="px-3 py-2 text-text-secondary">{p._count?.locations ?? 0}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ${STATUS_STYLE[p.status] ?? STATUS_STYLE.starten}`}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-text-secondary text-[13px] whitespace-nowrap">
                  {new Date(p.createdAt).toLocaleDateString('nl-NL')}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => setDeleting(p)} className="text-red-400 hover:opacity-80 text-sm cursor-pointer">Verwijder</button>
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-text-muted">
                  Nog geen projecten. Klik op "Nieuw project" om te beginnen.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Project verwijderen?"
        message={`Weet je zeker dat je "${deleting?.projectNumber}" wilt verwijderen?`}
      />
    </div>
  );
}
