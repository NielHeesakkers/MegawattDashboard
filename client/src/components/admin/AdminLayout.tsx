import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function LoginForm() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch {
      setError('Ongeldige inloggegevens');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-[#1a3a38] p-8 rounded-[12px] w-full max-w-sm border border-[rgba(255,255,255,0.08)]">
        <div className="flex justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28.35 5.67" className="h-7 w-auto">
            <path fill="#FFFF00" d="M27.47,3.24v-1.82h.87v-.63h-.87v-.79h-.67v2.96-.16s0,.45,0,.45c0,.67.29.96.96.96h.58v-.62h-.53c-.26,0-.34-.08-.34-.34h0ZM26.01,4.2h.58v-.62h-.53c-.26,0-.34-.08-.34-.34v-1.82h0s.87,0,.87,0v-.63h0s-.87,0-.87,0v-.79h-.67v.79h-.55v.63h.55v1.83c0,.67.29.96.96.96h0ZM24.53,3.58c-.13,0-.17-.03-.17-.18v-1.51c0-.83-.53-1.3-1.44-1.3-.87,0-1.43.42-1.52,1.13v.06s.66,0,.66,0v-.04c.07-.34.38-.54.84-.54.51,0,.81.24.81.66v.18h-.96c-.93,0-1.44.4-1.44,1.13,0,.65.52,1.06,1.33,1.06.47,0,.84-.16,1.12-.49.05.3.27.45.67.45h.36v-.62h-.23ZM23.69,2.74c0,.57-.4.92-1.04.92-.42,0-.7-.2-.7-.51,0-.35.23-.52.72-.52h1.02v.11h0ZM20.26,4.2l1.19-3.57h-.68l-.86,2.68-.82-2.68h-.6l-.87,2.68-.82-2.68h-.7l1.15,3.57h.69l.83-2.45.79,2.45h.69ZM16.23,3.58c-.13,0-.17-.03-.17-.18v-1.51c0-.83-.53-1.3-1.44-1.3-.87,0-1.43.42-1.52,1.13v.06s.66,0,.66,0v-.04c.07-.34.38-.54.84-.54.51,0,.81.24.81.66v.18h-.96c-.93,0-1.44.4-1.44,1.13,0,.65.52,1.06,1.33,1.06.47,0,.84-.16,1.12-.49.05.3.27.45.66.45h.36v-.62h-.23ZM15.4,2.74c0,.57-.4.92-1.04.92-.42,0-.7-.2-.7-.51,0-.35.23-.52.72-.52h1.02v.11h0ZM12.72,4.05V.63h-.58l-.06.49c-.25-.35-.65-.53-1.15-.53-1.01,0-1.72.75-1.72,1.82s.67,1.82,1.72,1.82c.49,0,.87-.17,1.13-.51v.3c0,.7-.35,1.04-1.06,1.04-.55,0-.92-.23-1-.63v-.04h-.68v.06c.1.76.71,1.22,1.65,1.22,1.17,0,1.77-.55,1.77-1.62h0ZM12.06,2.43c0,.71-.45,1.21-1.08,1.21s-1.09-.49-1.09-1.22.44-1.22,1.09-1.22,1.08.5,1.08,1.23h0ZM8.93,2.58c.01-.12.01-.22.01-.29-.03-1.04-.68-1.69-1.69-1.69s-1.69.75-1.69,1.82.71,1.82,1.77,1.82c.79,0,1.41-.5,1.56-1.24v-.04s-.67,0-.67,0v.02c-.11.42-.46.66-.93.66-.61,0-1.01-.41-1.04-1.06h2.69ZM8.23,2.01h-1.94c.07-.47.48-.82.97-.82.1,0,.2.01.29.03.39.09.65.37.69.79h0ZM4.61,4.2h.67v-2.05c0-.99-.5-1.56-1.36-1.56-.53,0-.94.21-1.19.6-.21-.38-.6-.6-1.1-.6-.4,0-.72.14-.97.44l-.06-.4h-.58v3.57h.67v-1.88c0-.67.34-1.11.86-1.11s.78.34.78.97v2.01h.67v-1.9c0-.68.33-1.08.87-1.08.63,0,.76.53.76.97v2.01h0Z"/>
          </svg>
        </div>
        {error && <p className="text-danger text-sm mb-4 text-center">{error}</p>}
        <div className="mb-4">
          <label className="block text-text-secondary text-sm mb-1">Gebruikersnaam</label>
          <input
            type="text" value={username} onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-[10px] rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
          />
        </div>
        <div className="mb-6">
          <label className="block text-text-secondary text-sm mb-1">Wachtwoord</label>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-[10px] rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px]"
          />
        </div>
        <button
          type="submit" disabled={loading}
          className="w-full py-2.5 rounded-[6px] bg-accent-teal text-[#1a3a38] font-semibold hover:opacity-85 transition-opacity disabled:opacity-50 cursor-pointer"
        >
          {loading ? 'Inloggen...' : 'Inloggen'}
        </button>
      </form>
    </div>
  );
}

const navItems = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/members', label: 'Medewerkers', divider: true },
  { to: '/admin/overzicht', label: 'Organigram', divider: true },
  { to: '/admin/client-teams', label: 'Klantteams', divider: true },
  { to: '/admin/users', label: 'Gebruikers', divider: true },
  { to: '/admin/settings', label: 'Instellingen' },
  { to: '/admin/audit', label: 'Audit Log', divider: true },
  { to: '/admin/versions', label: 'Versiegeschiedenis' },
];

