import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Project, fetchProjects, deleteProject } from '../../api';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

export default function ProjectList() {
  const toast = useToast();
  const location = useLocation();
  const isCompleted = location.pathname.includes('completed');
  const status = isCompleted ? 'completed' : 'active';

  const [projects, setProjects] = useState<Project[]>([]);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  const load = async () => {
    const data = await fetchProjects(status);
    setProjects(data);
  };

  useEffect(() => { load(); }, [status]);

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

  const formatDate = (d: string) => new Date(d).toLocaleDateString('nl-NL');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">
          {isCompleted ? 'Afgeronde projecten' : 'Lopende projecten'}
        </h1>
        <div className="flex gap-3">
          <Link
            to={isCompleted ? '/admin/projects' : '/admin/projects/completed'}
            className="px-4 py-2 rounded-[6px] text-text-secondary hover:text-text-primary border border-[rgba(255,255,255,0.12)] transition-colors"
          >
            {isCompleted ? 'Lopende projecten' : 'Afgeronde projecten'}
          </Link>
          <Link
            to="/admin/projects/new"
            className="px-4 py-2 rounded-[6px] bg-accent-teal text-[#1a3a38] font-semibold hover:opacity-85 transition-opacity"
          >
            + Nieuw project
          </Link>
        </div>
      </div>

      <div className="bg-bg-surface rounded-[12px] border border-[rgba(255,255,255,0.08)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[rgba(255,255,255,0.08)]">
              <th className="text-left px-4 py-3 text-text-secondary text-sm font-medium">Projectnummer</th>
              <th className="text-left px-4 py-3 text-text-secondary text-sm font-medium">Klant</th>
              <th className="text-left px-4 py-3 text-text-secondary text-sm font-medium">Startdatum</th>
              <th className="text-left px-4 py-3 text-text-secondary text-sm font-medium">Einddatum</th>
              <th className="text-left px-4 py-3 text-text-secondary text-sm font-medium">Activaties</th>
              <th className="text-right px-4 py-3 text-text-secondary text-sm font-medium">Acties</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]">
                <td className="px-4 py-3">
                  <Link to={`/admin/projects/${project.id}`} className="text-accent-teal hover:opacity-80 font-medium">
                    {project.projectNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-text-primary">{project.klant?.name || '—'}</td>
                <td className="px-4 py-3 text-text-secondary">{formatDate(project.startDate)}</td>
                <td className="px-4 py-3 text-text-secondary">{formatDate(project.endDate)}</td>
                <td className="px-4 py-3 text-text-secondary">{project._count?.activations ?? 0}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/admin/projects/${project.id}`}
                    className="text-accent-teal hover:opacity-80 text-sm mr-3"
                  >
                    Bewerk
                  </Link>
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
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  {isCompleted ? 'Geen afgeronde projecten.' : 'Nog geen lopende projecten.'}
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
