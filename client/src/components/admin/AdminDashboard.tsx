import { useState, useEffect } from 'react';
import { fetchTeams, fetchExecutives, Team, Executive } from '../../api';

export default function AdminDashboard() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [executives, setExecutives] = useState<Executive[]>([]);

  useEffect(() => {
    Promise.all([fetchTeams(), fetchExecutives()]).then(([t, e]) => {
      setTeams(t);
      setExecutives(e);
    });
  }, []);

  const totalMembers = teams.reduce((sum, t) => sum + t.members.length, 0);
  const totalVacancies = teams.reduce((sum, t) => sum + t.members.filter((m) => m.isVacancy).length, 0);

  return (
    <div>
      <h1 className="text-[28px] font-bold text-accent mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
    </div>
  );
}
