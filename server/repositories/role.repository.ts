import { heldByActiveMember } from '../core/membership-access.js';
import { NOT_DELETED, markTrashed, notDeleted } from '../core/soft-delete.js';
import { prisma } from '../prisma.js';

type RolePermissionRecord = {
  id: string;
  key: string;
};

type RoleRecord = {
  id: string;
  name: string;
  isSystem: boolean;
  isSuperadmin: boolean;
  permissions: string[];
};

/**
 * Il `where` del gesto «cestina ruolo» (CRMA-165), esportato per essere
 * provabile senza database.
 */
export const buildTrashRoleWhere = (workspaceId: string, roleId: string) =>
  notDeleted({
    id: roleId,
    workspaceId,
  });

/**
 * I `where` delle letture dei ruoli, dal Cestino in poi (CRMA-132).
 *
 * La regola che li tiene insieme e' quella di `soft-delete.ts`: **ogni lettura**
 * di un'entita' cestinabile esclude i cestinati, altrimenti il ruolo buttato
 * ricompare in un punto solo del CRM e non lo trova nessun test — perche' il
 * codice funziona, sta rispondendo a una domanda che nessuno ha aggiornato.
 *
 * Sono funzioni esportate, e non `notDeleted({...})` scritto dentro ogni query,
 * perche' cosi' il filtro si prova senza database: e' l'unica parte di queste
 * letture che puo' sbagliarsi restando verde (nota #76 per il runner).
 */
export const buildLiveRolesWhere = (workspaceId: string) => notDeleted({ workspaceId });

export const buildLiveRoleWhere = (workspaceId: string, roleId: string) =>
  notDeleted({ id: roleId, workspaceId });

export const buildLiveRolesByIdsWhere = (workspaceId: string, roleIds: string[]) =>
  notDeleted({ workspaceId, id: { in: roleIds } });

/**
 * ⚠️ L'ECCEZIONE, e l'unica: il `where` con cui si controlla se un nome di ruolo
 * e' gia' preso **non** filtra i cestinati, ed e' voluto.
 *
 * `@@unique([workspaceId, name])` vale anche sulle righe nel cestino
 * (`prisma/schema.prisma:1438`, 1444): un nome resta occupato finche' il ruolo
 * che lo porta non e' eliminato definitivamente. Se questa lettura filtrasse,
 * `createRole` non vedrebbe il ruolo cestinato, proverebbe a inserire il nome
 * e si schianterebbe sul vincolo del database — un 500 al posto di un 400.
 *
 * Si legge anche `deletedAt`, cosi' chi chiama puo' dire *perche'* il nome e'
 * occupato: «esiste un ruolo con questo nome» e «ne esiste uno nel cestino, che
 * tu non puoi vedere» sono lo stesso errore per il database e due vicoli molto
 * diversi per chi sta davanti allo schermo.
 */
export const buildRoleNameWhere = (workspaceId: string, roleName: string) => ({
  workspaceId,
  name: roleName,
});

/**
 * Le assegnazioni che bloccano la cancellazione di un ruolo (CRMA-132).
 *
 * Decisione di questo compito, che la scheda lasciava aperta: **un ruolo
 * assegnato soltanto a persone cestinate si sblocca.** Il motivo e' che quelle
 * assegnazioni non danno piu' niente a nessuno — `buildEffectiveUserRoleWhere`
 * le scarta — quindi «il ruolo e' ancora in uso» sarebbe falso: terrebbe fermo
 * un ruolo che nessuno esercita, e lo terrebbe fermo per sempre, perche' una
 * persona nel cestino puo' restarci a tempo indeterminato.
 *
 * ⚠️ Il prezzo, da tenere presente leggendo `deleteRole`: cestinando un ruolo
 * cosi' restano a database delle `UserRole` verso una persona cestinata. Non e'
 * sporcizia, e' la regola 1 del Cestino (nessuna cascata): se poi quella persona
 * viene riammessa, torna con l'assegnazione intatta — e quell'assegnazione non
 * le da' niente finche' il ruolo e' nel cestino, e le ritorna utile se anche il
 * ruolo viene ripristinato. E' il comportamento che si vuole da un cestino.
 */
