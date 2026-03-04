interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative w-full max-w-md mx-auto">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Zoek op naam of functie..."
        className="w-full pl-10 pr-8 py-2 rounded-[6px] bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] text-text-primary placeholder-text-muted text-[13px] focus:bg-[rgba(255,255,255,0.12)] focus:border-[rgba(255,255,255,0.25)] transition-all duration-150"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white text-lg leading-none px-1"
        >
          &times;
        </button>
      )}
    </div>
  );
}
