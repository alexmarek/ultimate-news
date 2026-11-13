import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SummaryView from '../components/SummaryView';

test('does not repeat the opening deck or show the key-points card', () => {
  const html = renderToStaticMarkup(createElement(SummaryView, {
    summary: '**Opening paragraph.**\n\nSecond paragraph.\n\n## Key points\n- A repeated point.',
    omitOpening: true,
  }));
  assert.doesNotMatch(html, /Opening paragraph|Key points|A repeated point/);
  assert.match(html, /Second paragraph/);
});

test('preserves normal subheadings and lists', () => {
  const html = renderToStaticMarkup(createElement(SummaryView, {
    summary: 'Opening paragraph.\n\n## Background\n- First item\n- Second item',
  }));
  assert.match(html, /Opening paragraph/);
  assert.match(html, /Background/);
  assert.match(html, /First item/);
  assert.match(html, /Second item/);
});
