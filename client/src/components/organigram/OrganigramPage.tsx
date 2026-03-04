import { useState, useEffect, useRef } from 'react';
import { fetchTeams, fetchExecutives, Team, Executive, Member } from '../../api';
import { ExecutiveCard, matchesSearch } from './ExecutiveSection';
import TeamColumn from './TeamColumn';
import MemberModal from './MemberModal';
import SearchBar from './SearchBar';

function MegawattLogo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28.35 5.67" className="h-8 w-auto">
      <path fill="#FFFF00" d="M27.47,3.24v-1.82h.87v-.63h-.87v-.79h-.67v2.96-.16s0,.45,0,.45c0,.67.29.96.96.96h.58v-.62h-.53c-.26,0-.34-.08-.34-.34h0ZM26.01,4.2h.58v-.62h-.53c-.26,0-.34-.08-.34-.34v-1.82h0s.87,0,.87,0v-.63h0s-.87,0-.87,0v-.79h-.67v.79h-.55v.63h.55v1.83c0,.67.29.96.96.96h0ZM24.53,3.58c-.13,0-.17-.03-.17-.18v-1.51c0-.83-.53-1.3-1.44-1.3-.87,0-1.43.42-1.52,1.13v.06s.66,0,.66,0v-.04c.07-.34.38-.54.84-.54.51,0,.81.24.81.66v.18h-.96c-.93,0-1.44.4-1.44,1.13,0,.65.52,1.06,1.33,1.06.47,0,.84-.16,1.12-.49.05.3.27.45.67.45h.36v-.62h-.23ZM23.69,2.74c0,.57-.4.92-1.04.92-.42,0-.7-.2-.7-.51,0-.35.23-.52.72-.52h1.02v.11h0ZM20.26,4.2l1.19-3.57h-.68l-.86,2.68-.82-2.68h-.6l-.87,2.68-.82-2.68h-.7l1.15,3.57h.69l.83-2.45.79,2.45h.69ZM16.23,3.58c-.13,0-.17-.03-.17-.18v-1.51c0-.83-.53-1.3-1.44-1.3-.87,0-1.43.42-1.52,1.13v.06s.66,0,.66,0v-.04c.07-.34.38-.54.84-.54.51,0,.81.24.81.66v.18h-.96c-.93,0-1.44.4-1.44,1.13,0,.65.52,1.06,1.33,1.06.47,0,.84-.16,1.12-.49.05.3.27.45.66.45h.36v-.62h-.23ZM15.4,2.74c0,.57-.4.92-1.04.92-.42,0-.7-.2-.7-.51,0-.35.23-.52.72-.52h1.02v.11h0ZM12.72,4.05V.63h-.58l-.06.49c-.25-.35-.65-.53-1.15-.53-1.01,0-1.72.75-1.72,1.82s.67,1.82,1.72,1.82c.49,0,.87-.17,1.13-.51v.3c0,.7-.35,1.04-1.06,1.04-.55,0-.92-.23-1-.63v-.04h-.68v.06c.1.76.71,1.22,1.65,1.22,1.17,0,1.77-.55,1.77-1.62h0ZM12.06,2.43c0,.71-.45,1.21-1.08,1.21s-1.09-.49-1.09-1.22.44-1.22,1.09-1.22,1.08.5,1.08,1.23h0ZM8.93,2.58c.01-.12.01-.22.01-.29-.03-1.04-.68-1.69-1.69-1.69s-1.69.75-1.69,1.82.71,1.82,1.77,1.82c.79,0,1.41-.5,1.56-1.24v-.04s-.67,0-.67,0v.02c-.11.42-.46.66-.93.66-.61,0-1.01-.41-1.04-1.06h2.69ZM8.23,2.01h-1.94c.07-.47.48-.82.97-.82.1,0,.2.01.29.03.39.09.65.37.69.79h0ZM4.61,4.2h.67v-2.05c0-.99-.5-1.56-1.36-1.56-.53,0-.94.21-1.19.6-.21-.38-.6-.6-1.1-.6-.4,0-.72.14-.97.44l-.06-.4h-.58v3.57h.67v-1.88c0-.67.34-1.11.86-1.11s.78.34.78.97v2.01h.67v-1.9c0-.68.33-1.08.87-1.08.63,0,.76.53.76.97v2.01h0Z"/>
    </svg>
  );
}

type OrgBranch =
  | { kind: 'team'; team: Team }
  | { kind: 'director'; director: Executive; childTeams: Team[] };

