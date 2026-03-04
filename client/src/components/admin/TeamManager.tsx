import { useState, useEffect } from 'react';
import { fetchTeams, fetchExecutives, createTeam, updateTeam, deleteTeam, reorderTeams, Team, Executive } from '../../api';
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
import ConfirmDialog from '../ui/ConfirmDialog';
import Modal from '../ui/Modal';

function SortableTeamRow({ team, onEdit, onDelete }: { team: Team; onEdit: (t: Team) => void; onDelete: (t: Team) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: team.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} onClick={() => onEdit(team)} className="flex items-center gap-3 bg-bg-card p-3 rounded-lg mb-2 hover:bg-white/5 cursor-pointer">
      <button {...attributes} {...listeners} onClick={(e) => e.stopPropagation()} className="cursor-grab text-text-secondary hover:text-white">
        ⠿
      </button>
      <div
        className="w-4 h-4 rounded-full flex-shrink-0"
        style={{ backgroundColor: team.color }}
      />
      <span className="flex-1 text-text-primary font-medium">{team.name}</span>
      {team.executive && (
        <span className="text-accent-gold text-xs bg-accent-gold/10 px-2 py-0.5 rounded-full">{team.executive.name}</span>
      )}
      <span className="text-text-secondary text-sm">{team.members.length} leden</span>
      <button onClick={(e) => { e.stopPropagation(); onDelete(team); }} className="text-red-400 text-sm hover:underline">
        Verwijderen
      </button>
    </div>
  );
}

export default function TeamManager() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [editingTeam, setEditingTeam] = useState<Partial<Team> | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // All executives available as "verantwoordelijke" (CEO + directors)
  const allExecs = executives;

  const load = async () => {
    const [t, e] = await Promise.all([fetchTeams(), fetchExecutives()]);
    setTeams(t);
    setExecutives(e);
  };
  useEffect(() => { load(); }, []);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = teams.findIndex((t) => t.id === active.id);
    const newIndex = teams.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(teams, oldIndex, newIndex);
    setTeams(reordered);

    await reorderTeams(reordered.map((t, i) => ({ id: t.id, order: i })));
  };

  const handleSave = async () => {
    if (!editingTeam?.name || saving) return;
    setSaving(true);
    try {
      if (editingTeam.id) {
        await updateTeam(editingTeam.id, editingTeam);
      } else {
        await createTeam({ ...editingTeam, order: teams.length });
      }
      setEditingTeam(null);
      setIsCreating(false);
      load();
    } catch (err) {
      console.error('Failed to save team:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTeam) return;
    await deleteTeam(deletingTeam.id);
    setDeletingTeam(null);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Teams</h1>
        <button
          onClick={() => { setEditingTeam({ name: '', color: '#c9a84c', executiveId: null }); setIsCreating(true); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-[8px] bg-accent text-bg-dark font-semibold text-sm hover:brightness-110 transition-all duration-150 shadow-[0_2px_8px_rgba(201,168,76,0.3)] cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Team toevoegen
        </button>
      </div>

      <p className="text-text-secondary text-sm mb-4">Versleep om de volgorde aan te passen</p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={teams.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {teams.map((team) => (
            <SortableTeamRow
              key={team.id}
              team={team}
              onEdit={(t) => { setEditingTeam(t); setIsCreating(false); }}
              onDelete={setDeletingTeam}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Edit / Create modal */}
      <Modal
        isOpen={!!editingTeam}
        onClose={() => { setEditingTeam(null); setIsCreating(false); }}
        title={isCreating ? 'Nieuw team' : 'Team bewerken'}
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-text-secondary text-sm mb-1">Kleur</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={editingTeam.color || '#c9a84c'}
                    onChange={(e) => setEditingTeam({ ...editingTeam, color: e.target.value })}
                    className="w-10 h-10 rounded border-0 cursor-pointer"
                  />
                  <span className="text-text-secondary text-sm">{editingTeam.color}</span>
                </div>
              </div>
              <div>
                <label className="block text-text-secondary text-sm mb-1">Verantwoordelijke</label>
                <select
                  value={editingTeam.executiveId ?? ''}
                  onChange={(e) => setEditingTeam({ ...editingTeam, executiveId: e.target.value ? Number(e.target.value) : null })}
                  className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-gold"
                >
                  <option value="">Geen</option>
                  {allExecs.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setEditingTeam(null); setIsCreating(false); }}
                className="px-4 py-2 rounded-lg bg-white/10 text-text-primary"
              >
                Annuleren
              </button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg bg-accent text-bg-dark font-semibold hover:brightness-110 transition-all shadow-[0_2px_8px_rgba(201,168,76,0.3)] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:brightness-100 flex items-center gap-2">
                {saving && (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {saving ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deletingTeam}
        onClose={() => setDeletingTeam(null)}
        onConfirm={handleDelete}
        title="Team verwijderen"
        message={`Weet je zeker dat je "${deletingTeam?.name}" wilt verwijderen? Alle leden worden ook verwijderd.`}
      />
    </div>
  );
}
