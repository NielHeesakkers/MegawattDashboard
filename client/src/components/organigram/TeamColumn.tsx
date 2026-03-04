import { Team, Member } from '../../api';
import MemberCard from './MemberCard';

interface TeamColumnProps {
  team: Team;
  onMemberClick: (member: Member) => void;
  searchQuery: string;
}

function matchesSearch(member: Member, query: string): boolean {
  if (!query) return false;
  const q = query.toLowerCase();
  return member.name.toLowerCase().includes(q) || member.role.toLowerCase().includes(q);
}

export default function TeamColumn({ team, onMemberClick, searchQuery }: TeamColumnProps) {
  const hasSearch = searchQuery.length > 0;

  // Group by subGroup if any members have one
  const subGroups = [...new Set(team.members.map((m) => m.subGroup).filter(Boolean))] as string[];
  const hasSubGroups = subGroups.length > 0;

  return (
    <div className="flex flex-col min-w-[160px]">
      {/* Team header */}
      <div className="text-center mb-3 pb-2 border-b border-[rgba(255,255,255,0.1)]">
        <h3 className="text-[11px] font-bold uppercase tracking-[1px] text-accent">
          {team.name}
        </h3>
      </div>

      {/* Members */}
      <div className="flex flex-col gap-2">
        {hasSubGroups ? (
          subGroups.map((group, gi) => (
            <div key={group} className={`flex flex-col gap-2 ${gi > 0 ? 'mt-1' : ''}`}>
              <p className="text-[11px] font-semibold text-accent-teal uppercase tracking-[0.8px]">
                {group}
              </p>
              {team.members
                .filter((m) => m.subGroup === group)
                .map((member) => (
                  <MemberCard
                    key={member.id}
                    member={member}
                    onClick={onMemberClick}
                    isHighlighted={hasSearch && matchesSearch(member, searchQuery)}
                    isDimmed={hasSearch && !matchesSearch(member, searchQuery)}
                  />
                ))}
            </div>
          ))
        ) : (
          team.members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              onClick={onMemberClick}
              isHighlighted={hasSearch && matchesSearch(member, searchQuery)}
              isDimmed={hasSearch && !matchesSearch(member, searchQuery)}
            />
          ))
        )}
      </div>
    </div>
  );
}
