// lib/markets/snapshot.ts
// Refreshes and reads the market data shown on the homepage. Fetched once per
// cron run and stored, so page views never wait on external services. A failed
// refresh keeps the previous snapshot.

import { prisma } from '@/lib/db';
import { PORTFOLIO_ETFS } from '@/lib/config/portfolio';
import { fetchEtf, type EtfQuote } from '@/lib/markets/etfs';
import { fetchPetrolPrices, type PetrolSnapshot } from '@/lib/markets/petrol';
import { mapPool } from '@/lib/ingest/pool';

export interface EtfSnapshot {
  fetchedAt: string;
  quotes: EtfQuote[];
}

async function save(id: string, value: unknown) {
  const data = JSON.stringify(value);
  await prisma.marketSnapshot.upsert({ where: { id }, create: { id, data }, update: { data } });
}

export async function refreshMarkets(): Promise<Record<string, unknown>> {
  const [quotes, petrol] = await Promise.all([mapPool(PORTFOLIO_ETFS, 4, fetchEtf), fetchPetrolPrices()]);

  const etfOk = quotes.some((q) => !('error' in q));
  if (etfOk) await save('etfs', { fetchedAt: new Date().toISOString(), quotes } satisfies EtfSnapshot);
  if (petrol.snapshot) await save('petrol', petrol.snapshot);

  return {
    etfs: { saved: etfOk, quotes },
    petrol: { saved: Boolean(petrol.snapshot), latest: petrol.snapshot?.weeks.slice(0, 2), attempts: petrol.attempts },
  };
}

export async function readMarkets(): Promise<{ etfs: EtfSnapshot | null; petrol: PetrolSnapshot | null }> {
  try {
    const rows = await prisma.marketSnapshot.findMany({ where: { id: { in: ['etfs', 'petrol'] } } });
    const get = (id: string) => {
      const row = rows.find((r) => r.id === id);
      return row ? JSON.parse(row.data) : null;
    };
    return { etfs: get('etfs'), petrol: get('petrol') };
  } catch {
    // Table not created yet (first deploy) or bad data: the panel is simply hidden.
    return { etfs: null, petrol: null };
  }
}
