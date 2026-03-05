import type { FastifyRequest } from 'fastify';
import { ensureAccess } from '../../auth/guards.js';

export const AUDIT_MODULE_KEY = 'audit';

export const AUDIT_PERMISSIONS = {
  view: 'audit.view',
} as const;

export type AuditPermissionKey = (typeof AUDIT_PERMISSIONS)[keyof typeof AUDIT_PERMISSIONS];

export const ensureAuditAccess = (
  request: FastifyRequest,
  permissionKey: AuditPermissionKey = AUDIT_PERMISSIONS.view,
) =>
  ensureAccess(request, {
    moduleKey: AUDIT_MODULE_KEY,
    permission: permissionKey,
  });