export default function OrganigramPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const captureRef = useRef<HTMLDivElement>(null);
  const branchContainerRef = useRef<HTMLDivElement>(null);
  const richardCardRef = useRef<HTMLDivElement>(null);
  const rachelleCardRef = useRef<HTMLDivElement>(null);
  const [connLine, setConnLine] = useState<{ left: number; width: number; top: number } | null>(null);

  useEffect(() => {
    Promise.all([fetchTeams(), fetchExecutives()])
      .then(([t, e]) => { setTeams(t); setExecutives(e); })
      .finally(() => setLoading(false));
  }, []);

  // Measure Richard ↔ Rachelle connecting line position
  useEffect(() => {
    const measure = () => {
      if (!richardCardRef.current || !rachelleCardRef.current || !branchContainerRef.current) return;
      const container = branchContainerRef.current.getBoundingClientRect();
      const richard = richardCardRef.current.getBoundingClientRect();
      const rachelle = rachelleCardRef.current.getBoundingClientRect();
      setConnLine({
        left: richard.right - container.left + 4,
        width: rachelle.left - richard.right - 8,
        top: richard.top + richard.height / 2 - container.top,
      });
    };
    // Wait for DOM to be painted before measuring
    requestAnimationFrame(() => requestAnimationFrame(measure));
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [teams, executives]);

  const handleExportPdf = async () => {
    if (!captureRef.current) return;
    const { toJpeg } = await import('html-to-image');
    const { jsPDF } = await import('jspdf');

    const el = captureRef.current;
    const fullW = el.scrollWidth;
    const fullH = el.scrollHeight;

    // Temporarily expand the container so the full organigram is visible
    const origStyles = {
      overflow: el.style.overflow,
      width: el.style.width,
      background: el.style.background,
    };
    el.style.overflow = 'visible';
    el.style.width = `${fullW}px`;
    el.style.background = 'linear-gradient(135deg, #0f1f1d 0%, #1a3a38 50%, #1f4340 100%)';

    // Wait for repaint
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    // html-to-image clones the DOM, inlines ALL computed styles,
    // embeds images as data URIs, and renders via the browser's own engine
    const dataUrl = await toJpeg(el, {
      width: fullW,
      height: fullH,
      quality: 0.95,
      backgroundColor: '#0f1f1d',
      pixelRatio: 2,
    });

    // Restore original styles
    el.style.overflow = origStyles.overflow;
    el.style.width = origStyles.width;
    el.style.background = origStyles.background;

    // Build PDF from the image
    const img = new Image();
    img.src = dataUrl;
    await new Promise((r) => { img.onload = r; });

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [img.width / 2, img.height / 2],
    });
    pdf.addImage(dataUrl, 'JPEG', 0, 0, img.width / 2, img.height / 2);
    pdf.save('MEGAWATT-Organigram.pdf');
  };

  const ceo = executives.find((e) => e.level === 0);
  const directors = executives.filter((e) => e.level === 1);
  const hasSearch = searchQuery.length > 0;

  // Build branch tree dynamically from executiveId relationships
  // Teams are already sorted by `order` from the API
  // Teams under CEO (level 0) are direct branches; teams under directors (level 1+) are grouped
  const ceoId = ceo?.id;
  const branches: OrgBranch[] = [];
  const directorGroupMap = new Map<number, { director: Executive; childTeams: Team[] }>();

  // First pass: group teams by their director (level 1+) executiveId
  for (const team of teams) {
    if (team.members.length === 0) continue;
    if (team.executiveId && team.executiveId !== ceoId) {
      const existing = directorGroupMap.get(team.executiveId);
      if (existing) {
        existing.childTeams.push(team);
      } else {
        const director = directors.find((d) => d.id === team.executiveId);
        if (director) {
          directorGroupMap.set(team.executiveId, { director, childTeams: [team] });
        }
      }
    }
  }

  // Second pass: build branches in team order
  const usedDirectors = new Set<number>();
  for (const team of teams) {
    if (team.members.length === 0) continue;
    const isDirectorTeam = team.executiveId && team.executiveId !== ceoId;
    if (isDirectorTeam) {
      if (!usedDirectors.has(team.executiveId!)) {
        usedDirectors.add(team.executiveId!);
        const group = directorGroupMap.get(team.executiveId!);
        if (group) {
          branches.push({ kind: 'director', ...group });
        }
      }
    } else {
      // CEO-direct team (executiveId is CEO or null)
      branches.push({ kind: 'team', team });
    }
  }

  // Find directors for ref attachment
  const richardBranchIdx = branches.findIndex(b => b.kind === 'director' && b.director.name.includes('Richard'));
  const rachelleBranchIdx = branches.findIndex(b => b.kind === 'director' && b.director.name.includes('Rachelle'));

  const memberClick = (m: Member, team: Team) => setSelectedMember({ ...m, team });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-accent text-lg">Laden...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[rgba(15,31,29,0.9)] backdrop-blur-md border-b border-[rgba(255,255,255,0.08)]">
        <div className="mx-auto px-6 py-3 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-shrink-0">
            <MegawattLogo />
          </div>
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <div className="flex-shrink-0 flex items-center gap-2">
            <a
              href="/admin"
              className="p-[6px] rounded-[6px] bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.15)] text-[rgba(255,255,255,0.5)] hover:bg-[rgba(255,255,255,0.15)] hover:text-white transition-all duration-150"
              title="Beheer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.248a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.248a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </a>
            <button
              onClick={handleExportPdf}
              className="px-4 py-[6px] rounded-[6px] bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.15)] text-[rgba(255,255,255,0.7)] text-[13px] hover:bg-[rgba(255,255,255,0.15)] hover:text-white transition-all duration-150 cursor-pointer"
            >
              Export PDF
            </button>
          </div>
        </div>
      </header>

      {/* Organigram — parent-child flex structure, lines always connected */}
      <div ref={captureRef} id="organigram-capture" className="mx-auto px-6 py-8 overflow-x-auto">
        {/* CEO */}
        <div className="flex flex-col items-center">
          {ceo && (
            <ExecutiveCard
              exec={ceo}
              isHighlighted={hasSearch && matchesSearch(ceo, searchQuery)}
              isDimmed={hasSearch && !matchesSearch(ceo, searchQuery)}
            />
          )}
          <div className="w-0.5 h-8 bg-accent" />
        </div>

        {/* CEO's children — each branch sized proportional to its team count */}
        <div ref={branchContainerRef} className="flex relative" style={{ minWidth: `${branches.reduce((s, b) => s + (b.kind === 'team' ? 1 : b.childTeams.length), 0) * 140}px` }}>
          {/* Richard ↔ Rachelle connecting line (dynamically positioned) */}
          {connLine && (
            <div className="absolute h-0.5 bg-accent z-10" style={{ left: connLine.left, width: connLine.width, top: connLine.top }} />
          )}
          {branches.map((branch, i) => {
            const teamCount = branch.kind === 'team' ? 1 : branch.childTeams.length;
            const teamsList = branch.kind === 'team' ? [branch.team] : branch.childTeams;

            return (
              <div
                key={i}
                style={{ flex: teamCount }}
                className="flex flex-col items-center relative"
              >
                {/* Horizontal bar — absolute, first/last child starts/ends at 50% */}
                <div
                  className="absolute top-0 h-0.5 bg-accent"
                  style={{
                    left: i === 0 ? '50%' : 0,
                    right: i === branches.length - 1 ? '50%' : 0,
                  }}
                />
                {/* Vertical connector from bar to director zone */}
                <div className="w-0.5 h-6 bg-accent" />

                {/* Director zone — consistent height so all team columns align */}
                <div className="flex flex-col items-center relative" style={{ height: 170 }}>
                  {branch.kind === 'director' ? (
                    <>
                      <div ref={i === richardBranchIdx ? richardCardRef : i === rachelleBranchIdx ? rachelleCardRef : undefined}>
                        <ExecutiveCard
                          exec={branch.director}
                          isHighlighted={hasSearch && matchesSearch(branch.director, searchQuery)}
                          isDimmed={hasSearch && !matchesSearch(branch.director, searchQuery)}
                        />
                      </div>
                      <div className="w-0.5 flex-1 bg-accent" />
                    </>
                  ) : (
                    <div className="w-0.5 h-full bg-accent" />
                  )}
                </div>

                {/* Connector below director zone */}
                <div className="w-0.5 h-6 bg-accent" />

                {/* Team columns — all start at the same vertical position */}
                {teamsList.length === 1 ? (
                  <>
                    <div className="w-0.5 h-5 bg-accent" />
                    <div className="w-full px-1.5">
                      <TeamColumn
                        team={teamsList[0]}
                        onMemberClick={(m) => memberClick(m, teamsList[0])}
                        searchQuery={searchQuery}
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex w-full">
                    {teamsList.map((team, j) => (
                      <div
                        key={team.id}
                        className="flex-1 flex flex-col items-center relative"
                      >
                        <div
                          className="absolute top-0 h-0.5 bg-accent"
                          style={{
                            left: j === 0 ? '50%' : 0,
                            right: j === teamsList.length - 1 ? '50%' : 0,
                          }}
                        />
                        <div className="w-0.5 h-5 bg-accent" />
                        <div className="w-full px-1.5">
                          <TeamColumn
                            team={team}
                            onMemberClick={(m) => memberClick(m, team)}
                            searchQuery={searchQuery}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <MemberModal member={selectedMember} onClose={() => setSelectedMember(null)} />
    </div>
  );
}
