import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Project, fetchProjects, deleteProject } from '../../api';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

interface ProjectListProps {
  onEditProject?: (id: number) => void;
  onNewProject?: () => void;
}

type SortKey = 'projectNumber' | 'name' | 'klant' | 'startDate' | 'endDate' | 'status' | 'activations';
type SortDir = 'asc' | 'desc';

export default function ProjectList({ onEditProject, onNewProject }: ProjectListProps = {}) {
  const toast = useToast();
  const [showAll, setShowAll] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('projectNumber');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const load = async () => {
    const data = await fetchProjects(showAll ? undefined : 'active');
    setProjects(data);
  };

  useEffect(() => { load(); }, [showAll]);

  const handleDelete = async () => {
    if (!deletingProject) return;
    try {
      await deleteProject(deletingProject.id);
      toast.success(`Project "${deletingProject.projectNumber}" verwijderd`);
      await load();
    } catch {
      toast.error('Project verwijderen mislukt');
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('nl-NL');
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return null;
    return <span className="text-accent-teal ml-1">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>;
  };

  const sorted = [...projects].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'projectNumber':
        cmp = (a.projectNumber || '').localeCompare(b.projectNumber || '', 'nl');
        break;
      case 'name':
        cmp = (a.name || '').localeCompare(b.name || '', 'nl');
        break;
      case 'klant':
        cmp = (a.klant?.name || '').localeCompare(b.klant?.name || '', 'nl');
        break;
      case 'startDate':
        cmp = (a.startDate || '').localeCompare(b.startDate || '');
        break;
      case 'endDate':
        cmp = (a.endDate || '').localeCompare(b.endDate || '');
        break;
      case 'status':
        cmp = (a.status || '').localeCompare(b.status || '');
        break;
      case 'activations':
        cmp = (a._count?.activations ?? 0) - (b._count?.activations ?? 0);
        break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const thClass = "text-left px-3 py-3 text-text-secondary text-sm font-medium cursor-pointer select-none hover:text-text-primary whitespace-nowrap";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Projecten</h1>
        <div className="flex items-center gap-4">
          {/* Toggle: Actieve / Alle projecten */}
          <div className="flex items-center">
            <button
              onClick={() => setShowAll(false)}
              className={`px-3 py-1.5 rounded-l-[6px] text-sm font-medium border transition-colors cursor-pointer ${
                !showAll
                  ? 'bg-accent-teal text-[#1a3a38] border-accent-teal'
                  : 'text-text-secondary border-[rgba(255,255,255,0.12)] hover:text-text-primary'
              }`}
            >
              Actieve projecten
            </button>
            <button
              onClick={() => setShowAll(true)}
              className={`px-3 py-1.5 rounded-r-[6px] text-sm font-medium border-y border-r transition-colors cursor-pointer ${
                showAll
                  ? 'bg-accent-teal text-[#1a3a38] border-accent-teal'
                  : 'text-text-secondary border-[rgba(255,255,255,0.12)] hover:text-text-primary'
              }`}
            >
              Alle projecten
            </button>
          </div>
          {onNewProject ? (
            <button
              onClick={onNewProject}
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg ring-1 ring-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.5)] text-[12px] font-medium hover:bg-[rgba(255,255,255,0.12)] hover:text-white transition-all duration-150 cursor-pointer"
            >
              + Nieuw project
            </button>
          ) : (
            <Link
              to="/admin/projects/new"
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg ring-1 ring-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.5)] text-[12px] font-medium hover:bg-[rgba(255,255,255,0.12)] hover:text-white transition-all duration-150"
            >
              + Nieuw project
            </Link>
          )}
        </div>
      </div>

      <div className="bg-bg-surface rounded-[12px] border border-[rgba(255,255,255,0.08)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[rgba(255,255,255,0.08)]">
              <th className={thClass} onClick={() => toggleSort('projectNumber')}>
                Projectnummer <SortIcon column="projectNumber" />
              </th>
              <th className={thClass} onClick={() => toggleSort('name')}>
                Projectnaam <SortIcon column="name" />
              </th>
              <th className={thClass} onClick={() => toggleSort('klant')}>
                Klant <SortIcon column="klant" />
              </th>
              <th className={`${thClass} text-right`} onClick={() => toggleSort('startDate')}>
                Startdatum <SortIcon column="startDate" />
              </th>
              <th className={`${thClass} text-right`} onClick={() => toggleSort('endDate')}>
                Einddatum <SortIcon column="endDate" />
              </th>
              <th className={thClass} onClick={() => toggleSort('status')}>
                Status <SortIcon column="status" />
              </th>
              <th className={thClass} onClick={() => toggleSort('activations')}>
                Activaties <SortIcon column="activations" />
              </th>
              <th className="text-right px-3 py-3 text-text-secondary text-sm font-medium whitespace-nowrap">Acties</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((project) => (
              <tr key={project.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]">
                <td className="px-3 py-2">
                  {onEditProject ? (
                    <button onClick={() => onEditProject(project.id)} className="text-accent-teal hover:opacity-80 font-medium cursor-pointer whitespace-nowrap">
                      {project.projectNumber}
                    </button>
                  ) : (
                    <Link to={`/admin/projects/${project.id}`} className="text-accent-teal hover:opacity-80 font-medium whitespace-nowrap">
                      {project.projectNumber}
                    </Link>
                  )}
                </td>
                <td className="px-3 py-2">
                  {onEditProject ? (
                    <button onClick={() => onEditProject(project.id)} className="text-accent-teal hover:opacity-80 font-medium cursor-pointer whitespace-nowrap">
                      {project.name || ''}
                    </button>
                  ) : (
                    <Link to={`/admin/projects/${project.id}`} className="text-accent-teal hover:opacity-80 font-medium whitespace-nowrap">
                      {project.name || ''}
                    </Link>
                  )}
                </td>
                <td className="px-3 py-2 text-text-primary">{project.klant?.name || ''}</td>
                <td className="px-3 py-2 text-text-secondary text-right whitespace-nowrap">{formatDate(project.startDate)}</td>
                <td className="px-3 py-2 text-text-secondary text-right whitespace-nowrap">{formatDate(project.endDate)}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                    project.status === 'active'
                      ? 'bg-green-500/15 text-green-400'
                      : 'bg-gray-500/15 text-gray-400'
                  }`}>
                    {project.status === 'active' ? 'Actief' : 'Afgerond'}
                  </span>
                </td>
                <td className="px-3 py-2 text-text-secondary">{project._count?.activations ?? 0}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button
                    onClick={() => setDeletingProject(project)}
                    className="text-red-400 hover:opacity-80 text-sm cursor-pointer"
                  >
                    Verwijder
                  </button>
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-text-muted">
                  {showAll ? 'Nog geen projecten.' : 'Geen actieve projecten.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={!!deletingProject}
        onClose={() => setDeletingProject(null)}
        onConfirm={handleDelete}
        title="Project verwijderen?"
        message={`Weet je zeker dat je project "${deletingProject?.projectNumber}" wilt verwijderen? Alle activaties worden ook verwijderd.`}
      />
    </div>
  );
}
