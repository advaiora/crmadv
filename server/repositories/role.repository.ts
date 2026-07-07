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

export const roleRepository = {
  async listRolesWithPermissions(workspaceId: string): Promise<RoleRecord[]> {
    const roles = await prisma.role.findMany({
      where: {
        workspaceId,
      },
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

  async findRoleById(workspaceId: string, roleId: string): Promise<RoleRecord | null> {
    const role = await prisma.role.findFirst({
      where: {
        id: roleId,
        workspaceId,
      },
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

  findRoleByName(workspaceId: string, roleName: string) {
    return prisma.role.findFirst({
      where: {
        workspaceId,
        name: roleName,
      },
      select: {
        id: true,
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

  countUserAssignments(workspaceId: string, roleId: string): Promise<number> {
    return prisma.userRole.count({
      where: {
        workspaceId,
        roleId,
      },
    });
  },

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
      where: {
        workspaceId,
        id: {
          in: roleIds,
        },
      },
      select: {
        id: true,
        name: true,
        isSystem: true,
      },
    });
  },

  async listUserCustomRoleIds(workspaceId: string, userId: string): Promise<string[]> {
    const userRoles = await prisma.userRole.findMany({
      where: {
        workspaceId,
        userId,
        role: {
          isSystem: false,
        },
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

  async listUserCustomRoles(
    workspaceId: string,
    userId: string,
  ): Promise<{ id: string; name: string }[]> {
    const userRoles = await prisma.userRole.findMany({
      where: {
        workspaceId,
        userId,
        role: {
          isSystem: false,
        },
      },
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
      where: {
        workspaceId,
        id: {
          in: roleIds,
        },
      },
    });
  },

  async listUserRoleIds(workspaceId: string, userId: string): Promise<string[]> {
    const userRoles = await prisma.userRole.findMany({
      where: {
        workspaceId,
        userId,
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
