import { useState, useEffect, useRef } from 'react';
import { Klant, KlantContact, fetchKlanten, createKlant, updateKlant, deleteKlant } from '../../api';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

type SortKey = 'name' | 'contactPerson' | 'email' | 'projects';
type SortDir = 'asc' | 'desc';

type ContactRow = { naam: string; email: string; telefoon: string };
const emptyContact = (): ContactRow => ({ naam: '', email: '', telefoon: '' });

export default function KlantenManager() {
  const toast = useToast();
  const [klanten, setKlanten] = useState<Klant[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '' });
  const [contacts, setContacts] = useState<ContactRow[]>([emptyContact()]);
  const [deletingKlant, setDeletingKlant] = useState<Klant | null>(null);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const load = async () => {
    const data = await fetchKlanten();
    setKlanten(data);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm({ name: '' });
    setContacts([emptyContact()]);
    setEditingId(null);
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(false);
    setShowForm(true);
  };

  const openEdit = (klant: Klant) => {
    setForm({ name: klant.name });
    const existing: ContactRow[] = (klant.contacts ?? []).map((c: KlantContact) => ({
      naam: c.naam, email: c.email ?? '', telefoon: c.telefoon ?? '',
    }));
    if (existing.length === 0) {
      existing.push({
        naam: klant.contactPerson ?? '',
        email: klant.email ?? '',
        telefoon: '',
      });
    }
    setContacts(existing);
    setEditingId(klant.id);
    setLogoFile(null);
    setLogoPreview(klant.logo || null);
    setRemoveLogo(false);
    setShowForm(true);
  };

  const addContact = () => setContacts([...contacts, emptyContact()]);
  const removeContact = (idx: number) => setContacts(contacts.filter((_, i) => i !== idx));
  const updContact = (idx: number, patch: Partial<ContactRow>) =>
    setContacts(contacts.map((c, i) => i === idx ? { ...c, ...patch } : c));

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setRemoveLogo(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      // Legacy velden blijven sync met de eerste contact voor zoek-compatibiliteit
      fd.append('contactPerson', contacts[0]?.naam || '');
      fd.append('email', contacts[0]?.email || '');
      const filteredContacts = contacts.filter((c) => c.naam.trim() || c.email.trim() || c.telefoon.trim());
      fd.append('contacts', JSON.stringify(filteredContacts));
      if (logoFile) fd.append('logo', logoFile);
      if (removeLogo) fd.append('removeLogo', 'true');

      if (editingId) {
        await updateKlant(editingId, fd);
        toast.success('Klant bijgewerkt');
      } else {
        await createKlant(fd);
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

  const sorted = [...klanten].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'name':
        cmp = a.name.localeCompare(b.name, 'nl');
        break;
      case 'contactPerson':
        cmp = (a.contactPerson || '').localeCompare(b.contactPerson || '', 'nl');
        break;
      case 'email':
        cmp = (a.email || '').localeCompare(b.email || '', 'nl');
        break;
      case 'projects':
        cmp = (a._count?.projects ?? 0) - (b._count?.projects ?? 0);
        break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Klanten</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 h-7 px-3 rounded-lg ring-1 ring-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.5)] text-[12px] font-medium hover:bg-[rgba(255,255,255,0.12)] hover:text-white transition-all duration-150 cursor-pointer"
        >
          + Nieuwe klant
        </button>
      </div>

      <div className="bg-bg-surface rounded-[12px] border border-[rgba(255,255,255,0.08)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[rgba(255,255,255,0.08)]">
              <th className="w-10 px-3 py-3"></th>
              <th className="text-left px-3 py-3 text-text-secondary text-sm font-medium cursor-pointer select-none hover:text-text-primary whitespace-nowrap" onClick={() => toggleSort('name')}>
                Naam <SortIcon column="name" />
              </th>
              <th className="text-left px-3 py-3 text-text-secondary text-sm font-medium cursor-pointer select-none hover:text-text-primary whitespace-nowrap" onClick={() => toggleSort('contactPerson')}>
                Contactpersoon <SortIcon column="contactPerson" />
              </th>
              <th className="text-left px-3 py-3 text-text-secondary text-sm font-medium cursor-pointer select-none hover:text-text-primary whitespace-nowrap" onClick={() => toggleSort('email')}>
                Email <SortIcon column="email" />
              </th>
              <th className="text-left px-3 py-3 text-text-secondary text-sm font-medium cursor-pointer select-none hover:text-text-primary whitespace-nowrap" onClick={() => toggleSort('projects')}>
                Projecten <SortIcon column="projects" />
              </th>
              <th className="text-right px-3 py-3 text-text-secondary text-sm font-medium whitespace-nowrap">Acties</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((klant) => (
              <tr key={klant.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]">
                <td className="px-3 py-2">
                  <button onClick={() => openEdit(klant)} className="cursor-pointer">
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-white shrink-0">
                      {klant.logo ? (
                        <img src={klant.logo} alt="" className="w-full h-full object-contain p-0.5" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => openEdit(klant)} className="text-accent-teal hover:opacity-80 font-medium cursor-pointer whitespace-nowrap">
                    {klant.name}
                  </button>
                </td>
                <td className="px-3 py-2 text-text-secondary">{klant.contactPerson || ''}</td>
                <td className="px-3 py-2">
                  {klant.email ? (
                    <a href={`mailto:${klant.email}`} className="text-text-secondary hover:text-accent-teal transition-colors">{klant.email}</a>
                  ) : ''}
                </td>
                <td className="px-3 py-2 text-text-secondary">{klant._count?.projects ?? 0}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => setDeletingKlant(klant)} className="text-red-400 hover:opacity-80 text-sm cursor-pointer">
                    Verwijder
                  </button>
                </td>
              </tr>
            ))}
            {klanten.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-text-muted">
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
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Logo + Name row */}
          <div className="flex gap-5 items-start">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              onChange={handleLogoChange}
              className="hidden"
            />
            <div
              className="shrink-0 w-[140px] h-[140px] rounded-full overflow-hidden bg-white border-2 border-white/10 hover:border-accent-teal cursor-pointer transition-colors group relative flex items-center justify-center"
              onClick={() => !logoPreview && fileRef.current?.click()}
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Preview" className="w-full h-full object-contain p-3" />
              ) : (
                <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
                </svg>
              )}
              <div className={`absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${logoPreview ? 'gap-6' : ''}`}>
                <button type="button" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors" title="Nieuw logo">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                  </svg>
                </button>
                {logoPreview && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setLogoPreview(null); setLogoFile(null); setRemoveLogo(true); }} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors" title="Logo verwijderen">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <label className="block text-text-secondary text-sm mb-1">Klantnaam *</label>
                <input
                  type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-teal"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-text-secondary text-sm mb-2">Contactpersonen</label>
            <div className="space-y-2">
              {contacts.map((c, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <input
                    type="text" placeholder="Contactpersoon"
                    value={c.naam}
                    onChange={(e) => updContact(i, { naam: e.target.value })}
                    className="col-span-4 px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white text-sm focus:outline-none focus:border-accent-teal"
                  />
                  <input
                    type="email" placeholder="Email"
                    value={c.email}
                    onChange={(e) => updContact(i, { email: e.target.value })}
                    className="col-span-4 px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white text-sm focus:outline-none focus:border-accent-teal"
                  />
                  <input
                    type="tel" placeholder="Telefoon"
                    value={c.telefoon}
                    onChange={(e) => updContact(i, { telefoon: e.target.value })}
                    className="col-span-3 px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white text-sm focus:outline-none focus:border-accent-teal"
                  />
                  {i === 0 ? (
                    <div className="col-span-1" />
                  ) : (
                    <button
                      type="button" onClick={() => removeContact(i)}
                      className="col-span-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm cursor-pointer"
                      title="Verwijderen"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button" onClick={addContact}
              className="mt-2 px-3 py-1.5 rounded-lg bg-white/5 text-text-secondary text-xs hover:bg-white/10 cursor-pointer"
            >
              + Contactpersoon toevoegen
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-white/10 text-text-primary hover:bg-white/20 transition-colors cursor-pointer">
              Annuleren
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-accent-teal text-[#1a3a38] font-semibold hover:brightness-110 transition-all shadow-[0_2px_8px_rgba(45,212,191,0.3)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer">
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
