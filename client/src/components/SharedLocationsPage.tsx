import { useState, useEffect, FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { fetchSharedLocations, verifySharedLocations, SharedLocationsResponse, SharedLocation } from '../api';
import LocatieMap from './locatie/LocatieMap';

const MegawattLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28.35 5.67" className="h-7 w-auto">
    <path fill="#FFFF00" d="M27.47,3.24v-1.82h.87v-.63h-.87v-.79h-.67v2.96-.16s0,.45,0,.45c0,.67.29.96.96.96h.58v-.62h-.53c-.26,0-.34-.08-.34-.34h0ZM26.01,4.2h.58v-.62h-.53c-.26,0-.34-.08-.34-.34v-1.82h0s.87,0,.87,0v-.63h0s-.87,0-.87,0v-.79h-.67v.79h-.55v.63h.55v1.83c0,.67.29.96.96.96h0ZM24.53,3.58c-.13,0-.17-.03-.17-.18v-1.51c0-.83-.53-1.3-1.44-1.3-.87,0-1.43.42-1.52,1.13v.06s.66,0,.66,0v-.04c.07-.34.38-.54.84-.54.51,0,.81.24.81.66v.18h-.96c-.93,0-1.44.4-1.44,1.13,0,.65.52,1.06,1.33,1.06.47,0,.84-.16,1.12-.49.05.3.27.45.67.45h.36v-.62h-.23ZM23.69,2.74c0,.57-.4.92-1.04.92-.42,0-.7-.2-.7-.51,0-.35.23-.52.72-.52h1.02v.11h0ZM20.26,4.2l1.19-3.57h-.68l-.86,2.68-.82-2.68h-.6l-.87,2.68-.82-2.68h-.7l1.15,3.57h.69l.83-2.45.79,2.45h.69ZM16.23,3.58c-.13,0-.17-.03-.17-.18v-1.51c0-.83-.53-1.3-1.44-1.3-.87,0-1.43.42-1.52,1.13v.06s.66,0,.66,0v-.04c.07-.34.38-.54.84-.54.51,0,.81.24.81.66v.18h-.96c-.93,0-1.44.4-1.44,1.13,0,.65.52,1.06,1.33,1.06.47,0,.84-.16,1.12-.49.05.3.27.45.66.45h.36v-.62h-.23ZM15.4,2.74c0,.57-.4.92-1.04.92-.42,0-.7-.2-.7-.51,0-.35.23-.52.72-.52h1.02v.11h0ZM12.72,4.05V.63h-.58l-.06.49c-.25-.35-.65-.53-1.15-.53-1.01,0-1.72.75-1.72,1.82s.67,1.82,1.72,1.82c.49,0,.87-.17,1.13-.51v.3c0,.7-.35,1.04-1.06,1.04-.55,0-.92-.23-1-.63v-.04h-.68v.06c.1.76.71,1.22,1.65,1.22,1.17,0,1.77-.55,1.77-1.62h0ZM12.06,2.43c0,.71-.45,1.21-1.08,1.21s-1.09-.49-1.09-1.22.44-1.22,1.09-1.22,1.08.5,1.08,1.23h0ZM8.93,2.58c.01-.12.01-.22.01-.29-.03-1.04-.68-1.69-1.69-1.69s-1.69.75-1.69,1.82.71,1.82,1.77,1.82c.79,0,1.41-.5,1.56-1.24v-.04s-.67,0-.67,0v.02c-.11.42-.46.66-.93.66-.61,0-1.01-.41-1.04-1.06h2.69ZM8.23,2.01h-1.94c.07-.47.48-.82.97-.82.1,0,.2.01.29.03.39.09.65.37.69.79h0ZM4.61,4.2h.67v-2.05c0-.99-.5-1.56-1.36-1.56-.53,0-.94.21-1.19.6-.21-.38-.6-.6-1.1-.6-.4,0-.72.14-.97.44l-.06-.4h-.58v3.57h.67v-1.88c0-.67.34-1.11.86-1.11s.78.34.78.97v2.01h.67v-1.9c0-.68.33-1.08.87-1.08.63,0,.76.53.76.97v2.01h0Z"/>
  </svg>
);

const OMGEVING_LABELS: Record<string, string> = {
  centrum: 'Centrum', winkelstraat: 'Winkelstraat', park: 'Park', plein: 'Plein', stationsplein: 'Stationsplein',
};

