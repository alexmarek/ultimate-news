import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickBrief } from '@/lib/brief';

const a = (id: string, primaryArea: string, importance: number | null, day: number) => ({ id, primaryArea, importance, publishedAt: new Date(Date.UTC(2026, 9, day)) });

test('the brief takes the most important stories, newest first on ties, max 2 per category, skips minor and leisure ones', () => {
  const picked = pickBrief([
    a('w1', 'World News', 5, 10), a('w2', 'World News', 5, 12), a('w3', 'World News', 5, 11),
    a('b1', 'Business', 4, 12), a('s1', 'Science', 4, 9), a('t1', 'Travel', 2, 12),
    a('e1', 'Environment', 3, 12), a('x1', 'Business', null, 12), a('e2', 'Environment', 3, 8),
  ]);
  assert.deepEqual(picked.map((p) => p.id), ['w2', 'w3', 'b1', 'e1', 'e2']);
});

test('the same event from two sources appears once (live case: tagesschau and FAZ on the Pope)', () => {
  const pope1 = {
    id: 'ts', primaryArea: 'World News', importance: 5, publishedAt: new Date(Date.UTC(2026, 9, 13, 18)),
    title: 'Pope Leo XIV has lung cancer',
    summary: '**Pope Leo XIV, 71, has undergone surgery to remove a lung tumour after doctors discovered an adenocarcinoma, a common form of lung cancer, during a routine examination.**',
  };
  const pope2 = {
    id: 'faz', primaryArea: 'World News', importance: 5, publishedAt: new Date(Date.UTC(2026, 9, 13, 17)),
    title: 'Vatican: Pope Leo XIV has cancer',
    summary: "**A malignant nodule was discovered in Pope Leo XIV's lung during a routine examination and has been successfully removed; the Vatican has now confirmed it was cancerous.**",
  };
  const hybrid = {
    id: 'eu', primaryArea: 'Business', importance: 4, publishedAt: new Date(Date.UTC(2026, 9, 13, 16)),
    title: 'EU brakes hybrid imports: Can German carmakers profit?',
    summary: '**The EU has imposed a four-year import cap on Chinese hybrid vehicles to protect European automakers.**',
  };
  const dax = {
    id: 'dax', primaryArea: 'Business', importance: 4, publishedAt: new Date(Date.UTC(2026, 9, 13, 15)),
    title: 'Market report: DAX drifts into negative territory',
    summary: '**The DAX ended the trading day slightly negative as semiconductor stocks sold off and earnings season disappointed.**',
  };
  assert.deepEqual(pickBrief([pope1, pope2, hybrid, dax]).map((p) => p.id), ['ts', 'eu', 'dax']);
});

test('articles in the same story cluster count as one story', () => {
  const x = { ...a('x', 'World News', 5, 12), clusterId: 'c1', title: 'Talks resume', summary: '**Talks resumed.**' };
  const y = { ...a('y', 'Business', 5, 11), clusterId: 'c1', title: 'Markets react', summary: '**Markets reacted.**' };
  assert.deepEqual(pickBrief([x, y]).map((p) => p.id), ['x']);
});
