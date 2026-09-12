// Riparazione dei difetti di accesso a un workspace al momento dell'ingresso:
// se un utente attivo non ha nessuna assegnazione che gli dia qualcosa glielo si
// assegna, e in ogni caso si risincronizzano i ruoli di sistema (che altrimenti
// resterebbero indietro quando si aggiungono moduli o permessi nuovi dopo la
// creazione del workspace).
//
// ⚠️ «Nessuna assegnazione che gli dia qualcosa» non e' «nessuna assegnazione»: dal
// Cestino in poi le due cose differiscono, e la differenza e' il difetto che
// CRMA-132 ha chiuso. Vedi il conteggio qui sotto.

import type { Prisma } from '@prisma/client';
import {
  assignWorkspaceUserRole,
  ensureWorkspaceSystemRoles,
  SYSTEM_ROLE_NAME,
  type WorkspaceSystemRoleName,
} from '../../auth/workspace-bootstrap.js';
import { activeMember } from '../../core/membership-access.js';
import { buildGrantingUserRoleWhere } from '../../repositories/rbac.repository.js';

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
  // ⚠️ Si contano solo le assegnazioni che concedono ancora qualcosa, cioe' quelle
  // verso un ruolo non cestinato (CRMA-132). Con il conteggio nudo, chi ha come
  // unica assegnazione un ruolo finito nel cestino si trova con zero permessi e
  // **nessuna auto-riparazione**: il conteggio vedrebbe 1, `shouldAssignRole`
  // resterebbe falso, e la persona entrerebbe in un CRM dove non puo' fare niente
  // senza che nessun errore lo dica. E' il difetto gemello del filtro in lettura:
  // da quando un ruolo cestinato non concede piu' i suoi permessi, un conteggio
  // che li conta ancora sta rispondendo alla domanda di prima.
  const grantingRoleCount = await tx.userRole.count({
    where: buildGrantingUserRoleWhere(userId, workspaceId),
  });

  const shouldAssignRole = grantingRoleCount === 0;
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
