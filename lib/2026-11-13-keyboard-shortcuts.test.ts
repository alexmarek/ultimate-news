import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { isHelpShortcut } from './2026-11-13-keyboard-shortcuts';

test('recognises a question mark even when typed using Shift', () => {
  const event = { key: '?', shiftKey: true, altKey: false, ctrlKey: false, metaKey: false };
  assert.equal(isHelpShortcut(event), true);
});

test('does not intercept modified or unrelated keys', () => {
  assert.equal(isHelpShortcut({ key: '?', altKey: false, ctrlKey: true, metaKey: false }), false);
  assert.equal(isHelpShortcut({ key: '/', altKey: false, ctrlKey: false, metaKey: false }), false);
});
