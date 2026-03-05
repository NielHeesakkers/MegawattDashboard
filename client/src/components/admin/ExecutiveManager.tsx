import { useState, useEffect, useRef } from 'react';
import { fetchExecutives, createExecutive, updateExecutive, deleteExecutive, Executive } from '../../api';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';

interface ExecFormData {
  name: string;
  role: string;
  email: string;
  phone: string;
  level: string;
}

const emptyForm: ExecFormData = { name: '', role: '', email: '', phone: '', level: '1' };

function ExecRow({ exec, onEdit, onDelete }: { exec: Executive; onEdit: (e: Executive) => void; onDelete: (e: Executive) => void }) {
  return (
    <div onClick={() => onEdit(exec)} className="flex items-center gap-3 bg-bg-card p-3 rounded-lg mb-2 hover:bg-white/5 cursor-pointer">
      <div className="w-8 h-8 rounded-full overflow-hidden bg-bg-dark shrink-0">
        {exec.photo ? (
          <img src={exec.photo} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-vacancy">
            <svg className="w-4 h-4 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
        )}
      </div>
      <span className="flex-1 text-text-primary font-medium">{exec.name}</span>
      <span className="text-text-secondary text-sm hidden sm:inline">{exec.role}</span>
      <span className={`text-xs px-2 py-0.5 rounded-full ${exec.level === 0 ? 'bg-accent-gold/20 text-accent-gold' : 'bg-accent-teal/20 text-accent-teal'}`}>
        {exec.level === 0 ? 'CEO' : 'Directie'}
      </span>
      <button onClick={(e) => { e.stopPropagation(); onDelete(exec); }} className="text-red-400 text-sm hover:underline">
        Verwijderen
      </button>
    </div>
  );
}

export default function ExecutiveManager() {
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [form, setForm] = useState<ExecFormData>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<Executive | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => fetchExecutives().then(setExecutives);
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setRemovePhoto(false);
    setShowForm(true);
  };

  const openEdit = (e: Executive) => {
    setForm({ name: e.name, role: e.role, email: e.email || '', phone: e.phone || '', level: String(e.level) });
    setEditingId(e.id);
    setPhotoFile(null);
    setPhotoPreview(e.photo || null);
    setRemovePhoto(false);
    setShowForm(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('role', form.role);
      fd.append('email', form.email);
      fd.append('phone', form.phone);
      fd.append('level', form.level);
      if (photoFile) fd.append('photo', photoFile);
      if (removePhoto) fd.append('removePhoto', 'true');

      if (editingId) {
        await updateExecutive(editingId, fd);
      } else {
        await createExecutive(fd);
      }
      setShowForm(false);
      load();
    } catch (err) {
      console.error('Failed to save executive:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await deleteExecutive(deleting.id);
    setDeleting(null);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Directie</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-5 py-2.5 rounded-[8px] bg-accent text-bg-dark font-semibold text-sm hover:brightness-110 transition-all duration-150 shadow-[0_2px_8px_rgba(201,168,76,0.3)] cursor-pointer">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Directielid toevoegen
        </button>
      </div>

      {/* Executives list */}
      {executives.map((exec) => (
        <ExecRow
          key={exec.id}
          exec={exec}
          onEdit={openEdit}
          onDelete={setDeleting}
        />
      ))}

      {/* Create/Edit modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? 'Directielid bewerken' : 'Directielid toevoegen'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo left + Name/Role right */}
          <div className="flex gap-5 items-start">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
              className="hidden"
            />
            <div
              className="shrink-0 w-[140px] h-[140px] rounded-full overflow-hidden bg-bg-dark border-2 border-white/10 hover:border-accent-gold cursor-pointer transition-colors group relative"
              onClick={() => !photoPreview && fileRef.current?.click()}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-vacancy">
                  <svg className="w-8 h-8 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
              )}
              <div className={`absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${photoPreview ? 'gap-6' : ''}`}>
                <button type="button" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors" title="Nieuwe foto">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                  </svg>
                </button>
                {photoPreview && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setPhotoPreview(null); setPhotoFile(null); setRemovePhoto(true); }} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors" title="Foto verwijderen">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <label className="block text-text-secondary text-sm mb-1">Naam</label>
                <input
                  type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-gold"
                  required
                />
              </div>
              <div>
                <label className="block text-text-secondary text-sm mb-1">Functie</label>
                <input
                  type="text" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-gold"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-text-secondary text-sm mb-1">E-mail</label>
            <input
              type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-gold"
            />
          </div>
          <div>
            <label className="block text-text-secondary text-sm mb-1">Telefoon</label>
            <input
              type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-gold"
            />
          </div>

          <div>
            <label className="block text-text-secondary text-sm mb-1">Niveau</label>
            <select
              value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-gold"
            >
              <option value="0">CEO</option>
              <option value="1">Directie</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-white/10 text-text-primary hover:bg-white/20 transition-colors">
              Annuleren
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-accent text-bg-dark font-semibold hover:brightness-110 transition-all shadow-[0_2px_8px_rgba(201,168,76,0.3)] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:brightness-100 flex items-center gap-2">
              {saving && (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Directielid verwijderen"
        message={`Weet je zeker dat je "${deleting?.name}" wilt verwijderen?`}
      />
    </div>
  );
}
