import assert from 'node:assert/strict';
import { test } from 'node:test';
import { workspaceRolesService } from './workspace-roles.service.js';
import { SYSTEM_PERMISSION_CATALOG } from '../auth/rbac-catalog.js';

test('getPermissionCatalog groups every catalog permission under a module', () => {
  const { modules } = workspaceRolesService.getPermissionCatalog();

  assert.ok(modules.length > 0);
  for (const module of modules) {
    assert.ok(module.permissions.length > 0, `module ${module.key} has no permissions`);
  }

  const flattened = modules.flatMap((module) => module.permissions.map((permission) => permission.key));
  const uniqueFlattened = new Set(flattened);
  assert.equal(flattened.length, uniqueFlattened.size, 'permissions must not be duplicated across modules');

  // Every catalog permission whose module exists must be present in the output.
  const catalogKeys = new Set(SYSTEM_PERMISSION_CATALOG.map((permission) => permission.key));
  for (const key of flattened) {
    assert.ok(catalogKeys.has(key), `unexpected permission ${key}`);
  }
});

test('parseCustomRoleIds accepts a clean string array', () => {
  const result = workspaceRolesService.parseCustomRoleIds({ roleIds: [' role-a ', 'role-b'] });
  assert.deepEqual(result, ['role-a', 'role-b']);
});

test('parseCustomRoleIds accepts an empty array (clears custom roles)', () => {
  assert.deepEqual(workspaceRolesService.parseCustomRoleIds({ roleIds: [] }), []);
});

test('parseCustomRoleIds rejects a non-array roleIds', () => {
  assert.throws(() => workspaceRolesService.parseCustomRoleIds({ roleIds: 'nope' }));
});

test('parseCustomRoleIds rejects non-string entries', () => {
  assert.throws(() => workspaceRolesService.parseCustomRoleIds({ roleIds: ['ok', 42] }));
});

test('parseCustomRoleIds rejects a non-object body', () => {
  assert.throws(() => workspaceRolesService.parseCustomRoleIds(null));
});
