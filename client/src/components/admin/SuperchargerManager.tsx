import { useState, useEffect, useRef } from 'react';
import { Supercharger, fetchSuperchargers, createSupercharger, updateSupercharger, deleteSupercharger } from '../../api';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

interface SuperchargerFormData {
  firstName: string;
  lastName: string;
  function: string;
  email: string;
  phone: string;
  birthDate: string;
}

const emptyForm: SuperchargerFormData = {
  firstName: '', lastName: '', function: 'Supercharger', email: '', phone: '', birthDate: '',
};

const functionPresets: string[] = ['Supercharger', 'Senior'];

type SortKey = 'firstName' | 'lastName' | 'function' | 'email' | 'phone' | 'birthDate';
type SortDir = 'asc' | 'desc';

export default function SuperchargerManager() {
  const toast = useToast();
  const [superchargers, setSuperchargers] = useState<Supercharger[]>([]);
  const [form, setForm] = useState<SuperchargerFormData>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deletingItem, setDeletingItem] = useState<Supercharger | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [customFunction, setCustomFunction] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('firstName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [phoneMenuId, setPhoneMenuId] = useState<number | null>(null);

  const load = async () => {
    const data = await fetchSuperchargers();
    setSuperchargers(data);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setRemovePhoto(false);
    setCustomFunction(false);
    setShowForm(true);
  };

  const openEdit = (item: Supercharger) => {
    const isPreset = functionPresets.includes(item.function);
    setForm({
      firstName: item.firstName,
      lastName: item.lastName,
      function: item.function,
      email: item.email || '',
      phone: item.phone || '',
      birthDate: item.birthDate ? item.birthDate.substring(0, 10) : '',
    });
    setEditingId(item.id);
    setPhotoFile(null);
    setPhotoPreview(item.photo || null);
    setRemovePhoto(false);
    setCustomFunction(!isPreset);
    setShowForm(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setRemovePhoto(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('firstName', form.firstName);
      fd.append('lastName', form.lastName);
      fd.append('function', form.function);
      fd.append('email', form.email);
      fd.append('phone', form.phone);
      fd.append('birthDate', form.birthDate);
      if (photoFile) fd.append('photo', photoFile);
      if (removePhoto) fd.append('removePhoto', 'true');

      if (editingId) {
        await updateSupercharger(editingId, fd);
        toast.success('Supercharger bijgewerkt');
      } else {
        await createSupercharger(fd);
        toast.success('Supercharger aangemaakt');
      }
      setShowForm(false);
      load();
    } catch {
      toast.error('Opslaan mislukt');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    try {
      await deleteSupercharger(deletingItem.id);
      toast.success(`"${deletingItem.firstName} ${deletingItem.lastName}" verwijderd`);
    } catch {
      toast.error('Verwijderen mislukt');
    }
    setDeletingItem(null);
    load();
  };

  const formatDate = (d: string | null) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('nl-NL');
  };

  const formatPhone = (p: string) => {
    // Add dash after first 2 digits if missing (e.g. 06243... → 06-243...)
    const digits = p.replace(/\s/g, '');
    if (/^\d{2}[^-]/.test(digits) && !digits.includes('-')) {
      return digits.slice(0, 2) + '-' + digits.slice(2);
    }
    return p;
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

  const sorted = [...superchargers].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'firstName':
        cmp = a.firstName.localeCompare(b.firstName, 'nl');
        break;
      case 'lastName':
        cmp = a.lastName.localeCompare(b.lastName, 'nl');
        break;
      case 'function':
        cmp = a.function.localeCompare(b.function, 'nl');
        break;
      case 'email':
        cmp = (a.email || '').localeCompare(b.email || '', 'nl');
        break;
      case 'phone':
        cmp = (a.phone || '').localeCompare(b.phone || '', 'nl');
        break;
      case 'birthDate':
        cmp = (a.birthDate || '').localeCompare(b.birthDate || '');
        break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Superchargers</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 h-7 px-3 rounded-lg ring-1 ring-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.5)] text-[12px] font-medium hover:bg-[rgba(255,255,255,0.12)] hover:text-white transition-all duration-150 cursor-pointer"
        >
          + Supercharger toevoegen
        </button>
      </div>

      {/* Table */}
      <div className="bg-bg-surface rounded-[12px] border border-[rgba(255,255,255,0.08)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[rgba(255,255,255,0.08)]">
              <th className="w-10 px-3 py-3"></th>
              <th className="text-left px-3 py-3 text-text-secondary text-sm font-medium cursor-pointer select-none hover:text-text-primary whitespace-nowrap" onClick={() => toggleSort('firstName')}>
                Voornaam <SortIcon column="firstName" />
              </th>
              <th className="text-left px-3 py-3 text-text-secondary text-sm font-medium cursor-pointer select-none hover:text-text-primary whitespace-nowrap" onClick={() => toggleSort('lastName')}>
                Achternaam <SortIcon column="lastName" />
              </th>
              <th className="text-left px-3 py-3 text-text-secondary text-sm font-medium cursor-pointer select-none hover:text-text-primary whitespace-nowrap" onClick={() => toggleSort('function')}>
                Functie <SortIcon column="function" />
              </th>
              <th className="text-left px-3 py-3 text-text-secondary text-sm font-medium cursor-pointer select-none hover:text-text-primary whitespace-nowrap" onClick={() => toggleSort('email')}>
                Email <SortIcon column="email" />
              </th>
              <th className="text-right px-3 py-3 text-text-secondary text-sm font-medium cursor-pointer select-none hover:text-text-primary whitespace-nowrap" onClick={() => toggleSort('phone')}>
                Telefoon <SortIcon column="phone" />
              </th>
              <th className="text-right px-3 py-3 text-text-secondary text-sm font-medium cursor-pointer select-none hover:text-text-primary whitespace-nowrap" onClick={() => toggleSort('birthDate')}>
                Geb. datum <SortIcon column="birthDate" />
              </th>
              <th className="text-right px-3 py-3 text-text-secondary text-sm font-medium whitespace-nowrap">Acties</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
              <tr key={item.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]">
                <td className="px-3 py-2">
                  <button onClick={() => openEdit(item)} className="cursor-pointer">
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-bg-dark shrink-0">
                      {item.photo ? (
                        <img src={item.photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => openEdit(item)} className="text-accent-teal hover:opacity-80 font-medium cursor-pointer whitespace-nowrap" title={item.firstName.length > 12 ? item.firstName : undefined}>
                    {item.firstName.length > 12 ? item.firstName.slice(0, 12) + '...' : item.firstName}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => openEdit(item)} className="text-accent-teal hover:opacity-80 font-medium cursor-pointer whitespace-nowrap" title={item.lastName.length > 12 ? item.lastName : undefined}>
                    {item.lastName.length > 12 ? item.lastName.slice(0, 12) + '...' : item.lastName}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                    item.function === 'Supercharger' ? 'bg-accent-teal/15 text-accent-teal'
                    : item.function === 'Senior' ? 'bg-accent-gold/15 text-accent-gold'
                    : 'bg-white/10 text-text-secondary'
                  }`}>
                    {item.function}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {item.email ? (
                    <a href={`mailto:${item.email}`} className="text-text-secondary hover:text-accent-teal transition-colors">{item.email}</a>
                  ) : ''}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap relative">
                  {item.phone ? (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); setPhoneMenuId(phoneMenuId === item.id ? null : item.id); }}
                        className="text-text-secondary hover:text-accent-teal transition-colors cursor-pointer"
                      >
                        {formatPhone(item.phone)}
                      </button>
                      {phoneMenuId === item.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setPhoneMenuId(null)} />
                          <div className="absolute right-3 top-full mt-1 z-20 bg-bg-surface border border-[rgba(255,255,255,0.12)] rounded-lg shadow-lg py-1 min-w-[140px]">
                            <a href={`tel:${item.phone}`} className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-white/5 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" /></svg>
                              Bellen
                            </a>
                            <a href={`sms:${item.phone}`} className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-white/5 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" /></svg>
                              Bericht
                            </a>
                            <a href={`https://wa.me/${item.phone.replace(/[^0-9+]/g, '').replace(/^06/, '316')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-white/5 transition-colors">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                              WhatsApp
                            </a>
                          </div>
                        </>
                      )}
                    </>
                  ) : ''}
                </td>
                <td className="px-3 py-2 text-text-secondary text-right whitespace-nowrap">{formatDate(item.birthDate)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => setDeletingItem(item)} className="text-red-400 hover:opacity-80 text-sm cursor-pointer">
                    Verwijder
                  </button>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-muted">
                  Nog geen superchargers toegevoegd.
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
        title={editingId ? 'Supercharger bewerken' : 'Supercharger toevoegen'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo + Name row */}
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
                <div className="w-full h-full flex items-center justify-center">
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
                <label className="block text-text-secondary text-sm mb-1">Voornaam *</label>
                <input
                  type="text" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-gold"
                  required
                />
              </div>
              <div>
                <label className="block text-text-secondary text-sm mb-1">Achternaam *</label>
                <input
                  type="text" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-gold"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-text-secondary text-sm mb-1">Functie *</label>
            {customFunction ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.function}
                  onChange={(e) => setForm({ ...form, function: e.target.value })}
                  placeholder="Vul functie in"
                  className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white placeholder-text-secondary focus:outline-none focus:border-accent-gold"
                  required
                />
                <button
                  type="button"
                  onClick={() => { setCustomFunction(false); setForm({ ...form, function: 'Supercharger' }); }}
                  className="px-2 text-text-secondary hover:text-white shrink-0"
                  title="Terug naar opties"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ) : (
              <select
                value={form.function}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setCustomFunction(true);
                    setForm({ ...form, function: '' });
                  } else {
                    setForm({ ...form, function: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-gold"
                required
              >
                {functionPresets.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
                <option value="__custom__">Anders...</option>
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div>
            <label className="block text-text-secondary text-sm mb-1">Geboortedatum</label>
            <input
              type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-gold"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-white/10 text-text-primary hover:bg-white/20 transition-colors cursor-pointer">
              Annuleren
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-accent text-bg-dark font-semibold hover:brightness-110 transition-all shadow-[0_2px_8px_rgba(201,168,76,0.3)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer">
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
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={handleDelete}
        title="Supercharger verwijderen"
        message={`Weet je zeker dat je "${deletingItem?.firstName} ${deletingItem?.lastName}" wilt verwijderen?`}
      />
    </div>
  );
}
