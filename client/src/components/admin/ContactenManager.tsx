// Generieke manager voor klant-achtige entiteiten (Klanten, Toeleveranciers).
// Dezelfde shape: name + contactPerson + email + logo + adres-velden + contacts[].
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import { EUROPESE_LANDEN_PRIO, EUROPESE_LANDEN_REST, landToFlag } from '../../shared/countries';
import { Specialisme, fetchProjects, Project } from '../../api';
import { useSpecialismes } from '../../hooks/useSpecialismes';
import { formatPhone } from '../../shared/phone';
import { useAutoSave, SaveIndicator } from '../../hooks/useAutoSave';

export interface ContactEntity {
  id: number;
  name: string;
  contactPerson: string | null;
  email: string | null;
  logo: string | null;
  adres: string | null;
  postcode: string | null;
  stad: string | null;
  land: string | null;
  contacts?: Array<{ naam: string; email: string | null; telefoon: string | null }>;
  specialismes?: Array<{ specialismeId: number; specialisme: Specialisme }>;
  _count?: { projects?: number };
}

interface Props<T extends ContactEntity> {
  title: string;
  singular: string;
  newButtonLabel: string;
  basePath?: string;           // optioneel: in-page routing i.p.v. modal
  cardView?: boolean;          // kaarten grid i.p.v. tabel (frontend)
  fetchAll: () => Promise<T[]>;
  create: (fd: FormData) => Promise<T>;
  update: (id: number, fd: FormData) => Promise<T>;
  remove: (id: number) => Promise<unknown>;
  refreshLogo?: (id: number) => Promise<{ logo: string }>;
  showProjectsCount?: boolean;
  showSpecialismes?: boolean;
}

type SortKey = 'name' | 'contactPerson' | 'email' | 'projects';
type SortDir = 'asc' | 'desc';
type ProjectLimit = 10 | 20 | 50 | 100 | 'all';

type ContactRow = { naam: string; email: string; telefoon: string };
const emptyContact = (): ContactRow => ({ naam: '', email: '', telefoon: '' });

const truncate = (s: string, n = 25) => s.length > n ? s.slice(0, n).trimEnd() + '…' : s;

const PROJECT_STATUS_LABEL: Record<string, string> = { active: 'Actief', completed: 'Afgerond', cancelled: 'Geannuleerd' };
const PROJECT_STATUS_STYLE: Record<string, string> = {
  active: 'bg-accent-teal/20 text-accent-teal ring-accent-teal/40',
  completed: 'bg-gray-500/15 text-gray-300 ring-gray-500/30',
  cancelled: 'bg-red-500/15 text-red-300 ring-red-500/30',
};

const inputClass = 'w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white text-sm focus:outline-none focus:border-accent-teal';

