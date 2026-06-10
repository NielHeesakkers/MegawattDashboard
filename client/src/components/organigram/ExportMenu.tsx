import { useState, useRef, useEffect } from 'react';

interface Props {
  onPdf: () => void;
  onJpg: () => void;
  onEmail?: () => void;
}

/** Compacte "Exporteren"-dropdown (PDF/JPG/E-mail) — alleen relevant op Organigram + Klantteams. */
export default function ExportMenu({ onPdf, onJpg, onEmail }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.06)] ring-1 ring-[rgba(255,255,255,0.12)] text-[13px] text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.12)] hover:text-white transition-all duration-150 cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15" />
        </svg>
        Exporteren
        <svg className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-40 bg-bg-surface rounded-lg ring-1 ring-[rgba(255,255,255,0.12)] shadow-2xl overflow-hidden">
          <button onClick={() => { setOpen(false); onPdf(); }} className="w-full text-left px-3 py-2 text-[13px] text-white/80 hover:bg-white/8 cursor-pointer">📄 PDF</button>
          <button onClick={() => { setOpen(false); onJpg(); }} className="w-full text-left px-3 py-2 text-[13px] text-white/80 hover:bg-white/8 cursor-pointer">🖼 JPG</button>
          {onEmail && (
            <button onClick={() => { setOpen(false); onEmail(); }} className="w-full text-left px-3 py-2 text-[13px] text-white/80 hover:bg-white/8 cursor-pointer">✉ E-mail</button>
          )}
        </div>
      )}
    </div>
  );
}
