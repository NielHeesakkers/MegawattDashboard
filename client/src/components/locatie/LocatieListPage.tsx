interface Props { onOpenDetail: (id: number | 'new') => void; }
export default function LocatieListPage(_props: Props) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-white mb-6">Locaties</h1>
      <div className="text-[rgba(255,255,255,0.5)] text-sm">Lijst volgt in Task 13.</div>
    </div>
  );
}
