import { Executive } from '../../api';
import Modal from '../ui/Modal';

interface ExecutiveModalProps {
  executive: Executive | null;
  onClose: () => void;
}

export default function ExecutiveModal({ executive, onClose }: ExecutiveModalProps) {
  if (!executive) return null;

  return (
    <Modal isOpen={!!executive} onClose={onClose} maxWidth="max-w-sm">
      <div className="flex flex-col items-center text-center">
        <div className="w-32 h-32 rounded-full overflow-hidden bg-[rgba(0,0,0,0.2)] mb-4">
          {executive.photo ? (
            <img src={executive.photo} alt={executive.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-vacancy">
              <svg className="w-16 h-16 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
          )}
        </div>
        <h3 className="text-xl font-semibold mb-1 text-accent">{executive.name}</h3>
        <p className="text-text-secondary mb-1 text-[14px]">{executive.role}</p>
        {executive.email && (
          <a
            href={`mailto:${executive.email}`}
            className="text-accent-teal hover:underline text-sm"
          >
            {executive.email}
          </a>
        )}
        {executive.phone && (
          <a
            href={`tel:${executive.phone}`}
            className="text-text-secondary hover:text-white text-sm mb-3"
          >
            {executive.phone}
          </a>
        )}
        {!executive.email && !executive.phone && <div className="mb-2" />}
      </div>
    </Modal>
  );
}
