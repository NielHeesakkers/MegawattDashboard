import { Member } from '../../api';
import Modal from '../ui/Modal';

interface MemberModalProps {
  member: Member | null;
  onClose: () => void;
}

export default function MemberModal({ member, onClose }: MemberModalProps) {
  if (!member) return null;

  return (
    <Modal isOpen={!!member} onClose={onClose} maxWidth="max-w-sm">
      <div className="flex flex-col items-center text-center">
        {/* Photo */}
        <div className="w-32 h-32 rounded-full overflow-hidden bg-[rgba(0,0,0,0.2)] mb-4">
          {member.isVacancy || !member.photo ? (
            <div className="w-full h-full flex items-center justify-center bg-vacancy">
              <svg className="w-16 h-16 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
          ) : (
            <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
          )}
        </div>

        {/* Name */}
        <h3 className={`text-xl font-semibold mb-1 ${member.isVacancy ? 'italic text-text-secondary' : 'text-accent'}`}>
          {member.isVacancy ? 'Vacature' : member.name}
        </h3>

        {/* Role */}
        <p className="text-text-secondary mb-1 text-[14px]">{member.role}</p>

        {/* Email */}
        {member.email && !member.isVacancy && (
          <a
            href={`mailto:${member.email}`}
            className="text-accent-teal hover:underline text-sm"
          >
            {member.email}
          </a>
        )}
        {member.phone && !member.isVacancy && (
          <a
            href={`tel:${member.phone}`}
            className="text-text-secondary hover:text-white text-sm mb-3"
          >
            {member.phone}
          </a>
        )}
        {(!member.email && !member.phone || member.isVacancy) && <div className="mb-2" />}

        {/* Team badge */}
        {member.team && (
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium mt-[15px] mb-3 bg-accent-teal-dim text-accent-teal">
            {member.team.name}
          </span>
        )}
      </div>
    </Modal>
  );
}
