import type { FastifyRequest } from 'fastify';
import { ensureAccess, type GuardAccessContext } from '../../auth/guards.js';

export const CHECKLISTS_MODULE_KEY = 'checklists';

export const CHECKLISTS_PERMISSIONS = {
  view: 'checklists.view',
  manageTemplates: 'checklists.manage_templates',
  // Legacy granular keys kept for backward compatibility.
  create: 'checklists.create',
  edit: 'checklists.edit',
  delete: 'checklists.delete',
  completeItem: 'checklists.complete_item',
  assign: 'checklists.assign',
  overrideGate: 'checklists.override_gate',
} as const;

type ChecklistsPermissionKey =
  (typeof CHECKLISTS_PERMISSIONS)[keyof typeof CHECKLISTS_PERMISSIONS];

type EnsureChecklistsAccessDependencies = {
  ensureAccessFn: typeof ensureAccess;
};

const defaultDependencies: EnsureChecklistsAccessDependencies = {
  ensureAccessFn: ensureAccess,
};

export const buildEnsureChecklistsAccess = (
  dependencies: EnsureChecklistsAccessDependencies = defaultDependencies,
) => {
  return (
    request: FastifyRequest,
    permissionKey: ChecklistsPermissionKey,
  ): Promise<GuardAccessContext> =>
    dependencies.ensureAccessFn(request, {
      moduleKey: CHECKLISTS_MODULE_KEY,
      permission: permissionKey,
    });
};

export const ensureChecklistsAccess = buildEnsureChecklistsAccess();
