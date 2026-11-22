// lib/markets/2026-11-22-visibility.ts
// EODHD's personal-plan terms forbid displaying its data to others, so ETF quotes are only
// sent to signed-in fact-check users. Petrol prices (EU Weekly Oil Bulletin) stay public.

import type { EtfSnapshot } from './snapshot';
import type { PetrolSnapshot } from './petrol';

export function visibleMarkets<T extends { etfs: EtfSnapshot | null; petrol: PetrolSnapshot | null }>(markets: T, canSeeEtfs: boolean): T {
  return canSeeEtfs ? markets : { ...markets, etfs: null };
}
