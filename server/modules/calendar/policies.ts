import type { FastifyRequest } from 'fastify';
import { requireAuth } from '../../guards/requireAuth.js';
import { requireModuleEnabled } from '../../guards/requireModule.js';
import { requirePermission } from '../../guards/requirePermission.js';
import { requireWorkspace } from '../../guards/requireWorkspace.js';

export const CALENDAR_MODULE_KEY = 'calendar';

export const CALENDAR_PERMISSIONS = {
  view: 'calendar.view',
  create: 'calendar.create',
  edit: 'calendar.edit',
  delete: 'calendar.delete',
} as const;

export type CalendarPermissionKey =
  (typeof CALENDAR_PERMISSIONS)[keyof typeof CALENDAR_PERMISSIONS];

export const ensureCalendarAccess = async (
  request: FastifyRequest,
  permissionKey: CalendarPermissionKey,
) => {
  const user = await requireAuth(request);
  const workspace = await requireWorkspace(request, user.id);

  await requireModuleEnabled(workspace.id, CALENDAR_MODULE_KEY);
  await requirePermission(user.id, workspace.id, permissionKey);

  return { user, workspace };
};
