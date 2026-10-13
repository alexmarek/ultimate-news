// lib/markets/etfs.ts
// Daily closes for the configured ETFs (Xetra, EUR) and their performance in %.
// Tries Stooq's free CSV download first, then Yahoo Finance's public chart
// endpoint (unofficial; may change without notice).

import type { EtfDef } from '@/lib/config/portfolio';

export interface DailyClose {
  date: string; // YYYY-MM-DD
  close: number;
}

export interface EtfPerformance {
  lastDate: string;
  /** Change in % vs the previous close. */
  day: number | null;
  month: number | null;
  ytd: number | null;
}

export type EtfQuote = { isin: string; name: string; xetra: string } & (
  | ({ provider: 'stooq' | 'yahoo' } & EtfPerformance)
  | { error: string }
);

export function parseStooqCsv(csv: string): DailyClose[] {
  const lines = csv.trim().split(/\r?\n/);
  if (!/^date,/i.test(lines[0] ?? '')) return [];
  const header = lines[0].toLowerCase().split(',');
  const closeCol = header.indexOf('close');
  return lines
    .slice(1)
    .map((l) => l.split(','))
    .map((c) => ({ date: c[0], close: Number(c[closeCol]) }))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && Number.isFinite(d.close) && d.close > 0);
}

export function parseYahooChart(json: unknown): DailyClose[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (json as any)?.chart?.result?.[0];
  const ts: number[] = result?.timestamp ?? [];
  const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close ?? [];
  const out: DailyClose[] = [];
  ts.forEach((t, i) => {
    const close = closes[i];
    if (typeof close === 'number' && close > 0) out.push({ date: new Date(t * 1000).toISOString().slice(0, 10), close });
  });
  // One bar per day (the live bar can repeat the last date).
  return out.filter((d, i) => i === out.length - 1 || out[i + 1].date !== d.date);
}

const pct = (now: number, then: number | undefined) => (then ? Math.round((now / then - 1) * 10000) / 100 : null);

export function computePerformance(series: DailyClose[]): EtfPerformance | null {
  const s = [...series].sort((a, b) => a.date.localeCompare(b.date));
  if (s.length < 2) return null;
  const last = s[s.length - 1];
  const monthAgo = new Date(`${last.date}T00:00:00Z`);
  monthAgo.setUTCMonth(monthAgo.getUTCMonth() - 1);
  const monthRef = [...s].reverse().find((d) => d.date <= monthAgo.toISOString().slice(0, 10));
  const yearStart = `${last.date.slice(0, 4)}-01-01`;
  const ytdRef = [...s].reverse().find((d) => d.date < yearStart);
  return {
    lastDate: last.date,
    day: pct(last.close, s[s.length - 2].close),
    month: pct(last.close, monthRef?.close),
    ytd: pct(last.close, ytdRef?.close),
  };
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function get(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    return await fetch(url, { signal: controller.signal, headers: { 'User-Agent': UA } });
  } finally {
    clearTimeout(timer);
  }
}

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');

async function fromStooq(def: EtfDef): Promise<DailyClose[]> {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear() - 1, 11, 1));
  const res = await get(`https://stooq.com/q/d/l/?s=${def.xetra.toLowerCase()}.de&d1=${ymd(start)}&d2=${ymd(now)}&i=d`);
  const text = await res.text();
  const series = parseStooqCsv(text);
  if (!series.length) throw new Error(`stooq HTTP ${res.status}: ${text.slice(0, 80).replace(/\s+/g, ' ')}`);
  return series;
}

async function fromYahoo(def: EtfDef): Promise<DailyClose[]> {
  const res = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(def.xetra)}.DE?range=1y&interval=1d`);
  if (!res.ok) throw new Error(`yahoo HTTP ${res.status}`);
  const series = parseYahooChart(await res.json());
  if (!series.length) throw new Error('yahoo: no data');
  return series;
}

export async function fetchEtf(def: EtfDef): Promise<EtfQuote> {
  const errors: string[] = [];
  for (const [provider, load] of [['stooq', fromStooq], ['yahoo', fromYahoo]] as const) {
    try {
      const perf = computePerformance(await load(def));
      if (perf) return { isin: def.isin, name: def.name, xetra: def.xetra, provider, ...perf };
      errors.push(`${provider}: too little data`);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { isin: def.isin, name: def.name, xetra: def.xetra, error: errors.join('; ') };
}
