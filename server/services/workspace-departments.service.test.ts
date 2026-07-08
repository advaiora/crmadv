import assert from 'node:assert/strict';
import { test } from 'node:test';
import { workspaceDepartmentsService } from './workspace-departments.service.js';

test('parseDepartmentPayload trims name and normalizes empty description to null', () => {
  const result = workspaceDepartmentsService.parseDepartmentPayload({ name: '  Grafica  ', description: '   ' });
  assert.deepEqual(result, { name: 'Grafica', description: null });
});

test('parseDepartmentPayload keeps a real description', () => {
  const result = workspaceDepartmentsService.parseDepartmentPayload({ name: 'Web', description: ' Siti e landing ' });
  assert.deepEqual(result, { name: 'Web', description: 'Siti e landing' });
});

test('parseDepartmentPayload rejects a missing/empty name', () => {
  assert.throws(() => workspaceDepartmentsService.parseDepartmentPayload({ description: 'x' }));
  assert.throws(() => workspaceDepartmentsService.parseDepartmentPayload({ name: '   ' }));
});

test('parseDepartmentPayload rejects a non-object body', () => {
  assert.throws(() => workspaceDepartmentsService.parseDepartmentPayload(null));
});

test('parseMemberUserIds accepts a clean string array and trims', () => {
  assert.deepEqual(
    workspaceDepartmentsService.parseMemberUserIds({ userIds: [' u1 ', 'u2'] }),
    ['u1', 'u2'],
  );
});

test('parseMemberUserIds accepts an empty array (clears members)', () => {
  assert.deepEqual(workspaceDepartmentsService.parseMemberUserIds({ userIds: [] }), []);
});

test('parseMemberUserIds rejects a non-array and non-string entries', () => {
  assert.throws(() => workspaceDepartmentsService.parseMemberUserIds({ userIds: 'nope' }));
  assert.throws(() => workspaceDepartmentsService.parseMemberUserIds({ userIds: ['ok', 7] }));
});
