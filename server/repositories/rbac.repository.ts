import { heldByActiveMember } from '../core/membership-access.js';
import { NOT_DELETED } from '../core/soft-delete.js';
import { prisma } from '../prisma.js';

/**
 * Quali assegnazioni (`UserRole`) contano davvero, dal Cestino in poi (CRMA-132).
 *
 * Una `UserRole` non si cestina: non ha una vita propria da buttare, segue il
 * destino delle due righe che collega. Quindi qui non si aggiunge un
 * `deletedAt`: si chiede che **nessuno dei due capi sia nel cestino**.
 *
 * 1. **Il ruolo.** Un ruolo personalizzato cestinato non deve dare piu' niente a
 *    nessuno, altrimenti cestinarlo sarebbe un gesto senza effetto — e questa e'
 *    la meta' piu' silenziosa delle due: nella pagina Ruoli e permessi quel
 *    ruolo non si vede piu', quindi nessuno andrebbe a cercarlo li'.
 * 2. **La persona.** Chi e' stato messo nel cestino nel workspace non esercita
 *    piu' i permessi che aveva. ⚠️ Questo e' un **secondo strato di difesa**, non
 *    l'unico: il rifiuto vero e' un 403 di `requireWorkspace` sulla membership
 *    cestinata (CRMA-157), e arriva prima. Lo strato serve dove quel 403 non
 *    passa — `/auth/me`, le letture che compongono permessi per una persona che
 *    non e' chi sta chiamando — e serve il giorno in cui qualcuno aggiunge una
 *    rotta dimenticandosi la guardia.
 *
 * Il filtro sulla persona guarda la **membership**, non `User`: `User` non ha
 * `deletedAt` e non deve averlo (`server/core/membership-access.ts:11-18`), perche'
 * una persona cestinata in un workspace resta intera in tutti gli altri.
 *
 * `NOT_DELETED` sta in fondo allo spread di proposito: cosi' un chiamante che
 * passi un `roleWhere` non puo' togliere il filtro, nemmeno per sbaglio.
 */
export const buildEffectiveUserRoleWhere = <T extends object>(
  userId: string,
  workspaceId: string,
  roleWhere: T = {} as T,
) => ({
  userId,
  workspaceId,
  ...heldByActiveMember(workspaceId),
  role: {
    ...roleWhere,
    ...NOT_DELETED,
  },
});

export const rbacRepository = {
  async hasPermission(userId: string, workspaceId: string, permissionKey: string): Promise<boolean> {
    const superadminRole = await prisma.userRole.findFirst({
      where: buildEffectiveUserRoleWhere(userId, workspaceId, {
        isSuperadmin: true,
      }),
      select: {
        id: true,
      },
    });

    if (superadminRole) {
      return true;
    }

    const roleWithPermission = await prisma.userRole.findFirst({
      where: buildEffectiveUserRoleWhere(userId, workspaceId, {
        rolePermissions: {
          some: {
            permission: {
              key: permissionKey,
            },
          },
        },
      }),
      select: {
        id: true,
      },
    });

    return Boolean(roleWithPermission);
  },

  async listUserPermissions(userId: string, workspaceId: string): Promise<string[]> {
    const userRoles = await prisma.userRole.findMany({
      where: buildEffectiveUserRoleWhere(userId, workspaceId),
      select: {
        role: {
          select: {
            isSuperadmin: true,
            rolePermissions: {
              select: {
                permission: {
                  select: {
                    key: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const isSuperadmin = userRoles.some((userRole) => userRole.role.isSuperadmin);
    if (isSuperadmin) {
      const allPermissions = await prisma.permission.findMany({
        select: {
          key: true,
        },
        orderBy: {
          key: 'asc',
        },
      });

      return allPermissions.map((permission) => permission.key);
    }

    const permissionKeys = new Set<string>();
    for (const userRole of userRoles) {
      for (const rolePermission of userRole.role.rolePermissions) {
        permissionKeys.add(rolePermission.permission.key);
      }
    }

    return Array.from(permissionKeys).sort();
  },

  async listUserRoles(userId: string, workspaceId: string): Promise<string[]> {
    const userRoles = await prisma.userRole.findMany({
      where: buildEffectiveUserRoleWhere(userId, workspaceId),
      select: {
        role: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        role: {
          name: 'asc',
        },
      },
    });

    return userRoles.map((userRole) => userRole.role.name);
  },
};
