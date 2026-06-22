// Gedeelde presets/labels voor de extra locatiekenmerken.
// Eén bron voor zowel het formulier (LocatieDetailPage) als de filter-sidebar.
// Opslagwaarden (key) zijn stabiel; label is de NL-weergave.

export interface Optie { key: string; label: string }

// Meervoudig, extensible ("anders…" toegestaan), alleen relevant als stroom = ja.
export const STROOMVOORZIENING_PRESETS: ReadonlyArray<Optie> = [
  { key: 'stroomput', label: 'Stroomput' },
  { key: 'paddenstoel', label: 'Paddenstoel' },
  { key: 'walaansluiting', label: 'Walaansluiting' },
];

// Enkelvoudig, gesloten, GEORDEND (index stuurt de drempel ≤ filter aan).
export const AANVRAAGTIJD_OPTIONS: ReadonlyArray<Optie> = [
  { key: '2_weken', label: '2 weken' },
  { key: '4_weken', label: '4 weken' },
  { key: '8_weken', label: '8 weken' },
  { key: 'langer', label: 'Langer' },
];

// Enkelvoudig, gesloten, GEORDEND (index stuurt de drempel ≥ filter aan).
export const VOLUME_SAMPLING_OPTIONS: ReadonlyArray<Optie> = [
  { key: '0-2500', label: '0 – 2.500' },
  { key: '2501-5000', label: '2.501 – 5.000' },
  { key: '5001-10000', label: '5.001 – 10.000' },
  { key: '10000+', label: '> 10.000' },
];

// Meervoudig, extensible.
export const DOELGROEP_PRESETS: ReadonlyArray<Optie> = [
  { key: '18-25', label: '18 – 25' },
  { key: '25-35', label: '25 – 35' },
  { key: '35-50', label: '35 – 50' },
  { key: '50+', label: '50+' },
  { key: 'gezinnen', label: 'Gezinnen' },
];

// Meervoudig, extensible.
export const EVENT_TYPE_PRESETS: ReadonlyArray<Optie> = [
  { key: 'weekmarkt', label: 'Weekmarkt' },
  { key: 'introweek', label: 'Introweek' },
  { key: 'festivals', label: 'Festivals' },
  { key: 'beurzen', label: 'Beurzen' },
  { key: 'sportevenement', label: 'Sportevenement' },
  { key: 'winkelcentra', label: 'Winkelcentra' },
  { key: 'station', label: 'Station' },
  { key: 'luchthavens', label: 'Luchthavens' },
  { key: 'parken', label: 'Parken' },
  { key: 'event_locatie', label: 'Event locatie' },
];

// Geordende key-lijsten voor de drempel-filters.
export const AANVRAAGTIJD_ORDER: readonly string[] = AANVRAAGTIJD_OPTIONS.map((o) => o.key);
export const VOLUME_SAMPLING_ORDER: readonly string[] = VOLUME_SAMPLING_OPTIONS.map((o) => o.key);

// Label opzoeken; valt terug op de ruwe key (bv. een "anders…"-waarde).
export const labelOf = (opts: ReadonlyArray<Optie>, key: string): string =>
  opts.find((o) => o.key === key)?.label ?? key;
