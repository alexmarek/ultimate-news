// lib/markets/xlsx.ts
// Minimal, dependency-free XLSX reader (ZIP + SpreadsheetML), enough to read the
// EU Weekly Oil Bulletin. Returns every sheet as rows of cell strings; numbers
// stay as their text form. Not a general Excel parser: no formulas, styles or dates.

import { inflateRawSync } from 'node:zlib';

function unzip(buf: Buffer): Map<string, Buffer> {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a ZIP/XLSX file');
  const entries = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map<string, Buffer>();
  for (let n = 0; n < entries; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('corrupt ZIP central directory');
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    if (method === 0) files.set(name, data);
    else if (method === 8) files.set(name, inflateRawSync(data));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');
}

/** All text inside <t> elements (shared strings may be split into rich-text runs). */
function textOf(xml: string): string {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join('');
}

function columnIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  for (const row of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowNum = Number(row[1].match(/\br="(\d+)"/)?.[1] ?? rows.length + 1);
    const cells: string[] = [];
    for (const c of row[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const body = c[2] ?? '';
      const ref = attrs.match(/\br="([A-Z]+\d+)"/i)?.[1];
      const type = attrs.match(/\bt="(\w+)"/)?.[1];
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = '';
      if (type === 's' && v !== undefined) value = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') value = textOf(body);
      else if (v !== undefined) value = decodeXml(v);
      cells[ref ? columnIndex(ref) : cells.length] = value.trim();
    }
    rows[rowNum - 1] = Array.from(cells, (x) => x ?? '');
  }
  return Array.from(rows, (r) => r ?? []);
}

export interface Sheet {
  name: string;
  rows: string[][];
}

export function readXlsx(buf: Buffer): Sheet[] {
  const files = unzip(buf);
  const text = (name: string) => files.get(name)?.toString('utf8') ?? '';
  const shared = [...text('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));

  const rels = new Map<string, string>();
  for (const m of text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)) {
    const id = m[0].match(/\bId="([^"]+)"/)?.[1];
    const target = m[0].match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) rels.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target}`);
  }

  const sheets: Sheet[] = [];
  for (const m of text('xl/workbook.xml').matchAll(/<sheet\b[^>]*>/g)) {
    const name = decodeXml(m[0].match(/\bname="([^"]*)"/)?.[1] ?? '');
    const rid = m[0].match(/\br:id="([^"]+)"/)?.[1];
    const path = rid ? rels.get(rid) : undefined;
    if (path && files.has(path)) sheets.push({ name, rows: parseSheet(text(path), shared) });
  }
  return sheets;
}

/** Excel serial day number (1900 date system) to an ISO date (YYYY-MM-DD). */
export function excelSerialToIso(serial: number): string {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000).toISOString().slice(0, 10);
}
