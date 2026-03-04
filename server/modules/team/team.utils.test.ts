import assert from 'node:assert/strict';
import test from 'node:test';
import { isWorkspaceEntityId, normalizeEmail } from './team.utils.js';

test('normalizeEmail trims and lowercases email values', () => {
  assert.equal(normalizeEmail('  USER@Example.COM '), 'user@example.com');
});

test('isWorkspaceEntityId accepts cuid and uuid values', () => {
  assert.equal(isWorkspaceEntityId('ckteam00000000000000000001'), true);
  assert.equal(isWorkspaceEntityId('550e8400-e29b-41d4-a716-446655440000'), true);
});

test('isWorkspaceEntityId rejects malformed identifiers', () => {
  assert.equal(isWorkspaceEntityId('member-1'), false);
  assert.equal(isWorkspaceEntityId(''), false);
});
