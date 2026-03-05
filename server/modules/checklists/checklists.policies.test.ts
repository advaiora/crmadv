import assert from 'node:assert/strict';
import test from 'node:test';
import { forbidden } from '../../core/errors.js';
import {
  buildEnsureChecklistsAccess,
  CHECKLISTS_PERMISSIONS,
} from './checklists.policies.js';

test('ensureChecklistsAccess forwards checklists.assign permission key', async () => {
  const calls: Array<{ permission?: string; moduleKey?: string }> = [];
  const ensure = buildEnsureChecklistsAccess({
    ensureAccessFn: async (_request, options) => {
      calls.push({
        permission: options.permission,
        moduleKey: options.moduleKey,
      });

      return {
        user: { id: 'user-1' } as never,
        workspace: { id: 'workspace-1' } as never,
        workspaceId: 'workspace-1',
      };
    },
  });

  await ensure({} as never, CHECKLISTS_PERMISSIONS.assign);

  assert.deepEqual(calls, [{ permission: 'checklists.assign', moduleKey: 'checklists' }]);
});

test('ensureChecklistsAccess returns 403 when checklists.assign permission is missing', async () => {
  const ensure = buildEnsureChecklistsAccess({
    ensureAccessFn: async () => {
      throw forbidden('Permission denied');
    },
  });

  await assert.rejects(
    async () => ensure({} as never, CHECKLISTS_PERMISSIONS.assign),
    (error: unknown) => (
      typeof error === 'object'
      && error !== null
      && 'statusCode' in error
      && (error as { statusCode: number }).statusCode === 403
    ),
  );
});
