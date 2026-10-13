// lib/markets/petrol.ts
// Weekly German pump prices (Euro-super 95 and diesel, taxes included) from the
// European Commission's Weekly Oil Bulletin. Free, no key. The bulletin gives
// prices per 1,000 litres; they are converted to EUR per litre here.

import { excelSerialToIso, readXlsx, type Sheet } from '@/lib/markets/xlsx';

/** The bulletin's page: its download links change with each upload, so they are read from here. */
export const OIL_BULLETIN_PAGE = 'https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en';
// Older fixed locations, tried last.
const FALLBACK_URLS = [
  'https://ec.europa.eu/energy/observatory/reports/Oil_Bulletin_Prices_History.xlsx',
  'https://ec.europa.eu/energy/observatory/reports/latest_prices_with_taxes.xlsx',
];

/** XLSX links on the bulletin page: the price history first, then "prices with taxes". */
export function findBulletinLinks(html: string, pageUrl: string): string[] {
  const links = [...html.matchAll(/href="([^"]+)"/g)]
    .map((m) => m[1].replace(/&amp;/g, '&'))
    .filter((h) => /\.xlsx/i.test(h))
    .map((h) => new URL(h, pageUrl).toString());
  const rank = (u: string) => (/history/i.test(u) ? 0 : /with_?taxes|with%20taxes/i.test(u) && !/without|wo_?taxes/i.test(u) ? 1 : 2);
  return [...new Set(links)].filter((u) => rank(u) < 2).sort((a, b) => rank(a) - rank(b));
}

export interface PetrolWeek {
  /** Date the prices were in force (YYYY-MM-DD). */
  date: string;
  /** EUR per litre. */
  super95: number | null;
  diesel: number | null;
}

export interface PetrolSnapshot {
  source: string;
  sourceUrl: string;
  /** Newest first. */
  weeks: PetrolWeek[];
}

function toNumber(s: string | undefined): number | null {
  if (!s) return null;
  const t = /^\d+,\d+$/.test(s.trim()) ? s.replace(',', '.') : s.replace(/[\s,]/g, '');
  const n = Number(t);
  return Number.isFinite(n) && t !== '' ? n : null;
}

/** EUR per 1,000 litres -> EUR per litre (values already per litre pass through). */
function perLitre(n: number | null): number | null {
  if (n === null || n <= 0) return null;
  return n > 50 ? Math.round(n) / 1000 : n;
}

function toIsoDate(cell: string | undefined): string | null {
  if (!cell) return null;
  const serial = Number(cell);
  if (Number.isFinite(serial) && serial > 30000 && serial < 80000) return excelSerialToIso(serial);
  const dmy = cell.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const iso = cell.match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : null;
}

/**
 * History layout: a header row with per-country columns such as
 * "DE_price_with_tax_euro95" / "DE_price_with_tax_diesel" and one row per week.
 */
function fromHistory(sheet: Sheet): PetrolWeek[] {
  for (let h = 0; h < Math.min(sheet.rows.length, 20); h++) {
    const header = sheet.rows[h];
    const superCol = header.findIndex((c) => /^DE[_ ].*euro.?(super)?.?95/i.test(c));
    const dieselCol = header.findIndex((c) => /^DE[_ ].*diesel/i.test(c));
    if (superCol < 0 || dieselCol < 0) continue;
    const weeks: PetrolWeek[] = [];
    for (const row of sheet.rows.slice(h + 1)) {
      const date = toIsoDate(row[0]);
      const super95 = perLitre(toNumber(row[superCol]));
      const diesel = perLitre(toNumber(row[dieselCol]));
      if (date && (super95 !== null || diesel !== null)) weeks.push({ date, super95, diesel });
    }
    return weeks.sort((a, b) => b.date.localeCompare(a.date));
  }
  return [];
}

