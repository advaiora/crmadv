// Riparazione dei difetti di accesso a un workspace al momento dell'ingresso:
// se un utente attivo non ha nessun ruolo assegnato glielo si assegna, e in ogni
// caso si risincronizzano i ruoli di sistema (che altrimenti resterebbero indietro
// quando si aggiungono moduli o permessi nuovi dopo la creazione del workspace).

import type { Prisma } from '@prisma/client';
import {
  assignWorkspaceUserRole,
  ensureWorkspaceSystemRoles,
  SYSTEM_ROLE_NAME,
  type WorkspaceSystemRoleName,
} from '../../auth/workspace-bootstrap.js';
import { activeMember } from '../../core/membership-access.js';

const LEGACY_USER_ROLE_TO_WORKSPACE_ROLE: Record<string, WorkspaceSystemRoleName> = {
  superadmin: SYSTEM_ROLE_NAME.superadmin,
  admin: SYSTEM_ROLE_NAME.admin,
  manager: SYSTEM_ROLE_NAME.manager,
  operativo: SYSTEM_ROLE_NAME.operativo,
  viewer: SYSTEM_ROLE_NAME.viewer,
};

export const resolveFallbackWorkspaceRoleName = (
  legacyUserRole: string | null | undefined,
): WorkspaceSystemRoleName => {
  if (!legacyUserRole) {
    return SYSTEM_ROLE_NAME.viewer;
  }

  const normalizedRole = legacyUserRole.trim().toLowerCase();
  return LEGACY_USER_ROLE_TO_WORKSPACE_ROLE[normalizedRole] ?? SYSTEM_ROLE_NAME.viewer;
};

export const ensureWorkspaceAccessDefaults = async ({
  tx,
  workspaceId,
  userId,
  fallbackUserRole,
  sourceAction,
}: {
  tx: Prisma.TransactionClient;
  workspaceId: string;
  userId: string;
  fallbackUserRole: string | null | undefined;
  sourceAction: string;
}) => {
  const [assignedRoleCount] = await Promise.all([
    tx.userRole.count({
      where: {
        workspaceId,
        userId,
      },
    }),
  ]);

  const shouldAssignRole = assignedRoleCount === 0;
  // Always sync RBAC catalogs and system role permissions to prevent permission drift
  // when new modules/permissions are introduced after workspace creation.
  await ensureWorkspaceSystemRoles({
    tx,
    workspaceId,
    actorUserId: userId,
    sourceAction,
  });

  if (!shouldAssignRole) {
    return null;
  }

  // I cestinati non contano come membri: se contassero, un workspace svuotato
  // non promuoverebbe piu' nessuno a Superadmin (CRMA-157).
  const activeWorkspaceUserCount = await tx.membership.count({
    where: activeMember({ workspaceId }),
  });

  const nextRoleName =
    activeWorkspaceUserCount <= 1
      ? SYSTEM_ROLE_NAME.superadmin
      : resolveFallbackWorkspaceRoleName(fallbackUserRole);

  return assignWorkspaceUserRole({
    tx,
    workspaceId,
    targetUserId: userId,
    actorUserId: userId,
    nextRoleName,
    sourceAction,
    enforceHierarchy: false,
    auditAction: 'rbac.user.role.assigned',
  });
};
