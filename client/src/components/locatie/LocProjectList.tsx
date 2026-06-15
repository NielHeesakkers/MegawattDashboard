import { useEffect, useState } from 'react';
import { Project, fetchProjects, deleteProject, reorderProjects } from '../../api';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

interface Props {
  onEdit: (id: number) => void;
  onNew: () => void;
  statusFilter?: 'active' | 'completed' | 'cancelled';
}

type SortKey = 'manual' | 'projectNumber' | 'name' | 'klant' | 'locations' | 'status' | 'createdAt';
type SortDir = 'asc' | 'desc';

const STATUS_LABEL: Record<string, string> = {
  active: 'Actief',
  completed: 'Afgerond',
  cancelled: 'Geannuleerd',
};

const truncate = (s: string, n = 25) => s.length > n ? s.slice(0, n).trimEnd() + '…' : s;

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-accent-teal/20 text-accent-teal ring-accent-teal/40',
  completed: 'bg-gray-500/15 text-gray-300 ring-gray-500/30',
  cancelled: 'bg-red-500/15 text-red-300 ring-red-500/30',
};

function LogoBox({ p }: { p: Project }) {
  return (
    <div className="w-9 h-9 rounded overflow-hidden bg-white shrink-0 flex items-center justify-center" title={p.klant?.name}>
      {p.klant?.logo ? (
        <img src={p.klant.logo} alt={p.klant.name} className="w-full h-full object-cover" />
      ) : (
        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
        </svg>
      )}
    </div>
  );
}

