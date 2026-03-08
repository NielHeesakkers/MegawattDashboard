import { ClientTeam, ClientTeamMemberWithMember, Member } from '../../api';
import ClientRow from './ClientRow';

interface ClientTeamColumnProps {
  team: ClientTeam;
  searchQuery: string;
  onMemberClick: (member: Member) => void;
}

function matchesClientSearch(name: string, query: string): boolean {
  return name.toLowerCase().includes(query.toLowerCase());
}

function getPersonInfo(ctm: ClientTeamMemberWithMember) {
  const person = ctm.member || ctm.executive;
  return person ? { name: person.name, photo: person.photo, role: person.role } : null;
}

export default function ClientTeamColumn({ team, searchQuery, onMemberClick }: ClientTeamColumnProps) {
  const hasSearch = searchQuery.length > 0;
  const cls = team.members.filter((m) => m.role === 'CL');
  const pms = team.members.filter((m) => m.role === 'PM');

  const teamMatches = hasSearch && (
    matchesClientSearch(team.name, searchQuery) ||
    team.members.some((m) => { const p = getPersonInfo(m); return p && matchesClientSearch(p.name, searchQuery); }) ||
    team.clients.some((c) => matchesClientSearch(c.name, searchQuery))
  );

  return (
    <div className="flex flex-col min-w-[180px]">
      {/* Team header */}
      <div className="text-center mb-3 pb-2 border-b border-[rgba(255,255,255,0.1)]">
        <h3 className="text-[11px] font-bold uppercase tracking-[1px] text-accent">
          {team.name}
        </h3>
      </div>

      {/* CL's */}
      {cls.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] font-semibold text-accent-teal uppercase tracking-[0.8px] mb-1">{cls.length === 1 ? 'Client Lead' : 'Client Leads'}</p>
          <div className="flex flex-col gap-1.5">
            {cls.map((cl) => {
              const person = getPersonInfo(cl);
              if (!person) return null;
              return (
                <button
                  key={cl.id}
                  onClick={() => cl.member && onMemberClick(cl.member)}
                  className={`
                    w-full flex items-center gap-2.5 p-2 rounded-[10px] text-left
                    border transition-all duration-150 cursor-pointer
                    bg-[rgba(255,255,255,0.08)] border-accent/40 hover:bg-[rgba(255,255,255,0.12)] hover:border-accent/60
                    ${hasSearch && matchesClientSearch(person.name, searchQuery) ? 'ring-2 ring-accent border-accent bg-accent-dim' : ''}
                    ${hasSearch && !matchesClientSearch(person.name, searchQuery) && !teamMatches ? 'opacity-30' : ''}
                  `}
                  style={{ animation: 'slideUp 0.3s ease-out' }}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-[rgba(0,0,0,0.2)]">
                    {person.photo ? (
                      <img src={person.photo} alt={person.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-vacancy">
                        <svg className="w-5 h-5 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium leading-tight truncate text-accent">{person.name}</p>
                    <p className="text-[11px] leading-tight mt-0.5 truncate text-text-secondary">{person.role}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* PM's */}
      {pms.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-accent-teal uppercase tracking-[0.8px] mb-1">Project Managers</p>
          <div className="flex flex-col gap-1.5">
            {pms.map((pm) => {
              const person = getPersonInfo(pm);
              if (!person) return null;
              return (
                <button
                  key={pm.id}
                  onClick={() => pm.member && onMemberClick(pm.member)}
                  className={`
                    w-full flex items-center gap-2 p-1.5 rounded-[8px] text-left
                    border transition-all duration-150 cursor-pointer
                    bg-bg-card border-border hover:border-border-hover hover:bg-bg-card-hover
                    ${hasSearch && matchesClientSearch(person.name, searchQuery) ? 'ring-2 ring-accent border-accent bg-accent-dim' : ''}
                    ${hasSearch && !matchesClientSearch(person.name, searchQuery) && !teamMatches ? 'opacity-30' : ''}
                  `}
                  style={{ animation: 'slideUp 0.3s ease-out' }}
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-[rgba(0,0,0,0.2)]">
                    {person.photo ? (
                      <img src={person.photo} alt={person.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-vacancy">
                        <svg className="w-4 h-4 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium leading-tight truncate text-accent">{person.name}</p>
                    <p className="text-[10px] leading-tight mt-0.5 truncate text-text-secondary">{person.role}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Clients */}
      {team.clients.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.8px] mb-1">Klanten</p>
          <div className="bg-[rgba(255,255,255,0.03)] rounded-lg p-1.5 border border-[rgba(255,255,255,0.06)]">
            {team.clients.map((client) => (
              <ClientRow
                key={client.id}
                name={client.name}
                url={client.url}
                isHighlighted={hasSearch && matchesClientSearch(client.name, searchQuery)}
                isDimmed={hasSearch && !matchesClientSearch(client.name, searchQuery) && !teamMatches}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
