import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readXlsx, excelSerialToIso } from '@/lib/markets/xlsx';
import { extractGermanPrices } from '@/lib/markets/petrol';
import { computePerformance, parseStooqCsv, parseYahooChart } from '@/lib/markets/etfs';

// A real (tiny) XLSX built with Python's zipfile: two sheets, shared strings incl. rich text,
// an inline string, a sparse row and an absolute relationship target.
const FIXTURE = Buffer.from('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', 'base64');

test('readXlsx reads sheets, shared strings (incl. rich text), inline strings and sparse cells', () => {
  const sheets = readXlsx(FIXTURE);
  assert.deepEqual(sheets.map((s) => s.name), ['Prices wo taxes', 'Prices with taxes']);
  const rows = sheets[1].rows;
  assert.deepEqual(rows[0], ['Prices in force on', 'AT_price_with_tax_euro95', '', 'DE_price_with_tax_euro95', 'DE_price_with_tax_diesel']);
  assert.equal(rows[2][5], 'note & more');
  assert.deepEqual(rows[3], []);
  assert.equal(excelSerialToIso(46300), '2026-10-05');
});

test('German weekly prices come from the "with taxes" sheet, newest first, in EUR per litre', () => {
  const weeks = extractGermanPrices(readXlsx(FIXTURE));
  assert.deepEqual(weeks, [
    { date: '2026-10-05', super95: 1.781, diesel: 1.703 },
    { date: '2026-09-28', super95: 1.77, diesel: 1.69 },
  ]);
});

test('the one-week "latest prices" layout (one row per country) is understood too', () => {
  const weeks = extractGermanPrices([
    {
      name: 'Prices with taxes',
      rows: [
        ['Prices in force on 05/10/2026'],
        ['', 'Euro-super 95 (I)', 'Gas oil automobile Automotive gas oil Dieselkraftstoff (I)'],
        ['Austria', '1,601.00', '1,580.00'],
        ['Germany', '1781.24', '1702.5'],
      ],
    },
  ]);
  assert.deepEqual(weeks, [{ date: '2026-10-05', super95: 1.781, diesel: 1.703 }]);
});

test('Stooq CSV and Yahoo chart JSON parse into daily closes', () => {
  assert.deepEqual(parseStooqCsv('Date,Open,High,Low,Close,Volume\n2026-10-09,1,1,1,120.5,10\n2026-10-10,1,1,1,121,10\n'), [
    { date: '2026-10-09', close: 120.5 },
    { date: '2026-10-10', close: 121 },
  ]);
  assert.deepEqual(parseStooqCsv('No data'), []);
  const yahoo = { chart: { result: [{ timestamp: [1791612000, 1791698400, 1791702000], indicators: { quote: [{ close: [100, null, 101] }] } }] } };
  assert.deepEqual(parseYahooChart(yahoo), [
    { date: '2026-10-10', close: 100 },
    { date: '2026-10-11', close: 101 },
  ]);
});

test('performance: day vs previous close, 1 month, year to date (in %)', () => {
  const perf = computePerformance([
    { date: '2025-12-30', close: 100 },
    { date: '2025-12-31', close: 100 },
    { date: '2026-09-10', close: 110 },
    { date: '2026-10-09', close: 120 },
    { date: '2026-10-12', close: 123 },
  ]);
  assert.deepEqual(perf, { lastDate: '2026-10-12', day: 2.5, month: 11.82, ytd: 23 });
  assert.equal(computePerformance([{ date: '2026-10-12', close: 1 }]), null);
});
