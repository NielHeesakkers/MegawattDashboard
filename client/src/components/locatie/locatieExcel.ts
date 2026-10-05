// Excel import/export in het formaat van Locatie-import-template.xlsx.
// Import: xlsx → rijen → LocationWriteInput; aanmaken gaat via POST /api/locations (geocoding/code/audit server-side).
// Export: Location[] → xlsx met dezelfde kolommen, zodat een export weer te importeren is.
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import type { Location, LocationWriteInput, OmgevingType, Orientatie, EigendomType } from '../../api';
import {
  Optie, labelOf, OMGEVING_PRESETS, EIGENDOM_PRESETS, STROOMVOORZIENING_PRESETS, AANVRAAGTIJD_OPTIONS,
  VOLUME_SAMPLING_OPTIONS, DOELGROEP_PRESETS, EVENT_TYPE_PRESETS,
} from './locatieKenmerken';

const decode = (s: string) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// Alle <t>-teksten binnen een fragment aan elkaar (rich text bestaat uit meerdere runs).
const texts = (xml: string) => [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join('');

const colIndex = (ref: string) => [...ref.replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

// Eerste werkblad als 2D-array van strings.
// ponytail: leest altijd sheet1.xml; als iemand de bladvolgorde omgooit, workbook.xml.rels gaan volgen.
export function parseXlsx(buf: Uint8Array): string[][] {
  const files = unzipSync(buf);
  const sheet = files['xl/worksheets/sheet1.xml'];
  if (!sheet) throw new Error('Geen werkblad gevonden — is dit wel een .xlsx-bestand?');
  const ssXml = files['xl/sharedStrings.xml'] ? strFromU8(files['xl/sharedStrings.xml']) : '';
  const shared = [...ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));

  const rows: string[][] = [];
  for (const rm of strFromU8(sheet).matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const row: string[] = [];
    for (const cm of (rm[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const body = cm[2] ?? '';
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /\bt="(\w+)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let val = '';
      if (type === 's') val = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') val = texts(body);
      else if (v !== undefined) val = decode(v);
      row[ref ? colIndex(ref) : row.length] = val.trim();
    }
    rows.push(Array.from(row, (c) => c ?? ''));
  }
  return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/[–—]/g, '-').replace(/[\s.]/g, '');
const isAnders = (s: string) => norm(s) === 'anders';

// Label of key uit de template → opslag-key; onbekende waarde blijft als eigen ("anders…") waarde staan.
const toKey = (opts: ReadonlyArray<Optie>, raw: string) =>
  opts.find((o) => norm(o.key) === norm(raw) || norm(o.label) === norm(raw))?.key ?? raw;
const one = (opts: ReadonlyArray<Optie>, raw: string, fallback: string) =>
  raw && !isAnders(raw) ? toKey(opts, raw) : fallback;
const many = (opts: ReadonlyArray<Optie>, raw: string) =>
  raw.split(',').map((s) => s.trim()).filter((s) => s && !isAnders(s)).map((s) => toKey(opts, s));
const bool = (raw: string) => ['ja', 'j', 'yes', 'y', 'true', 'waar', '1', 'x'].includes(raw.trim().toLowerCase());
const num = (raw: string) => {
  if (!raw) return null;
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export interface ImportRow { rij: number; input: LocationWriteInput }
export interface ImportFout { rij: number; fout: string }

export function rowsToLocations(rows: string[][]): { ok: ImportRow[]; fouten: ImportFout[] } {
  const [header = [], ...data] = rows;
  const idx = new Map(header.map((h, i) => [norm(h), i]));
  for (const verplicht of ['Naam', 'Land', 'Adres']) {
    if (!idx.has(norm(verplicht))) throw new Error(`Kolom "${verplicht}" ontbreekt — gebruik het import-template.`);
  }

  const ok: ImportRow[] = [];
  const fouten: ImportFout[] = [];
  data.forEach((r, i) => {
    const rij = i + 2; // Excel-rijnummer
    const get = (kolom: string) => r[idx.get(norm(kolom)) ?? -1] ?? '';
    if (r.every((c) => !c)) return;
    if (get('Notities').startsWith('Voorbeeldrij')) return;

    const naam = get('Naam'), land = get('Land'), adres = get('Adres');
    const mist = [!naam && 'Naam', !land && 'Land', !adres && 'Adres'].filter(Boolean);
    if (mist.length) { fouten.push({ rij, fout: `${mist.join(', ')} ontbreekt` }); return; }

    const ori = get('Oriëntatie').toUpperCase();
    ok.push({
      rij,
      input: {
        naam, land, adres,
        // Eigen "anders…"-waarden zijn toegestaan (net als in het formulier), vandaar de casts.
        omgevingType: one(OMGEVING_PRESETS, get('Omgevingstype'), 'centrum') as OmgevingType,
        orientatie: (ori && !isAnders(ori) ? ori : 'N') as Orientatie,
        eigendomType: one(EIGENDOM_PRESETS, get('Eigendomstype'), 'particulier') as EigendomType,
        stroom: bool(get('Stroom aanwezig')),
        stroomvoorzieningTypes: many(STROOMVOORZIENING_PRESETS, get('Stroomvoorziening-type')),
        verlichting: bool(get('Verlichting aanwezig')),
        truckBereikbaar: bool(get('Bereikbaar met bakwagen')),
        vergunningNodig: bool(get('Vergunning nodig')),
        vergunningLink: get('Vergunning link') || null,
        aanvraagtijd: one(AANVRAAGTIJD_OPTIONS, get('Aanvraagtijd'), ''),
        volumeSampling: one(VOLUME_SAMPLING_OPTIONS, get('Volume sampling'), ''),
        doelgroepen: many(DOELGROEP_PRESETS, get('Doelgroepen')),
        eventTypes: many(EVENT_TYPE_PRESETS, get('Event type')),
        geschiktActivatie: bool(get('Geschikt voor activatie')),
        geschiktSampling: bool(get('Geschikt voor sampling')),
        geschiktHotspot: bool(get('Geschikt als hotspot')),
        geschiktAnder: get('Geschikt anders') || null,
        lengte: num(get('Lengte (m)')),
        breedte: num(get('Breedte (m)')),
        m2: num(get('Oppervlakte (m²)')),
        notities: get('Notities'),
        contacts: [],
        costs: [],
      },
    });
  });
  return { ok, fouten };
}

// ---- Export ----

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colLetter = (i: number): string => (i >= 26 ? colLetter(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26));
const jn = (b: boolean) => (b ? 'Ja' : 'Nee');
const labels = (opts: ReadonlyArray<Optie>, keys: string[]) => keys.map((k) => labelOf(opts, k)).join(', ');

// [kolomkop, waarde] — koppen gelijk aan het template; "Code" en "Stad" zijn extra (import negeert ze).
const exportKolommen = (l: Location): Array<[string, string | number | null | undefined]> => [
  ['Code', l.code], ['Naam', l.naam], ['Land', l.land], ['Adres', l.adres], ['Stad', l.stad],
  ['Omgevingstype', labelOf(OMGEVING_PRESETS, l.omgevingType)],
  ['Oriëntatie', l.orientatie],
  ['Eigendomstype', labelOf(EIGENDOM_PRESETS, l.eigendomType)],
  ['Stroom aanwezig', jn(l.stroom)],
  ['Stroomvoorziening-type', labels(STROOMVOORZIENING_PRESETS, l.stroomvoorzieningTypes ?? [])],
  ['Verlichting aanwezig', jn(l.verlichting)],
  ['Bereikbaar met bakwagen', jn(l.truckBereikbaar)],
  ['Vergunning nodig', jn(l.vergunningNodig)],
  ['Vergunning link', l.vergunningLink],
  ['Aanvraagtijd', l.aanvraagtijd ? labelOf(AANVRAAGTIJD_OPTIONS, l.aanvraagtijd) : ''],
  ['Volume sampling', l.volumeSampling ? labelOf(VOLUME_SAMPLING_OPTIONS, l.volumeSampling) : ''],
  ['Doelgroepen', labels(DOELGROEP_PRESETS, l.doelgroepen ?? [])],
  ['Event type', labels(EVENT_TYPE_PRESETS, l.eventTypes ?? [])],
  ['Geschikt voor activatie', jn(l.geschiktActivatie)],
  ['Geschikt voor sampling', jn(l.geschiktSampling)],
  ['Geschikt als hotspot', jn(l.geschiktHotspot)],
  ['Geschikt anders', l.geschiktAnder],
  ['Lengte (m)', l.lengte], ['Breedte (m)', l.breedte], ['Oppervlakte (m²)', l.m2],
  ['Notities', l.notities],
];

const cell = (ref: string, v: string | number | null | undefined) =>
  typeof v === 'number' ? `<c r="${ref}"><v>${v}</v></c>`
    : v ? `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>` : '';

export function locationsToXlsx(locations: Location[]): Uint8Array {
  const header = exportKolommen(locations[0] ?? ({} as Location)).map(([k]) => k);
  const rows = [header, ...locations.map((l) => exportKolommen(l).map(([, v]) => v))]
    .map((r, i) => `<row r="${i + 1}">${r.map((v, c) => cell(`${colLetter(c)}${i + 1}`, v)).join('')}</row>`).join('');
  const x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  return zipSync({
    '[Content_Types].xml': strToU8(`${x}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`),
    '_rels/.rels': strToU8(`${x}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`${x}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Locaties" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`${x}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`),
    'xl/worksheets/sheet1.xml': strToU8(`${x}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${rows}</sheetData></worksheet>`),
  });
}
