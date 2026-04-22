import type { Location } from '../../api';

interface Props {
  location: Location;
  onClick: () => void;
}

function formatEUR(cents: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

export default function LocatieCard({ location, onClick }: Props) {
  const mainPhoto = location.photos.find((p) => p.isMain) ?? location.photos[0];
  const totalCents = location.costs.reduce((sum, c) => sum + c.bedragCents, 0);

  const chips: string[] = [];
  if (location.geschiktActivatie) chips.push('Activatie');
  if (location.geschiktSampling) chips.push('Sampling');
  if (location.stroom) chips.push('Stroom');
  if (location.verlichting) chips.push('Verlichting');
  if (location.vergunningNodig) chips.push('Vergunning');
  if (location.truckBereikbaar) chips.push('Bakwagen');
  if (location.eigendomType === 'particulier') chips.push('Particulier');
  else chips.push('Gemeentelijk');

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex text-left bg-[rgba(255,255,255,0.03)] ring-1 ring-[rgba(255,255,255,0.08)] hover:ring-[rgba(255,255,255,0.18)] rounded-xl overflow-hidden transition-all duration-150 cursor-pointer"
    >
      <div className="w-[130px] h-[130px] flex-shrink-0 bg-[rgba(255,255,255,0.05)]">
        {mainPhoto ? (
          <img src={`/uploads/Locaties/${location.id}/${mainPhoto.filename}`} alt={location.naam} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[rgba(255,255,255,0.2)]">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 p-3 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-white font-semibold text-[14px] truncate">{location.naam || 'Naamloos'}</h3>
          {totalCents > 0 && <span className="text-accent text-[12px] font-medium whitespace-nowrap">{formatEUR(totalCents)}</span>}
        </div>
        <div className="text-[rgba(255,255,255,0.5)] text-[12px] mb-2">
          {[location.land, location.m2 ? `${location.m2} m²` : null].filter(Boolean).join(' · ')}
        </div>
        <div className="flex flex-wrap gap-1 mt-auto">
          {chips.map((c) => (
            <span key={c} className="inline-flex items-center h-5 px-2 rounded text-[10px] font-medium bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.7)]">
              {c}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
