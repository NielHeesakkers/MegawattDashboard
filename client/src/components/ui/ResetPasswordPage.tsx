import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { checkResetToken, resetPassword } from '../../api';

const MegawattLogoSvg = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28.35 5.67" className="h-7 w-auto">
    <path fill="#FFFF00" d="M27.47,3.24v-1.82h.87v-.63h-.87v-.79h-.67v2.96-.16s0,.45,0,.45c0,.67.29.96.96.96h.58v-.62h-.53c-.26,0-.34-.08-.34-.34h0ZM26.01,4.2h.58v-.62h-.53c-.26,0-.34-.08-.34-.34v-1.82h0s.87,0,.87,0v-.63h0s-.87,0-.87,0v-.79h-.67v.79h-.55v.63h.55v1.83c0,.67.29.96.96.96h0ZM24.53,3.58c-.13,0-.17-.03-.17-.18v-1.51c0-.83-.53-1.3-1.44-1.3-.87,0-1.43.42-1.52,1.13v.06s.66,0,.66,0v-.04c.07-.34.38-.54.84-.54.51,0,.81.24.81.66v.18h-.96c-.93,0-1.44.4-1.44,1.13,0,.65.52,1.06,1.33,1.06.47,0,.84-.16,1.12-.49.05.3.27.45.67.45h.36v-.62h-.23ZM23.69,2.74c0,.57-.4.92-1.04.92-.42,0-.7-.2-.7-.51,0-.35.23-.52.72-.52h1.02v.11h0ZM20.26,4.2l1.19-3.57h-.68l-.86,2.68-.82-2.68h-.6l-.87,2.68-.82-2.68h-.7l1.15,3.57h.69l.83-2.45.79,2.45h.69ZM16.23,3.58c-.13,0-.17-.03-.17-.18v-1.51c0-.83-.53-1.3-1.44-1.3-.87,0-1.43.42-1.52,1.13v.06s.66,0,.66,0v-.04c.07-.34.38-.54.84-.54.51,0,.81.24.81.66v.18h-.96c-.93,0-1.44.4-1.44,1.13,0,.65.52,1.06,1.33,1.06.47,0,.84-.16,1.12-.49.05.3.27.45.66.45h.36v-.62h-.23ZM15.4,2.74c0,.57-.4.92-1.04.92-.42,0-.7-.2-.7-.51,0-.35.23-.52.72-.52h1.02v.11h0ZM12.72,4.05V.63h-.58l-.06.49c-.25-.35-.65-.53-1.15-.53-1.01,0-1.72.75-1.72,1.82s.67,1.82,1.72,1.82c.49,0,.87-.17,1.13-.51v.3c0,.7-.35,1.04-1.06,1.04-.55,0-.92-.23-1-.63v-.04h-.68v.06c.1.76.71,1.22,1.65,1.22,1.17,0,1.77-.55,1.77-1.62h0ZM12.06,2.43c0,.71-.45,1.21-1.08,1.21s-1.09-.49-1.09-1.22.44-1.22,1.09-1.22,1.08.5,1.08,1.23h0ZM8.93,2.58c.01-.12.01-.22.01-.29-.03-1.04-.68-1.69-1.69-1.69s-1.69.75-1.69,1.82.71,1.82,1.77,1.82c.79,0,1.41-.5,1.56-1.24v-.04s-.67,0-.67,0v.02c-.11.42-.46.66-.93.66-.61,0-1.01-.41-1.04-1.06h2.69ZM8.23,2.01h-1.94c.07-.47.48-.82.97-.82.1,0,.2.01.29.03.39.09.65.37.69.79h0ZM4.61,4.2h.67v-2.05c0-.99-.5-1.56-1.36-1.56-.53,0-.94.21-1.19.6-.21-.38-.6-.6-1.1-.6-.4,0-.72.14-.97.44l-.06-.4h-.58v3.57h.67v-1.88c0-.67.34-1.11.86-1.11s.78.34.78.97v2.01h.67v-1.9c0-.68.33-1.08.87-1.08.63,0,.76.53.76.97v2.01h0Z"/>
  </svg>
);

const inputCls = 'w-full px-3 py-[10px] rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px] focus:outline-none focus:border-accent-teal';

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [username, setUsername] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [pw, setPw] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setTokenError('Geen token'); setValidating(false); return; }
    checkResetToken(token).then((r) => {
      if (r.valid) { setValid(true); setUsername(r.username || ''); }
      else setTokenError(r.error || 'Link is ongeldig');
    }).catch(() => setTokenError('Link is ongeldig of verlopen'))
      .finally(() => setValidating(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (pw !== pwConfirm) { setError('Wachtwoorden komen niet overeen'); return; }
    if (pw.length < 6) { setError('Wachtwoord moet minimaal 6 tekens zijn'); return; }
    setSubmitting(true);
    try {
      await resetPassword(token!, pw);
      setSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error || 'Reset mislukt');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-[#1a3a38] p-8 rounded-[12px] w-full max-w-sm border border-[rgba(255,255,255,0.08)]">
        <div className="flex justify-center mb-6"><MegawattLogoSvg /></div>

        {validating && <p className="text-text-secondary text-sm text-center">Token controleren…</p>}

        {!validating && tokenError && (
          <>
            <p className="text-danger text-sm mb-4 text-center">{tokenError}</p>
            <button onClick={() => navigate('/')} className="w-full py-2.5 rounded-[6px] bg-accent-teal text-[#1a3a38] font-semibold hover:opacity-85 cursor-pointer">
              Terug naar inloggen
            </button>
          </>
        )}

        {!validating && valid && success && (
          <>
            <p className="text-accent-teal text-sm mb-4 text-center">✓ Wachtwoord gewijzigd! Je wordt teruggestuurd…</p>
          </>
        )}

        {!validating && valid && !success && (
          <form onSubmit={handleSubmit}>
            {/* Verborgen gebruikersnaam zodat Safari/Keychain het wachtwoord aan het account koppelt */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              readOnly
              aria-hidden="true"
              tabIndex={-1}
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
            />
            <p className="text-[rgba(255,255,255,0.7)] text-sm mb-1">Hi <strong className="text-white">{username}</strong>,</p>
            <p className="text-[rgba(255,255,255,0.5)] text-sm mb-5">Stel een nieuw wachtwoord in.</p>

            {error && <p className="text-danger text-sm mb-4 text-center">{error}</p>}

            <div className="mb-3">
              <label className="block text-text-secondary text-sm mb-1">Nieuw wachtwoord</label>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} required minLength={6} autoFocus autoComplete="new-password" />
            </div>
            <div className="mb-5">
              <label className="block text-text-secondary text-sm mb-1">Bevestig wachtwoord</label>
              <input type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} className={inputCls} required minLength={6} autoComplete="new-password" />
            </div>
            <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-[6px] bg-accent-teal text-[#1a3a38] font-semibold hover:opacity-85 transition-opacity disabled:opacity-50 cursor-pointer">
              {submitting ? 'Bezig…' : 'Wachtwoord opslaan'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
