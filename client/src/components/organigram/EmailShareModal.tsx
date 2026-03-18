import { useState, useRef, useEffect } from 'react';
import Modal from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { shareViaEmail } from '../../api';

interface Contact {
  name: string;
  email: string;
  role: string;
  photo: string | null;
}

interface EmailShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  generatePdfBase64: () => Promise<string | null>;
  viewMode: string;
  contacts: Contact[];
}

export default function EmailShareModal({ isOpen, onClose, generatePdfBase64, viewMode, contacts }: EmailShareModalProps) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const defaultSubject = viewMode === 'klantteams' ? 'MEGAWATT Klantteams' : 'MEGAWATT Organigram';
  const fileName = viewMode === 'klantteams' ? 'MEGAWATT-Klantteams.pdf' : 'MEGAWATT-Organigram.pdf';

  // Filter contacts based on input
  const query = email.toLowerCase().trim();
  const suggestions = query.length > 0
    ? contacts.filter((c) =>
        c.name.toLowerCase().includes(query) || c.email.toLowerCase().includes(query)
      ).slice(0, 6)
    : [];

  // Reset selected index when suggestions change
  useEffect(() => { setSelectedIndex(-1); }, [suggestions.length]);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const selectContact = (contact: Contact) => {
    setEmail(contact.email);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      selectContact(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setSending(true);

    try {
      const pdfBase64 = await generatePdfBase64();
      if (!pdfBase64) {
        toast.error('PDF genereren mislukt');
        setSending(false);
        return;
      }

      await shareViaEmail({
        to: email,
        subject: subject || defaultSubject,
        pdfBase64,
        fileName,
      });

      toast.success(`E-mail verzonden naar ${email}`);
      setEmail('');
      setSubject('');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'E-mail verzenden mislukt';
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setSubject('');
    setShowSuggestions(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Delen via e-mail" maxWidth="max-w-md">
      <form onSubmit={handleSubmit}>
        <div className="mb-4 relative">
          <label className="block text-text-secondary text-sm mb-1">Ontvanger *</label>
          <input
            ref={inputRef}
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder="Zoek medewerker of typ e-mailadres"
            required
            autoComplete="off"
            className="w-full px-3 py-[10px] rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px] outline-none focus:border-accent"
          />

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#1a3a38] rounded-[8px] ring-1 ring-[rgba(255,255,255,0.12)] shadow-2xl overflow-hidden max-h-[240px] overflow-y-auto"
            >
              {suggestions.map((contact, i) => (
                <button
                  key={contact.email}
                  type="button"
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer ${
                    i === selectedIndex
                      ? 'bg-[rgba(255,255,255,0.12)]'
                      : 'hover:bg-[rgba(255,255,255,0.06)]'
                  }`}
                  onMouseDown={(e) => { e.preventDefault(); selectContact(contact); }}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  {contact.photo ? (
                    <img
                      src={contact.photo.startsWith('http') ? contact.photo : `http://localhost:3001${contact.photo}`}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[rgba(255,255,255,0.1)] flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] text-[rgba(255,255,255,0.4)]">
                        {contact.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-white truncate">{contact.name}</div>
                    <div className="text-[11px] text-[rgba(255,255,255,0.4)] truncate">{contact.email}</div>
                  </div>
                  <span className="text-[10px] text-[rgba(255,255,255,0.3)] flex-shrink-0">{contact.role}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-text-secondary text-sm mb-1">Onderwerp</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={defaultSubject}
            className="w-full px-3 py-[10px] rounded-[8px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.12)] text-white text-[14px] outline-none focus:border-accent"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-[8px] bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] text-text-primary text-sm hover:bg-[rgba(255,255,255,0.1)] transition-all duration-150 cursor-pointer"
          >
            Annuleren
          </button>
          <button
            type="submit"
            disabled={sending || !email}
            className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-accent text-bg-dark text-sm font-semibold hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {sending && (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {sending ? 'Verzenden...' : 'Verzenden'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
