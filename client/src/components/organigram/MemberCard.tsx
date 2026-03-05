import { Member } from '../../api';

interface MemberCardProps {
  member: Member;
  onClick: (member: Member) => void;
  isHighlighted: boolean;
  isDimmed: boolean;
}

export default function MemberCard({ member, onClick, isHighlighted, isDimmed }: MemberCardProps) {
  const isVacancy = member.isVacancy;

  return (
    <button
      onClick={() => onClick(member)}
      className={`
        w-full flex items-center gap-2.5 p-2 rounded-[10px] text-left
        border transition-all duration-150 cursor-pointer
        ${member.isTeamLead
          ? 'bg-[rgba(255,255,255,0.08)] border-accent/40 hover:bg-[rgba(255,255,255,0.12)] hover:border-accent/60'
          : 'bg-bg-card border-border hover:border-border-hover hover:bg-bg-card-hover'}
        ${isHighlighted ? 'ring-2 ring-accent border-accent bg-accent-dim' : ''}
        ${isDimmed ? 'opacity-30' : ''}
      `}
      style={{ animation: 'slideUp 0.3s ease-out' }}
    >
      {/* Photo */}
      <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-[rgba(0,0,0,0.2)]">
        {isVacancy || !member.photo ? (
          <div className="w-full h-full flex items-center justify-center bg-vacancy">
            <svg className="w-6 h-6 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
        ) : (
          <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-medium leading-tight truncate ${isVacancy ? 'italic text-text-secondary' : 'text-accent'}`}>
          {isVacancy ? 'Vacature' : member.name}
        </p>
        <p className={`text-[11px] leading-tight mt-0.5 truncate ${isVacancy ? 'italic text-text-muted' : 'text-text-secondary'}`}>
          {member.role}
        </p>
      </div>
    </button>
  );
}
