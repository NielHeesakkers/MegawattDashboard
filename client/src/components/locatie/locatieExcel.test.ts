import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { parseXlsx, rowsToLocations, locationsToXlsx } from './locatieExcel';
import type { Location } from '../../api';

const xlsx = (sheet: string, shared: string[]) => zipSync({
  'xl/worksheets/sheet1.xml': strToU8(`<worksheet><sheetData>${sheet}</sheetData></worksheet>`),
  'xl/sharedStrings.xml': strToU8(`<sst>${shared.map((s) => `<si><t>${s}</t></si>`).join('')}</sst>`),
});

describe('locatieExcel', () => {
  it('leest shared/inline strings, getallen en lege kolommen', () => {
    const rows = parseXlsx(xlsx(
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="inlineStr"><is><t>B &amp; C</t></is></c></row>'
      + '<row r="2"><c r="B2"><v>12.5</v></c></row>',
      ['Naam'],
    ));
    expect(rows).toEqual([['Naam', '', 'B & C'], ['', '12.5']]);
  });

  it('mapt template-labels naar keys, slaat voorbeeldrij over en meldt ontbrekende velden', () => {
    const { ok, fouten } = rowsToLocations([
      ['Naam', 'Land', 'Adres', 'Omgevingstype', 'Stroom aanwezig', 'Volume sampling', 'Event type', 'Oppervlakte (m²)', 'Notities'],
      ['Voorbeeld', 'Nederland', 'X 1', '', '', '', '', '', 'Voorbeeldrij — verwijder'],
      ['Markt', 'Nederland', 'Markt 1, Breda', 'Plein', 'Ja', '5.001 - 10.000', 'Festivals, Braderie, anders', '40', ''],
      ['Leeg adres', 'Nederland', '', '', '', '', '', '', ''],
    ]);
    expect(fouten).toEqual([{ rij: 4, fout: 'Adres ontbreekt' }]);
    expect(ok).toHaveLength(1);
    expect(ok[0].input).toMatchObject({
      omgevingType: 'plein', stroom: true, volumeSampling: '5001-10000',
      eventTypes: ['festivals', 'Braderie'], m2: 40, eigendomType: 'particulier', orientatie: 'N',
    });
  });

  it('export is weer te importeren (round-trip)', () => {
    const loc = {
      code: 'BRE_001', naam: 'Markt <Breda>', land: 'Nederland', adres: 'Markt 1, 4811 Breda', stad: 'Breda',
      omgevingType: 'plein', orientatie: 'Z', eigendomType: 'gemeentelijk', stroom: true, verlichting: false,
      truckBereikbaar: true, vergunningNodig: false, vergunningLink: null, geschiktActivatie: false,
      geschiktSampling: true, geschiktHotspot: false, geschiktAnder: null, lengte: 10, breedte: 4, m2: 40,
      notities: 'A & B', stroomvoorzieningTypes: ['stroomput'], aanvraagtijd: '4_weken', volumeSampling: '10000+',
      doelgroepen: ['gezinnen'], eventTypes: ['festivals', 'Braderie'],
    } as unknown as Location;
    const { ok } = rowsToLocations(parseXlsx(locationsToXlsx([loc])));
    expect(ok[0].input).toMatchObject({
      naam: 'Markt <Breda>', omgevingType: 'plein', orientatie: 'Z', eigendomType: 'gemeentelijk', stroom: true,
      stroomvoorzieningTypes: ['stroomput'], aanvraagtijd: '4_weken', volumeSampling: '10000+',
      doelgroepen: ['gezinnen'], eventTypes: ['festivals', 'Braderie'], m2: 40, notities: 'A & B',
    });
  });
});
