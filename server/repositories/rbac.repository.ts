import { prisma } from '../prisma.js';

export const rbacRepository = {
  async hasPermission(userId: string, workspaceId: string, permissionKey: string): Promise<boolean> {
    const superadminRole = await prisma.userRole.findFirst({
      where: {
        userId,
        workspaceId,
        role: {
          isSuperadmin: true,
        },
      },
      select: {
        id: true,
      },
    });

    if (superadminRole) {
      return true;
    }

    const roleWithPermission = await prisma.userRole.findFirst({
      where: {
        userId,
        workspaceId,
        role: {
          rolePermissions: {
            some: {
              permission: {
                key: permissionKey,
              },
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    return Boolean(roleWithPermission);
  },

  async listUserPermissions(userId: string, workspaceId: string): Promise<string[]> {
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId,
        workspaceId,
      },
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
      where: {
        userId,
        workspaceId,
      },
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
