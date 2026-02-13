import type { FastifyRequest } from 'fastify';
import { requireAuth } from '../../guards/requireAuth.js';
import { requireModuleEnabled } from '../../guards/requireModule.js';
import { requirePermission } from '../../guards/requirePermission.js';
import { requireWorkspace } from '../../guards/requireWorkspace.js';

export const PROJECTS_MODULE_KEY = 'projects';

export const PROJECTS_PERMISSIONS = {
  view: 'projects.view',
  create: 'projects.create',
  edit: 'projects.edit',
  delete: 'projects.delete',
  moveStage: 'projects.move_stage',
} as const;

type ProjectsPermissionKey = (typeof PROJECTS_PERMISSIONS)[keyof typeof PROJECTS_PERMISSIONS];

export const ensureProjectsAccess = async (
  request: FastifyRequest,
  permissionKey: ProjectsPermissionKey,
) => {
  const user = await requireAuth(request);
  const workspace = await requireWorkspace(request, user.id);
  await requireModuleEnabled(workspace.id, PROJECTS_MODULE_KEY);
  await requirePermission(user.id, workspace.id, permissionKey);

  return { user, workspace };
};

export const ensureProjectsMoveStageAccess = async (request: FastifyRequest) => {
  return ensureProjectsAccess(request, PROJECTS_PERMISSIONS.moveStage);
};
