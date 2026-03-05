import { Executive } from '../../api';

export function matchesSearch(exec: Executive, query: string): boolean {
  if (!query) return false;
  const q = query.toLowerCase();
  return exec.name.toLowerCase().includes(q) || exec.role.toLowerCase().includes(q);
}

export function ExecutiveCard({ exec, isHighlighted, isDimmed, onClick, hasAccent }: { exec: Executive; isHighlighted: boolean; isDimmed: boolean; onClick?: (exec: Executive) => void; hasAccent?: number }) {
  return (
    <button
      onClick={() => onClick?.(exec)}
      className={`
        flex flex-col items-center p-4 rounded-[10px]
        transition-all duration-150 cursor-pointer
        ${hasAccent
          ? 'border border-accent/70 hover:border-accent/90'
          : 'bg-bg-card border border-border'}
        ${isHighlighted ? 'ring-2 ring-accent border-accent bg-accent-dim' : ''}
        ${isDimmed ? 'opacity-30' : ''}
      `}
      style={{
        animation: 'slideUp 0.3s ease-out',
        ...(hasAccent ? { backgroundColor: `rgba(255,255,255,${hasAccent})` } : {}),
      }}
      onMouseEnter={(e) => { if (hasAccent) e.currentTarget.style.backgroundColor = `rgba(255,255,255,${hasAccent + 0.05})`; }}
      onMouseLeave={(e) => { if (hasAccent) e.currentTarget.style.backgroundColor = `rgba(255,255,255,${hasAccent})`; }}
    >
      <div className="w-16 h-16 rounded-full overflow-hidden bg-[rgba(0,0,0,0.2)] mb-2">
        {exec.photo ? (
          <img src={exec.photo} alt={exec.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-vacancy">
            <svg className="w-8 h-8 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
        )}
      </div>
      <p className="text-sm font-semibold text-text-primary text-center">{exec.name}</p>
      <p className="text-xs text-accent-teal text-center">{exec.role}</p>
    </button>
  );
}