export const buildRoleAssignmentsWhere = (workspaceId: string, roleId: string) => ({
  workspaceId,
  roleId,
  ...heldByActiveMember(workspaceId),
});

/**
 * I ruoli personalizzati di una persona: quelli di sistema no (li gestisce il
 * ruolo base), e quelli nel cestino nemmeno — non devono comparire nella scheda
 * di nessuno, come non compaiono nel catalogo.
 */
export const buildUserCustomRolesWhere = (workspaceId: string, userId: string) => ({
  workspaceId,
  userId,
  role: notDeleted({ isSystem: false }),
});

export const roleRepository = {
  async listRolesWithPermissions(workspaceId: string): Promise<RoleRecord[]> {
    const roles = await prisma.role.findMany({
      where: buildLiveRolesWhere(workspaceId),
      select: {
        id: true,
        name: true,
        isSystem: true,
        isSuperadmin: true,
        rolePermissions: {
          select: {
            permission: {
              select: {
                key: true,
              },
            },
          },
          orderBy: {
            permission: {
              key: 'asc',
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      isSystem: role.isSystem,
      isSuperadmin: role.isSuperadmin,
      permissions: role.rolePermissions.map((entry) => entry.permission.key),
    }));
  },

  /**
   * ⚠️ Un ruolo nel cestino qui non si trova, e chi chiama lo tratta come
   * inesistente: e' cosi' che «modifica ruolo» e «elimina ruolo» rispondono 404
   * su un ruolo cestinato invece di lavorarci sopra. Il ripristino dal Cestino
   * non passa da qui, per questo (legge con `onlyDeleted`).
   */
  async findRoleById(workspaceId: string, roleId: string): Promise<RoleRecord | null> {
    const role = await prisma.role.findFirst({
      where: buildLiveRoleWhere(workspaceId, roleId),
      select: {
        id: true,
        name: true,
        isSystem: true,
        isSuperadmin: true,
        rolePermissions: {
          select: {
            permission: {
              select: {
                key: true,
              },
            },
          },
          orderBy: {
            permission: {
              key: 'asc',
            },
          },
        },
      },
    });

    if (!role) {
      return null;
    }

    return {
      id: role.id,
      name: role.name,
      isSystem: role.isSystem,
      isSuperadmin: role.isSuperadmin,
      permissions: role.rolePermissions.map((entry) => entry.permission.key),
    };
  },

  // Vedi `buildRoleNameWhere`: questa e' la lettura che NON filtra il cestino.
  findRoleByName(workspaceId: string, roleName: string) {
    return prisma.role.findFirst({
      where: buildRoleNameWhere(workspaceId, roleName),
      select: {
        id: true,
        deletedAt: true,
      },
    });
  },

  listPermissionsByKeys(permissionKeys: string[]): Promise<RolePermissionRecord[]> {
    if (permissionKeys.length === 0) {
      return Promise.resolve([]);
    }

    return prisma.permission.findMany({
      where: {
        key: {
          in: permissionKeys,
        },
      },
      select: {
        id: true,
        key: true,
      },
    });
  },

  async createRoleWithPermissions(
    workspaceId: string,
    roleName: string,
    permissionIds: string[],
  ): Promise<RoleRecord> {
    const createdRole = await prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          workspaceId,
          name: roleName,
          isSystem: false,
          isSuperadmin: false,
        },
        select: {
          id: true,
        },
      });

      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId: role.id,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }

      return role.id;
    });

    return (await this.findRoleById(workspaceId, createdRole)) as RoleRecord;
  },

  async updateRoleWithPermissions(
    workspaceId: string,
    roleId: string,
    roleName: string,
    permissionIds: string[],
  ): Promise<RoleRecord> {
    await prisma.$transaction(async (tx) => {
      await tx.role.updateMany({
        where: {
          id: roleId,
          workspaceId,
        },
        data: {
          name: roleName,
        },
      });

      await tx.rolePermission.deleteMany({
        where: {
          roleId,
          role: {
            workspaceId,
          },
        },
      });

      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }
    });

    return (await this.findRoleById(workspaceId, roleId)) as RoleRecord;
  },

  // Conta solo chi e' ancora dentro il workspace: vedi
  // `buildRoleAssignmentsWhere` per la decisione e per il suo prezzo.
  countUserAssignments(workspaceId: string, roleId: string): Promise<number> {
    return prisma.userRole.count({
      where: buildRoleAssignmentsWhere(workspaceId, roleId),
    });
  },

  /**
   * Sposta un ruolo nel cestino (CRMA-165).
   *
   * Ha preso il posto della `deleteMany` che stava qui. Il permesso resta
   * `roles.manage`: e' lo stesso gesto, cambia cosa ne resta a database.
   *
   * `notDeleted` nel `where` evita che cancellare due volte lo stesso ruolo
   * riscriva la data e il nome di chi l'ha buttato la prima volta.
   */
  async markRoleTrashed(
    workspaceId: string,
    roleId: string,
    actorUserId: string,
  ): Promise<boolean> {
    const result = await prisma.role.updateMany({
      where: buildTrashRoleWhere(workspaceId, roleId),
      data: markTrashed(actorUserId),
    });

    return result.count > 0;
  },

  /**
   * Distrugge davvero il ruolo.
   *
   * ⚠️ Dal 11/9/2026 non e' piu' il gesto di «Elimina ruolo»: e'
   * l'eliminazione definitiva dal Cestino, dietro `trash.purge` (CRMA-135).
   */
  async deleteRole(workspaceId: string, roleId: string): Promise<boolean> {
    const result = await prisma.role.deleteMany({
      where: {
        id: roleId,
        workspaceId,
      },
    });

    return result.count > 0;
  },

  async listRolesByIds(
    workspaceId: string,
    roleIds: string[],
  ): Promise<{ id: string; name: string; isSystem: boolean }[]> {
    if (roleIds.length === 0) {
      return [];
    }

    return prisma.role.findMany({
      where: buildLiveRolesByIdsWhere(workspaceId, roleIds),
      select: {
        id: true,
        name: true,
        isSystem: true,
      },
    });
  },

  async listUserCustomRoleIds(workspaceId: string, userId: string): Promise<string[]> {
    const userRoles = await prisma.userRole.findMany({
      where: buildUserCustomRolesWhere(workspaceId, userId),
      select: {
        roleId: true,
      },
      orderBy: {
        roleId: 'asc',
      },
    });

    return userRoles.map((userRole) => userRole.roleId);
  },

  async listUserCustomRoles(
    workspaceId: string,
    userId: string,
  ): Promise<{ id: string; name: string }[]> {
    const userRoles = await prisma.userRole.findMany({
      where: buildUserCustomRolesWhere(workspaceId, userId),
      select: {
        role: {
          select: {
            id: true,
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

    return userRoles.map((userRole) => ({
      id: userRole.role.id,
      name: userRole.role.name,
    }));
  },

  // Replace the user's additive custom (non-system) roles, leaving their system
  // base role untouched. Callers must validate that roleIds are non-system roles.
  async replaceUserCustomRoles(
    workspaceId: string,
    userId: string,
    roleIds: string[],
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: {
          workspaceId,
          userId,
          role: {
            isSystem: false,
          },
        },
      });

      if (roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId) => ({
            workspaceId,
            userId,
            roleId,
          })),
          skipDuplicates: true,
        });
      }
    });
  },

  async countRolesByIds(workspaceId: string, roleIds: string[]): Promise<number> {
    if (roleIds.length === 0) {
      return 0;
    }

    return prisma.role.count({
      where: buildLiveRolesByIdsWhere(workspaceId, roleIds),
    });
  },

  async listUserRoleIds(workspaceId: string, userId: string): Promise<string[]> {
    const userRoles = await prisma.userRole.findMany({
      where: {
        workspaceId,
        userId,
        role: NOT_DELETED,
      },
      select: {
        roleId: true,
      },
      orderBy: {
        roleId: 'asc',
      },
    });

    return userRoles.map((userRole) => userRole.roleId);
  },

  async replaceUserRoles(workspaceId: string, userId: string, roleIds: string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: {
          workspaceId,
          userId,
        },
      });

      if (roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId) => ({
            workspaceId,
            userId,
            roleId,
          })),
          skipDuplicates: true,
        });
      }
    });
  },
};
