import { useState, useEffect, useRef } from 'react';
import { fetchClientTeams, fetchExecutives, ClientTeam, Executive, Member } from '../../api';
import { ExecutiveCard, matchesSearch } from './ExecutiveSection';
import ClientTeamColumn from './ClientTeamColumn';
import MemberModal from './MemberModal';
import ExecutiveModal from './ExecutiveModal';

interface KlantteamsViewProps {
  searchQuery: string;
  captureRef: React.RefObject<HTMLDivElement | null>;
}

export default function KlantteamsView({ searchQuery, captureRef }: KlantteamsViewProps) {
  const [clientTeams, setClientTeams] = useState<ClientTeam[]>([]);
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedExec, setSelectedExec] = useState<Executive | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const execRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [connLine, setConnLine] = useState<{ left: number; width: number; top: number } | null>(null);

  useEffect(() => {
    Promise.all([fetchClientTeams(), fetchExecutives()])
      .then(([ct, e]) => { setClientTeams(ct); setExecutives(e); })
      .finally(() => setLoading(false));
  }, []);

  // Get unique executives assigned to client teams
  const assignedExecIds = [...new Set(clientTeams.map((t) => t.executiveId).filter(Boolean))] as number[];
  const assignedExecs = assignedExecIds
    .map((id) => executives.find((e) => e.id === id))
    .filter(Boolean) as Executive[];

  // Measure connecting line between executives
  useEffect(() => {
    const measure = () => {
      if (assignedExecs.length < 2 || !containerRef.current) return;
      const container = containerRef.current.getBoundingClientRect();
      const firstRef = execRefs.current.get(assignedExecs[0].id);
      const lastRef = execRefs.current.get(assignedExecs[assignedExecs.length - 1].id);
      if (!firstRef || !lastRef) return;
      const first = firstRef.getBoundingClientRect();
      const last = lastRef.getBoundingClientRect();
      setConnLine({
        left: first.right - container.left + 4,
        width: last.left - first.right - 8,
        top: first.top + first.height / 2 - container.top,
      });
    };
    requestAnimationFrame(() => requestAnimationFrame(measure));
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [clientTeams, executives]);

  const hasSearch = searchQuery.length > 0;

  // Group teams by executive
  const execTeamMap = new Map<number | null, ClientTeam[]>();
  for (const team of clientTeams) {
    const key = team.executiveId;
    const existing = execTeamMap.get(key) || [];
    existing.push(team);
    execTeamMap.set(key, existing);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-accent text-lg">Laden...</div>
      </div>
    );
  }

  if (clientTeams.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-text-muted text-sm">Nog geen klantteams aangemaakt. Ga naar Beheer om klantteams toe te voegen.</p>
      </div>
    );
  }

  return (
    <>
      <div ref={captureRef} id="organigram-capture" className="mx-auto px-6 py-8 overflow-x-auto">
        <div ref={containerRef} className="relative">
          {/* Connecting line between executives (positioned relative to containerRef) */}
          {connLine && (
            <div
              className="absolute h-0.5 bg-accent z-10"
              style={{ left: connLine.left, width: connLine.width, top: connLine.top }}
            />
          )}
          {/* Executives row */}
          {assignedExecs.length > 0 && (
            <div className="flex flex-col items-center mb-0">
              <div className="flex justify-center gap-16">
                {assignedExecs.map((exec) => (
                  <div
                    key={exec.id}
                    ref={(el) => { if (el) execRefs.current.set(exec.id, el); }}
                    className="flex flex-col items-center"
                  >
                    <ExecutiveCard
                      exec={exec}
                      isHighlighted={hasSearch && matchesSearch(exec, searchQuery)}
                      isDimmed={hasSearch && !matchesSearch(exec, searchQuery)}
                      onClick={setSelectedExec}
                      hasAccent={0.09}
                    />
                  </div>
                ))}
              </div>
              <div className="w-0.5 h-8 bg-accent" />
            </div>
          )}

          {/* Horizontal bar + team columns */}
          <div className="flex relative" style={{ minWidth: `${clientTeams.length * 200}px` }}>
            {clientTeams.map((team, i) => (
              <div
                key={team.id}
                className="flex-1 flex flex-col items-center relative"
              >
                {/* Horizontal bar */}
                <div
                  className="absolute top-0 h-0.5 bg-accent"
                  style={{
                    left: i === 0 ? '50%' : 0,
                    right: i === clientTeams.length - 1 ? '50%' : 0,
                  }}
                />
                {/* Vertical connector */}
                <div className="w-0.5 h-8 bg-accent" />
                {/* Team column */}
                <div className="w-full px-2">
                  <ClientTeamColumn
                    team={team}
                    searchQuery={searchQuery}
                    onMemberClick={(m) => setSelectedMember(m)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <MemberModal member={selectedMember} onClose={() => setSelectedMember(null)} />
      <ExecutiveModal executive={selectedExec} onClose={() => setSelectedExec(null)} />
    </>
  );
}
