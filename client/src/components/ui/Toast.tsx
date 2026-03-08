import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';

interface Toast {
  id: number;
  type: 'success' | 'error';
  text: string;
}

interface ToastContextType {
  success: (text: string) => void;
  error: (text: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const add = useCallback((type: 'success' | 'error', text: string) => {
    const id = ++nextId;
    setToasts((prev) => {
      const next = [...prev, { id, type, text }];
      // Max 5 tegelijk
      return next.length > 5 ? next.slice(next.length - 5) : next;
    });
    const duration = type === 'success' ? 4000 : 8000;
    const timer = setTimeout(() => remove(id), duration);
    timers.current.set(id, timer);
  }, [remove]);

  const success = useCallback((text: string) => add('success', text), [add]);
  const error = useCallback((text: string) => add('error', text), [add]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '400px' }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => remove(toast.id)}
            className={`pointer-events-auto px-4 py-3 rounded-[10px] text-sm font-medium shadow-lg backdrop-blur-sm cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
              toast.type === 'success'
                ? 'bg-green-500/15 border border-green-500/25 text-green-400'
                : 'bg-red-500/15 border border-red-500/25 text-red-400'
            }`}
            style={{
              animation: 'toastSlideIn 0.25s ease-out',
            }}
          >
            <div className="flex items-start gap-2">
              {toast.type === 'success' ? (
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              )}
              <span>{toast.text}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
