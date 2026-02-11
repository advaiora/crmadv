import type { FastifyRequest } from 'fastify';
import { requireAuth } from '../../guards/requireAuth.js';
import { requireModuleEnabled } from '../../guards/requireModule.js';
import { requirePermission } from '../../guards/requirePermission.js';
import { requireWorkspace } from '../../guards/requireWorkspace.js';

export const PROJECTS_MODULE_KEY = 'projects';

export const PROJECTS_PERMISSIONS = {
  moveStage: 'projects.move_stage',
} as const;

export const CHECKLISTS_OVERRIDE_PERMISSION = 'checklists.override_gate';

export const ensureProjectsMoveStageAccess = async (request: FastifyRequest) => {
  const user = await requireAuth(request);
  const workspace = await requireWorkspace(request, user.id);
  await requireModuleEnabled(workspace.id, PROJECTS_MODULE_KEY);
  await requirePermission(user.id, workspace.id, PROJECTS_PERMISSIONS.moveStage);

  return { user, workspace };
};

export const ensureChecklistsOverridePermission = async (
  userId: string,
  workspaceId: string,
) => requirePermission(userId, workspaceId, CHECKLISTS_OVERRIDE_PERMISSION);
