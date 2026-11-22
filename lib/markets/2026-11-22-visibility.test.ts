import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { EtfSnapshot } from './snapshot';
import type { PetrolSnapshot } from './petrol';
import { visibleMarkets } from './2026-11-22-visibility';

const etfs = { quotes: [] } as unknown as EtfSnapshot;
const petrol = { weeks: [] } as unknown as PetrolSnapshot;

test('hides ETF quotes from visitors who are not signed in', () => {
  assert.deepEqual(visibleMarkets({ etfs, petrol }, false), { etfs: null, petrol });
});

test('keeps ETF quotes for signed-in users and never touches petrol', () => {
  assert.deepEqual(visibleMarkets({ etfs, petrol }, true), { etfs, petrol });
  assert.deepEqual(visibleMarkets({ etfs: null, petrol }, false), { etfs: null, petrol });
});
