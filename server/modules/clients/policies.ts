import type { FastifyRequest } from 'fastify';
import { requireAuth } from '../../guards/requireAuth.js';
import { requireModuleEnabled } from '../../guards/requireModule.js';
import { requirePermission } from '../../guards/requirePermission.js';
import { requireWorkspace } from '../../guards/requireWorkspace.js';

export const CLIENTS_MODULE_KEY = 'clients';

export const CLIENTS_PERMISSIONS = {
  view: 'clients.view',
  create: 'clients.create',
  edit: 'clients.edit',
  delete: 'clients.delete',
} as const;

type ClientsPermissionKey = (typeof CLIENTS_PERMISSIONS)[keyof typeof CLIENTS_PERMISSIONS];

export const ensureClientsAccess = async (
  request: FastifyRequest,
  permissionKey: ClientsPermissionKey,
) => {
  const user = await requireAuth(request);
  const workspace = await requireWorkspace(request, user.id);
  await requireModuleEnabled(workspace.id, CLIENTS_MODULE_KEY);
  await requirePermission(user.id, workspace.id, permissionKey);

  return { user, workspace };
};
