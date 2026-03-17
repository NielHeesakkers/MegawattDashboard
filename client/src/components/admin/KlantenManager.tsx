import { useState, useEffect } from 'react';
import { Klant, fetchKlanten, createKlant, updateKlant, deleteKlant } from '../../api';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

export default function KlantenManager() {
  const toast = useToast();
  const [klanten, setKlanten] = useState<Klant[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', contactPerson: '', email: '' });
  const [deletingKlant, setDeletingKlant] = useState<Klant | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const data = await fetchKlanten();
    setKlanten(data);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm({ name: '', contactPerson: '', email: '' });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (klant: Klant) => {
    setForm({
      name: klant.name,
      contactPerson: klant.contactPerson || '',
      email: klant.email || '',
    });
    setEditingId(klant.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await updateKlant(editingId, form);
        toast.success('Klant bijgewerkt');
      } else {
        await createKlant(form);
        toast.success('Klant aangemaakt');
      }
      setShowForm(false);
      await load();
    } catch {
      toast.error('Klant opslaan mislukt');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingKlant) return;
    try {
      await deleteKlant(deletingKlant.id);
      toast.success(`Klant "${deletingKlant.name}" verwijderd`);
      await load();
    } catch {
      toast.error('Kan klant niet verwijderen — er zijn nog projecten gekoppeld');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Klanten</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-[6px] bg-accent-teal text-[#1a3a38] font-semibold hover:opacity-85 transition-opacity cursor-pointer"
        >
          + Nieuwe klant
        </button>
      </div>

      <div className="bg-bg-surface rounded-[12px] border border-[rgba(255,255,255,0.08)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[rgba(255,255,255,0.08)]">
              <th className="text-left px-4 py-3 text-text-secondary text-sm font-medium">Naam</th>
              <th className="text-left px-4 py-3 text-text-secondary text-sm font-medium">Contactpersoon</th>
              <th className="text-left px-4 py-3 text-text-secondary text-sm font-medium">Email</th>
              <th className="text-left px-4 py-3 text-text-secondary text-sm font-medium">Projecten</th>
              <th className="text-right px-4 py-3 text-text-secondary text-sm font-medium">Acties</th>
            </tr>
          </thead>
          <tbody>
            {klanten.map((klant) => (
              <tr key={klant.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]">
                <td className="px-4 py-3 text-text-primary font-medium">{klant.name}</td>
                <td className="px-4 py-3 text-text-secondary">{klant.contactPerson || '—'}</td>
                <td className="px-4 py-3 text-text-secondary">{klant.email || '—'}</td>
                <td className="px-4 py-3 text-text-secondary">{klant._count?.projects ?? 0}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => openEdit(klant)}
                    className="text-accent-teal hover:opacity-80 text-sm mr-3 cursor-pointer"
                  >
                    Bewerk
                  </button>
                  <button
                    onClick={() => setDeletingKlant(klant)}
                    className="text-red-400 hover:opacity-80 text-sm cursor-pointer"
                  >
                    Verwijder
                  </button>
                </td>
              </tr>
            ))}
            {klanten.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  Nog geen klanten. Klik op "+ Nieuwe klant" om er een toe te voegen.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? 'Klant bewerken' : 'Nieuwe klant'}
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-text-secondary text-sm mb-1">Naam *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
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
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-white/10 text-text-primary hover:bg-white/20 transition-colors cursor-pointer"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-[6px] bg-accent-teal text-[#1a3a38] font-semibold hover:opacity-85 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deletingKlant}
        onClose={() => setDeletingKlant(null)}
        onConfirm={handleDelete}
        title="Klant verwijderen?"
        message={`Weet je zeker dat je "${deletingKlant?.name}" wilt verwijderen?`}
      />
    </div>
  );
}
