import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Klant, Activation,
  fetchKlanten, fetchProject,
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

export default function ProjectForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = Boolean(id);

  const [klanten, setKlanten] = useState<Klant[]>([]);
  const [form, setForm] = useState({
    klantId: 0,
    projectNumber: '',
    startDate: '',
    endDate: '',
    contactPerson: '',
    email: '',
    status: 'active',
  });
  const [activations, setActivations] = useState<Activation[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [activationForm, setActivationForm] = useState({ location: '', date: '' });
  const [saving, setSaving] = useState(false);
  const [savingActivation, setSavingActivation] = useState(false);
  const [deletingActivation, setDeletingActivation] = useState<Activation | null>(null);

  useEffect(() => {
    const load = async () => {
      const k = await fetchKlanten();
      setKlanten(k);

      if (id) {
        const project = await fetchProject(Number(id));
        setForm({
          klantId: project.klantId,
          projectNumber: project.projectNumber,
          startDate: toDateInput(project.startDate),
          endDate: toDateInput(project.endDate),
          contactPerson: project.contactPerson || '',
          email: project.email || '',
          status: project.status,
        });
        setActivations(project.activations || []);
      }
    };
    load();
  }, [id]);

  // Sync activation form when switching tabs or activations change
  useEffect(() => {
    const current = activations[activeTab];
    if (current) {
      setActivationForm({
        location: current.location,
        date: toDateInput(current.date),
      });
    }
  }, [activeTab, activations]);

  const handleKlantChange = (klantId: number) => {
    const klant = klanten.find((k) => k.id === klantId);
    setForm({
      ...form,
      klantId,
      contactPerson: klant?.contactPerson || '',
      email: klant?.email || '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await updateProject(Number(id), form);
        toast.success('Project bijgewerkt');
        const project = await fetchProject(Number(id));
        setActivations(project.activations || []);
      } else {
        const project = await createProject(form);
        toast.success('Project aangemaakt');
        navigate(`/admin/projects/${project.id}`);
      }
    } catch {
      toast.error('Project opslaan mislukt');
    } finally {
      setSaving(false);
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

  const handleSaveActivation = async () => {
    const current = activations[activeTab];
    if (!current) return;
    setSavingActivation(true);
    try {
      const updated = await updateActivation(current.id, {
        location: activationForm.location,
        date: activationForm.date || null,
      });
      setActivations(activations.map((a) => (a.id === updated.id ? updated : a)));
      toast.success('Activatie bijgewerkt');
    } catch {
      toast.error('Activatie opslaan mislukt');
    } finally {
      setSavingActivation(false);
    }
  };

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">
          {isEdit ? `Project ${form.projectNumber}` : 'Nieuw project'}
        </h1>
        <button
          onClick={() => navigate('/admin/projects')}
          className="px-4 py-2 rounded-[6px] text-text-secondary hover:text-text-primary border border-[rgba(255,255,255,0.12)] transition-colors cursor-pointer"
        >
          Terug
        </button>
      </div>

      {/* Project form */}
      <form onSubmit={handleSubmit} className="bg-bg-surface rounded-[12px] border border-[rgba(255,255,255,0.08)] p-6 mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Projectgegevens</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-text-secondary text-sm mb-1">Klant *</label>
            <select
              value={form.klantId}
              onChange={(e) => handleKlantChange(Number(e.target.value))}
              required
              className="w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
            >
              <option value={0} disabled>Selecteer een klant</option>
              {klanten.map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-text-secondary text-sm mb-1">Projectnummer *</label>
            <input
              type="text"
              value={form.projectNumber}
              onChange={(e) => setForm({ ...form, projectNumber: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
            />
          </div>
          <div>
            <label className="block text-text-secondary text-sm mb-1">Startdatum *</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
            />
          </div>
          <div>
            <label className="block text-text-secondary text-sm mb-1">Einddatum *</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
            />
          </div>
          <div>
            <label className="block text-text-secondary text-sm mb-1">Contactpersoon</label>
            <input
              type="text"
              value={form.contactPerson}
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              className="w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
            />
          </div>
          <div>
            <label className="block text-text-secondary text-sm mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
            />
          </div>
          {isEdit && (
            <div>
              <label className="block text-text-secondary text-sm mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
              >
                <option value="active">Actief</option>
                <option value="completed">Afgerond</option>
              </select>
            </div>
          )}
        </div>
        <div className="mt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-[6px] bg-accent-teal text-[#1a3a38] font-semibold hover:opacity-85 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Opslaan...' : 'Project opslaan'}
          </button>
        </div>
      </form>

      {/* Activations (only shown when editing) */}
      {isEdit && activations.length > 0 && (
        <div className="bg-bg-surface rounded-[12px] border border-[rgba(255,255,255,0.08)] p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Activaties</h2>

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-4 border-b border-[rgba(255,255,255,0.08)] pb-2">
            {activations.map((activation, idx) => (
              <button
                key={activation.id}
                onClick={() => setActiveTab(idx)}
                className={`px-3 py-1.5 rounded-t-[6px] text-[14px] transition-all cursor-pointer ${
                  activeTab === idx
                    ? 'bg-accent-teal text-[#1a3a38] font-semibold'
                    : 'text-[rgba(255,255,255,0.6)] hover:text-[rgba(255,255,255,0.9)]'
                }`}
              >
                {activation.location || 'Nieuwe activatie'}
              </button>
            ))}
            <button
              onClick={handleAddActivation}
              className="px-3 py-1.5 text-accent-teal hover:opacity-80 text-[18px] cursor-pointer"
              title="Activatie toevoegen"
            >
              +
            </button>
          </div>

          {/* Active tab content — local state, explicit save */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-text-secondary text-sm mb-1">Locatie</label>
              <input
                type="text"
                value={activationForm.location}
                onChange={(e) => setActivationForm({ ...activationForm, location: e.target.value })}
                placeholder="Voer locatie in"
                className="w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
              />
            </div>
            <div>
              <label className="block text-text-secondary text-sm mb-1">Datum</label>
              <input
                type="date"
                value={activationForm.date}
                onChange={(e) => setActivationForm({ ...activationForm, date: e.target.value })}
                className="w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <button
              onClick={handleSaveActivation}
              disabled={savingActivation}
              className="px-4 py-2 rounded-[6px] bg-accent-teal text-[#1a3a38] font-semibold hover:opacity-85 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              {savingActivation ? 'Opslaan...' : 'Activatie opslaan'}
            </button>
            {activations.length > 1 && (
              <button
                onClick={() => setDeletingActivation(activations[activeTab])}
                className="text-red-400 hover:opacity-80 text-sm cursor-pointer"
              >
                Activatie verwijderen
              </button>
            )}
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
