import type { FastifyRequest } from 'fastify';
import { requireAuth } from '../../guards/requireAuth.js';
import { requireModuleEnabled } from '../../guards/requireModule.js';
import { requirePermission } from '../../guards/requirePermission.js';
import { requireWorkspace } from '../../guards/requireWorkspace.js';

export const MESSAGING_MODULE_KEY = 'team';

export const MESSAGING_PERMISSIONS = {
  view: 'team.view',
  send: 'team.view',
} as const;

type MessagingPermissionKey =
  (typeof MESSAGING_PERMISSIONS)[keyof typeof MESSAGING_PERMISSIONS];

export const ensureMessagingAccess = async (
  request: FastifyRequest,
  permissionKey: MessagingPermissionKey,
) => {
  const user = await requireAuth(request);
  const workspace = await requireWorkspace(request, user.id);

  await requireModuleEnabled(workspace.id, MESSAGING_MODULE_KEY);
  await requirePermission(user.id, workspace.id, permissionKey);

  return { user, workspace };
};
