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
        <h1 className="text-xl font-bold text-accent mb-6 text-center">MEGAWATT Admin</h1>
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
  { to: '/admin/members', label: 'Medewerkers' },
  { to: '/admin/executives', label: 'Directie' },
  { to: '/admin/audit', label: 'Audit Log' },
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
          <Link to="/" className="text-accent font-bold text-lg">MEGAWATT</Link>
          <p className="text-text-muted text-xs mt-1">Admin Panel</p>
        </div>
        <nav className="flex-1 flex flex-col gap-[2px]">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`block px-3 py-2 rounded-[6px] text-[14px] transition-all duration-150 ${
                location.pathname === item.to
                  ? 'bg-accent-teal text-[#1a3a38]'
                  : 'text-[rgba(255,255,255,0.7)] hover:text-[rgba(255,255,255,0.9)]'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex-shrink-0 pt-3 border-t border-[rgba(255,255,255,0.08)] mt-auto">
          <p className="text-text-muted text-xs mb-2">Ingelogd als {username}</p>
          <button onClick={logout} className="text-sm text-danger hover:opacity-80 cursor-pointer">
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
