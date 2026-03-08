import { useState, useEffect } from 'react';
import {
  fetchClientTeams, fetchMembers, fetchExecutives,
  createClientTeam, updateClientTeam, deleteClientTeam, reorderClientTeams,
  createClientTeamMember, updateClientTeamMember, deleteClientTeamMember,
  createClient, updateClient, deleteClient, reorderClients,
  ClientTeam, Member, Executive, Client as ClientType, ClientTeamMemberWithMember,
} from '../../api';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';

function SortableClientRow({ client, onEdit, onDelete }: { client: ClientType; onEdit: (c: ClientType) => void; onDelete: (c: ClientType) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: client.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} onClick={() => onEdit(client)} className="flex items-center gap-3 bg-bg-card p-2.5 rounded-lg mb-1.5 hover:bg-white/5 cursor-pointer transition-colors">
      <button {...attributes} {...listeners} onClick={(e) => e.stopPropagation()} className="cursor-grab text-text-secondary hover:text-white text-sm">⠿</button>
      <span className="flex-1 text-text-primary text-sm">{client.name}</span>
      {client.url && <span className="text-text-muted text-xs truncate max-w-[200px]">{client.url}</span>}
      <button onClick={(e) => { e.stopPropagation(); onDelete(client); }} className="text-red-400 text-xs hover:underline">Verwijderen</button>
    </div>
  );
}

function SortableTeamRow({ team, isSelected, onClick }: { team: ClientTeam; isSelected: boolean; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: team.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={`flex items-center gap-2 p-3 rounded-lg mb-2 cursor-pointer transition-all ${
        isSelected
          ? 'bg-accent-teal/20 border border-accent-teal/40'
          : 'bg-bg-card hover:bg-white/5 border border-transparent'
      }`}
    >
      <button {...attributes} {...listeners} onClick={(e) => e.stopPropagation()} className="cursor-grab text-text-secondary hover:text-white">⠿</button>
      <div className="flex-1 min-w-0">
        <p className="text-text-primary font-medium text-sm truncate">{team.name}</p>
        <p className="text-text-muted text-xs">{team.members.length} leden · {team.clients.length} klanten</p>
      </div>
    </div>
  );
}

