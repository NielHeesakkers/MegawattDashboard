import { useState, useRef, useEffect } from 'react';
import {
  exportBackup, importBackup, clearAllData,
  fetchEmailSettings, updateEmailSettings, sendTestEmail,
  fetchBackupList, downloadBackup, deleteBackup, triggerAutoBackup, BackupFile,
  fetchAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser, AdminUser,
  fetchAuditLogs, AuditLogEntry,
} from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui/Toast';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import ConfirmDialog from '../ui/ConfirmDialog';
import Modal from '../ui/Modal';

const inputClass = 'w-full px-3 py-[10px] rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px] outline-none focus:border-accent';

type Tab = 'data' | 'email' | 'users' | 'audit';

const tabs: { key: Tab; label: string }[] = [
  { key: 'data', label: 'Gegevensbeheer' },
  { key: 'email', label: 'E-mail' },
  { key: 'users', label: 'Gebruikers' },
  { key: 'audit', label: 'Audit Log' },
];

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---- Data tab ----
function DataTab() {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Backup list
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [showAllBackups, setShowAllBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);

  const loadBackups = () => {
    fetchBackupList().then(setBackups).catch(() => {});
  };

  useEffect(() => { loadBackups(); }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportBackup();
      toast.success('Backup succesvol gedownload');
    } catch {
      toast.error('Export mislukt');
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
    try {
      const result = await importBackup(pendingImportFile);
      toast.success(`Import succesvol: ${result.imported.teams} teams, ${result.imported.members} medewerkers, ${result.imported.executives} directieleden`);
    } catch {
      toast.error('Import mislukt. Controleer of het ZIP-bestand geldig is.');
    } finally {
      setImporting(false);
      setPendingImportFile(null);
    }
  };

  const handleClear = async () => {
    setShowClearConfirm(false);
    setClearing(true);
    try {
      const result = await clearAllData();
      toast.success(`Verwijderd: ${result.deleted.teams} teams, ${result.deleted.members} medewerkers, ${result.deleted.executives} directieleden`);
    } catch {
      toast.error('Wissen mislukt');
    } finally {
      setClearing(false);
    }
  };

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      const result = await triggerAutoBackup();
      toast.success(`Backup aangemaakt: ${result.filename}`);
      loadBackups();
    } catch {
      toast.error('Backup aanmaken mislukt');
    } finally {
      setCreatingBackup(false);
    }
  };

  const visibleBackups = showAllBackups ? backups : backups.slice(0, 10);

  return (
    <>
      {/* Export / Import / Clear */}
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Export & Import</h3>
      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] text-text-primary text-sm hover:bg-[rgba(255,255,255,0.1)] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {exporting ? (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
          )}
          {exporting ? 'Exporteren...' : 'Exporteren'}
        </button>

        <input ref={fileInputRef} type="file" accept=".zip" onChange={handleImportSelect} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] text-text-primary text-sm hover:bg-[rgba(255,255,255,0.1)] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {importing ? (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
          )}
          {importing ? 'Importeren...' : 'Importeren'}
        </button>

        <button
          onClick={() => setShowClearConfirm(true)}
          disabled={clearing}
          className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-red-500/10 border border-red-500/20 text-red-400 text-sm hover:bg-red-500/20 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {clearing ? (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
          )}
          {clearing ? 'Wissen...' : 'Alles wissen'}
        </button>
      </div>

      {/* Backup list */}
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Backups</h3>
      <div className="mb-3">
        <button
          onClick={handleCreateBackup}
          disabled={creatingBackup}
          className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-accent text-bg-dark text-sm font-semibold hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {creatingBackup ? (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          )}
          {creatingBackup ? 'Aanmaken...' : 'Backup aanmaken'}
        </button>
      </div>

      {backups.length === 0 ? (
        <p className="text-text-muted text-sm">Nog geen backups. Backups worden dagelijks automatisch aangemaakt.</p>
      ) : (
        <div className="bg-bg-card rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-text-secondary text-left">
                <th className="px-4 py-3">Bestand</th>
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3">Grootte</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {visibleBackups.map((b) => (
                <tr key={b.filename} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-2 text-text-primary font-mono text-xs">{b.filename}</td>
                  <td className="px-4 py-2 text-text-secondary">
                    {new Date(b.createdAt).toLocaleString('nl-NL')}
                  </td>
                  <td className="px-4 py-2 text-text-secondary">{formatFileSize(b.size)}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => downloadBackup(b.filename)}
                        className="text-accent hover:text-accent/80 transition-colors cursor-pointer"
                        title="Download"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Backup "${b.filename}" verwijderen?`)) return;
                          await deleteBackup(b.filename);
                          loadBackups();
                        }}
                        className="text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                        title="Verwijderen"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {backups.length > 10 && !showAllBackups && (
            <button
              onClick={() => setShowAllBackups(true)}
              className="w-full py-2 text-center text-accent text-sm hover:bg-white/5 transition-colors cursor-pointer"
            >
              Toon alle {backups.length} backups
            </button>
          )}
          {showAllBackups && backups.length > 10 && (
            <button
              onClick={() => setShowAllBackups(false)}
              className="w-full py-2 text-center text-text-secondary text-sm hover:bg-white/5 transition-colors cursor-pointer"
            >
              Toon minder
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClear}
        title="Alle gegevens wissen"
        message="Weet je zeker dat je alle teams, medewerkers, directieleden en foto's wilt verwijderen? Admin gebruikers en audit logs blijven behouden."
        confirmLabel="Alles wissen"
      />
      <ConfirmDialog
        isOpen={showImportConfirm}
        onClose={() => { setShowImportConfirm(false); setPendingImportFile(null); }}
        onConfirm={handleImportConfirm}
        title="Backup importeren"
        message={`Weet je zeker dat je "${pendingImportFile?.name}" wilt importeren? Dit vervangt alle huidige teams, medewerkers, directieleden en foto's.`}
        confirmLabel="Importeren"
      />
    </>
  );
}