export default function ContactenManager<T extends ContactEntity>({
  title, singular, newButtonLabel, basePath, cardView, fetchAll, create, update, remove, refreshLogo, showProjectsCount, showSpecialismes,
}: Props<T>) {
  const toast = useToast();
  const navigate = useNavigate();
  const { contactId } = useParams<{ contactId?: string }>();

  // URL-modus als basePath meegegeven
  const urlMode = !!basePath;
  const isNew = urlMode && contactId === 'new';
  const urlEditId = urlMode && contactId && contactId !== 'new' ? Number(contactId) : null;
  const showInPage = isNew || !!urlEditId;

  const [items, setItems] = useState<T[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', adres: '', postcode: '', stad: '', land: '' });
  const [contacts, setContacts] = useState<ContactRow[]>([emptyContact()]);
  const [selectedSpecialismeIds, setSelectedSpecialismeIds] = useState<number[]>([]);
  const { specialismes: allSpecialismes, addSpecialisme } = useSpecialismes(!!showSpecialismes);
  const [addingSpec, setAddingSpec] = useState(false);
  const [newSpecNaam, setNewSpecNaam] = useState('');
  const specBusyRef = useRef(false);
  const [klantProjects, setKlantProjects] = useState<Project[]>([]);
  const [projectLimits, setProjectLimits] = useState<Record<'active' | 'completed' | 'cancelled', ProjectLimit>>({
    active: 10, completed: 10, cancelled: 10,
  });
  const [projectSectionCollapsed, setProjectSectionCollapsed] = useState<Record<'completed' | 'cancelled', boolean>>({
    completed: true, cancelled: true,
  });
  const [deleting, setDeleting] = useState<T | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [search, setSearch] = useState('');
  const [filterSpecialismeIds, setFilterSpecialismeIds] = useState<number[]>([]);

  const load = async () => setItems(await fetchAll());
  useEffect(() => { load(); }, []);

  // Nieuw specialisme inline aanmaken (of bestaande hergebruiken) → meteen selecteren.
  // De ref-guard voorkomt een dubbele aanmaak als zowel Enter als blur vuren.
  async function handleAddSpecialisme() {
    if (specBusyRef.current) return;
    const naam = newSpecNaam.trim();
    setAddingSpec(false);
    setNewSpecNaam('');
    if (!naam) return;
    specBusyRef.current = true;
    try {
      const sp = await addSpecialisme(naam);
      if (sp) setSelectedSpecialismeIds((prev) => (prev.includes(sp.id) ? prev : [...prev, sp.id]));
    } finally {
      specBusyRef.current = false;
    }
  }

  // Specialisme-kiezer: chips (toggle) + de inline "+ specialisme"-affordance. Voor beide weergaven.
  function specialismeSelector(variant: 'form' | 'detail') {
    const chip = variant === 'form' ? 'px-3 py-1.5 rounded-full text-sm' : 'px-3 h-8 rounded-full text-[13px]';
    const inactive = variant === 'form'
      ? 'bg-white/5 ring-1 ring-white/15 text-white/50 hover:text-white hover:bg-white/10'
      : 'bg-[rgba(255,255,255,0.05)] ring-1 ring-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.55)] hover:text-white hover:bg-[rgba(255,255,255,0.1)]';
    return (
      <div className="flex flex-wrap gap-2">
        {allSpecialismes.map((s) => {
          const active = selectedSpecialismeIds.includes(s.id);
          return (
            <button key={s.id} type="button"
              onClick={() => setSelectedSpecialismeIds(active ? selectedSpecialismeIds.filter((id) => id !== s.id) : [...selectedSpecialismeIds, s.id])}
              className={`${chip} font-medium transition-colors cursor-pointer ${active ? 'bg-accent-teal text-[#1a3a38]' : inactive}`}
            >
              {active && <span className="mr-1">✓</span>}{s.naam}
            </button>
          );
        })}
        {addingSpec ? (
          <input
            autoFocus
            value={newSpecNaam}
            onChange={(e) => setNewSpecNaam(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleAddSpecialisme(); }
              if (e.key === 'Escape') { setAddingSpec(false); setNewSpecNaam(''); }
            }}
            onBlur={() => handleAddSpecialisme()}
            placeholder="Nieuw specialisme…"
            className={`${chip} w-44 bg-white/5 ring-1 ring-accent-teal text-white placeholder-white/30 focus:outline-none`}
          />
        ) : (
          <button type="button" onClick={() => setAddingSpec(true)}
            className={`${chip} border border-dashed border-white/25 text-white/50 hover:text-white hover:border-white/50 transition-colors cursor-pointer`}
          >
            + specialisme
          </button>
        )}
      </div>
    );
  }

  // Projecten van deze klant of toeleverancier ophalen
  const detailEditId = urlMode ? urlEditId : editingId;
  const isToeleverancier = singular === 'toeleverancier';
  useEffect(() => {
    if (!showProjectsCount || !detailEditId) { setKlantProjects([]); return; }
    fetchProjects().then((all) => {
      const filtered = isToeleverancier
        ? all.filter((p) => (p.toeleveranciers ?? []).some((t) => t.toeleverancierId === detailEditId))
        : all.filter((p) => p.klantId === detailEditId);
      setKlantProjects(filtered);
    }).catch(() => setKlantProjects([]));
  }, [showProjectsCount, detailEditId, isToeleverancier]);

  // Set met namen die aan minstens één project gekoppeld zijn (case-insensitive, trimmed).
  // Gebruikt om de X-knop te verbergen bij contacten die in gebruik zijn.
  const linkedContactNames = new Set(
    klantProjects.flatMap((p) => (p.contacts ?? []).map((c) => c.naam.trim().toLowerCase())),
  );
  const isContactLinked = (naam: string) => {
    const key = naam.trim().toLowerCase();
    return key.length > 0 && linkedContactNames.has(key);
  };

  const populateForm = (item: T) => {
    setForm({ name: item.name, adres: item.adres ?? '', postcode: item.postcode ?? '', stad: item.stad ?? '', land: item.land ?? '' });
    const existing: ContactRow[] = (item.contacts ?? []).map((c) => ({ naam: c.naam, email: c.email ?? '', telefoon: c.telefoon ?? '' }));
    if (existing.length === 0) existing.push({ naam: item.contactPerson ?? '', email: item.email ?? '', telefoon: '' });
    setContacts(existing);
    setSelectedSpecialismeIds((item.specialismes ?? []).map((s) => s.specialismeId));
    setLogoFile(null); setLogoPreview(item.logo || null); setRemoveLogo(false);
  };

  // URL-modus: laad formulier als contactId verandert
  useEffect(() => {
    if (!urlMode) return;
    if (isNew) {
      setForm({ name: '', adres: '', postcode: '', stad: '', land: '' });
      setContacts([emptyContact()]); setSelectedSpecialismeIds([]);
      setLogoFile(null); setLogoPreview(null); setRemoveLogo(false);
      return;
    }
    if (urlEditId) {
      const item = items.find(i => i.id === urlEditId);
      if (item) populateForm(item);
    }
  }, [contactId, items.length]);

  const openCreate = () => {
    if (urlMode) { navigate(`${basePath}/new`); return; }
    setForm({ name: '', adres: '', postcode: '', stad: '', land: '' });
    setContacts([emptyContact()]); setSelectedSpecialismeIds([]);
    setEditingId(null); setLogoFile(null); setLogoPreview(null); setRemoveLogo(false);
    setShowForm(true);
  };

  const openEdit = (item: T) => {
    if (urlMode) { navigate(`${basePath}/${item.id}`); return; }
    populateForm(item); setEditingId(item.id); setShowForm(true);
  };

  const closeDetail = () => { if (urlMode) navigate(basePath!); else setShowForm(false); };

  const addContact = () => setContacts([...contacts, emptyContact()]);
  const removeContact = (idx: number) => setContacts(contacts.filter((_, i) => i !== idx));
  const updContact = (idx: number, patch: Partial<ContactRow>) =>
    setContacts(contacts.map((c, i) => i === idx ? { ...c, ...patch } : c));

  const handleRefreshLogo = async () => {
    const activeId = urlMode ? urlEditId : editingId;
    if (!activeId || !refreshLogo) return;
    try {
      const result = await refreshLogo(activeId);
      setLogoPreview(result.logo);
      setLogoFile(null);
      setRemoveLogo(false);
      await load();
    } catch {
      toast.error('Geen logo gevonden');
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setRemoveLogo(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  // Eén save-functie zonder toasts (auto-save). Maakt aan bij eerste call met naam.
  const saveNow = async () => {
    if (!form.name.trim()) return; // Geen lege records aanmaken
    const fd = new FormData();
    fd.append('name', form.name);
    fd.append('adres', form.adres);
    fd.append('postcode', form.postcode);
    fd.append('stad', form.stad);
    fd.append('land', form.land);
    fd.append('contactPerson', contacts[0]?.naam || '');
    fd.append('email', contacts[0]?.email || '');
    const filtered = contacts.filter((c) => c.naam.trim() || c.email.trim() || c.telefoon.trim());
    fd.append('contacts', JSON.stringify(filtered));
    if (logoFile) { fd.append('logo', logoFile); }
    if (removeLogo) { fd.append('removeLogo', 'true'); }
    if (showSpecialismes) fd.append('specialismeIds', JSON.stringify(selectedSpecialismeIds));

    const activeId = urlMode ? urlEditId : editingId;
    if (activeId) {
      await update(activeId, fd);
    } else {
      const created = await create(fd);
      if (urlMode) navigate(`${basePath}/${created.id}`, { replace: true });
      else setEditingId(created.id);
    }
    // Reset éénmalige logo flags na succesvolle save
    if (logoFile) setLogoFile(null);
    if (removeLogo) setRemoveLogo(false);
    await load();
  };

  // Auto-save als formulier zichtbaar is (in-page of modal)
  const isFormActive = showInPage || showForm;
  const saveStatus = useAutoSave(
    { form, contacts, selectedSpecialismeIds, hasLogoFile: !!logoFile, removeLogo },
    saveNow,
    { enabled: isFormActive && !!form.name.trim() }
  );

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await remove(deleting.id);
      toast.success(`${singular[0].toUpperCase()}${singular.slice(1)} "${deleting.name}" verwijderd`);
      closeDetail(); await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || `Kan ${singular} niet verwijderen`);
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

  const sorted = [...items].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'name': cmp = a.name.localeCompare(b.name, 'nl'); break;
      case 'contactPerson': cmp = (a.contactPerson || '').localeCompare(b.contactPerson || '', 'nl'); break;
      case 'email': cmp = (a.email || '').localeCompare(b.email || '', 'nl'); break;
      case 'projects': cmp = (a._count?.projects ?? 0) - (b._count?.projects ?? 0); break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // ── Gedeeld formulier ─────────────────────────────────────────────────────
  const inlineFormBody = (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
      <div className="flex gap-5 items-start">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" onChange={handleLogoChange} className="hidden" />
        <div className="shrink-0 w-[140px] h-[140px] rounded-full overflow-hidden bg-white border-2 border-white/10 hover:border-accent-teal cursor-pointer transition-colors group relative flex items-center justify-center"
          onClick={() => !logoPreview && fileRef.current?.click()}>
          {logoPreview
            ? <img src={logoPreview} alt="Preview" className="w-full h-full object-contain p-3" />
            : <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>}
          <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-2">
              <button type="button" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors" title="Nieuw logo">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" /></svg>
              </button>
              {refreshLogo && (urlMode ? urlEditId : editingId) && (
                <button type="button" onClick={(e) => { e.stopPropagation(); handleRefreshLogo(); }} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors" title="Logo opnieuw zoeken">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                </button>
              )}
            </div>
            {logoPreview && (
              <button type="button" onClick={(e) => { e.stopPropagation(); setLogoPreview(null); setLogoFile(null); setRemoveLogo(true); }} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors" title="Logo verwijderen">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 space-y-3 min-w-0">
          <div>
            <label className="block text-text-secondary text-sm mb-1">{`${singular[0].toUpperCase()}${singular.slice(1)}naam`} *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} required />
          </div>
          <div className="grid grid-cols-[1fr_8ch] gap-3">
            <div>
              <label className="block text-text-secondary text-sm mb-1">Adres</label>
              <input type="text" placeholder="Straatnaam + huisnummer" value={form.adres} onChange={(e) => setForm({ ...form, adres: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-text-secondary text-sm mb-1">Postcode</label>
              <input type="text" placeholder="1012 AB" maxLength={7} value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-text-secondary text-sm mb-1">Plaats</label>
              <input type="text" placeholder="Amsterdam" value={form.stad} onChange={(e) => setForm({ ...form, stad: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-text-secondary text-sm mb-1">Land</label>
              <select value={form.land} onChange={(e) => setForm({ ...form, land: e.target.value })} className={inputClass}>
                <option value="">— Kies land —</option>
                {EUROPESE_LANDEN_PRIO.map((l) => <option key={l} value={l}>{l}</option>)}
                <option disabled>──────────</option>
                {EUROPESE_LANDEN_REST.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>
      <div>
        <label className="block text-text-secondary text-sm mb-2">Contactpersonen</label>
        <div className="space-y-2">
          {contacts.map((c, i) => {
            const linked = isContactLinked(c.naam);
            return (
              <div key={i} className="grid grid-cols-12 gap-2">
                <input type="text" placeholder="Contactpersoon" value={c.naam} onChange={(e) => setContacts(contacts.map((r, j) => j === i ? { ...r, naam: e.target.value } : r))} className="col-span-4 px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white text-sm focus:outline-none focus:border-accent-teal" />
                <input type="email" placeholder="Email" value={c.email} onChange={(e) => setContacts(contacts.map((r, j) => j === i ? { ...r, email: e.target.value } : r))} className="col-span-4 px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white text-sm focus:outline-none focus:border-accent-teal" />
                <input type="tel" placeholder="Telefoon" value={c.telefoon} onChange={(e) => setContacts(contacts.map((r, j) => j === i ? { ...r, telefoon: e.target.value } : r))} onBlur={(e) => { const f = formatPhone(e.target.value); if (f !== e.target.value) setContacts(contacts.map((r, j) => j === i ? { ...r, telefoon: f } : r)); }} className="col-span-3 px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white text-sm focus:outline-none focus:border-accent-teal" />
                {linked ? (
                  <div className="col-span-1 flex items-center justify-center text-[rgba(255,255,255,0.3)]" title="Gekoppeld aan een project — kan niet verwijderd worden">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                  </div>
                ) : i === 0 ? <div className="col-span-1" /> : (
                  <button type="button" onClick={() => setContacts(contacts.filter((_, j) => j !== i))} className="col-span-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm cursor-pointer">×</button>
                )}
              </div>
            );
          })}
        </div>
        <button type="button" onClick={() => setContacts([...contacts, emptyContact()])} className="mt-2 px-3 py-1.5 rounded-lg bg-white/5 text-text-secondary text-xs hover:bg-white/10 cursor-pointer">
          + Contactpersoon toevoegen
        </button>
      </div>
      {showSpecialismes && (
        <div>
          <label className="block text-text-secondary text-sm mb-2">Specialismes</label>
          {specialismeSelector('form')}
        </div>
      )}
      <div className="flex justify-end items-center gap-3 pt-2">
        <SaveIndicator status={saveStatus} />
      </div>
    </form>
  );

  // ── In-page view (URL modus, frontend) ────────────────────────────────────
  if (showInPage) {
    const currentItem = urlEditId ? items.find(i => i.id === urlEditId) : null;
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const sectionCls = 'rounded-xl bg-[rgba(255,255,255,0.03)] ring-1 ring-[rgba(255,255,255,0.08)] p-5';
    const sectionTitleCls = 'text-[11px] font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.5)] mb-4';
    const fieldLabel = 'block text-[12px] font-medium text-[rgba(255,255,255,0.55)] mb-1.5';
    const fieldInput = 'w-full h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.1)] text-white text-[13px] focus:outline-none focus:ring-accent-teal placeholder-[rgba(255,255,255,0.25)]';
    return (
      <div className="px-6 py-6">
        <form onSubmit={(e) => e.preventDefault()}>
          {/* Header sectie */}
          <div className="relative flex items-center gap-6 pb-6 mb-6 border-b border-[rgba(255,255,255,0.08)]">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" onChange={handleLogoChange} className="hidden" />
            <div
              className="shrink-0 w-[160px] h-[160px] rounded-2xl overflow-hidden bg-white border border-white/10 hover:border-accent-teal cursor-pointer transition-colors group relative flex items-center justify-center"
              onClick={() => !logoPreview && fileRef.current?.click()}
            >
              {logoPreview
                ? <img src={logoPreview} alt={form.name || 'Logo'} className="w-full h-full object-cover" />
                : <svg className="w-12 h-12 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>}
              <div className={`absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity`}>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }} className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center" title="Upload logo">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" /></svg>
                  </button>
                  {refreshLogo && (urlMode ? urlEditId : editingId) && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleRefreshLogo(); }} className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center" title="Logo opnieuw zoeken">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                    </button>
                  )}
                </div>
                {logoPreview && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setLogoPreview(null); setLogoFile(null); setRemoveLogo(true); }} className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center" title="Verwijder logo">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold text-white truncate">{isNew ? `Nieuwe ${singular}` : (form.name || currentItem?.name || '…')}</h1>
              {form.land && (
                <span className="inline-block text-[28px] leading-none mt-2" title={form.land}>
                  {landToFlag(form.land)}
                </span>
              )}
            </div>
          </div>

          {/* Twee koloms grid — 2 kolommen vanaf md (768px+) zodat bredere schermen volledig benut worden */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            {/* Bedrijfsgegevens */}
            <div className={sectionCls}>
              <h2 className={sectionTitleCls}>Bedrijfsgegevens</h2>
              <div className="space-y-3">
                <div>
                  <label className={fieldLabel}>{cap(singular)}naam *</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={fieldInput} required />
                </div>
                <div>
                  <label className={fieldLabel}>Adres</label>
                  <input type="text" placeholder="Straatnaam + huisnummer" value={form.adres} onChange={(e) => setForm({ ...form, adres: e.target.value })} className={fieldInput} />
                </div>
                <div className="grid grid-cols-[8rem_1fr] gap-3">
                  <div>
                    <label className={fieldLabel}>Postcode</label>
                    <input type="text" placeholder="1012 AB" maxLength={7} value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} className={fieldInput} />
                  </div>
                  <div>
                    <label className={fieldLabel}>Plaats</label>
                    <input type="text" placeholder="Amsterdam" value={form.stad} onChange={(e) => setForm({ ...form, stad: e.target.value })} className={fieldInput} />
                  </div>
                </div>
                <div>
                  <label className={fieldLabel}>Land</label>
                  <select value={form.land} onChange={(e) => setForm({ ...form, land: e.target.value })} className={fieldInput}>
                    <option value="">— Kies land —</option>
                    {EUROPESE_LANDEN_PRIO.map((l) => <option key={l} value={l}>{l}</option>)}
                    <option disabled>──────────</option>
                    {EUROPESE_LANDEN_REST.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Contactpersonen */}
            <div className={sectionCls}>
              <h2 className={sectionTitleCls}>Contactpersonen</h2>
              <div className="space-y-3">
                {contacts.map((c, i) => {
                  const linked = isContactLinked(c.naam);
                  return (
                  <div key={i} className={`relative rounded-lg p-3 ${i === 0 ? 'bg-accent-teal/5 ring-1 ring-accent-teal/20' : 'bg-[rgba(255,255,255,0.03)] ring-1 ring-[rgba(255,255,255,0.06)]'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${i === 0 ? 'text-accent-teal' : 'text-[rgba(255,255,255,0.35)]'}`}>
                        {`Contact ${i + 1}`}
                      </span>
                      {linked ? (
                        <span title="Gekoppeld aan een project — kan niet verwijderd worden" className="flex items-center gap-1 text-[10px] text-[rgba(255,255,255,0.3)]">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                        </span>
                      ) : i > 0 ? (
                        <button type="button" onClick={() => setContacts(contacts.filter((_, j) => j !== i))} className="text-[rgba(255,255,255,0.3)] hover:text-red-400 transition-colors cursor-pointer">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                        </button>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <input type="text" placeholder="Naam" value={c.naam} onChange={(e) => setContacts(contacts.map((r, j) => j === i ? { ...r, naam: e.target.value } : r))} className={fieldInput} />
                      <input type="email" placeholder="Email" value={c.email} onChange={(e) => setContacts(contacts.map((r, j) => j === i ? { ...r, email: e.target.value } : r))} className={fieldInput} />
                      <input type="tel" placeholder="Telefoon" value={c.telefoon} onChange={(e) => setContacts(contacts.map((r, j) => j === i ? { ...r, telefoon: e.target.value } : r))} onBlur={(e) => { const f = formatPhone(e.target.value); if (f !== e.target.value) setContacts(contacts.map((r, j) => j === i ? { ...r, telefoon: f } : r)); }} className={fieldInput} />
                    </div>
                  </div>
                  );
                })}
                <button type="button" onClick={() => setContacts([...contacts, emptyContact()])} className="w-full py-2.5 rounded-lg border border-dashed border-[rgba(255,255,255,0.15)] text-[rgba(255,255,255,0.4)] text-sm hover:border-[rgba(255,255,255,0.3)] hover:text-[rgba(255,255,255,0.6)] transition-colors cursor-pointer">
                  + Contactpersoon toevoegen
                </button>
              </div>
            </div>
          </div>

          {/* Specialismes (alleen toeleveranciers) — boven de projectensecties */}
          {showSpecialismes && (
            <div className={`${sectionCls} mb-5`}>
              <h2 className={sectionTitleCls}>Specialismes</h2>
              {specialismeSelector('detail')}
            </div>
          )}

          {/* Projecten van deze klant of toeleverancier — drie secties (actief/afgerond/geannuleerd) */}
          {showProjectsCount && detailEditId && (() => {
            const sections: Array<{ key: 'active' | 'completed' | 'cancelled'; label: string }> = [
              { key: 'active', label: 'Actieve projecten' },
              { key: 'completed', label: 'Afgeronde projecten' },
              { key: 'cancelled', label: 'Geannuleerde projecten' },
            ];
            const limitOptions: Array<{ value: ProjectLimit; label: string }> = [
              { value: 10, label: '10' },
              { value: 20, label: '20' },
              { value: 50, label: '50' },
              { value: 100, label: '100' },
              { value: 'all', label: 'Alles' },
            ];
            return sections.map(({ key, label }) => {
              const all = klantProjects
                .filter((p) => p.status === key)
                .sort((a, b) => a.projectNumber.localeCompare(b.projectNumber, 'nl'));
              const limit = projectLimits[key];
              const visible = limit === 'all' ? all : all.slice(0, limit);
              const collapsible = key !== 'active';
              const collapsed = collapsible && projectSectionCollapsed[key as 'completed' | 'cancelled'];
              const toggleCollapsed = () => {
                if (!collapsible) return;
                const k = key as 'completed' | 'cancelled';
                setProjectSectionCollapsed({ ...projectSectionCollapsed, [k]: !projectSectionCollapsed[k] });
              };
              return (
                <div key={key} className={`rounded-xl bg-[rgba(255,255,255,0.03)] ring-1 ring-[rgba(255,255,255,0.08)] ${collapsed ? 'px-5 py-2 mb-3' : 'p-5 mb-5'}`}>
                  <div className={`flex items-center justify-between gap-3 flex-wrap ${collapsed ? 'mb-0' : 'mb-4'}`}>
                    <h2
                      className={`${sectionTitleCls} !mb-0 flex items-center gap-2 ${collapsible ? 'cursor-pointer select-none hover:text-[rgba(255,255,255,0.7)] transition-colors' : ''}`}
                      onClick={toggleCollapsed}
                    >
                      {collapsible && (
                        <svg
                          className={`w-3 h-3 transition-transform ${collapsed ? '' : 'rotate-90'}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      )}
                      {label} <span className="text-[rgba(255,255,255,0.35)] normal-case tracking-normal font-normal">({all.length})</span>
                    </h2>
                    {!collapsed && all.length > 0 && (
                      <div className="flex items-center gap-1">
                        {limitOptions.map((opt) => {
                          const active = limit === opt.value;
                          return (
                            <button
                              key={String(opt.value)}
                              type="button"
                              onClick={() => setProjectLimits({ ...projectLimits, [key]: opt.value })}
                              className={`h-6 px-2 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                                active
                                  ? 'bg-accent-teal/20 text-accent-teal ring-1 ring-accent-teal/40'
                                  : 'bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.5)] hover:text-white hover:bg-[rgba(255,255,255,0.08)]'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {!collapsed && (all.length === 0 ? (
                    <p className="text-sm text-white/30 italic">Geen {label.toLowerCase()}.</p>
                  ) : (
                    <div className="bg-[rgba(0,0,0,0.2)] rounded-[10px] border border-[rgba(255,255,255,0.06)] overflow-hidden overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[rgba(255,255,255,0.06)]">
                            <th className="text-left px-3 py-2.5 text-text-secondary text-xs font-medium whitespace-nowrap">Projectnr.</th>
                            <th className="text-left px-3 py-2.5 text-text-secondary text-xs font-medium whitespace-nowrap">Projectnaam</th>
                            <th className="hidden md:table-cell text-left px-3 py-2.5 text-text-secondary text-xs font-medium whitespace-nowrap">Locaties</th>
                            <th className="hidden lg:table-cell text-left px-3 py-2.5 text-text-secondary text-xs font-medium whitespace-nowrap">Aangemaakt</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map((p) => (
                            <tr key={p.id} onClick={() => navigate(`/projecten/${p.id}`)} className="h-14 border-b border-[rgba(255,255,255,0.04)] last:border-0 hover:bg-[rgba(255,255,255,0.04)] cursor-pointer transition-colors align-middle">
                              <td className="px-3 py-2"><span className="text-accent-teal font-medium whitespace-nowrap">{p.projectNumber}</span></td>
                              <td className="px-3 py-2 text-text-primary whitespace-nowrap">{p.name || ''}</td>
                              <td className="hidden md:table-cell px-3 py-2 text-text-secondary">{p._count?.locations ?? 0}</td>
                              <td className="hidden lg:table-cell px-3 py-2 text-text-secondary whitespace-nowrap">
                                {new Date(p.createdAt).toLocaleDateString('nl-NL')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {visible.length < all.length && (
                        <div className="px-3 py-2 text-center text-[11px] text-[rgba(255,255,255,0.35)] border-t border-[rgba(255,255,255,0.04)]">
                          {all.length - visible.length} verborgen — kies een hogere limiet
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            });
          })()}

          {/* Specialismes-sectie verplaatst naar header rechts (zie boven). */}

          {/* Bottom bar: opslaan-status links, verwijder/badge rechts */}
          <div className="flex items-center pt-5 border-t border-[rgba(255,255,255,0.08)]">
            <SaveIndicator status={saveStatus} />
            <div className="ml-auto">
              {!isNew && currentItem && (
                showProjectsCount && klantProjects.length > 0 ? (
                  <span title="Deze klant heeft gekoppelde projecten en kan niet verwijderd worden" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.35)] text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                    Gekoppeld aan {klantProjects.length} project{klantProjects.length === 1 ? '' : 'en'}
                  </span>
                ) : (
                  <button type="button" onClick={() => setDeleting(currentItem)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm transition-colors cursor-pointer">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916" /></svg>
                    Verwijderen
                  </button>
                )
              )}
            </div>
          </div>
        </form>

        <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} title={`${cap(singular)} verwijderen?`} message={`Weet je zeker dat je "${deleting?.name}" wilt verwijderen?`} />
      </div>
    );
  }

  // ── Kaarten view (frontend) ────────────────────────────────────────────────
  const filteredSorted = sorted.filter((item) => {
    // Specialisme filter (AND-vrij: minstens 1 match)
    if (filterSpecialismeIds.length > 0) {
      const ids = (item.specialismes ?? []).map(s => s.specialismeId);
      if (!filterSpecialismeIds.some(id => ids.includes(id))) return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return item.name.toLowerCase().includes(q)
      || (item.stad || '').toLowerCase().includes(q)
      || (item.land || '').toLowerCase().includes(q)
      || (item.contactPerson || '').toLowerCase().includes(q);
  });

  if (cardView) {
    return (
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-white">{title}</h1>
          <button onClick={openCreate} className="flex items-center gap-2 h-9 px-4 rounded-lg bg-accent-teal text-[#1a3a38] text-[13px] font-semibold hover:opacity-85 transition-opacity cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            {newButtonLabel.replace('+ N', 'N')}
          </button>
        </div>
        {showSpecialismes && allSpecialismes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {allSpecialismes.map((s) => {
              const active = filterSpecialismeIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setFilterSpecialismeIds(active ? filterSpecialismeIds.filter(id => id !== s.id) : [...filterSpecialismeIds, s.id])}
                  className={`px-2.5 h-7 rounded-full text-[12px] font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-accent-teal text-[#1a3a38]'
                      : 'bg-[rgba(255,255,255,0.05)] ring-1 ring-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.55)] hover:text-white hover:bg-[rgba(255,255,255,0.1)]'
                  }`}
                >
                  {active && <span className="mr-1">✓</span>}{s.naam}
                </button>
              );
            })}
            {filterSpecialismeIds.length > 0 && (
              <button onClick={() => setFilterSpecialismeIds([])} className="text-[rgba(255,255,255,0.4)] hover:text-white text-[12px] cursor-pointer ml-1">
                Wissen
              </button>
            )}
          </div>
        )}
        {filteredSorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-[rgba(255,255,255,0.5)] mb-4">{items.length === 0 ? `Nog geen ${title.toLowerCase()}` : 'Geen resultaten'}</p>
            {items.length === 0 && <button onClick={openCreate} className="h-10 px-6 rounded-lg bg-accent-teal text-[#1a3a38] font-semibold hover:opacity-85 cursor-pointer">+ Voeg eerste {singular} toe</button>}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredSorted.map((item) => {
              const primary = item.contacts?.[0];
              return (
                <button key={item.id} type="button" onClick={() => openEdit(item)}
                  className="relative flex text-left bg-[rgba(255,255,255,0.03)] ring-1 ring-[rgba(255,255,255,0.08)] hover:ring-[rgba(255,255,255,0.18)] rounded-xl overflow-hidden transition-all duration-150 cursor-pointer h-[120px]">
                  <div className="w-[110px] flex-shrink-0 bg-white flex items-center justify-center">
                    {item.logo
                      ? <img src={item.logo} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                      : <svg className="w-8 h-8 text-[rgba(0,0,0,0.2)]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>
                    }
                  </div>
                  <div className="flex-1 min-w-0 p-3 flex flex-col gap-0.5">
                    <h3 className="text-white font-semibold text-[14px] truncate">{item.name}</h3>
                    {item.adres && <p className="text-[rgba(255,255,255,0.5)] text-[12px] truncate">{item.adres}</p>}
                    {(item.postcode || item.stad) && <p className="text-[rgba(255,255,255,0.45)] text-[12px] truncate">{[item.postcode, item.stad].filter(Boolean).join(' ')}</p>}
                    {primary?.naam && <p className="text-[rgba(255,255,255,0.4)] text-[12px] truncate mt-1">{primary.naam}</p>}
                  </div>
                  <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1.5">
                    {(item.specialismes ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                        {item.specialismes!.slice(0, 3).map((s) => (
                          <span key={s.specialismeId} className="inline-flex items-center h-5 px-2 rounded text-[10px] font-medium bg-accent-teal/15 text-accent-teal">{s.specialisme.naam}</span>
                        ))}
                      </div>
                    )}
                    {item.land && (
                      <span className="text-[16px] leading-none" title={item.land}>{landToFlag(item.land)}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? `${singular[0].toUpperCase()}${singular.slice(1)} bewerken` : `Nieuwe ${singular}`} maxWidth="max-w-2xl">
          {inlineFormBody}
        </Modal>
        <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} title={`${singular[0].toUpperCase()}${singular.slice(1)} verwijderen?`} message={`Weet je zeker dat je "${deleting?.name}" wilt verwijderen?`} />
      </div>
    );
  }

  // ── Tabel view (full-width, responsive — match locaties) ──────────────────
  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-semibold text-white">
          {title} <span className="text-[rgba(255,255,255,0.4)] text-base font-normal">({sorted.length})</span>
        </h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 h-7 px-3 rounded-lg ring-1 ring-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.5)] text-[12px] font-medium hover:bg-accent hover:text-[#1a3a38] hover:ring-accent transition-all duration-150 cursor-pointer"
        >
          {newButtonLabel}
        </button>
      </div>

      <div className="bg-bg-surface rounded-[12px] border border-[rgba(255,255,255,0.08)] overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[rgba(255,255,255,0.08)]">
              <th className="w-10 px-3 py-3"></th>
              <th className="text-left px-3 py-3 text-text-secondary text-sm font-medium cursor-pointer select-none hover:text-text-primary whitespace-nowrap" onClick={() => toggleSort('name')}>
                Naam <SortIcon column="name" />
              </th>
              <th className="hidden md:table-cell text-left px-3 py-3 text-text-secondary text-sm font-medium cursor-pointer select-none hover:text-text-primary whitespace-nowrap" onClick={() => toggleSort('contactPerson')}>
                Contactpersoon <SortIcon column="contactPerson" />
              </th>
              <th className="hidden lg:table-cell text-left px-3 py-3 text-text-secondary text-sm font-medium cursor-pointer select-none hover:text-text-primary whitespace-nowrap" onClick={() => toggleSort('email')}>
                Email <SortIcon column="email" />
              </th>
              <th className="hidden xl:table-cell text-left px-3 py-3 text-text-secondary text-sm font-medium whitespace-nowrap">Telefoon</th>
              <th className="hidden sm:table-cell text-left px-3 py-3 text-text-secondary text-sm font-medium whitespace-nowrap">Plaats</th>
              {showSpecialismes && (
                <th className="hidden lg:table-cell text-left px-3 py-3 text-text-secondary text-sm font-medium whitespace-nowrap">Specialismes</th>
              )}
              {showProjectsCount && (
                <th className="hidden md:table-cell text-left px-3 py-3 text-text-secondary text-sm font-medium cursor-pointer select-none hover:text-text-primary whitespace-nowrap" onClick={() => toggleSort('projects')}>
                  Projecten <SortIcon column="projects" />
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => {
              const primaryTel = item.contacts?.[0]?.telefoon;
              return (
                <tr key={item.id} onClick={() => openEdit(item)} className="h-14 border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.04)] cursor-pointer transition-colors align-middle">
                  <td className="px-3 py-2">
                    <div className="w-9 h-9 rounded overflow-hidden bg-white shrink-0 flex items-center justify-center">
                      {item.logo ? (
                        <img src={item.logo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
                        </svg>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-accent-teal hover:opacity-80 font-medium whitespace-nowrap">{item.name}</span>
                  </td>
                  <td className="hidden md:table-cell px-3 py-2 text-text-secondary" title={item.contactPerson || ''}>{truncate(item.contactPerson || '')}</td>
                  <td className="hidden lg:table-cell px-3 py-2">
                    {item.email ? (
                      <a href={`mailto:${item.email}`} className="text-text-secondary hover:text-accent-teal transition-colors">{item.email}</a>
                    ) : ''}
                  </td>
                  <td className="hidden xl:table-cell px-3 py-2">
                    {primaryTel ? (
                      <a href={`tel:${primaryTel.replace(/\s/g, '')}`} className="text-text-secondary hover:text-accent-teal transition-colors whitespace-nowrap">{primaryTel}</a>
                    ) : ''}
                  </td>
                  <td className="hidden sm:table-cell px-3 py-2 text-text-secondary whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      {item.stad}
                      {item.land && <span className="text-[14px]" title={item.land}>{landToFlag(item.land)}</span>}
                    </span>
                  </td>
                  {showSpecialismes && (
                    <td className="hidden lg:table-cell px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {(item.specialismes ?? []).map((s) => (
                          <span key={s.specialismeId} className="px-2 py-0.5 rounded-full bg-accent-teal/15 text-accent-teal text-xs font-medium whitespace-nowrap">
                            {s.specialisme.naam}
                          </span>
                        ))}
                      </div>
                    </td>
                  )}
                  {showProjectsCount && (
                    <td className="hidden md:table-cell px-3 py-2 text-text-secondary">{item._count?.projects ?? 0}</td>
                  )}
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={(showProjectsCount ? 7 : 6) + (showSpecialismes ? 1 : 0)} className="px-3 py-8 text-center text-text-muted">
                  Nog geen {title.toLowerCase()}. Klik op "{newButtonLabel}" om er een toe te voegen.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? `${singular[0].toUpperCase()}${singular.slice(1)} bewerken` : `Nieuwe ${singular}`}
        maxWidth="max-w-2xl"
      >
        {inlineFormBody}
      </Modal>

      <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} title={`${singular[0].toUpperCase()}${singular.slice(1)} verwijderen?`} message={`Weet je zeker dat je "${deleting?.name}" wilt verwijderen?`} />
    </div>
  );
}

