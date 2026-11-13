import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowed, type FactCheckRole } from './2026-11-09-access-policy';

const user = (role: FactCheckRole, active = true) => ({ googleSubject: 'google-subject', role, active });

test('only the owner can manage users', () => {
  assert.equal(isAllowed(user('owner'), 'google-subject', 'manage-users'), true);
  assert.equal(isAllowed(user('editor'), 'google-subject', 'manage-users'), false);
});

test('active editors can manage fact checks', () => {
  assert.equal(isAllowed(user('editor'), 'google-subject', 'manage-fact-checks'), true);
});

test('a removed user or a different account cannot use an existing session', () => {
  assert.equal(isAllowed(user('editor', false), 'google-subject', 'manage-fact-checks'), false);
  assert.equal(isAllowed(user('owner'), 'other-subject', 'manage-users'), false);
  assert.equal(isAllowed(null, 'google-subject', 'manage-fact-checks'), false);
});