function DataCells({ p }: { p: Project }) {
  return (
    <>
      <td className="px-3 py-2"><span className="text-accent-teal font-medium whitespace-nowrap">{p.projectNumber}</span></td>
      <td className="hidden sm:table-cell px-3 py-2 text-text-primary whitespace-nowrap" title={p.klant?.name || ''}>{truncate(p.klant?.name || '')}</td>
      <td className="px-3 py-2 text-text-primary whitespace-nowrap">{p.name || ''}</td>
      <td className="hidden lg:table-cell px-3 py-2 text-text-secondary">{p._count?.locations ?? 0}</td>
      <td className="hidden md:table-cell px-3 py-2">
        <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ${STATUS_STYLE[p.status] ?? STATUS_STYLE.active}`}>
          {STATUS_LABEL[p.status] ?? p.status}
        </span>
      </td>
      <td className="hidden xl:table-cell px-3 py-2 text-text-secondary whitespace-nowrap">
        {new Date(p.createdAt).toLocaleDateString('nl-NL')}
      </td>
    </>
  );
}

const rowClass = 'h-14 border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.04)] transition-colors align-middle cursor-pointer';

// Sleepbare rij (Lopend, handmatige volgorde) — de andere rijen schuiven mee om ruimte te maken.
function SortableProjectRow({ p, onEdit }: { p: Project; onEdit: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative',
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <tr ref={setNodeRef} style={style} onClick={() => onEdit(p.id)} className={rowClass}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            aria-label="Versleep om volgorde aan te passen"
            className="touch-none cursor-grab active:cursor-grabbing text-white/30 hover:text-white/70 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
            </svg>
          </button>
          <LogoBox p={p} />
        </div>
      </td>
      <DataCells p={p} />
    </tr>
  );
}

function PlainProjectRow({ p, onEdit }: { p: Project; onEdit: (id: number) => void }) {
  return (
    <tr onClick={() => onEdit(p.id)} className={rowClass}>
      <td className="px-3 py-2"><LogoBox p={p} /></td>
      <DataCells p={p} />
    </tr>
  );
}

export default function LocProjectList({ onEdit, onNew, statusFilter = 'active' }: Props) {
  const toast = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [deleting, setDeleting] = useState<Project | null>(null);
  // Lopend staat in handmatige volgorde (sleepbaar); andere lijsten sorteren op kolom (default projectnummer).
  const [sortKey, setSortKey] = useState<SortKey>(statusFilter === 'active' ? 'manual' : 'projectNumber');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = async () => setProjects(await fetchProjects());
  useEffect(() => { load(); }, []);

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteProject(deleting.id);
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
    return <span className="text-accent-teal ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>;
  };

  const sortFn = (a: Project, b: Project) => {
    // Handmatige volgorde: op 'order'; bij gelijke order de nieuwste bovenaan.
    if (sortKey === 'manual') {
      const c = (a.order ?? 0) - (b.order ?? 0);
      return c !== 0 ? c : b.createdAt.localeCompare(a.createdAt);
    }
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
  };

  const filtered = projects.filter(p => p.status === statusFilter).sort(sortFn);
  const titleLabel = statusFilter === 'active' ? 'Actieve projecten' : statusFilter === 'completed' ? 'Afgeronde projecten' : 'Geannuleerde projecten';

  // Slepen kan alleen in de Lopend-lijst (handmatige volgorde). Daar staan de kolomkoppen vast.
  const manualMode = statusFilter === 'active' && sortKey === 'manual';

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = filtered.findIndex((p) => p.id === active.id);
    const newIndex = filtered.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(filtered, oldIndex, newIndex);
    const orders = reordered.map((p, i) => ({ id: p.id, order: i }));
    const omap = new Map(orders.map((o) => [o.id, o.order]));
    setProjects((prev) => prev.map((p) => (omap.has(p.id) ? { ...p, order: omap.get(p.id)! } : p)));
    try { await reorderProjects(orders); } catch { toast.error('Volgorde opslaan mislukt'); load(); }
  };

  const thBase = 'text-left px-3 py-3 text-text-secondary text-sm font-medium select-none whitespace-nowrap';
  const thClass = `${thBase}${manualMode ? '' : ' cursor-pointer hover:text-text-primary'}`;
  const headClick = (key: SortKey) => (manualMode ? undefined : () => toggleSort(key));

  const renderTable = (rows: Project[], emptyText: string) => {
    const emptyRow = rows.length === 0 ? (
      <tr><td colSpan={7} className="px-3 py-8 text-center text-text-muted">{emptyText}</td></tr>
    ) : null;

    return (
      <div className="bg-bg-surface rounded-[12px] border border-[rgba(255,255,255,0.08)] overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[rgba(255,255,255,0.08)]">
              <th className="w-10 px-3 py-3"></th>
              <th className={thClass} onClick={headClick('projectNumber')}>Projectnr. <SortIcon column="projectNumber" /></th>
              <th className={`hidden sm:table-cell ${thClass}`} onClick={headClick('klant')}>Klant <SortIcon column="klant" /></th>
              <th className={thClass} onClick={headClick('name')}>Projectnaam <SortIcon column="name" /></th>
              <th className={`hidden lg:table-cell ${thClass}`} onClick={headClick('locations')}>Locaties <SortIcon column="locations" /></th>
              <th className={`hidden md:table-cell ${thClass}`} onClick={headClick('status')}>Status <SortIcon column="status" /></th>
              <th className={`hidden xl:table-cell ${thClass}`} onClick={headClick('createdAt')}>Aangemaakt <SortIcon column="createdAt" /></th>
            </tr>
          </thead>
          {manualMode ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={rows.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {rows.map((p) => <SortableProjectRow key={p.id} p={p} onEdit={onEdit} />)}
                  {emptyRow}
                </tbody>
              </SortableContext>
            </DndContext>
          ) : (
            <tbody>
              {rows.map((p) => <PlainProjectRow key={p.id} p={p} onEdit={onEdit} />)}
              {emptyRow}
            </tbody>
          )}
        </table>
      </div>
    );
  };

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-semibold text-white">
          {titleLabel} <span className="text-[rgba(255,255,255,0.4)] text-base font-normal">({filtered.length})</span>
        </h1>
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 h-7 px-3 rounded-lg ring-1 ring-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.5)] text-[12px] font-medium hover:bg-accent hover:text-[#1a3a38] hover:ring-accent transition-all duration-150 cursor-pointer"
        >
          + Project
        </button>
      </div>

      {manualMode && (
        <p className="text-text-secondary text-sm mb-3">Sleep aan het greepje (links) om de volgorde aan te passen.</p>
      )}

      {renderTable(filtered, statusFilter === 'active'
        ? (projects.length === 0 ? 'Nog geen projecten. Klik op "+ Project" om te beginnen.' : 'Geen actieve projecten.')
        : statusFilter === 'completed' ? 'Geen afgeronde projecten.' : 'Geen geannuleerde projecten.')}

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
