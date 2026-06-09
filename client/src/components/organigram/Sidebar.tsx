import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { globalSearch, GlobalSearchResults } from '../../api';
import { PERMISSION_GROUPS } from '../../shared/permissions';

type ViewMode = 'dashboard' | 'klantteams' | 'klanten' | 'toeleveranciers' | 'projecten-actief' | 'projecten-afgerond' | 'projecten-geannuleerd' | 'locaties' | 'superchargers';

interface Props {
  viewMode: ViewMode;
  onViewMode: (mode: ViewMode) => void;
  hasTab: (tab: string) => boolean;
  isAdmin: boolean;
  username: string | null;
  onExportPdf: () => void;
  onExportJpg: () => void;
  onEmailShare: () => void;
  onLogout: () => void;
}


const MegawattLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28.35 5.67" className="h-6 w-auto">
    <path fill="#FFFF00" d="M27.47,3.24v-1.82h.87v-.63h-.87v-.79h-.67v2.96-.16s0,.45,0,.45c0,.67.29.96.96.96h.58v-.62h-.53c-.26,0-.34-.08-.34-.34h0ZM26.01,4.2h.58v-.62h-.53c-.26,0-.34-.08-.34-.34v-1.82h0s.87,0,.87,0v-.63h0s-.87,0-.87,0v-.79h-.67v.79h-.55v.63h.55v1.83c0,.67.29.96.96.96h0ZM24.53,3.58c-.13,0-.17-.03-.17-.18v-1.51c0-.83-.53-1.3-1.44-1.3-.87,0-1.43.42-1.52,1.13v.06s.66,0,.66,0v-.04c.07-.34.38-.54.84-.54.51,0,.81.24.81.66v.18h-.96c-.93,0-1.44.4-1.44,1.13,0,.65.52,1.06,1.33,1.06.47,0,.84-.16,1.12-.49.05.3.27.45.67.45h.36v-.62h-.23ZM23.69,2.74c0,.57-.4.92-1.04.92-.42,0-.7-.2-.7-.51,0-.35.23-.52.72-.52h1.02v.11h0ZM20.26,4.2l1.19-3.57h-.68l-.86,2.68-.82-2.68h-.6l-.87,2.68-.82-2.68h-.7l1.15,3.57h.69l.83-2.45.79,2.45h.69ZM16.23,3.58c-.13,0-.17-.03-.17-.18v-1.51c0-.83-.53-1.3-1.44-1.3-.87,0-1.43.42-1.52,1.13v.06s.66,0,.66,0v-.04c.07-.34.38-.54.84-.54.51,0,.81.24.81.66v.18h-.96c-.93,0-1.44.4-1.44,1.13,0,.65.52,1.06,1.33,1.06.47,0,.84-.16,1.12-.49.05.3.27.45.66.45h.36v-.62h-.23ZM15.4,2.74c0,.57-.4.92-1.04.92-.42,0-.7-.2-.7-.51,0-.35.23-.52.72-.52h1.02v.11h0ZM12.72,4.05V.63h-.58l-.06.49c-.25-.35-.65-.53-1.15-.53-1.01,0-1.72.75-1.72,1.82s.67,1.82,1.72,1.82c.49,0,.87-.17,1.13-.51v.3c0,.7-.35,1.04-1.06,1.04-.55,0-.92-.23-1-.63v-.04h-.68v.06c.1.76.71,1.22,1.65,1.22,1.17,0,1.77-.55,1.77-1.62h0ZM12.06,2.43c0,.71-.45,1.21-1.08,1.21s-1.09-.49-1.09-1.22.44-1.22,1.09-1.22,1.08.5,1.08,1.23h0ZM8.93,2.58c.01-.12.01-.22.01-.29-.03-1.04-.68-1.69-1.69-1.69s-1.69.75-1.69,1.82.71,1.82,1.77,1.82c.79,0,1.41-.5,1.56-1.24v-.04s-.67,0-.67,0v.02c-.11.42-.46.66-.93.66-.61,0-1.01-.41-1.04-1.06h2.69ZM8.23,2.01h-1.94c.07-.47.48-.82.97-.82.1,0,.2.01.29.03.39.09.65.37.69.79h0ZM4.61,4.2h.67v-2.05c0-.99-.5-1.56-1.36-1.56-.53,0-.94.21-1.19.6-.21-.38-.6-.6-1.1-.6-.4,0-.72.14-.97.44l-.06-.4h-.58v3.57h.67v-1.88c0-.67.34-1.11.86-1.11s.78.34.78.97v2.01h.67v-1.9c0-.68.33-1.08.87-1.08.63,0,.76.53.76.97v2.01h0Z"/>
  </svg>
);

