import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchTeams, fetchExecutives, createTeam, exportBackup, importBackup, clearAllData, Team, Executive } from '../../api';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';

export default function Dashboard() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [newTeam, setNewTeam] = useState<Partial<Team>>({ name: '', color: '#c9a84c', executiveId: null });
  const [saving, setSaving] = useState(false);

  // Backup state
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleExport = async () => {
    setExporting(true);
    setStatusMessage(null);
    try {
      await exportBackup();
      setStatusMessage({ type: 'success', text: 'Backup succesvol gedownload' });
    } catch {
      setStatusMessage({ type: 'error', text: 'Export mislukt' });
    } finally {
      setExporting(false);
    }
  };

  const handleImportSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingImportFile(file);
    setShowImportConfirm(true);
    e.target.value = '';
  };

  const handleImportConfirm = async () => {
    if (!pendingImportFile) return;
    setShowImportConfirm(false);
    setImporting(true);
    setStatusMessage(null);
    try {
      const result = await importBackup(pendingImportFile);
      setStatusMessage({
        type: 'success',
        text: `Import succesvol: ${result.imported.teams} teams, ${result.imported.members} medewerkers, ${result.imported.executives} directieleden`,
      });
      load();
    } catch {
      setStatusMessage({ type: 'error', text: 'Import mislukt. Controleer of het ZIP-bestand geldig is.' });
    } finally {
      setImporting(false);
      setPendingImportFile(null);
    }
  };

  const handleClear = async () => {
    setShowClearConfirm(false);
    setClearing(true);
    setStatusMessage(null);
    try {
      const result = await clearAllData();
      setStatusMessage({
        type: 'success',
        text: `Verwijderd: ${result.deleted.teams} teams, ${result.deleted.members} medewerkers, ${result.deleted.executives} directieleden`,
      });
      load();
    } catch {
      setStatusMessage({ type: 'error', text: 'Wissen mislukt' });
    } finally {
      setClearing(false);
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

      {/* Data Management */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Gegevensbeheer</h2>

        {statusMessage && (
          <div className={`mb-4 px-4 py-3 rounded-[8px] text-sm ${
            statusMessage.type === 'success'
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            {statusMessage.text}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] text-text-primary text-sm hover:bg-[rgba(255,255,255,0.1)] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {exporting ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            )}
            {exporting ? 'Exporteren...' : 'Exporteren'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleImportSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] text-text-primary text-sm hover:bg-[rgba(255,255,255,0.1)] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {importing ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            )}
            {importing ? 'Importeren...' : 'Importeren'}
          </button>

          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={clearing}
            className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-red-500/10 border border-red-500/20 text-red-400 text-sm hover:bg-red-500/20 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {clearing ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            )}
            {clearing ? 'Wissen...' : 'Alles wissen'}
          </button>
        </div>
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

      {/* Clear confirmation */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClear}
        title="Alle gegevens wissen"
        message="Weet je zeker dat je alle teams, medewerkers, directieleden en foto's wilt verwijderen? Admin gebruikers en audit logs blijven behouden."
        confirmLabel="Alles wissen"
      />

      {/* Import confirmation */}
      <ConfirmDialog
        isOpen={showImportConfirm}
        onClose={() => { setShowImportConfirm(false); setPendingImportFile(null); }}
        onConfirm={handleImportConfirm}
        title="Backup importeren"
        message={`Weet je zeker dat je "${pendingImportFile?.name}" wilt importeren? Dit vervangt alle huidige teams, medewerkers, directieleden en foto's.`}
        confirmLabel="Importeren"
      />
    </div>
  );
}
