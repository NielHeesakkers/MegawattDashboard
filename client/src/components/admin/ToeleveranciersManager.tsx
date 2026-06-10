import { useState } from 'react';
import { fetchToeleveranciers, createToeleverancier, updateToeleverancier, deleteToeleverancier, refreshToeleverancierLogo, Toeleverancier } from '../../api';
import ContactenManager from './ContactenManager';
import { useSpecialismes } from '../../hooks/useSpecialismes';

// ─── Instellingen tab ────────────────────────────────────────────────────────

function InstellingenTab() {
  const { specialismes, addSpecialisme, removeSpecialisme } = useSpecialismes();
  const [newNaam, setNewNaam] = useState('');
  const [adding, setAdding] = useState(false);
  const [showInput, setShowInput] = useState(false);

  async function handleAdd() {
    if (!newNaam.trim()) return;
    setAdding(true);
    try {
      await addSpecialisme(newNaam.trim());
      setNewNaam('');
      setShowInput(false);
    } finally {
      setAdding(false);
    }
  }

  const handleDelete = removeSpecialisme;

  return (
    <div className="max-w-lg">
      <h2 className="text-lg font-semibold text-white mb-1">Specialismes</h2>
      <p className="text-sm text-white/50 mb-5">
        Definieer specialismes die je aan toeleveranciers kunt koppelen.
      </p>

      <div className="space-y-2 mb-4">
        {specialismes.length === 0 && (
          <p className="text-sm text-white/30 italic">Nog geen specialismes aangemaakt.</p>
        )}
        {specialismes.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/5 ring-1 ring-white/10"
          >
            <span className="text-sm text-white">{s.naam}</span>
            <button
              onClick={() => handleDelete(s.id)}
              className="text-white/30 hover:text-red-400 transition-colors cursor-pointer"
              title="Verwijderen"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {showInput ? (
        <div className="flex gap-2">
          <input
            autoFocus
            type="text"
            value={newNaam}
            onChange={(e) => setNewNaam(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setShowInput(false); setNewNaam(''); } }}
            placeholder="Naam specialisme…"
            className="flex-1 h-9 px-3 rounded-lg bg-white/5 ring-1 ring-white/15 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-accent"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newNaam.trim()}
            className="h-9 px-4 rounded-lg bg-accent text-black text-sm font-medium disabled:opacity-40 cursor-pointer hover:bg-accent/90 transition-colors"
          >
            Toevoegen
          </button>
          <button
            onClick={() => { setShowInput(false); setNewNaam(''); }}
            className="h-9 px-3 rounded-lg bg-white/5 ring-1 ring-white/10 text-sm text-white/50 hover:text-white cursor-pointer transition-colors"
          >
            Annuleer
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-xl bg-white/5 ring-1 ring-white/10 text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Specialisme toevoegen
        </button>
      )}
    </div>
  );
}

// ─── Hoofd component met tabs ────────────────────────────────────────────────

export default function ToeleveranciersManager() {
  const [activeTab, setActiveTab] = useState<'contact' | 'instellingen'>('contact');

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-white/10 pb-0">
        {(['contact', 'instellingen'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize rounded-t-lg transition-colors cursor-pointer ${
              activeTab === tab
                ? 'text-white border-b-2 border-accent -mb-px'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'contact' ? (
        <ContactenManager<Toeleverancier>
          title="Toeleveranciers"
          singular="toeleverancier"
          newButtonLabel="+ Toeleverancier"
          fetchAll={fetchToeleveranciers}
          create={createToeleverancier}
          update={updateToeleverancier}
          remove={deleteToeleverancier}
          refreshLogo={refreshToeleverancierLogo}
          showSpecialismes
          showProjectsCount
        />
      ) : (
        <InstellingenTab />
      )}
    </div>
  );
}