// ---- Email tab ----
function EmailTab() {
  const toast = useToast();
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [savedValues, setSavedValues] = useState({ smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '', fromEmail: '', fromName: '' });

  const isDirty = smtpHost !== savedValues.smtpHost || smtpPort !== savedValues.smtpPort ||
    smtpUser !== savedValues.smtpUser || smtpPass !== savedValues.smtpPass ||
    fromEmail !== savedValues.fromEmail || fromName !== savedValues.fromName;
  useUnsavedChanges(isDirty);

  useEffect(() => {
    fetchEmailSettings().then((data) => {
      setEmailConfigured(data.configured);
      setSmtpHost(data.smtpHost);
      setSmtpPort(data.smtpPort || 587);
      setSmtpUser(data.smtpUser);
      setSmtpPass(data.smtpPass);
      setFromEmail(data.fromEmail);
      setFromName(data.fromName);
      setSavedValues({ smtpHost: data.smtpHost, smtpPort: data.smtpPort || 587, smtpUser: data.smtpUser, smtpPass: data.smtpPass, fromEmail: data.fromEmail, fromName: data.fromName });
    }).catch(() => {});
  }, []);

  const handleSaveEmailSettings = async () => {
    setSavingEmail(true);
    try {
      await updateEmailSettings({ smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, fromName });
      setEmailConfigured(!!(smtpHost && smtpUser && smtpPass && fromEmail));
      setSavedValues({ smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, fromName });
      toast.success('E-mail instellingen opgeslagen');
    } catch {
      toast.error('Opslaan mislukt');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleSendTestEmail = async () => {
    setSendingTest(true);
    try {
      await sendTestEmail(testEmail);
      toast.success(`Test e-mail verzonden naar ${testEmail}`);
      setTestEmail('');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Test e-mail verzenden mislukt';
      toast.error(msg);
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${emailConfigured ? 'bg-green-400' : 'bg-red-400'}`} />
        <span className="text-text-secondary text-sm">
          SMTP: {emailConfigured ? `Geconfigureerd (${smtpHost}:${smtpPort})` : 'Niet geconfigureerd'}
        </span>
      </div>

      <div className="space-y-4 max-w-md">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-text-secondary text-sm mb-1">SMTP host *</label>
            <input type="text" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" className={inputClass} />
          </div>
          <div className="w-24">
            <label className="block text-text-secondary text-sm mb-1">Poort</label>
            <input type="number" value={smtpPort} onChange={(e) => setSmtpPort(Number(e.target.value))} placeholder="587" className={inputClass} />
          </div>
        </div>
        <div>
          <label className="block text-text-secondary text-sm mb-1">Gebruikersnaam *</label>
          <input type="text" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="user@gmail.com" className={inputClass} />
        </div>
        <div>
          <label className="block text-text-secondary text-sm mb-1">Wachtwoord *</label>
          <input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder={emailConfigured ? 'Laat leeg om huidig wachtwoord te behouden' : 'App-wachtwoord of SMTP wachtwoord'} className={inputClass} />
        </div>
        <div className="border-t border-[rgba(255,255,255,0.06)] pt-4">
          <label className="block text-text-secondary text-sm mb-1">Afzender e-mail *</label>
          <input type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="noreply@megawatt.nl" className={inputClass} />
        </div>
        <div>
          <label className="block text-text-secondary text-sm mb-1">Afzender naam</label>
          <input type="text" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Megawatt Dashboard" className={inputClass} />
        </div>
        <button
          onClick={handleSaveEmailSettings}
          disabled={savingEmail || !smtpHost || !smtpUser || !fromEmail}
          className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-accent text-bg-dark text-sm font-semibold hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {savingEmail && (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          )}
          {savingEmail ? 'Opslaan...' : 'Opslaan'}
        </button>
      </div>

      <div className="mt-6 pt-6 border-t border-[rgba(255,255,255,0.06)] max-w-md">
        <h3 className="text-sm font-medium text-text-secondary mb-3">Test e-mail</h3>
        <div className="flex gap-2">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="test@voorbeeld.nl"
            className="flex-1 px-3 py-[10px] rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px] outline-none focus:border-accent"
          />
          <button
            onClick={handleSendTestEmail}
            disabled={sendingTest || !testEmail || !emailConfigured}
            className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] text-text-primary text-sm hover:bg-[rgba(255,255,255,0.1)] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {sendingTest && (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            )}
            {sendingTest ? 'Verzenden...' : 'Test verzenden'}
          </button>
        </div>
      </div>
    </>
  );
}

// ---- Password strength indicator ----
function PasswordStrength({ password }: { password: string }) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const level = score <= 1 ? 'Zwak' : score <= 3 ? 'Matig' : 'Sterk';
  const color = score <= 1 ? 'bg-red-500' : score <= 3 ? 'bg-orange-500' : 'bg-green-500';
  const textColor = score <= 1 ? 'text-red-400' : score <= 3 ? 'text-orange-400' : 'text-green-400';
  const width = `${Math.min((score / 5) * 100, 100)}%`;

  return (
    <div className="mt-2">
      <div className="h-1.5 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-300`} style={{ width }} />
      </div>
      <p className={`text-xs mt-1 ${textColor}`}>{level}</p>
    </div>
  );
}

const AVAILABLE_TABS = [
  { key: 'intern', label: 'Intern' },
  { key: 'planning', label: 'Planning' },
  { key: 'locatie', label: 'Locatie man' },
] as const;

const ALL_TAB_KEYS = AVAILABLE_TABS.map(t => t.key);

// ---- Users tab ----
function UsersTab() {
  const toast = useToast();
  const { username: currentUsername } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [editingUser, setEditingUser] = useState<{ id?: number; username: string; password: string; role: string; allowedTabs: string[] } | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const data = await fetchAdminUsers();
    setUsers(data);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!editingUser?.username || saving) return;
    if (isCreating && !editingUser.password) { setError('Wachtwoord is verplicht'); return; }
    setSaving(true);
    setError('');
    try {
      if (editingUser.id) {
        const data: { username?: string; password?: string; role?: string; allowedTabs?: string[] } = {
          username: editingUser.username,
          role: editingUser.role,
          allowedTabs: editingUser.role === 'admin' ? [...ALL_TAB_KEYS] : editingUser.allowedTabs,
        };
        if (editingUser.password) data.password = editingUser.password;
        await updateAdminUser(editingUser.id, data);
        toast.success('Gebruiker bijgewerkt');
      } else {
        await createAdminUser({
          username: editingUser.username,
          password: editingUser.password,
          role: editingUser.role,
          allowedTabs: editingUser.role === 'admin' ? [...ALL_TAB_KEYS] : editingUser.allowedTabs,
        });
        toast.success('Gebruiker aangemaakt');
      }
      setEditingUser(null);
      setIsCreating(false);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Opslaan mislukt';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    try {
      await deleteAdminUser(deletingUser.id);
      toast.success(`Gebruiker "${deletingUser.username}" verwijderd`);
      setDeletingUser(null);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Verwijderen mislukt';
      toast.error(msg);
      setDeletingUser(null);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => { setEditingUser({ username: '', password: '', role: 'user', allowedTabs: [] }); setIsCreating(true); setError(''); }}
          className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-accent text-bg-dark text-sm font-semibold hover:opacity-85 transition-opacity cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Gebruiker toevoegen
        </button>
      </div>

      {error && !editingUser && (
        <p className="text-danger text-sm mb-4 bg-danger/10 px-4 py-2 rounded-lg">{error}</p>
      )}

      <div className="space-y-2">
        {users.map((user) => (
          <div
            key={user.id}
            onClick={() => { setEditingUser({ id: user.id, username: user.username, password: '', role: user.role, allowedTabs: user.allowedTabs }); setIsCreating(false); setError(''); }}
            className="flex items-center gap-3 bg-bg-card p-3 rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-accent-teal/20 flex items-center justify-center text-accent-teal text-sm font-bold flex-shrink-0">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <span className="flex-1 text-text-primary font-medium">{user.username}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${user.role === 'admin' ? 'bg-accent/20 text-accent' : 'bg-white/10 text-text-secondary'}`}>
              {user.role === 'admin' ? 'Admin' : 'Gebruiker'}
            </span>
            {user.allowedTabs && user.role !== 'admin' && (
              <span className="text-xs text-text-muted">{user.allowedTabs.join(', ')}</span>
            )}
            {user.username === currentUsername && (
              <span className="text-accent-teal text-xs bg-accent-teal/10 px-2 py-0.5 rounded-full">Jij</span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setDeletingUser(user); setError(''); }}
              className="text-red-400 text-sm hover:underline cursor-pointer"
              disabled={user.username === currentUsername}
              title={user.username === currentUsername ? 'Je kunt jezelf niet verwijderen' : ''}
            >
              Verwijderen
            </button>
          </div>
        ))}
      </div>

      <Modal
        isOpen={!!editingUser}
        onClose={() => { setEditingUser(null); setIsCreating(false); setError(''); }}
        title={isCreating ? 'Nieuwe gebruiker' : 'Gebruiker bewerken'}
      >
        {editingUser && (
          <div className="space-y-4">
            {error && <p className="text-danger text-sm bg-danger/10 px-4 py-2 rounded-lg">{error}</p>}
            <div>
              <label className="block text-text-secondary text-sm mb-1">Gebruikersnaam</label>
              <input type="text" value={editingUser.username} onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-text-secondary text-sm mb-1">{isCreating ? 'Wachtwoord' : 'Nieuw wachtwoord (laat leeg om niet te wijzigen)'}</label>
              <input type="password" value={editingUser.password} onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })} className={inputClass} placeholder={isCreating ? '' : 'Ongewijzigd'} />
              {editingUser.password && <PasswordStrength password={editingUser.password} />}
            </div>
            <div>
              <label className="block text-text-secondary text-sm mb-1">Rol</label>
              <select
                value={editingUser.role}
                onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                className={inputClass}
              >
                <option value="user">Gebruiker</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-text-secondary text-sm mb-2">Zichtbare tabs</label>
              <div className="flex gap-4">
                {AVAILABLE_TABS.map((tab) => (
                  <label key={tab.key} className={`flex items-center gap-2 text-sm ${editingUser.role === 'admin' ? 'opacity-50' : ''}`}>
                    <input
                      type="checkbox"
                      checked={editingUser.role === 'admin' || editingUser.allowedTabs.includes(tab.key)}
                      disabled={editingUser.role === 'admin'}
                      onChange={(e) => {
                        if (editingUser.role === 'admin') return;
                        const newAllowedTabs = e.target.checked
                          ? [...editingUser.allowedTabs, tab.key]
                          : editingUser.allowedTabs.filter(t => t !== tab.key);
                        setEditingUser({ ...editingUser, allowedTabs: newAllowedTabs });
                      }}
                      className="accent-accent-teal"
                    />
                    <span className="text-text-primary">{tab.label}</span>
                  </label>
                ))}
              </div>
              {editingUser.role === 'admin' && (
                <p className="text-text-muted text-xs mt-1">Admins hebben automatisch toegang tot alle tabs</p>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => { setEditingUser(null); setIsCreating(false); setError(''); }} className="px-4 py-2 rounded-lg bg-white/10 text-text-primary cursor-pointer">Annuleren</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg bg-accent text-bg-dark font-semibold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer">
                {saving && <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                {saving ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog isOpen={!!deletingUser} onClose={() => setDeletingUser(null)} onConfirm={handleDelete} title="Gebruiker verwijderen" message={`Weet je zeker dat je "${deletingUser?.username}" wilt verwijderen?`} />
    </>
  );
}

// ---- Audit Log tab ----
function AuditTab() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = async (p: number) => {
    const data = await fetchAuditLogs(p);
    setLogs(data.logs);
    setTotalPages(data.pages);
    setPage(data.page);
  };

  useEffect(() => { load(1); }, []);

  const actionColors: Record<string, string> = {
    CREATE: 'bg-green-500/20 text-green-400',
    UPDATE: 'bg-blue-500/20 text-blue-400',
    DELETE: 'bg-red-500/20 text-red-400',
  };

  return (
    <>
      <div className="bg-bg-card rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-text-secondary text-left">
              <th className="px-4 py-3">Datum</th>
              <th className="px-4 py-3">Actie</th>
              <th className="px-4 py-3">Entiteit</th>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Door</th>
              <th className="px-4 py-3">Wijzigingen</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              let changes: Record<string, unknown> = {};
              try { changes = JSON.parse(log.changes); } catch {}
              return (
                <tr key={log.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-2 text-text-secondary">{new Date(log.createdAt).toLocaleString('nl-NL')}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${actionColors[log.action] || ''}`}>{log.action}</span>
                  </td>
                  <td className="px-4 py-2 text-text-primary">{log.entity}</td>
                  <td className="px-4 py-2 text-text-secondary">{log.entityId}</td>
                  <td className="px-4 py-2 text-text-secondary">{log.performedBy}</td>
                  <td className="px-4 py-2 text-text-secondary text-xs max-w-xs truncate">
                    {Object.entries(changes).map(([k, v]) => `${k}: ${v}`).join(', ')}
                  </td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-text-secondary">Geen logs gevonden</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => load(page - 1)} disabled={page <= 1} className="px-3 py-1 rounded bg-white/10 text-text-primary text-sm disabled:opacity-30 cursor-pointer">Vorige</button>
          <span className="px-3 py-1 text-text-secondary text-sm">Pagina {page} van {totalPages}</span>
          <button onClick={() => load(page + 1)} disabled={page >= totalPages} className="px-3 py-1 rounded bg-white/10 text-text-primary text-sm disabled:opacity-30 cursor-pointer">Volgende</button>
        </div>
      )}
    </>
  );
}

// ---- Main component ----
export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('data');

  return (
    <div>
      <h1 className="text-[28px] font-bold text-accent mb-6">Instellingen</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[rgba(255,255,255,0.08)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-all duration-150 border-b-2 -mb-px cursor-pointer ${
              activeTab === tab.key
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'data' && <DataTab />}
      {activeTab === 'email' && <EmailTab />}
      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'audit' && <AuditTab />}
    </div>
  );
}
