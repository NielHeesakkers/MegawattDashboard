import Modal from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
}

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Verwijderen' }: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <p className="text-text-secondary mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-white/10 text-text-primary hover:bg-white/20 transition-colors"
        >
          Annuleren
        </button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
