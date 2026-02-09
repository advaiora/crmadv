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
};
