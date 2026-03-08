import { useState, useEffect } from 'react';
import { fetchTeams, fetchExecutives, fetchAuditLogs, fetchBackupList, fetchEmailSettings, Team, Executive, AuditLogEntry, BackupFile } from '../../api';
import { DashboardSkeleton } from '../ui/Skeleton';

export default function AdminDashboard() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLogEntry[]>([]);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [smtpConfigured, setSmtpConfigured] = useState<boolean | null>(null);
  const [smtpHost, setSmtpHost] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchTeams(),
      fetchExecutives(),
      fetchAuditLogs(1, 5),
      fetchBackupList(),
      fetchEmailSettings(),
    ]).then(([t, e, auditData, b, emailData]) => {
      setTeams(t);
      setExecutives(e);
      setRecentLogs(auditData.logs);
      setBackups(b);
      setSmtpConfigured(emailData.configured);
      setSmtpHost(emailData.smtpHost || '');
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const totalMembers = teams.reduce((sum, t) => sum + t.members.length, 0);
  const totalVacancies = teams.reduce((sum, t) => sum + t.members.filter((m) => m.isVacancy).length, 0);

  const actionColors: Record<string, string> = {
    CREATE: 'bg-green-500/20 text-green-400',
    UPDATE: 'bg-blue-500/20 text-blue-400',
    DELETE: 'bg-red-500/20 text-red-400',
  };

  const lastBackup = backups.length > 0 ? backups[0] : null;

  if (loading) return <DashboardSkeleton />;

  return (
    <div>
      <h1 className="text-[28px] font-bold text-accent mb-6">Dashboard</h1>

      {/* Stats cards */}
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

      {/* Status row: SMTP + Backups */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* SMTP Status */}
        <div className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-[8px] p-4">
          <p className="text-[rgba(255,255,255,0.4)] text-[11px] uppercase tracking-[0.8px] mb-2">SMTP Status</p>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${smtpConfigured === null ? 'bg-gray-400' : smtpConfigured ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-text-primary text-sm">
              {smtpConfigured === null ? 'Laden...' : smtpConfigured ? `Actief (${smtpHost})` : 'Niet geconfigureerd'}
            </span>
          </div>
        </div>

        {/* Backup status */}
        <div className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-[8px] p-4">
          <p className="text-[rgba(255,255,255,0.4)] text-[11px] uppercase tracking-[0.8px] mb-2">Backups</p>
          <div className="flex items-center justify-between">
            <span className="text-text-primary text-sm">
              {backups.length} backup{backups.length !== 1 ? 's' : ''}
            </span>
            {lastBackup && (
              <span className="text-text-secondary text-xs">
                Laatste: {new Date(lastBackup.createdAt).toLocaleDateString('nl-NL')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Laatste activiteit</h2>
        {recentLogs.length === 0 ? (
          <p className="text-text-muted text-sm">Nog geen activiteit geregistreerd.</p>
        ) : (
          <div className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-[8px] overflow-hidden">
            {recentLogs.map((log) => {
              let summary = '';
              try {
                const changes = JSON.parse(log.changes);
                if (changes.name) summary = changes.name;
                else if (changes.action) summary = changes.action;
                else summary = Object.keys(changes).slice(0, 2).join(', ');
              } catch { summary = ''; }

              return (
                <div key={log.id} className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.04)] last:border-b-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${actionColors[log.action] || 'bg-white/10 text-text-secondary'}`}>
                    {log.action}
                  </span>
                  <span className="text-text-primary text-sm flex-1">
                    {log.entity}
                    {summary && <span className="text-text-secondary"> — {summary}</span>}
                  </span>
                  <span className="text-text-muted text-xs">
                    {new Date(log.createdAt).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
