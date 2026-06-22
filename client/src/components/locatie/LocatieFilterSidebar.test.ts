import { describe, it, expect } from 'vitest';
import type { Location } from '../../api';
import { applyFilters, EMPTY_FILTERS } from './LocatieFilterSidebar';

const base: Location = {
  id: 1,
  code: null,
  naam: 'Test',
  land: 'NL',
  stad: null,
  adres: 'Straat 1',
  lat: null,
  lng: null,
  omgevingType: 'centrum',
  orientatie: 'N',
  eigendomType: 'particulier',
  vergunningNodig: false,
  vergunningLink: null,
  truckBereikbaar: true,
  geschiktActivatie: true,
  geschiktSampling: true,
  geschiktHotspot: false,
  geschiktAnder: null,
  stroom: true,
  verlichting: false,
  lengte: null,
  breedte: null,
  m2: null,
  notities: '',
  stroomvoorzieningTypes: [],
  aanvraagtijd: '',
  volumeSampling: '',
  doelgroepen: [],
  eventTypes: [],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  contacts: [],
  photos: [],
  costs: [],
};

function loc(over: Partial<Location>): Location {
  return { ...base, ...over } as Location;
}

describe('applyFilters – EMPTY_FILTERS', () => {
  it('geeft alle locaties terug als filters leeg zijn', () => {
    const locs = [loc({}), loc({ id: 2, naam: 'Ander' })];
    expect(applyFilters(locs, EMPTY_FILTERS, '')).toHaveLength(2);
  });
});

describe('applyFilters – eventTypes (match-any)', () => {
  it('positief: locatie met overeenkomend eventType wordt opgenomen', () => {
    const locs = [loc({ eventTypes: ['weekmarkt', 'festivals'] })];
    const f = { ...EMPTY_FILTERS, eventTypes: ['weekmarkt'] };
    expect(applyFilters(locs, f, '')).toHaveLength(1);
  });

  it('negatief: locatie zonder overeenkomend eventType wordt uitgesloten', () => {
    const locs = [loc({ eventTypes: ['beurzen'] })];
    const f = { ...EMPTY_FILTERS, eventTypes: ['weekmarkt'] };
    expect(applyFilters(locs, f, '')).toHaveLength(0);
  });
});

describe('applyFilters – doelgroepen (match-any)', () => {
  it('positief: locatie met overeenkomende doelgroep wordt opgenomen', () => {
    const locs = [loc({ doelgroepen: ['18-25', 'gezinnen'] })];
    const f = { ...EMPTY_FILTERS, doelgroepen: ['gezinnen'] };
    expect(applyFilters(locs, f, '')).toHaveLength(1);
  });

  it('negatief: locatie zonder overeenkomende doelgroep wordt uitgesloten', () => {
    const locs = [loc({ doelgroepen: ['50+'] })];
    const f = { ...EMPTY_FILTERS, doelgroepen: ['18-25'] };
    expect(applyFilters(locs, f, '')).toHaveLength(0);
  });
});

describe('applyFilters – volumeSampling (drempel ≤: klasse én alles eronder)', () => {
  it('locatie 2501-5000 matcht selectie [5001-10000]', () => {
    const locs = [loc({ volumeSampling: '2501-5000' })];
    const f = { ...EMPTY_FILTERS, volumeSampling: ['5001-10000'] };
    expect(applyFilters(locs, f, '')).toHaveLength(1);
  });

  it('locatie 5001-10000 matcht NIET selectie [2501-5000]', () => {
    const locs = [loc({ volumeSampling: '5001-10000' })];
    const f = { ...EMPTY_FILTERS, volumeSampling: ['2501-5000'] };
    expect(applyFilters(locs, f, '')).toHaveLength(0);
  });

  it('lege volumeSampling op locatie wordt uitgesloten bij actieve selectie', () => {
    const locs = [loc({ volumeSampling: '' })];
    const f = { ...EMPTY_FILTERS, volumeSampling: ['2501-5000'] };
    expect(applyFilters(locs, f, '')).toHaveLength(0);
  });
});

describe('applyFilters – aanvraagtijd (drempel ≤)', () => {
  it('locatie 2_weken matcht selectie [4_weken]', () => {
    const locs = [loc({ aanvraagtijd: '2_weken' })];
    const f = { ...EMPTY_FILTERS, aanvraagtijd: ['4_weken'] };
    expect(applyFilters(locs, f, '')).toHaveLength(1);
  });

  it('locatie langer matcht NIET selectie [4_weken]', () => {
    const locs = [loc({ aanvraagtijd: 'langer' })];
    const f = { ...EMPTY_FILTERS, aanvraagtijd: ['4_weken'] };
    expect(applyFilters(locs, f, '')).toHaveLength(0);
  });

  it('lege aanvraagtijd op locatie wordt uitgesloten bij actieve selectie', () => {
    const locs = [loc({ aanvraagtijd: '' })];
    const f = { ...EMPTY_FILTERS, aanvraagtijd: ['2_weken'] };
    expect(applyFilters(locs, f, '')).toHaveLength(0);
  });
});
