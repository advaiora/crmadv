import type { FastifyRequest } from 'fastify';
import { requireAuth } from '../../guards/requireAuth.js';
import { requireModuleEnabled } from '../../guards/requireModule.js';
import { requirePermission } from '../../guards/requirePermission.js';
import { requireWorkspace } from '../../guards/requireWorkspace.js';

export const CHECKLISTS_MODULE_KEY = 'checklists';

export const CHECKLISTS_PERMISSIONS = {
  view: 'checklists.view',
  create: 'checklists.create',
  edit: 'checklists.edit',
  delete: 'checklists.delete',
  completeItem: 'checklists.complete_item',
} as const;

type ChecklistsPermissionKey =
  (typeof CHECKLISTS_PERMISSIONS)[keyof typeof CHECKLISTS_PERMISSIONS];

export const ensureChecklistsAccess = async (
  request: FastifyRequest,
  permissionKey: ChecklistsPermissionKey,
) => {
  const user = await requireAuth(request);
  const workspace = await requireWorkspace(request, user.id);
  await requireModuleEnabled(workspace.id, CHECKLISTS_MODULE_KEY);
  await requirePermission(user.id, workspace.id, permissionKey);

  return { user, workspace };
};
