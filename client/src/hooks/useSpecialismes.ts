import { useState, useEffect, useCallback } from 'react';
import { fetchSpecialismes, createSpecialisme, deleteSpecialisme, Specialisme } from '../api';
import { useToast } from '../components/ui/Toast';

/**
 * Gedeelde state + acties voor de master-lijst van specialismes.
 * Gebruikt door zowel het toeleverancier-beheer (CRUD) als de inline "+ specialisme".
 */
export function useSpecialismes(enabled = true) {
  const toast = useToast();
  const [specialismes, setSpecialismes] = useState<Specialisme[]>([]);

  useEffect(() => {
    if (enabled) fetchSpecialismes().then(setSpecialismes).catch(() => {});
  }, [enabled]);

  const sortByNaam = (list: Specialisme[]) => [...list].sort((a, b) => a.naam.localeCompare(b.naam));

  /**
   * Maakt het specialisme aan, of geeft het bestaande terug (case-insensitive,
   * ook als 'ie alleen server-side bestond). Retourneert null bij een echte fout.
   */
  const addSpecialisme = useCallback(async (naam: string): Promise<Specialisme | null> => {
    const trimmed = naam.trim();
    if (!trimmed) return null;
    const existing = specialismes.find((s) => s.naam.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;
    try {
      const created = await createSpecialisme(trimmed);
      setSpecialismes((prev) => sortByNaam([...prev, created]));
      toast.success(`Specialisme "${created.naam}" toegevoegd`);
      return created;
    } catch {
      // Mogelijk bestaat 'ie server-side al (niet in onze lijst): herlaad en zoek opnieuw.
      try {
        const fresh = await fetchSpecialismes();
        setSpecialismes(sortByNaam(fresh));
        const match = fresh.find((s) => s.naam.toLowerCase() === trimmed.toLowerCase());
        if (match) return match;
      } catch { /* negeer */ }
      toast.error('Kon specialisme niet aanmaken');
      return null;
    }
  }, [specialismes, toast]);

  const removeSpecialisme = useCallback(async (id: number) => {
    await deleteSpecialisme(id);
    setSpecialismes((prev) => prev.filter((s) => s.id !== id));
    toast.success('Specialisme verwijderd');
  }, [toast]);

  return { specialismes, setSpecialismes, addSpecialisme, removeSpecialisme };
}
