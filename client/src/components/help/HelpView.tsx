import { useState } from 'react';
import { PERMISSION_GROUPS } from '../../shared/permissions';
import { HELP_CONTENT, LOCATIE_MANAGEMENT } from './helpContent';

interface Props {
  hasTab: (key: string) => boolean;
}

const FLOW_ID = '__flow__';

/** Handleiding in het content-deel: een stappenplan-tab + een tab per groep. */
export default function HelpView({ hasTab }: Props) {
  // Groepen met minstens één onderdeel waar de gebruiker recht op heeft én content voor is.
  const groups = PERMISSION_GROUPS
    .map((g) => ({ id: g.group, label: g.group, items: g.items.filter((it) => hasTab(it.key) && HELP_CONTENT[it.key]) }))
    .filter((g) => g.items.length > 0);

  // Het stappenplan tonen wie locaties of projecten mag — dat is de doelgroep van deze flow.
  const showFlow = hasTab('locaties') || hasTab('nieuw-project') || hasTab('projecten-actief');

  const tabs = [
    ...(showFlow ? [{ id: FLOW_ID, label: 'Locatie management' }] : []),
    ...groups.map((g) => ({ id: g.id, label: g.label })),
  ];

  const [active, setActive] = useState(tabs[0]?.id ?? '');
  const activeGroup = groups.find((g) => g.id === active);

  return (
    <div className="px-6 py-7 max-w-3xl">
      <h1 className="text-white text-2xl font-semibold flex items-center gap-2.5 mb-5">
        <svg className="w-6 h-6 text-accent-teal" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
        </svg>
        Handleiding
      </h1>

      {tabs.length === 0 ? (
        <p className="text-[rgba(255,255,255,0.5)] text-sm">Er is voor jouw toegang nog geen handleiding beschikbaar.</p>
      ) : (
        <>
          {/* Tabs: stappenplan + groepen */}
          <div className="flex flex-wrap gap-1 border-b border-[rgba(255,255,255,0.08)] pb-2 mb-6">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${
                  active === t.id
                    ? 'bg-accent-teal text-[#1a3a38]'
                    : 'text-[rgba(255,255,255,0.6)] hover:text-white hover:bg-[rgba(255,255,255,0.06)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {active === FLOW_ID ? (
            LOCATIE_MANAGEMENT
          ) : (
            activeGroup?.items.map((it) => (
              <section key={it.key} className="mb-9 last:mb-0">
                <h2 className="text-[#ffff00] text-[17px] font-semibold mb-3 pb-1.5 border-b border-[rgba(255,255,255,0.07)]">{it.label}</h2>
                {HELP_CONTENT[it.key]}
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}