export default function ClientTeamManager() {
  const [clientTeams, setClientTeams] = useState<ClientTeam[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  // Team form
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<{ id?: number; name: string; executiveId: number | null }>({ name: '', executiveId: null });
  const [deletingTeam, setDeletingTeam] = useState<ClientTeam | null>(null);

  // Member assignment
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [memberForm, setMemberForm] = useState({ personId: '', personType: '' as 'member' | 'executive' | '', role: 'PM' });
  const [memberSearch, setMemberSearch] = useState('');
  const [editingMember, setEditingMember] = useState<ClientTeamMemberWithMember | null>(null);
  const [editMemberRole, setEditMemberRole] = useState('PM');
  const [deletingAssignment, setDeletingAssignment] = useState<number | null>(null);

  // Client form
  const [showClientForm, setShowClientForm] = useState(false);
  const [clientForm, setClientForm] = useState<{ id?: number; name: string; url: string }>({ name: '', url: '' });
  const [deletingClient, setDeletingClient] = useState<ClientType | null>(null);

  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [ct, m, e] = await Promise.all([fetchClientTeams(), fetchMembers(), fetchExecutives()]);
    setClientTeams(ct);
    setMembers(m);
    setExecutives(e);
  };
  useEffect(() => { load(); }, []);

  const selectedTeam = clientTeams.find((t) => t.id === selectedTeamId) || null;

  // Already assigned IDs in the selected team
  const assignedMemberIds = new Set(selectedTeam?.members.filter((m) => m.memberId).map((m) => m.memberId!) || []);
  const assignedExecIds = new Set(selectedTeam?.members.filter((m) => m.executiveId).map((m) => m.executiveId!) || []);

  // Combined list of available people (members + executives), sorted alphabetically
  const availablePeople: { id: number; name: string; role: string; photo: string | null; type: 'member' | 'executive' }[] = [
    ...members.filter((m) => !m.isVacancy && !assignedMemberIds.has(m.id)).map((m) => ({ id: m.id, name: m.name, role: m.role, photo: m.photo, type: 'member' as const })),
    ...executives.filter((e) => !assignedExecIds.has(e.id)).map((e) => ({ id: e.id, name: e.name, role: e.role, photo: e.photo, type: 'executive' as const })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Team CRUD
  const openCreateTeam = () => {
    setEditingTeam({ name: '', executiveId: null });
    setShowTeamForm(true);
  };
  const openEditTeam = (t: ClientTeam) => {
    setEditingTeam({ id: t.id, name: t.name, executiveId: t.executiveId });
    setShowTeamForm(true);
  };
  const handleTeamSave = async () => {
    if (!editingTeam.name || saving) return;
    setSaving(true);
    try {
      if (editingTeam.id) {
        await updateClientTeam(editingTeam.id, editingTeam);
      } else {
        const newTeam = await createClientTeam({ ...editingTeam, order: clientTeams.length });
        setSelectedTeamId(newTeam.id);
      }
      setShowTeamForm(false);
      load();
    } finally { setSaving(false); }
  };
  const handleTeamDelete = async () => {
    if (!deletingTeam) return;
    await deleteClientTeam(deletingTeam.id);
    if (selectedTeamId === deletingTeam.id) setSelectedTeamId(null);
    setDeletingTeam(null);
    load();
  };

  // Member assignment
  const handleAssignMember = async () => {
    if (!memberForm.personId || !memberForm.personType || !selectedTeamId || saving) return;
    setSaving(true);
    try {
      const order = (selectedTeam?.members.length || 0);
      await createClientTeamMember({
        clientTeamId: selectedTeamId,
        ...(memberForm.personType === 'member' ? { memberId: Number(memberForm.personId) } : { executiveId: Number(memberForm.personId) }),
        role: memberForm.role,
        order,
      });
      setShowMemberForm(false);
      setMemberForm({ personId: '', personType: '', role: 'PM' });
      setMemberSearch('');
      load();
    } catch (err: any) {
      if (err.response?.status === 409) {
        alert(err.response.data.error);
      }
    } finally { setSaving(false); }
  };
  const openEditMember = (ctm: ClientTeamMember) => {
    setEditingMember(ctm);
    setEditMemberRole(ctm.role);
  };
  const handleMemberRoleSave = async () => {
    if (!editingMember || saving) return;
    setSaving(true);
    try {
      await updateClientTeamMember(editingMember.id, { role: editMemberRole });
      setEditingMember(null);
      load();
    } finally { setSaving(false); }
  };
  const handleRemoveAssignment = async () => {
    if (!deletingAssignment) return;
    await deleteClientTeamMember(deletingAssignment);
    setDeletingAssignment(null);
    load();
  };

  // Client CRUD
  const openCreateClient = () => {
    setClientForm({ name: '', url: '' });
    setShowClientForm(true);
  };
  const openEditClient = (c: ClientType) => {
    setClientForm({ id: c.id, name: c.name, url: c.url || '' });
    setShowClientForm(true);
  };
  const handleClientSave = async () => {
    if (!clientForm.name || !selectedTeamId || saving) return;
    setSaving(true);
    try {
      if (clientForm.id) {
        await updateClient(clientForm.id, { name: clientForm.name, url: clientForm.url || null });
      } else {
        await createClient({ name: clientForm.name, url: clientForm.url || null, clientTeamId: selectedTeamId, order: selectedTeam?.clients.length || 0 });
      }
      setShowClientForm(false);
      load();
    } finally { setSaving(false); }
  };
  const handleClientDelete = async () => {
    if (!deletingClient) return;
    await deleteClient(deletingClient.id);
    setDeletingClient(null);
    load();
  };

  // Client drag reorder
  const handleClientDragEnd = async (event: DragEndEvent) => {
    if (!selectedTeam) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const clients = selectedTeam.clients;
    const oldIndex = clients.findIndex((c) => c.id === active.id);
    const newIndex = clients.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(clients, oldIndex, newIndex);
    // Optimistic update
    setClientTeams((prev) =>
      prev.map((t) => t.id === selectedTeamId ? { ...t, clients: reordered.map((c, i) => ({ ...c, order: i })) } : t)
    );
    await reorderClients(reordered.map((c, i) => ({ id: c.id, order: i })));
  };

  // Team drag reorder
  const handleTeamDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = clientTeams.findIndex((t) => t.id === active.id);
    const newIndex = clientTeams.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(clientTeams, oldIndex, newIndex);
    setClientTeams(reordered.map((t, i) => ({ ...t, order: i })));
    await reorderClientTeams(reordered.map((t, i) => ({ id: t.id, order: i })));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Klantteams</h1>
        <button onClick={openCreateTeam} className="flex items-center gap-2 px-5 py-2.5 rounded-[8px] bg-accent text-bg-dark font-semibold text-sm hover:brightness-110 transition-all duration-150 shadow-[0_2px_8px_rgba(201,168,76,0.3)] cursor-pointer">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Klantteam toevoegen
        </button>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-6">
        {/* Team list */}
        <div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTeamDragEnd}>
            <SortableContext items={clientTeams.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {clientTeams.map((team) => (
                <SortableTeamRow
                  key={team.id}
                  team={team}
                  isSelected={selectedTeamId === team.id}
                  onClick={() => setSelectedTeamId(team.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
          {clientTeams.length === 0 && (
            <p className="text-text-muted text-sm">Nog geen klantteams aangemaakt.</p>
          )}
        </div>

        {/* Team detail */}
        {selectedTeam ? (
          <div>
            {/* Team header */}
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-lg font-semibold text-text-primary">{selectedTeam.name}</h2>
              {selectedTeam.executive && (
                <span className="text-xs bg-accent-gold/10 text-accent-gold px-2 py-0.5 rounded-full">{selectedTeam.executive.name}</span>
              )}
              <div className="ml-auto flex gap-2">
                <button onClick={() => openEditTeam(selectedTeam)} className="text-accent-teal text-sm hover:underline">Bewerken</button>
                <button onClick={() => setDeletingTeam(selectedTeam)} className="text-red-400 text-sm hover:underline">Verwijderen</button>
              </div>
            </div>

            {/* Members */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Teamleden</h3>
                <button onClick={() => setShowMemberForm(true)} className="text-accent-teal text-xs hover:underline">+ Lid toevoegen</button>
              </div>

              {/* CL's then PM's */}
              {['CL', 'PM'].map((roleFilter) =>
                selectedTeam.members.filter((m) => m.role === roleFilter).map((ctm) => {
                  const person = ctm.member || ctm.executive;
                  if (!person) return null;
                  return (
                    <div key={ctm.id} onClick={() => openEditMember(ctm)} className="flex items-center gap-3 bg-bg-card p-3 rounded-lg mb-2 cursor-pointer hover:bg-white/5 transition-colors">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-bg-dark shrink-0">
                        {person.photo ? (
                          <img src={person.photo} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-vacancy">
                            <svg className="w-4 h-4 text-text-secondary" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                          </div>
                        )}
                      </div>
                      <span className="flex-1 text-text-primary font-medium">{person.name}</span>
                      {ctm.executiveId && <span className="text-xs bg-white/10 text-text-muted px-2 py-0.5 rounded-full">Directie</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${roleFilter === 'CL' ? 'bg-accent-gold/20 text-accent-gold' : 'bg-accent-teal/20 text-accent-teal'}`}>{roleFilter}</span>
                      <button onClick={(e) => { e.stopPropagation(); setDeletingAssignment(ctm.id); }} className="text-red-400 text-xs hover:underline">Verwijderen</button>
                    </div>
                  );
                })
              )}

              {selectedTeam.members.length === 0 && (
                <p className="text-text-muted text-sm">Nog geen teamleden toegewezen.</p>
              )}
            </div>

            {/* Clients */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Klanten</h3>
                <button onClick={openCreateClient} className="text-accent-teal text-xs hover:underline">+ Klant toevoegen</button>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleClientDragEnd}>
                <SortableContext items={(selectedTeam.clients || []).map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  {(selectedTeam.clients || []).map((client) => (
                    <SortableClientRow
                      key={client.id}
                      client={client}
                      onEdit={openEditClient}
                      onDelete={setDeletingClient}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              {(!selectedTeam.clients || selectedTeam.clients.length === 0) && (
                <p className="text-text-muted text-sm">Nog geen klanten toegevoegd.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center text-text-muted text-sm h-40">
            Selecteer een klantteam om details te bekijken
          </div>
        )}
      </div>

      {/* Team create/edit modal */}
      <Modal isOpen={showTeamForm} onClose={() => setShowTeamForm(false)} title={editingTeam.id ? 'Klantteam bewerken' : 'Klantteam toevoegen'}>
        <div className="space-y-4">
          <div>
            <label className="block text-text-secondary text-sm mb-1">Naam</label>
            <input
              type="text" value={editingTeam.name} onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-gold"
              required
            />
          </div>
          <div>
            <label className="block text-text-secondary text-sm mb-1">Verantwoordelijke</label>
            <select
              value={editingTeam.executiveId ?? ''} onChange={(e) => setEditingTeam({ ...editingTeam, executiveId: e.target.value ? Number(e.target.value) : null })}
              className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-gold"
            >
              <option value="">Geen</option>
              {executives.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowTeamForm(false)} className="px-4 py-2 rounded-lg bg-white/10 text-text-primary hover:bg-white/20 transition-colors">Annuleren</button>
            <button onClick={handleTeamSave} disabled={saving} className="px-5 py-2 rounded-lg bg-accent text-bg-dark font-semibold hover:brightness-110 transition-all shadow-[0_2px_8px_rgba(201,168,76,0.3)] disabled:opacity-60">
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Assign member modal */}
      <Modal isOpen={showMemberForm} onClose={() => { setShowMemberForm(false); setMemberSearch(''); }} title="Teamlid toewijzen">
        <div className="space-y-4">
          <div>
            <label className="block text-text-secondary text-sm mb-1">Medewerker</label>
            <input
              type="text"
              value={memberSearch}
              onChange={(e) => { setMemberSearch(e.target.value); setMemberForm({ ...memberForm, personId: '', personType: '' }); }}
              placeholder="Zoek op naam..."
              className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-gold"
              autoFocus
            />
            {memberSearch.length > 0 && !memberForm.personId && (
              <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-bg-dark">
                {availablePeople
                  .filter((p) => {
                    const q = memberSearch.toLowerCase();
                    return p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q);
                  })
                  .map((p) => (
                    <button
                      key={`${p.type}-${p.id}`}
                      onClick={() => { setMemberForm({ ...memberForm, personId: String(p.id), personType: p.type }); setMemberSearch(p.name); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/10 transition-colors"
                    >
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-bg-dark shrink-0">
                        {p.photo ? (
                          <img src={p.photo} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-vacancy">
                            <svg className="w-3 h-3 text-text-secondary" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                          </div>
                        )}
                      </div>
                      <span className="text-text-primary text-sm">{p.name}</span>
                      {p.type === 'executive' && <span className="text-xs bg-white/10 text-text-muted px-1.5 py-0.5 rounded">Directie</span>}
                      <span className="text-text-muted text-xs ml-auto">{p.role}</span>
                    </button>
                  ))}
                {availablePeople.filter((p) => {
                  const q = memberSearch.toLowerCase();
                  return p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q);
                }).length === 0 && (
                  <p className="px-3 py-2 text-text-muted text-sm">Geen resultaten</p>
                )}
              </div>
            )}
            {memberForm.personId && (
              <p className="mt-1 text-accent-teal text-xs">Geselecteerd: {memberSearch}</p>
            )}
          </div>
          <div>
            <label className="block text-text-secondary text-sm mb-1">Rol</label>
            <select
              value={memberForm.role} onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-gold"
            >
              <option value="PM">Project Manager (PM)</option>
              <option value="CL">Client Lead (CL)</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowMemberForm(false); setMemberSearch(''); }} className="px-4 py-2 rounded-lg bg-white/10 text-text-primary hover:bg-white/20 transition-colors">Annuleren</button>
            <button onClick={handleAssignMember} disabled={saving || !memberForm.personId} className="px-5 py-2 rounded-lg bg-accent text-bg-dark font-semibold hover:brightness-110 transition-all shadow-[0_2px_8px_rgba(201,168,76,0.3)] disabled:opacity-60">
              {saving ? 'Toewijzen...' : 'Toewijzen'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Client create/edit modal */}
      <Modal isOpen={showClientForm} onClose={() => setShowClientForm(false)} title={clientForm.id ? 'Klant bewerken' : 'Klant toevoegen'}>
        <div className="space-y-4">
          <div>
            <label className="block text-text-secondary text-sm mb-1">Naam</label>
            <input
              type="text" value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-gold"
              required
            />
          </div>
          <div>
            <label className="block text-text-secondary text-sm mb-1">Website (optioneel)</label>
            <input
              type="url" value={clientForm.url} onChange={(e) => setClientForm({ ...clientForm, url: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-gold"
              placeholder="https://"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowClientForm(false)} className="px-4 py-2 rounded-lg bg-white/10 text-text-primary hover:bg-white/20 transition-colors">Annuleren</button>
            <button onClick={handleClientSave} disabled={saving || !clientForm.name} className="px-5 py-2 rounded-lg bg-accent text-bg-dark font-semibold hover:brightness-110 transition-all shadow-[0_2px_8px_rgba(201,168,76,0.3)] disabled:opacity-60">
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit member role modal */}
      <Modal isOpen={!!editingMember} onClose={() => setEditingMember(null)} title="Teamlid bewerken">
        {editingMember && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-bg-card p-3 rounded-lg">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-bg-dark shrink-0">
                {(editingMember.member || editingMember.executive)?.photo ? (
                  <img src={(editingMember.member || editingMember.executive)!.photo!} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-vacancy">
                    <svg className="w-4 h-4 text-text-secondary" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                  </div>
                )}
              </div>
              <span className="text-text-primary font-medium">{(editingMember.member || editingMember.executive)?.name}</span>
              {editingMember.executiveId && <span className="text-xs bg-white/10 text-text-muted px-2 py-0.5 rounded">Directie</span>}
            </div>
            <div>
              <label className="block text-text-secondary text-sm mb-1">Rol</label>
              <select
                value={editMemberRole} onChange={(e) => setEditMemberRole(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-gold"
              >
                <option value="PM">Project Manager (PM)</option>
                <option value="CL">Client Lead (CL)</option>
              </select>
            </div>
            <div className="flex justify-between pt-2">
              <button onClick={() => { setDeletingAssignment(editingMember.id); setEditingMember(null); }} className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm hover:bg-red-500/20 transition-colors">Verwijderen</button>
              <div className="flex gap-3">
                <button onClick={() => setEditingMember(null)} className="px-4 py-2 rounded-lg bg-white/10 text-text-primary hover:bg-white/20 transition-colors">Annuleren</button>
                <button onClick={handleMemberRoleSave} disabled={saving} className="px-5 py-2 rounded-lg bg-accent text-bg-dark font-semibold hover:brightness-110 transition-all shadow-[0_2px_8px_rgba(201,168,76,0.3)] disabled:opacity-60">
                  {saving ? 'Opslaan...' : 'Opslaan'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmations */}
      <ConfirmDialog isOpen={!!deletingTeam} onClose={() => setDeletingTeam(null)} onConfirm={handleTeamDelete}
        title="Klantteam verwijderen" message={`Weet je zeker dat je "${deletingTeam?.name}" wilt verwijderen? Alle toewijzingen en klanten worden ook verwijderd.`} />
      <ConfirmDialog isOpen={!!deletingAssignment} onClose={() => setDeletingAssignment(null)} onConfirm={handleRemoveAssignment}
        title="Toewijzing verwijderen" message="Weet je zeker dat je dit teamlid wilt verwijderen uit het klantteam?" />
      <ConfirmDialog isOpen={!!deletingClient} onClose={() => setDeletingClient(null)} onConfirm={handleClientDelete}
        title="Klant verwijderen" message={`Weet je zeker dat je "${deletingClient?.name}" wilt verwijderen?`} />
    </div>
  );
}
