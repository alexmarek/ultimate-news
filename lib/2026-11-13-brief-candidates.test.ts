import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { pickEditionBrief } from './2026-11-13-brief-candidates';

test('fills five brief slots with eligible stories from recent editions', () => {
  const articles = [
    { id: 'a', title: 'Volcano changes island coastline', primaryArea: 'World News', publishedAt: new Date('2026-11-12T12:00:00Z'), importance: 5 },
    { id: 'b', title: 'Central bank announces interest decision', primaryArea: 'Business', publishedAt: new Date('2026-11-12T11:00:00Z'), importance: 5 },
    { id: 'c', title: 'Parliament passes coastal legislation', primaryArea: 'World News', publishedAt: new Date('2026-11-12T10:00:00Z'), importance: 4 },
    { id: 'd', title: 'Energy prices change across Europe', primaryArea: 'Business', publishedAt: new Date('2026-11-12T09:00:00Z'), importance: 4 },
    { id: 'e', title: 'New climate agreement reached', primaryArea: 'Environment', publishedAt: new Date('2026-11-11T12:00:00Z'), importance: 4 },
    { id: 'old', title: 'Ancient mountain discovery', primaryArea: 'Technology', publishedAt: new Date('2026-11-07T12:00:00Z'), importance: 5 },
    { id: 'future', title: 'Tomorrow orbit mission launched', primaryArea: 'Technology', publishedAt: new Date('2026-11-14T12:00:00Z'), importance: 5 },
  ];
  const selected = pickEditionBrief(articles, '2026-11-12', new Date('2026-11-13T12:00:00Z'));
  assert.equal(selected.length, 5);
  assert.ok(selected.some((article) => article.id === 'e'));
  assert.ok(!selected.some((article) => article.id === 'old' || article.id === 'future'));
});
