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
  ...towardLiveRole(roleWhere),
});

/**
 * Il capo «ruolo» del filtro, da solo: un'assegnazione vale se il ruolo verso cui
 * punta non e' nel cestino. Sta in una funzione perche' lo vogliono in due, e i
 * due non vogliono la stessa altra meta' (vedi `buildGrantingUserRoleWhere`).
 */
const towardLiveRole = <T extends object>(roleWhere: T = {} as T) => ({
  role: {
    ...roleWhere,
    ...NOT_DELETED,
  },
});

/**
 * Le assegnazioni di una persona che le **concedono ancora qualcosa**, per chi
 * deve contarle invece di leggerle (CRMA-132, rilievo del Guardiano su CRMA-131).
 *
 * Esiste separato da `buildEffectiveUserRoleWhere` per una differenza voluta:
 * qui **non c'e' il filtro sulla membership**, e non e' una dimenticanza.
 *
 * Il chiamante e' l'auto-riparazione dell'accesso al workspace
 * (`ensureWorkspaceAccessDefaults`), che sul conteggio zero **scrive**: assegna un
 * ruolo di ripiego, e in un workspace con un solo membro attivo quel ripiego e'
 * **Superadmin**. Con il filtro sulla membership dentro, una persona cestinata
 * arriverebbe al conteggio zero e uscirebbe da quella riparazione con
 * un'assegnazione nuova — cestinata e Superadmin insieme, pronta al ripristino.
 * Un filtro in piu' che apre una strada invece di chiuderla.
 *
 * Che la persona sia ancora dentro il workspace lo decide chi chiama, prima e
 * altrove: `listMemberships` legge solo le membership attive e non cestinate
 * (CRMA-157), quindi al conteggio non arriva nessun cestinato.
 */
export const buildGrantingUserRoleWhere = (userId: string, workspaceId: string) => ({
  userId,
  workspaceId,
  ...towardLiveRole(),
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
