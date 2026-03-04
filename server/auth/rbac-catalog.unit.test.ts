import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DASHBOARD_MODULE_KEY,
  DASHBOARD_PERMISSIONS,
  SYSTEM_MODULE_CATALOG,
  SYSTEM_PERMISSION_CATALOG,
  TEAM_MODULE_KEY,
  TEAM_PERMISSIONS,
} from './rbac-catalog.js';

test('RBAC catalog includes team module in registry', () => {
  const moduleKeys = new Set(SYSTEM_MODULE_CATALOG.map((moduleEntry) => moduleEntry.key));
  assert.equal(moduleKeys.has(TEAM_MODULE_KEY), true);
});

test('RBAC catalog includes dashboard module in registry', () => {
  const moduleKeys = new Set(SYSTEM_MODULE_CATALOG.map((moduleEntry) => moduleEntry.key));
  assert.equal(moduleKeys.has(DASHBOARD_MODULE_KEY), true);
});

test('RBAC catalog includes required TEAM permissions', () => {
  const permissionKeys = new Set(
    SYSTEM_PERMISSION_CATALOG
      .filter((permissionEntry) => permissionEntry.moduleKey === TEAM_MODULE_KEY)
      .map((permissionEntry) => permissionEntry.key),
  );

  assert.equal(permissionKeys.has(TEAM_PERMISSIONS.view), true);
  assert.equal(permissionKeys.has(TEAM_PERMISSIONS.invite), true);
  assert.equal(permissionKeys.has(TEAM_PERMISSIONS.edit), true);
  assert.equal(permissionKeys.has(TEAM_PERMISSIONS.deactivate), true);
  assert.equal(permissionKeys.has(TEAM_PERMISSIONS.rolesAssign), true);
});

test('RBAC catalog includes required dashboard permission', () => {
  const permissionKeys = new Set(
    SYSTEM_PERMISSION_CATALOG
      .filter((permissionEntry) => permissionEntry.moduleKey === DASHBOARD_MODULE_KEY)
      .map((permissionEntry) => permissionEntry.key),
  );

  assert.equal(permissionKeys.has(DASHBOARD_PERMISSIONS.view), true);
});
