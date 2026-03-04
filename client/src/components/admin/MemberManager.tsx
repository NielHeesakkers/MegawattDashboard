import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetchTeams, fetchMembers, fetchExecutives, createMember, updateMember, deleteMember, reorderMembers, updateTeam, deleteTeam, Team, Member, Executive } from '../../api';
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
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';

interface MemberFormData {
  name: string;
  role: string;
  email: string;
  teamId: string;
  isVacancy: boolean;
  isTeamLead: boolean;
  subGroup: string;
}

const emptyForm: MemberFormData = {
  name: '', role: '', email: '', teamId: '', isVacancy: false, isTeamLead: false, subGroup: '',
};

function SortableMemberRow({ member, onEdit, onDelete }: { member: Member; onEdit: (m: Member) => void; onDelete: (m: Member) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: member.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} onClick={() => onEdit(member)} className="flex items-center gap-3 bg-bg-card p-3 rounded-lg mb-2 hover:bg-white/5 cursor-pointer">
      <button {...attributes} {...listeners} onClick={(e) => e.stopPropagation()} className="cursor-grab text-text-secondary hover:text-white">
        ⠿
      </button>
      <div className="w-8 h-8 rounded-full overflow-hidden bg-bg-dark shrink-0">
        {member.photo ? (
          <img src={member.photo} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-vacancy">
            <svg className="w-4 h-4 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
        )}
      </div>
      <span className={`flex-1 text-text-primary font-medium ${member.isVacancy ? 'italic text-text-secondary' : ''}`}>
        {member.isVacancy ? 'Vacature' : member.name}
      </span>
      <span className="text-text-secondary text-sm hidden sm:inline">{member.role}</span>
      <span className="text-text-secondary text-sm hidden md:inline">{member.team?.name}</span>
      {member.isTeamLead && <span className="text-xs bg-accent-gold/20 text-accent-gold px-2 py-0.5 rounded-full">Lead</span>}
      {member.isVacancy && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Vacature</span>}
      <button onClick={(e) => { e.stopPropagation(); onDelete(member); }} className="text-red-400 text-sm hover:underline">
        Verwijderen
      </button>
    </div>
  );
}

