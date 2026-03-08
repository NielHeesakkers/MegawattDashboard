import { useState, useRef, useEffect } from 'react';
import { exportBackup, importBackup, clearAllData, fetchEmailSettings, updateEmailSettings, sendTestEmail } from '../../api';
import ConfirmDialog from '../ui/ConfirmDialog';

const inputClass = 'w-full px-3 py-[10px] rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px] outline-none focus:border-accent';

export default function Settings() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Email / SMTP settings
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
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchEmailSettings().then((data) => {
      setEmailConfigured(data.configured);
      setSmtpHost(data.smtpHost);
      setSmtpPort(data.smtpPort || 587);
      setSmtpUser(data.smtpUser);
      setSmtpPass(data.smtpPass);
      setFromEmail(data.fromEmail);
      setFromName(data.fromName);
    }).catch(() => {});
  }, []);

  const handleSaveEmailSettings = async () => {
    setSavingEmail(true);
    setEmailStatus(null);
    try {
      await updateEmailSettings({ smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, fromName });
      setEmailConfigured(!!(smtpHost && smtpUser && smtpPass && fromEmail));
      setEmailStatus({ type: 'success', text: 'E-mail instellingen opgeslagen' });
    } catch {
      setEmailStatus({ type: 'error', text: 'Opslaan mislukt' });
    } finally {
      setSavingEmail(false);
    }
  };

  const handleSendTestEmail = async () => {
    setSendingTest(true);
    setEmailStatus(null);
    try {
      await sendTestEmail(testEmail);
      setEmailStatus({ type: 'success', text: `Test e-mail verzonden naar ${testEmail}` });
      setTestEmail('');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Test e-mail verzenden mislukt';
      setEmailStatus({ type: 'error', text: msg });
    } finally {
      setSendingTest(false);
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
    } catch {
      setStatusMessage({ type: 'error', text: 'Wissen mislukt' });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div>
      <h1 className="text-[28px] font-bold text-accent mb-6">Instellingen</h1>

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

      {/* E-mail instellingen (SMTP) */}
      <div className="border-t border-[rgba(255,255,255,0.08)] mt-8 pt-8">
        <h2 className="text-lg font-semibold text-text-primary mb-4">E-mail instellingen</h2>

        <div className="mb-4 flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${emailConfigured ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-text-secondary text-sm">
            SMTP: {emailConfigured ? `Geconfigureerd (${smtpHost}:${smtpPort})` : 'Niet geconfigureerd'}
          </span>
        </div>

        {emailStatus && (
          <div className={`mb-4 px-4 py-3 rounded-[8px] text-sm ${
            emailStatus.type === 'success'
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            {emailStatus.text}
          </div>
        )}

        <div className="space-y-4 max-w-md">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-text-secondary text-sm mb-1">SMTP host *</label>
              <input
                type="text"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.gmail.com"
                className={inputClass}
              />
            </div>
            <div className="w-24">
              <label className="block text-text-secondary text-sm mb-1">Poort</label>
              <input
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(Number(e.target.value))}
                placeholder="587"
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="block text-text-secondary text-sm mb-1">Gebruikersnaam *</label>
            <input
              type="text"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              placeholder="user@gmail.com"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-text-secondary text-sm mb-1">Wachtwoord *</label>
            <input
              type="password"
              value={smtpPass}
              onChange={(e) => setSmtpPass(e.target.value)}
              placeholder={emailConfigured ? 'Laat leeg om huidig wachtwoord te behouden' : 'App-wachtwoord of SMTP wachtwoord'}
              className={inputClass}
            />
          </div>
          <div className="border-t border-[rgba(255,255,255,0.06)] pt-4">
            <label className="block text-text-secondary text-sm mb-1">Afzender e-mail *</label>
            <input
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="noreply@megawatt.nl"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-text-secondary text-sm mb-1">Afzender naam</label>
            <input
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Megawatt Dashboard"
              className={inputClass}
            />
          </div>
          <button
            onClick={handleSaveEmailSettings}
            disabled={savingEmail || !smtpHost || !smtpUser || !fromEmail}
            className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-accent text-bg-dark text-sm font-semibold hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {savingEmail && (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
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
              className={'flex-1 px-3 py-[10px] rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px] outline-none focus:border-accent'}
            />
            <button
              onClick={handleSendTestEmail}
              disabled={sendingTest || !testEmail || !emailConfigured}
              className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] text-text-primary text-sm hover:bg-[rgba(255,255,255,0.1)] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {sendingTest && (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {sendingTest ? 'Verzenden...' : 'Test verzenden'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