/** Latest layout: one row per country, product columns named in the header rows above it. */
function fromLatest(sheet: Sheet): PetrolWeek[] {
  const rowIdx = sheet.rows.findIndex((r) => r.some((c) => /^(germany|deutschland|allemagne)\b/i.test(c)));
  if (rowIdx < 0) return [];
  let superCol = -1;
  let dieselCol = -1;
  for (const r of sheet.rows.slice(0, rowIdx)) {
    r.forEach((c, i) => {
      if (superCol < 0 && /euro-?\s?super\s?95/i.test(c)) superCol = i;
      if (dieselCol < 0 && /(automotive gas ?oil|gas ?oil automobile|dieselkraftstoff|diesel)/i.test(c)) dieselCol = i;
    });
  }
  if (superCol < 0 && dieselCol < 0) return [];
  let date: string | null = null;
  for (const r of sheet.rows.slice(0, rowIdx)) {
    for (const c of r) date ??= /in force|en vigueur|g(ue|ü)ltig/i.test(c) || /\d{1,2}[/.]\d{1,2}[/.]\d{4}/.test(c) ? toIsoDate(c) : null;
  }
  const row = sheet.rows[rowIdx];
  const week = { date: date ?? '', super95: perLitre(toNumber(row[superCol])), diesel: perLitre(toNumber(row[dieselCol])) };
  return week.super95 !== null || week.diesel !== null ? [week] : [];
}

export function extractGermanPrices(sheets: Sheet[]): PetrolWeek[] {
  const ordered = [...sheets].sort((a, b) => Number(/with.*tax/i.test(b.name)) - Number(/with.*tax/i.test(a.name)));
  for (const sheet of ordered) {
    const weeks = fromHistory(sheet);
    if (weeks.length) return weeks;
  }
  for (const sheet of ordered) {
    const weeks = fromLatest(sheet);
    if (weeks.length) return weeks;
  }
  return [];
}

export interface PetrolResult {
  snapshot?: PetrolSnapshot;
  /** Per URL: what happened (for the diagnostics report). */
  attempts: Array<Record<string, unknown>>;
}

async function discoverUrls(attempts: Array<Record<string, unknown>>): Promise<string[]> {
  try {
    const res = await fetch(OIL_BULLETIN_PAGE, { headers: { 'User-Agent': 'Mozilla/5.0 (ultimate-news)' } });
    const found = res.ok ? findBulletinLinks(await res.text(), res.url || OIL_BULLETIN_PAGE) : [];
    attempts.push({ url: OIL_BULLETIN_PAGE, status: res.status, linksFound: found });
    return found;
  } catch (e) {
    attempts.push({ url: OIL_BULLETIN_PAGE, error: e instanceof Error ? e.message : String(e) });
    return [];
  }
}

export async function fetchPetrolPrices(timeoutMs = 25_000): Promise<PetrolResult> {
  const attempts: Array<Record<string, unknown>> = [];
  const urls = [...(await discoverUrls(attempts)), ...FALLBACK_URLS];
  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 (ultimate-news)' } });
      if (!res.ok) {
        attempts.push({ url, status: res.status });
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.readUInt32LE(0) !== 0x04034b50) {
        attempts.push({ url, status: res.status, error: 'not an XLSX file', contentType: res.headers.get('content-type'), start: buf.toString('utf8', 0, 120) });
        continue;
      }
      const sheets = readXlsx(buf);
      const weeks = extractGermanPrices(sheets).slice(0, 8);
      if (weeks.length) {
        attempts.push({ url, status: res.status, bytes: buf.length, weeks: weeks.length });
        return { snapshot: { source: 'EU Weekly Oil Bulletin', sourceUrl: url, weeks }, attempts };
      }
      // Layout not recognised: report the start of each sheet so the parser can be adjusted.
      attempts.push({ url, status: res.status, bytes: buf.length, error: 'German prices not found', sheets: sheets.map((s) => ({ name: s.name, firstRows: s.rows.slice(0, 8).map((r) => r.slice(0, 10)) })) });
    } catch (e) {
      attempts.push({ url, error: e instanceof Error ? e.message : String(e) });
    } finally {
      clearTimeout(timer);
    }
  }
  return { attempts };
}