export default function MemberManager() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [form, setForm] = useState<MemberFormData>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [filterTeam, setFilterTeam] = useState<string>(searchParams.get('team') || 'all');
  const [customSubGroup, setCustomSubGroup] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Team editing state
  const [editingTeam, setEditingTeam] = useState<Partial<Team> | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);
  const [savingTeam, setSavingTeam] = useState(false);

  const load = async () => {
    const [m, t, e] = await Promise.all([fetchMembers(), fetchTeams(), fetchExecutives()]);
    setMembers(m);
    setTeams(t);
    setExecutives(e);
  };
  useEffect(() => { load(); }, []);

  // Collect existing subGroups filtered by the currently selected team in the form
  const existingSubGroups = useMemo(() => {
    const groups = new Set<string>();
    members.forEach((m) => {
      if (m.subGroup && (!form.teamId || String(m.teamId) === form.teamId)) {
        groups.add(m.subGroup);
      }
    });
    return Array.from(groups).sort();
  }, [members, form.teamId]);

  const openCreate = () => {
    setForm({
      ...emptyForm,
      // Pre-select the currently filtered team
      teamId: filterTeam !== 'all' ? filterTeam : '',
    });
    setEditingId(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setCustomSubGroup(false);
    setShowForm(true);
  };

  const openEdit = (m: Member) => {
    const isExisting = existingSubGroups.includes(m.subGroup || '');
    setForm({
      name: m.name,
      role: m.role,
      email: m.email || '',
      teamId: String(m.teamId),
      isVacancy: m.isVacancy,
      isTeamLead: m.isTeamLead,
      subGroup: m.subGroup || '',
    });
    setEditingId(m.id);
    setPhotoFile(null);
    setPhotoPreview(m.photo || null);
    setCustomSubGroup(!!m.subGroup && !isExisting);
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
      fd.append('teamId', form.teamId);
      fd.append('isVacancy', String(form.isVacancy));
      fd.append('isTeamLead', String(form.isTeamLead));
      fd.append('subGroup', form.subGroup);
      if (photoFile) fd.append('photo', photoFile);

      if (editingId) {
        await updateMember(editingId, fd);
      } else {
        await createMember(fd);
      }
      setShowForm(false);
      load();
    } catch (err) {
      console.error('Failed to save member:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingMember) return;
    await deleteMember(deletingMember.id);
    setDeletingMember(null);
    load();
  };

  // Team handlers
  const handleTeamSave = async () => {
    if (!editingTeam?.name || savingTeam) return;
    setSavingTeam(true);
    try {
      await updateTeam(editingTeam.id!, editingTeam);
      setEditingTeam(null);
      load();
    } catch (err) {
      console.error('Failed to save team:', err);
    } finally {
      setSavingTeam(false);
    }
  };

  const handleTeamDelete = async () => {
    if (!deletingTeam) return;
    await deleteTeam(deletingTeam.id);
    setDeletingTeam(null);
    setFilterTeam('all');
    navigate('/admin/members');
    load();
  };

  const selectedTeam = filterTeam !== 'all' ? teams.find((t) => String(t.id) === filterTeam) : null;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const filtered = filterTeam === 'all' ? members : members.filter((m) => String(m.teamId) === filterTeam);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = filtered.findIndex((m) => m.id === active.id);
    const newIndex = filtered.findIndex((m) => m.id === over.id);
    const reordered = arrayMove(filtered, oldIndex, newIndex);

    // Optimistic update in full members list
    const reorderedIds = new Map(reordered.map((m, i) => [m.id, i]));
    setMembers((prev) =>
      prev.map((m) => (reorderedIds.has(m.id) ? { ...m, order: reorderedIds.get(m.id)! } : m))
        .sort((a, b) => a.teamId - b.teamId || a.order - b.order)
    );

    await reorderMembers(reordered.map((m, i) => ({ id: m.id, order: i })));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Medewerkers</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-5 py-2.5 rounded-[8px] bg-accent text-bg-dark font-semibold text-sm hover:brightness-110 transition-all duration-150 shadow-[0_2px_8px_rgba(201,168,76,0.3)] cursor-pointer">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Teamlid toevoegen
        </button>
      </div>

      {/* Filter */}
      <div className="mb-4">
        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          className="px-3 py-2 rounded-lg bg-bg-card border border-white/10 text-white text-sm"
        >
          <option value="all">Alle teams</option>
          {teams.map((t) => (
            <option key={t.id} value={String(t.id)}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Team info bar — when a specific team is selected, click to edit */}
      {selectedTeam && (
        <div
          onClick={() => setEditingTeam({ id: selectedTeam.id, name: selectedTeam.name, color: selectedTeam.color, executiveId: selectedTeam.executiveId })}
          className="mb-5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-[10px] p-4 hover:bg-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer transition-all duration-150"
        >
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-text-primary">{selectedTeam.name}</h2>
            <div className="flex items-center gap-3 ml-auto">
              {selectedTeam.executive && (
                <span className="text-xs bg-accent-gold/10 text-accent-gold px-2 py-0.5 rounded-full">
                  {selectedTeam.executive.name}
                </span>
              )}
              <span className="text-text-secondary text-sm">{filtered.length} leden</span>
            </div>
          </div>
        </div>
      )}

      {/* Members list */}
      <p className="text-text-secondary text-sm mb-4">Versleep om de volgorde aan te passen</p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={filtered.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          {filtered.map((member) => (
            <SortableMemberRow
              key={member.id}
              member={member}
              onEdit={openEdit}
              onDelete={setDeletingMember}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Team delete — bottom right */}
      {selectedTeam && (
        <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
          <button
            onClick={() => setDeletingTeam(selectedTeam)}
            className="px-3 py-1.5 rounded-[6px] bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] hover:bg-red-500/20 transition-all duration-150 cursor-pointer"
          >
            Team verwijderen
          </button>
        </div>
      )}

      {/* Create/Edit modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? 'Teamlid bewerken' : 'Teamlid toevoegen'}
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
              onClick={() => fileRef.current?.click()}
              className="shrink-0 w-[140px] h-[140px] rounded-full overflow-hidden bg-bg-dark border-2 border-white/10 hover:border-accent-gold cursor-pointer transition-colors group relative"
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
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                </svg>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-text-secondary text-sm mb-1">Team</label>
              <select
                value={form.teamId} onChange={(e) => { setForm({ ...form, teamId: e.target.value, subGroup: '' }); setCustomSubGroup(false); }}
                className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-gold"
                required
              >
                <option value="">Selecteer team</option>
                {teams.map((t) => (
                  <option key={t.id} value={String(t.id)}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-text-secondary text-sm mb-1">Subgroep (optioneel)</label>
              {customSubGroup || existingSubGroups.length === 0 ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.subGroup}
                    onChange={(e) => setForm({ ...form, subGroup: e.target.value })}
                    placeholder="Naam subgroep"
                    className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white placeholder-text-secondary focus:outline-none focus:border-accent-gold"
                  />
                  {existingSubGroups.length > 0 && (
                    <button
                      type="button"
                      onClick={() => { setCustomSubGroup(false); setForm({ ...form, subGroup: '' }); }}
                      className="px-2 text-text-secondary hover:text-white shrink-0"
                      title="Bestaande kiezen"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              ) : (
                <select
                  value={form.subGroup}
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setCustomSubGroup(true);
                      setForm({ ...form, subGroup: '' });
                    } else {
                      setForm({ ...form, subGroup: e.target.value });
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-gold"
                >
                  <option value="">Geen subgroep</option>
                  {existingSubGroups.map((sg) => (
                    <option key={sg} value={sg}>{sg}</option>
                  ))}
                  <option value="__new__">+ Nieuwe subgroep...</option>
                </select>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <input
                type="checkbox" checked={form.isVacancy} onChange={(e) => setForm({ ...form, isVacancy: e.target.checked })}
                id="isVacancy" className="rounded"
              />
              <label htmlFor="isVacancy" className="text-text-secondary text-sm">Vacature</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox" checked={form.isTeamLead} onChange={(e) => setForm({ ...form, isTeamLead: e.target.checked })}
                id="isTeamLead" className="rounded"
              />
              <label htmlFor="isTeamLead" className="text-text-secondary text-sm">Teamlead</label>
            </div>
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

      {/* Delete member confirmation */}
      <ConfirmDialog
        isOpen={!!deletingMember}
        onClose={() => setDeletingMember(null)}
        onConfirm={handleDelete}
        title="Teamlid verwijderen"
        message={`Weet je zeker dat je "${deletingMember?.name}" wilt verwijderen?`}
      />

      {/* Team edit modal */}
      <Modal
        isOpen={!!editingTeam}
        onClose={() => setEditingTeam(null)}
        title="Team bewerken"
      >
        {editingTeam && (
          <div className="space-y-4">
            <div>
              <label className="block text-text-secondary text-sm mb-1">Naam</label>
              <input
                type="text"
                value={editingTeam.name || ''}
                onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-gold"
              />
            </div>
            <div>
              <label className="block text-text-secondary text-sm mb-1">Verantwoordelijke</label>
              <select
                value={editingTeam.executiveId ?? ''}
                onChange={(e) => setEditingTeam({ ...editingTeam, executiveId: e.target.value ? Number(e.target.value) : null })}
                className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-gold"
              >
                <option value="">Geen</option>
                {executives.map((ex) => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setEditingTeam(null)}
                className="px-4 py-2 rounded-lg bg-white/10 text-text-primary hover:bg-white/20 transition-colors"
              >
                Annuleren
              </button>
              <button onClick={handleTeamSave} disabled={savingTeam} className="px-5 py-2 rounded-lg bg-accent text-bg-dark font-semibold hover:brightness-110 transition-all shadow-[0_2px_8px_rgba(201,168,76,0.3)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2">
                {savingTeam && (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {savingTeam ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete team confirmation */}
      <ConfirmDialog
        isOpen={!!deletingTeam}
        onClose={() => setDeletingTeam(null)}
        onConfirm={handleTeamDelete}
        title="Team verwijderen"
        message={`Weet je zeker dat je "${deletingTeam?.name}" wilt verwijderen? Alle leden worden ook verwijderd.`}
      />
    </div>
  );
}
