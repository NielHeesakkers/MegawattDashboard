import { useEffect, useRef } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  maxWidth?: string;
}

export default function Modal({ isOpen, onClose, children, title, maxWidth = 'max-w-lg' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.6)] backdrop-blur-[4px] p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className={`bg-[#1a3a38] rounded-[12px] w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}
        style={{ animation: 'fadeInScale 0.2s ease-out' }}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.1)]">
            <h2 className="text-[14px] font-semibold text-accent">{title}</h2>
            <button onClick={onClose} className="text-[rgba(255,255,255,0.5)] hover:text-[rgba(255,255,255,0.8)] text-lg leading-none px-2 py-1 cursor-pointer">&times;</button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
