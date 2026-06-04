import type { LocationContact } from '../../api';
import { formatPhone } from '../../shared/phone';

type ContactInput = Omit<LocationContact, 'id' | 'locationId' | 'order'>;

interface Props {
  contacts: ContactInput[];
  onChange: (contacts: ContactInput[]) => void;
}

const inputClass = 'h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.08)] text-white text-[13px] focus:outline-none focus:ring-[rgba(255,255,255,0.2)]';

export default function LocatieContactsSection({ contacts, onChange }: Props) {
  // Garandeer altijd minstens één rij (niet verwijderbaar).
  const rows = contacts.length === 0 ? [{ naam: '', email: null, telefoon: null, website: null, rol: null }] : contacts;
  const add = () => onChange([...rows, { naam: '', email: null, telefoon: null, website: null, rol: null }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const upd = (i: number, patch: Partial<ContactInput>) => onChange(rows.map((c, idx) => idx === i ? { ...c, ...patch } : c));

  return (
    <div>
      <div className="flex flex-col gap-4">
        {rows.map((c, i) => (
          <div key={i} className="rounded-lg bg-[rgba(255,255,255,0.02)] ring-1 ring-[rgba(255,255,255,0.05)] p-3 relative">
            {/* Regel 1: Naam, E-mail, Telefoon */}
            <div className="grid grid-cols-12 gap-2 mb-2">
              <input className={`${inputClass} col-span-4`} placeholder="Naam" value={c.naam} onChange={(e) => upd(i, { naam: e.target.value })} />
              <input className={`${inputClass} col-span-4`} placeholder="E-mail" value={c.email ?? ''} onChange={(e) => upd(i, { email: e.target.value || null })} />
              <input className={`${inputClass} col-span-4`} placeholder="Telefoon" value={c.telefoon ?? ''} onChange={(e) => upd(i, { telefoon: e.target.value || null })} onBlur={(e) => { const f = formatPhone(e.target.value); if (f !== e.target.value) upd(i, { telefoon: f || null }); }} />
            </div>
            {/* Regel 2: Website, Functie */}
            <div className="grid grid-cols-12 gap-2">
              <input className={`${inputClass} col-span-7`} placeholder="Website" value={c.website ?? ''} onChange={(e) => upd(i, { website: e.target.value || null })} />
              <input className={`${inputClass} col-span-5`} placeholder="Functie" value={c.rol ?? ''} onChange={(e) => upd(i, { rol: e.target.value || null })} />
            </div>
            {i > 0 && (
              <button onClick={() => remove(i)} className="absolute top-2 right-2 w-6 h-6 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 cursor-pointer flex items-center justify-center" title="Verwijderen" type="button">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        ))}
      </div>
      <button onClick={add} type="button" className="mt-3 h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.06)] ring-1 ring-[rgba(255,255,255,0.15)] text-white text-[12px] hover:bg-[rgba(255,255,255,0.12)] cursor-pointer">+ Contact toevoegen</button>
    </div>
  );
}
