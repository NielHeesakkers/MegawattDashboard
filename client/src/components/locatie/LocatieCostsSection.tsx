import type { LocationCost } from '../../api';

type CostInput = Omit<LocationCost, 'id' | 'locationId' | 'order'>;

interface Props {
  costs: CostInput[];
  onChange: (costs: CostInput[]) => void;
}

const inputClass = 'h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.08)] text-white text-[13px] focus:outline-none focus:ring-[rgba(255,255,255,0.2)]';

export default function LocatieCostsSection({ costs, onChange }: Props) {
  const add = () => onChange([...costs, { label: '', bedragCents: 0 }]);
  const remove = (i: number) => onChange(costs.filter((_, idx) => idx !== i));
  const upd = (i: number, patch: Partial<CostInput>) => onChange(costs.map((c, idx) => idx === i ? { ...c, ...patch } : c));

  const total = costs.reduce((sum, c) => sum + c.bedragCents, 0);

  return (
    <div>
      <div className="flex flex-col gap-3">
        {costs.map((c, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <input className={`${inputClass} col-span-6`} placeholder="Label (bv. Locatiehuur)" value={c.label} onChange={(e) => upd(i, { label: e.target.value })} />
            <div className="col-span-5 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.4)] text-[13px]">€</span>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.3)] text-[11px] pointer-events-none">/ dag</span>
              <input
                type="number"
                step="0.01"
                className={`${inputClass} w-full pl-7 pr-12`}
                placeholder="0,00"
                value={c.bedragCents === 0 ? '' : (c.bedragCents / 100).toFixed(2)}
                onChange={(e) => upd(i, { bedragCents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : 0 })}
              />
            </div>
            <button onClick={() => remove(i)} type="button" className="col-span-1 h-9 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 cursor-pointer" title="Verwijderen">
              <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166M18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79" /></svg>
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-3">
        <button onClick={add} type="button" className="h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.06)] ring-1 ring-[rgba(255,255,255,0.15)] text-white text-[12px] hover:bg-[rgba(255,255,255,0.12)] cursor-pointer">+ Kostenpost</button>
        <div className="text-white font-semibold text-[14px]">
          Totaal per dag: {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(total / 100)}
        </div>
      </div>
    </div>
  );
}