export default function AdminLayout() {
  const { isAuthenticated, username, logout } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) return <LoginForm />;

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-[220px] min-w-[220px] bg-bg-surface border-r border-[rgba(255,255,255,0.08)] flex flex-col h-screen p-5 gap-0">
        <div className="flex-shrink-0 mb-3">
          <Link to="/" className="block px-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28.35 5.67" className="h-6 w-auto">
              <path fill="#FFFF00" d="M27.47,3.24v-1.82h.87v-.63h-.87v-.79h-.67v2.96-.16s0,.45,0,.45c0,.67.29.96.96.96h.58v-.62h-.53c-.26,0-.34-.08-.34-.34h0ZM26.01,4.2h.58v-.62h-.53c-.26,0-.34-.08-.34-.34v-1.82h0s.87,0,.87,0v-.63h0s-.87,0-.87,0v-.79h-.67v.79h-.55v.63h.55v1.83c0,.67.29.96.96.96h0ZM24.53,3.58c-.13,0-.17-.03-.17-.18v-1.51c0-.83-.53-1.3-1.44-1.3-.87,0-1.43.42-1.52,1.13v.06s.66,0,.66,0v-.04c.07-.34.38-.54.84-.54.51,0,.81.24.81.66v.18h-.96c-.93,0-1.44.4-1.44,1.13,0,.65.52,1.06,1.33,1.06.47,0,.84-.16,1.12-.49.05.3.27.45.67.45h.36v-.62h-.23ZM23.69,2.74c0,.57-.4.92-1.04.92-.42,0-.7-.2-.7-.51,0-.35.23-.52.72-.52h1.02v.11h0ZM20.26,4.2l1.19-3.57h-.68l-.86,2.68-.82-2.68h-.6l-.87,2.68-.82-2.68h-.7l1.15,3.57h.69l.83-2.45.79,2.45h.69ZM16.23,3.58c-.13,0-.17-.03-.17-.18v-1.51c0-.83-.53-1.3-1.44-1.3-.87,0-1.43.42-1.52,1.13v.06s.66,0,.66,0v-.04c.07-.34.38-.54.84-.54.51,0,.81.24.81.66v.18h-.96c-.93,0-1.44.4-1.44,1.13,0,.65.52,1.06,1.33,1.06.47,0,.84-.16,1.12-.49.05.3.27.45.66.45h.36v-.62h-.23ZM15.4,2.74c0,.57-.4.92-1.04.92-.42,0-.7-.2-.7-.51,0-.35.23-.52.72-.52h1.02v.11h0ZM12.72,4.05V.63h-.58l-.06.49c-.25-.35-.65-.53-1.15-.53-1.01,0-1.72.75-1.72,1.82s.67,1.82,1.72,1.82c.49,0,.87-.17,1.13-.51v.3c0,.7-.35,1.04-1.06,1.04-.55,0-.92-.23-1-.63v-.04h-.68v.06c.1.76.71,1.22,1.65,1.22,1.17,0,1.77-.55,1.77-1.62h0ZM12.06,2.43c0,.71-.45,1.21-1.08,1.21s-1.09-.49-1.09-1.22.44-1.22,1.09-1.22,1.08.5,1.08,1.23h0ZM8.93,2.58c.01-.12.01-.22.01-.29-.03-1.04-.68-1.69-1.69-1.69s-1.69.75-1.69,1.82.71,1.82,1.77,1.82c.79,0,1.41-.5,1.56-1.24v-.04s-.67,0-.67,0v.02c-.11.42-.46.66-.93.66-.61,0-1.01-.41-1.04-1.06h2.69ZM8.23,2.01h-1.94c.07-.47.48-.82.97-.82.1,0,.2.01.29.03.39.09.65.37.69.79h0ZM4.61,4.2h.67v-2.05c0-.99-.5-1.56-1.36-1.56-.53,0-.94.21-1.19.6-.21-.38-.6-.6-1.1-.6-.4,0-.72.14-.97.44l-.06-.4h-.58v3.57h.67v-1.88c0-.67.34-1.11.86-1.11s.78.34.78.97v2.01h.67v-1.9c0-.68.33-1.08.87-1.08.63,0,.76.53.76.97v2.01h0Z"/>
            </svg>
          </Link>
        </div>
        <nav className="flex-1 flex flex-col gap-[2px]">
          {navItems.map((item) => (
            <div key={item.to}>
              {'divider' in item && item.divider && (
                <div className="border-t border-[rgba(255,255,255,0.06)] my-2" />
              )}
              <Link
                to={item.to}
                className={`block px-3 py-2 rounded-[6px] text-[14px] transition-all duration-150 ${
                  location.pathname === item.to
                    ? 'bg-accent-teal text-[#1a3a38]'
                    : 'text-[rgba(255,255,255,0.7)] hover:text-[rgba(255,255,255,0.9)]'
                }`}
              >
                {item.label}
              </Link>
            </div>
          ))}
        </nav>
        <div className="flex-shrink-0 pt-3 border-t border-[rgba(255,255,255,0.08)] mt-auto">
          <p className="text-text-muted text-xs mb-2">Ingelogd als {username}</p>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[6px] bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] font-medium hover:bg-red-500/20 hover:text-red-300 transition-all duration-150 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
            </svg>
            Uitloggen
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
