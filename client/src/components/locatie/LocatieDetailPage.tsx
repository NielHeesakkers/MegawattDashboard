interface Props { locationId: number | 'new'; onBack: () => void; onDeleted: () => void; }
export default function LocatieDetailPage({ locationId, onBack }: Props) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <button onClick={onBack} className="text-accent text-sm mb-4 cursor-pointer">← Terug</button>
      <h1 className="text-2xl font-semibold text-white">{locationId === 'new' ? 'Nieuwe locatie' : `Locatie #${locationId}`}</h1>
      <p className="text-[rgba(255,255,255,0.5)] text-sm mt-4">Detail-formulier volgt in Tasks 14-19.</p>
    </div>
  );
}
