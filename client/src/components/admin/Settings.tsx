import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  exportBackup, importBackup, clearAllData,
  fetchEmailSettings, updateEmailSettings, sendTestEmail, testEmailConnection, EmailMethod,
  fetchBackupList, downloadBackup, deleteBackup, triggerAutoBackup, BackupFile,
  fetchAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser, sendWelcomeEmail, AdminUser,
  fetchAuditLogs, AuditLogEntry,
} from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui/Toast';
import ConfirmDialog from '../ui/ConfirmDialog';
import Modal from '../ui/Modal';
import { PERMISSION_GROUPS, ALL_PERMISSION_KEYS } from '../../shared/permissions';

const inputClass = 'w-full px-3 py-[10px] rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px] outline-none focus:border-accent';

type Tab = 'data' | 'email' | 'users' | 'audit';

const tabs: { key: Tab; label: string }[] = [
  { key: 'users', label: 'Gebruikers' },
  { key: 'email', label: 'E-mail' },
  { key: 'data', label: 'Gegevensbeheer' },
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
  const [method, setMethod] = useState<EmailMethod>('smtp');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [graphTenantId, setGraphTenantId] = useState('');
  const [graphClientId, setGraphClientId] = useState('');
  const [graphClientSecret, setGraphClientSecret] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [sendingTest, setSendingTest] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [savedValues, setSavedValues] = useState({ method: 'smtp' as EmailMethod, smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '', graphTenantId: '', graphClientId: '', graphClientSecret: '', fromEmail: '', fromName: '' });

  const isDirty = method !== savedValues.method ||
    smtpHost !== savedValues.smtpHost || smtpPort !== savedValues.smtpPort ||
    smtpUser !== savedValues.smtpUser || smtpPass !== savedValues.smtpPass ||
    graphTenantId !== savedValues.graphTenantId || graphClientId !== savedValues.graphClientId || graphClientSecret !== savedValues.graphClientSecret ||
    fromEmail !== savedValues.fromEmail || fromName !== savedValues.fromName;
  const canSave = !!fromEmail && (method === 'smtp' ? (!!smtpHost && !!smtpUser) : (!!graphTenantId && !!graphClientId));

  useEffect(() => {
    fetchEmailSettings().then((data) => {
      setEmailConfigured(data.configured);
      setMethod(data.method || 'smtp');
      setSmtpHost(data.smtpHost);
      setSmtpPort(data.smtpPort || 587);
      setSmtpUser(data.smtpUser);
      setSmtpPass(data.smtpPass);
      setGraphTenantId(data.graphTenantId || '');
      setGraphClientId(data.graphClientId || '');
      setGraphClientSecret(data.graphClientSecret || '');
      setFromEmail(data.fromEmail);
      setFromName(data.fromName);
      setSavedValues({ method: data.method || 'smtp', smtpHost: data.smtpHost, smtpPort: data.smtpPort || 587, smtpUser: data.smtpUser, smtpPass: data.smtpPass, graphTenantId: data.graphTenantId || '', graphClientId: data.graphClientId || '', graphClientSecret: data.graphClientSecret || '', fromEmail: data.fromEmail, fromName: data.fromName });
    }).catch(() => {});
  }, []);

  const saveSettings = async () => {
    setAutoSaveStatus('saving');
    try {
      await updateEmailSettings({ method, smtpHost, smtpPort, smtpUser, smtpPass, graphTenantId, graphClientId, graphClientSecret, fromEmail, fromName });
      setEmailConfigured(method === 'graph'
        ? !!(graphTenantId && graphClientId && graphClientSecret && fromEmail)
        : !!(smtpHost && smtpUser && smtpPass && fromEmail));
      setSavedValues({ method, smtpHost, smtpPort, smtpUser, smtpPass, graphTenantId, graphClientId, graphClientSecret, fromEmail, fromName });
      setAutoSaveStatus('saved');
    } catch {
      setAutoSaveStatus('idle');
      toast.error('Automatisch opslaan mislukt');
    }
  };

  // Auto-save: 800 ms na de laatste wijziging, mits de verplichte velden ingevuld zijn.
  useEffect(() => {
    if (!isDirty || !canSave) return;
    const t = setTimeout(() => { void saveSettings(); }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, smtpHost, smtpPort, smtpUser, smtpPass, graphTenantId, graphClientId, graphClientSecret, fromEmail, fromName]);

  // Forceer opslaan vóór een test, zodat de test de actuele waarden gebruikt.
  const ensureSaved = async () => { if (isDirty && canSave) await saveSettings(); };

  const handleSendTestEmail = async () => {
    await ensureSaved();
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

  const handleTestConnection = async () => {
    await ensureSaved();
    setTestingConnection(true);
    try {
      await testEmailConnection();
      toast.success('Serververbinding geslaagd');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Verbinding mislukt';
      toast.error(msg);
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${emailConfigured ? 'bg-green-400' : 'bg-red-400'}`} />
        <span className="text-text-secondary text-sm">
          {emailConfigured ? `Geconfigureerd via ${method === 'graph' ? 'Microsoft 365' : 'SMTP'}` : 'Niet geconfigureerd'}
        </span>
      </div>

      <div className="space-y-4 max-w-md">
        <div>
          <label className="block text-text-secondary text-sm mb-2">Verzendmethode</label>
          <div className="flex gap-2">
            {([['smtp', 'SMTP'], ['graph', 'Microsoft 365 (Graph)']] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMethod(key)}
                className={`px-4 py-2 rounded-[8px] text-sm font-medium cursor-pointer transition-all ${
                  method === key ? 'bg-accent text-bg-dark' : 'bg-[rgba(255,255,255,0.06)] text-text-secondary hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {method === 'smtp' ? (
          <>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-text-secondary text-sm mb-1">SMTP host *</label>
                <input type="text" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.office365.com" className={inputClass} />
              </div>
              <div className="w-24">
                <label className="block text-text-secondary text-sm mb-1">Poort</label>
                <input type="number" value={smtpPort} onChange={(e) => setSmtpPort(Number(e.target.value))} placeholder="587" className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-text-secondary text-sm mb-1">Gebruikersnaam *</label>
              <input type="text" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="user@domein.nl" className={inputClass} />
            </div>
            <div>
              <label className="block text-text-secondary text-sm mb-1">Wachtwoord *</label>
              <input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder={emailConfigured ? 'Laat leeg om huidig wachtwoord te behouden' : 'App-wachtwoord of SMTP wachtwoord'} className={inputClass} />
            </div>
          </>
        ) : (
          <>
            <div className="bg-accent-teal/10 border border-accent-teal/30 rounded-lg px-4 py-3 text-accent-teal text-xs leading-relaxed">
              Maak in <b>Entra ID</b> een app-registratie met <b>Mail.Send</b> (Application) + admin-consent. Vul Tenant-ID, Client-ID en een Client-secret in. De afzender hieronder is de (gedeelde) postbus waar de app namens mag versturen.
            </div>
            <div>
              <label className="block text-text-secondary text-sm mb-1">Tenant-ID *</label>
              <input type="text" value={graphTenantId} onChange={(e) => setGraphTenantId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" className={inputClass} />
            </div>
            <div>
              <label className="block text-text-secondary text-sm mb-1">Client-ID *</label>
              <input type="text" value={graphClientId} onChange={(e) => setGraphClientId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" className={inputClass} />
            </div>
            <div>
              <label className="block text-text-secondary text-sm mb-1">Client-secret *</label>
              <input type="password" value={graphClientSecret} onChange={(e) => setGraphClientSecret(e.target.value)} placeholder={emailConfigured ? 'Laat leeg om huidige secret te behouden' : 'Client-secret uit Entra ID'} className={inputClass} />
            </div>
          </>
        )}

        <div className="border-t border-[rgba(255,255,255,0.06)] pt-4">
          <label className="block text-text-secondary text-sm mb-1">Afzender e-mail *</label>
          <input type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="noreply@megawatt.agency" className={inputClass} />
        </div>
        <div>
          <label className="block text-text-secondary text-sm mb-1">Afzender naam</label>
          <input type="text" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Megawatt Dashboard" className={inputClass} />
        </div>
        <div className="h-5 flex items-center text-xs">
          {autoSaveStatus === 'saving' ? (
            <span className="flex items-center gap-1.5 text-text-muted">
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Opslaan…
            </span>
          ) : isDirty ? (
            <span className="text-text-muted">Wijzigingen worden automatisch opgeslagen…</span>
          ) : autoSaveStatus === 'saved' ? (
            <span className="flex items-center gap-1.5 text-green-400">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              Opgeslagen
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-[rgba(255,255,255,0.06)] max-w-md">
        <h3 className="text-sm font-medium text-text-secondary mb-3">Testen</h3>
        <button
          onClick={handleTestConnection}
          disabled={testingConnection || !emailConfigured}
          className="flex items-center gap-2 mb-3 px-4 py-2 rounded-[8px] bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] text-text-primary text-sm hover:bg-[rgba(255,255,255,0.1)] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {testingConnection && (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          )}
          {testingConnection ? 'Verbinden...' : 'Test server'}
        </button>
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

// ---- Users tab ----
function UsersTab() {
  const toast = useToast();
  const { username: currentUsername } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [editingUser, setEditingUser] = useState<{ id?: number; username: string; email: string; password: string; role: string; allowedTabs: string[] } | null>(null);
  const [sendingMail, setSendingMail] = useState(false);
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
    if (saving) return;
    if (isCreating && !editingUser?.email) { setError('E-mailadres is verplicht'); return; }
    if (!isCreating && !editingUser?.username) return;
    setSaving(true);
    setError('');
    try {
      if (editingUser!.id) {
        // Bestaande user bewerken
        const data: { email?: string; password?: string; role?: string; allowedTabs?: string[] } = {
          email: editingUser!.email,
          role: editingUser!.role,
          allowedTabs: editingUser!.role === 'admin' ? [...ALL_PERMISSION_KEYS] : editingUser!.allowedTabs,
        };
        if (editingUser!.password) data.password = editingUser!.password;
        await updateAdminUser(editingUser!.id, data);
        toast.success('Gebruiker bijgewerkt');
      } else {
        // Nieuwe user — alleen email + rol nodig
        const created = await createAdminUser({
          email: editingUser!.email,
          role: editingUser!.role,
          allowedTabs: editingUser!.role === 'admin' ? [...ALL_PERMISSION_KEYS] : editingUser!.allowedTabs,
        });
        const withEmail = created as AdminUser & { emailSent?: boolean };
        if (withEmail.emailSent) toast.success('Gebruiker aangemaakt — welkomstmail verstuurd ✉');
        else toast.success('Gebruiker aangemaakt (welkomstmail kon niet worden verstuurd)');
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
          onClick={() => { setEditingUser({ username: '', email: '', password: '', role: 'user', allowedTabs: [] }); setIsCreating(true); setError(''); setError(''); }}
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
            onClick={() => { setEditingUser({ id: user.id, username: user.username, email: user.email ?? '', password: '', role: user.role, allowedTabs: user.allowedTabs }); setIsCreating(false); setError(''); }}
            className="flex items-center gap-3 bg-bg-card p-3 rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-accent-teal/20 flex items-center justify-center text-accent-teal text-sm font-bold flex-shrink-0">
              {(user.email || user.username).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-text-primary font-medium truncate">{user.email || user.username}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
              user.role === 'admin' ? 'bg-accent/20 text-accent' :
              user.role === 'superuser' ? 'bg-accent-teal/20 text-accent-teal' :
              'bg-white/10 text-text-secondary'
            }`}>
              {user.role === 'admin' ? 'Admin' : user.role === 'superuser' ? 'Super User' : 'Gebruiker'}
            </span>
            {user.allowedTabs && user.role !== 'admin' && (
              <span className="text-xs text-text-muted">{user.allowedTabs.join(', ')}</span>
            )}
            {(user.email === currentUsername || user.username === currentUsername) && (
              <span className="text-accent-teal text-xs bg-accent-teal/10 px-2 py-0.5 rounded-full shrink-0">Jij</span>
            )}
            {user.email && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  try { await sendWelcomeEmail(user.id); toast.success('Welkomstmail verstuurd'); }
                  catch (err: unknown) {
                    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'E-mail versturen mislukt';
                    toast.error(msg);
                  }
                }}
                className="text-accent-teal text-sm hover:underline cursor-pointer"
                title="Stuur welkomstmail met wachtwoord-instel link"
              >
                ✉ Mail
              </button>
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

            {/* Nieuwe user: alleen email + rol — wachtwoord via welkomstmail */}
            {isCreating && (
              <div className="bg-accent-teal/10 border border-accent-teal/30 rounded-lg px-4 py-3 text-accent-teal text-sm flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>
                De gebruiker ontvangt een welkomstmail om zelf een wachtwoord in te stellen.
              </div>
            )}

            <div>
              <label className="block text-text-secondary text-sm mb-1">E-mailadres</label>
              <input
                type="email"
                value={editingUser.email}
                onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                className={inputClass}
                placeholder="naam@megawatt.agency"
                autoFocus={isCreating}
              />
              {isCreating && <p className="text-text-muted text-xs mt-1">Dit wordt ook de gebruikersnaam</p>}
            </div>

            {/* Bestaande user: optioneel wachtwoord wijzigen */}
            {!isCreating && (
              <div>
                <label className="block text-text-secondary text-sm mb-1">Nieuw wachtwoord <span className="text-text-muted">(laat leeg om niet te wijzigen)</span></label>
                <input type="password" value={editingUser.password} onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })} className={inputClass} placeholder="Ongewijzigd" />
                {editingUser.password && <PasswordStrength password={editingUser.password} />}
              </div>
            )}
            <div>
              <label className="block text-text-secondary text-sm mb-1">Rol</label>
              <select
                value={editingUser.role}
                onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                className={inputClass}
              >
                <option value="user">Gebruiker — alleen frontend</option>
                <option value="superuser">Super User — alles behalve accountbeheer</option>
                <option value="admin">Admin — volledige toegang</option>
              </select>
            </div>
            <div>
              <label className="block text-text-secondary text-sm mb-2">Zichtbaar</label>
              <div className="space-y-3">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.group}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1">{group.group}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {group.items.map((item) => (
                        <label key={item.key} className={`flex items-center gap-2 text-sm ${editingUser.role === 'admin' ? 'opacity-50' : ''}`}>
                          <input
                            type="checkbox"
                            checked={editingUser.role === 'admin' || editingUser.allowedTabs.includes(item.key)}
                            disabled={editingUser.role === 'admin'}
                            onChange={(e) => {
                              if (editingUser.role === 'admin') return;
                              const newAllowedTabs = e.target.checked
                                ? [...editingUser.allowedTabs, item.key]
                                : editingUser.allowedTabs.filter((t) => t !== item.key);
                              setEditingUser({ ...editingUser, allowedTabs: newAllowedTabs });
                            }}
                            className="accent-accent-teal"
                          />
                          <span className="text-text-primary">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {editingUser.role === 'admin' && (
                <p className="text-text-muted text-xs mt-2">Admins hebben automatisch toegang tot alles</p>
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
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();

  // Gebruikers-tab alleen voor admins
  const visibleTabs = tabs.filter(t => t.key !== 'users' || isAdmin);

  // Actieve tab uit de URL (?tab=...) zodat een refresh op dezelfde tab blijft.
  const urlTab = searchParams.get('tab') as Tab | null;
  const initialTab: Tab = visibleTabs.some((t) => t.key === urlTab) ? (urlTab as Tab) : (isAdmin ? 'users' : 'email');
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  const selectTab = (tab: Tab) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  return (
    <div>
      <h1 className="text-[28px] font-bold text-accent mb-6">Instellingen</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[rgba(255,255,255,0.08)]">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => selectTab(tab.key)}
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
      {activeTab === 'users' && isAdmin && <UsersTab />}
      {activeTab === 'audit' && <AuditTab />}
    </div>
  );
}
