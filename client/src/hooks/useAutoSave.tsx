import { useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Auto-save hook met debounce + change-detection.
 * - Triggert `save()` ~delay ms na laatste wijziging.
 * - Slaat over als data niet veranderd is sinds laatste save.
 * - Eerste mount triggert geen save (alleen baseline vastleggen).
 */
export function useAutoSave(
  data: unknown,
  save: () => Promise<void>,
  options: { delay?: number; enabled?: boolean } = {}
) {
  const { delay = 800, enabled = true } = options;
  const [status, setStatus] = useState<SaveStatus>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedHash = useRef<string | null>(null);
  const saveRef = useRef(save);

  useEffect(() => { saveRef.current = save; }, [save]);

  const hash = JSON.stringify(data);

  // Capture baseline op enable
  useEffect(() => {
    if (enabled && lastSavedHash.current === null) {
      lastSavedHash.current = hash;
    }
    if (!enabled) {
      lastSavedHash.current = null;
      if (timer.current) clearTimeout(timer.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (lastSavedHash.current === null) return;
    if (hash === lastSavedHash.current) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus('saving');
      try {
        await saveRef.current();
        lastSavedHash.current = hash;
        setStatus('saved');
        setTimeout(() => setStatus((s) => s === 'saved' ? 'idle' : s), 1500);
      } catch {
        setStatus('error');
      }
    }, delay);

    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [hash, enabled, delay]);

  return status;
}

export function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;
  const text = status === 'saving' ? 'Bezig met opslaan…' : status === 'saved' ? '✓ Opgeslagen' : '⚠ Opslaan mislukt';
  const color = status === 'error' ? 'text-red-400' : status === 'saved' ? 'text-accent-teal' : 'text-white/40';
  return <span className={`text-xs ${color} transition-opacity`}>{text}</span>;
}