function LocationCard({ loc }: { loc: SharedLocation }) {
  const main = loc.photos.find((p) => p.isMain) ?? loc.photos[0];
  const photoUrl = main ? `/uploads/Locaties/${loc.id}/${encodeURIComponent(main.filename)}` : null;
  const chips = [loc.stad, OMGEVING_LABELS[loc.omgevingType], loc.m2 != null ? `${loc.m2} m²` : null].filter(Boolean) as string[];
  return (
    <div className="bg-bg-surface rounded-[14px] border border-[rgba(255,255,255,0.08)] overflow-hidden flex flex-col">
      {photoUrl && (
        <div className="aspect-[16/10] bg-black/30">
          <img src={photoUrl} alt={loc.naam} loading="lazy" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-4 flex flex-col gap-1.5">
        <div className="flex items-baseline gap-2">
          {loc.code && <span className="font-mono text-[11px] text-accent-teal shrink-0">{loc.code}</span>}
          <h3 className="text-white font-semibold text-[15px] leading-tight">{loc.naam}</h3>
        </div>
        <p className="text-text-secondary text-[13px]">{loc.adres}</p>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {chips.map((c) => (
              <span key={c} className="px-2 py-0.5 rounded-full bg-white/5 text-white/70 text-[11px]">{c}</span>
            ))}
          </div>
        )}
      </div>
      {loc.lat != null && loc.lng != null && (
        <div className="mt-auto">
          <LocatieMap lat={loc.lat} lng={loc.lng} address={loc.adres} heightClass="h-[180px]" />
        </div>
      )}
    </div>
  );
}

export default function SharedLocationsPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedLocationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [pwError, setPwError] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchSharedLocations(token)
      .then(setData)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setVerifying(true);
    setPwError(false);
    try {
      const r = await verifySharedLocations(token, password);
      setData(r);
    } catch {
      setPwError(true);
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-bg-main flex items-center justify-center text-text-muted">Laden…</div>;
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center px-6">
        <div className="text-center">
          <div className="flex justify-center mb-6"><MegawattLogo /></div>
          <h1 className="text-white text-xl font-semibold mb-2">Link niet gevonden</h1>
          <p className="text-text-secondary text-sm">Deze deel-link bestaat niet (meer) of is ingetrokken.</p>
        </div>
      </div>
    );
  }

  const header = (
    <header className="border-b border-[rgba(255,255,255,0.08)] bg-bg-surface">
      <div className="max-w-6xl mx-auto px-6 py-5 flex items-center gap-4">
        <MegawattLogo />
        <div className="border-l border-[rgba(255,255,255,0.12)] pl-4">
          <p className="text-text-muted text-[11px] uppercase tracking-wider">Locatie-overzicht</p>
          <h1 className="text-white text-lg font-semibold leading-tight">{data.projectName}</h1>
          {data.klantName && <p className="text-text-secondary text-[13px]">{data.klantName}</p>}
        </div>
      </div>
    </header>
  );

  if (data.requiresPassword) {
    return (
      <div className="min-h-screen bg-bg-main">
        {header}
        <main className="max-w-md mx-auto px-6 py-16">
          <form onSubmit={submitPassword} className="bg-bg-surface rounded-[14px] border border-[rgba(255,255,255,0.08)] p-6">
            <h2 className="text-white font-semibold mb-1">Beveiligd overzicht</h2>
            <p className="text-text-secondary text-sm mb-4">Voer het wachtwoord in om de locaties te bekijken.</p>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Wachtwoord"
              className="w-full px-3 py-2 rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px] placeholder-[rgba(255,255,255,0.3)] focus:outline-none focus:border-accent-teal"
            />
            {pwError && <p className="text-red-400 text-[13px] mt-2">Onjuist wachtwoord.</p>}
            <button
              type="submit"
              disabled={verifying || !password}
              className="mt-4 w-full px-3 py-2 rounded-[8px] bg-[#ffff00] text-[#1a3a38] text-sm font-semibold hover:brightness-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {verifying ? 'Bezig…' : 'Bekijk locaties'}
            </button>
          </form>
        </main>
      </div>
    );
  }

  const locations = data.locations ?? [];
  return (
    <div className="min-h-screen bg-bg-main">
      {header}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {locations.length === 0 ? (
          <p className="text-text-muted">Nog geen locaties gekoppeld aan dit project.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {locations.map((loc) => <LocationCard key={loc.id} loc={loc} />)}
          </div>
        )}
      </main>
      <footer className="text-center text-text-muted text-xs py-8">Gedeeld via Megawatt Dashboard</footer>
    </div>
  );
}
