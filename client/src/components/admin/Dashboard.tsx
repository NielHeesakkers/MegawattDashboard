import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchTeams, fetchExecutives, createTeam, Team, Executive } from '../../api';
import Modal from '../ui/Modal';

export default function Dashboard() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [newTeam, setNewTeam] = useState<Partial<Team>>({ name: '', color: '#c9a84c', executiveId: null });
  const [saving, setSaving] = useState(false);

  const load = () => {
    Promise.all([fetchTeams(), fetchExecutives()]).then(([t, e]) => {
      setTeams(t);
      setExecutives(e);
    });
  };
  useEffect(() => { load(); }, []);

  const handleCreateTeam = async () => {
    if (!newTeam.name || saving) return;
    setSaving(true);
    try {
      const created = await createTeam({ ...newTeam, order: teams.length });
      setShowNewTeam(false);
      setNewTeam({ name: '', color: '#c9a84c', executiveId: null });
      load();
      navigate(`/admin/members?team=${created.id}`);
    } catch (err) {
      console.error('Failed to create team:', err);
    } finally {
      setSaving(false);
    }
  };

  const totalMembers = teams.reduce((sum, t) => sum + t.members.length, 0);
  const totalVacancies = teams.reduce((sum, t) => sum + t.members.filter((m) => m.isVacancy).length, 0);

  return (
    <div>
      <h1 className="text-[28px] font-bold text-accent mb-6">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Teams', value: teams.length, cls: '' },
          { label: 'Medewerkers', value: totalMembers, cls: '' },
          { label: 'Directieleden', value: executives.length, cls: '' },
          { label: 'Vacatures', value: totalVacancies, cls: 'text-danger' },
        ].map((s) => (
          <div key={s.label} className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-[8px] p-4" style={{ animation: 'slideUp 0.3s ease-out' }}>
            <p className="text-[rgba(255,255,255,0.4)] text-[11px] uppercase tracking-[0.8px]">{s.label}</p>
            <p className={`text-[20px] font-semibold ${s.cls || 'text-white'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Teams overview */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-primary">Teams overzicht</h2>
        <button
          onClick={() => setShowNewTeam(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-accent text-bg-dark font-semibold text-sm hover:brightness-110 transition-all duration-150 shadow-[0_2px_8px_rgba(201,168,76,0.3)] cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Team toevoegen
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => (
          <Link key={team.id} to={`/admin/members?team=${team.id}`} className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] p-4 rounded-[10px] border-l-4 border-l-accent-teal hover:border-[rgba(255,255,255,0.25)] hover:bg-[rgba(255,255,255,0.06)] transition-all duration-150 block" style={{ animation: 'slideUp 0.3s ease-out' }}>
            <h3 className="font-semibold text-accent text-[14px] mb-1">{team.name}</h3>
            <p className="text-text-secondary text-[13px]">
              {team.members.filter((m) => !m.isVacancy).length} leden
              {team.members.some((m) => m.isVacancy) && (
                <span className="text-danger ml-1">
                  ({team.members.filter((m) => m.isVacancy).length} vacature{team.members.filter((m) => m.isVacancy).length !== 1 ? 's' : ''})
                </span>
              )}
            </p>
            {team.executive && (
              <p className="text-accent-gold text-[11px] mt-1">{team.executive.name}</p>
            )}
          </Link>
        ))}
      </div>

      {/* New team modal */}
      <Modal
        isOpen={showNewTeam}
        onClose={() => setShowNewTeam(false)}
        title="Nieuw team"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-text-secondary text-sm mb-1">Naam</label>
            <input
              type="text"
              value={newTeam.name || ''}
              onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-white/10 text-white focus:outline-none focus:border-accent-gold"
            />
          </div>
          <div>
            <label className="block text-text-secondary text-sm mb-1">Verantwoordelijke</label>
            <select
              value={newTeam.executiveId ?? ''}
              onChange={(e) => setNewTeam({ ...newTeam, executiveId: e.target.value ? Number(e.target.value) : null })}
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
              onClick={() => setShowNewTeam(false)}
              className="px-4 py-2 rounded-lg bg-white/10 text-text-primary hover:bg-white/20 transition-colors"
            >
              Annuleren
            </button>
            <button onClick={handleCreateTeam} disabled={saving} className="px-5 py-2 rounded-lg bg-accent text-bg-dark font-semibold hover:brightness-110 transition-all shadow-[0_2px_8px_rgba(201,168,76,0.3)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2">
              {saving && (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {saving ? 'Aanmaken...' : 'Aanmaken'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
