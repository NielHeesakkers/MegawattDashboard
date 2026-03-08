import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [headerBottom, setHeaderBottom] = useState(52);

  useEffect(() => {
    if (open) {
      if (btnRef.current) {
        const header = btnRef.current.closest('header');
        if (header) setHeaderBottom(header.getBoundingClientRect().bottom);
      }
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Cmd/Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape' && open) {
        onChange('');
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onChange]);

  const close = () => {
    onChange('');
    setOpen(false);
  };

  const overlay = open ? createPortal(
    <div
      className="fixed left-0 right-0 bottom-0"
      style={{ top: headerBottom, zIndex: 9999 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-md animate-[fadeIn_150ms_ease-out]"
        onClick={close}
      />

      {/* Search container */}
      <div
        className="relative flex justify-center pointer-events-none animate-[slideDown_150ms_ease-out]"
        style={{ paddingTop: '15vh' }}
      >
        <div className="w-full max-w-lg mx-4 pointer-events-auto">
          <div className="bg-bg-surface rounded-xl ring-1 ring-[rgba(255,255,255,0.12)] shadow-2xl overflow-hidden">
            <div className="flex items-center px-4 gap-3">
              <svg
                className="w-5 h-5 text-[rgba(255,255,255,0.4)] flex-shrink-0"
                fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Zoek op naam of functie..."
                className="flex-1 h-12 bg-transparent text-white text-[15px] placeholder-[rgba(255,255,255,0.3)] outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') close();
                }}
              />
              {value ? (
                <button
                  onClick={() => { onChange(''); inputRef.current?.focus(); }}
                  className="text-[rgba(255,255,255,0.4)] hover:text-white transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ) : (
                <kbd className="text-[10px] text-[rgba(255,255,255,0.25)] bg-[rgba(255,255,255,0.06)] px-1.5 py-0.5 rounded font-mono">
                  ESC
                </kbd>
              )}
            </div>
            <div className="px-4 py-2 border-t border-[rgba(255,255,255,0.06)] text-[11px] text-[rgba(255,255,255,0.25)]">
              Typ om te zoeken in {value ? 'resultaten' : 'medewerkers, teams en klanten'}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(true)}
        className={`h-7 w-7 flex items-center justify-center rounded-lg ring-1 ring-[rgba(255,255,255,0.15)] transition-all duration-150 cursor-pointer ${
          value
            ? 'bg-accent text-bg-dark'
            : 'bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.5)] hover:bg-[rgba(255,255,255,0.12)] hover:text-white'
        }`}
        title="Zoeken (⌘K)"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>
      {overlay}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
