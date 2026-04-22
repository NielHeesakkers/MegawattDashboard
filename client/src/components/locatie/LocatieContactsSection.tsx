import type { LocationContact } from '../../api';

type ContactInput = Omit<LocationContact, 'id' | 'locationId' | 'order'>;

interface Props {
  contacts: ContactInput[];
  onChange: (contacts: ContactInput[]) => void;
}

const inputClass = 'h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.08)] text-white text-[13px] focus:outline-none focus:ring-[rgba(255,255,255,0.2)]';

export default function LocatieContactsSection({ contacts, onChange }: Props) {
  const add = () => onChange([...contacts, { naam: '', email: null, telefoon: null, website: null, rol: null }]);
  const remove = (i: number) => onChange(contacts.filter((_, idx) => idx !== i));
  const upd = (i: number, patch: Partial<ContactInput>) => onChange(contacts.map((c, idx) => idx === i ? { ...c, ...patch } : c));

  return (
    <div>
      <div className="flex flex-col gap-3">
        {contacts.map((c, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <input className={`${inputClass} col-span-3`} placeholder="Naam" value={c.naam} onChange={(e) => upd(i, { naam: e.target.value })} />
            <input className={`${inputClass} col-span-3`} placeholder="E-mail" value={c.email ?? ''} onChange={(e) => upd(i, { email: e.target.value || null })} />
            <input className={`${inputClass} col-span-2`} placeholder="Telefoon" value={c.telefoon ?? ''} onChange={(e) => upd(i, { telefoon: e.target.value || null })} />
            <input className={`${inputClass} col-span-2`} placeholder="Website" value={c.website ?? ''} onChange={(e) => upd(i, { website: e.target.value || null })} />
            <input className={`${inputClass} col-span-1`} placeholder="Rol" value={c.rol ?? ''} onChange={(e) => upd(i, { rol: e.target.value || null })} />
            <button onClick={() => remove(i)} className="col-span-1 h-9 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 cursor-pointer" title="Verwijderen" type="button">
              <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
            </button>
          </div>
        ))}
      </div>
      <button onClick={add} type="button" className="mt-3 h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.06)] ring-1 ring-[rgba(255,255,255,0.15)] text-white text-[12px] hover:bg-[rgba(255,255,255,0.12)] cursor-pointer">+ Contact toevoegen</button>
    </div>
  );
}
