interface ClientRowProps {
  name: string;
  url: string | null;
  isHighlighted: boolean;
  isDimmed: boolean;
}

export default function ClientRow({ name, url, isHighlighted, isDimmed }: ClientRowProps) {
  return (
    <div
      className={`
        flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px]
        transition-all duration-150
        ${isHighlighted ? 'bg-accent-dim text-accent ring-1 ring-accent' : 'text-text-secondary'}
        ${isDimmed ? 'opacity-30' : ''}
      `}
    >
      <span className="truncate">{name}</span>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 text-text-muted hover:text-accent-teal transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>
      )}
    </div>
  );
}