// ── Globale search ──────────────────────────────────────────────────────────
function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GlobalSearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setResults(null); return; }
    debounceRef.current = setTimeout(async () => {
      try { const r = await globalSearch(q); setResults(r); setOpen(true); } catch { setResults(null); }
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q]);

  const navigateTo = (path: string) => { navigate(path); setOpen(false); setQ(''); };
  const totalCount = results ? Object.values(results).reduce((s, arr) => s + arr.length, 0) : 0;

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="search"
        placeholder="Zoeken…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results && setOpen(true)}
        className="w-full h-9 pl-9 pr-3 rounded-[6px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[13px] placeholder-[rgba(255,255,255,0.3)] focus:outline-none focus:border-accent-teal"
      />
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgba(255,255,255,0.3)] pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>

      {open && results && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-bg-surface rounded-xl ring-1 ring-[rgba(255,255,255,0.12)] shadow-2xl max-h-[70vh] overflow-y-auto">
          {totalCount === 0 ? (
            <p className="text-[rgba(255,255,255,0.4)] text-sm px-4 py-3">Geen resultaten</p>
          ) : (
            <div className="py-2">
              <SearchSection title="Klanten" items={results.klanten.map(k => ({ id: k.id, label: k.name, sub: [k.stad, k.land].filter(Boolean).join(', ') || null, logo: k.logo, path: `/contacten/klanten/${k.id}` }))} onClick={navigateTo} />
              <SearchSection title="Toeleveranciers" items={results.toeleveranciers.map(t => ({ id: t.id, label: t.name, sub: [t.stad, t.land].filter(Boolean).join(', ') || null, logo: t.logo, path: `/contacten/toeleveranciers/${t.id}` }))} onClick={navigateTo} />
              <SearchSection title="Locaties" items={results.locaties.map(l => ({ id: l.id, label: l.naam || `Locatie ${l.id}`, sub: [l.code, l.stad].filter(Boolean).join(' · ') || null, logo: null, path: `/locaties/${l.id}` }))} onClick={navigateTo} />
              <SearchSection title="Projecten" items={results.projecten.map((p) => ({ id: p.id, label: p.name || p.projectNumber, sub: `${p.projectNumber} · ${p.klant.name}`, logo: null, path: `/projecten/${p.id}` }))} onClick={navigateTo} />
              <SearchSection title="Medewerkers" items={[
                ...results.executives.map(e => ({ id: e.id, label: e.name, sub: e.role, logo: e.photo, path: '/' })),
                ...results.members.map(m => ({ id: m.id, label: m.name, sub: m.team?.name ? `${m.role || ''} · ${m.team.name}` : m.role, logo: m.photo, path: '/' })),
              ]} onClick={navigateTo} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SearchItem { id: number; label: string; sub: string | null; logo: string | null; path: string }
function SearchSection({ title, items, onClick }: { title: string; items: SearchItem[]; onClick: (path: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.4)] px-4 py-1.5 bg-[rgba(255,255,255,0.02)]">{title}</p>
      {items.map((it) => (
        <button key={`${title}-${it.id}`} onClick={() => onClick(it.path)} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[rgba(255,255,255,0.06)] cursor-pointer text-left">
          {it.logo ? (
            <div className="w-7 h-7 rounded bg-white shrink-0 overflow-hidden flex items-center justify-center">
              <img src={it.logo} alt="" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-7 h-7 rounded bg-[rgba(255,255,255,0.06)] shrink-0 flex items-center justify-center text-[10px] text-[rgba(255,255,255,0.5)] font-semibold">
              {it.label.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-[13px] font-medium truncate">{it.label}</p>
            {it.sub && <p className="text-[rgba(255,255,255,0.4)] text-[11px] truncate">{it.sub}</p>}
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Sidebar (admin-stijl) ────────────────────────────────────────────────────
export default function Sidebar({ viewMode, onViewMode, hasTab, isAdmin, username, onExportPdf, onExportJpg, onEmailShare, onLogout }: Props) {
  const [exportOpen, setExportOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Sluit mobiele sidebar bij viewMode wijziging
  useEffect(() => { setSidebarOpen(false); }, [viewMode]);

  const { pathname } = useLocation();
  const isNewProject = pathname === '/projecten/new';

  const itemClass = (active: boolean) =>
    `block w-full text-left px-3 py-2 rounded-[6px] text-[14px] transition-all duration-150 cursor-pointer ${
      active
        ? 'bg-accent-teal text-[#1a3a38] font-medium'
        : 'text-[rgba(255,255,255,0.7)] hover:bg-accent-teal/30 hover:text-white'
    }`;

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex-shrink-0 mb-4 px-3">
        <MegawattLogo />
      </div>

      {/* Search */}
      <div className="flex-shrink-0 mb-3">
        <GlobalSearch />
      </div>

      {/* Menu sections */}
      <nav className="flex-1 flex flex-col gap-[2px] overflow-y-auto">
        {PERMISSION_GROUPS.filter((g) => g.items.some((it) => hasTab(it.key))).map((group, idx) => (
          <div key={group.group}>
            {idx > 0 && <div className="border-t border-[rgba(255,255,255,0.06)] my-2" />}
            <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[rgba(255,255,255,0.4)]">
              {group.group}
            </div>
            {group.items.filter((it) => hasTab(it.key)).map((item) => (
              item.key === 'nieuw-project' ? (
                <Link
                  key={item.key}
                  to="/projecten/new"
                  onClick={() => setSidebarOpen(false)}
                  className={`w-full flex items-center gap-2 mb-1 px-3 py-2 rounded-[6px] text-[14px] font-semibold transition-all duration-150 ${
                    isNewProject
                      ? 'bg-[#ffff00] text-[#1a3a38]'
                      : 'bg-[#ffff00]/10 text-[#ffff00] hover:bg-[#ffff00] hover:text-[#1a3a38]'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.key}
                  onClick={() => onViewMode(item.key as ViewMode)}
                  className={`${itemClass(viewMode === item.key && !isNewProject)} pl-5`}
                >
                  {item.label}
                </button>
              )
            ))}
          </div>
        ))}
      </nav>

      {/* Sticky bottom acties */}
      <div className="flex-shrink-0 pt-3 border-t border-[rgba(255,255,255,0.08)] mt-auto flex flex-col gap-1">
        {/* Export dropdown */}
        <div ref={exportRef} className="relative">
          <button
            onClick={() => setExportOpen(!exportOpen)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-[6px] text-[14px] text-[rgba(255,255,255,0.7)] hover:text-[rgba(255,255,255,0.9)] cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15" />
            </svg>
            Exporteren
          </button>
          {exportOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-bg-surface rounded-lg ring-1 ring-[rgba(255,255,255,0.12)] shadow-2xl overflow-hidden">
              <button onClick={() => { setExportOpen(false); onExportPdf(); }} className="w-full text-left px-3 py-2 text-[13px] text-white/80 hover:bg-white/8 cursor-pointer">📄 PDF</button>
              <button onClick={() => { setExportOpen(false); onExportJpg(); }} className="w-full text-left px-3 py-2 text-[13px] text-white/80 hover:bg-white/8 cursor-pointer">🖼 JPG</button>
              {localStorage.getItem('token') && (
                <button onClick={() => { setExportOpen(false); onEmailShare(); }} className="w-full text-left px-3 py-2 text-[13px] text-white/80 hover:bg-white/8 cursor-pointer">✉ E-mail</button>
              )}
            </div>
          )}
        </div>

        {isAdmin && (
          <Link to="/admin" className="flex items-center gap-2 px-3 py-2 rounded-[6px] text-[14px] text-[rgba(255,255,255,0.7)] hover:text-[rgba(255,255,255,0.9)]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.248a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.248a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            Admin panel
          </Link>
        )}

        {username && (
          <p className="text-text-muted text-xs px-3 mt-2">Ingelogd als {username}</p>
        )}
        <button
          onClick={onLogout}
          className="mt-1 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[6px] bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] font-medium hover:bg-red-500/20 hover:text-red-300 transition-all duration-150 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
          </svg>
          Uitloggen
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[220px] min-w-[220px] bg-bg-surface border-r border-[rgba(255,255,255,0.08)] flex-col h-screen sticky top-0 p-5 gap-0">
        {sidebarContent}
      </aside>

      {/* Mobile trigger button (positioned absolutely) */}
      <button onClick={() => setSidebarOpen(true)} className="md:hidden fixed top-3 left-3 z-30 w-9 h-9 rounded-lg bg-bg-surface ring-1 ring-[rgba(255,255,255,0.15)] flex items-center justify-center text-white">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <aside className="absolute left-0 top-0 bottom-0 w-[220px] bg-bg-surface border-r border-[rgba(255,255,255,0.08)] flex flex-col p-5 gap-0" onClick={(e) => e.stopPropagation()}>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
