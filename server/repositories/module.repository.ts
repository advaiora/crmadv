import { prisma } from '../prisma.js';

export const moduleRepository = {
  async isEnabled(workspaceId: string, moduleKey: string): Promise<boolean> {
    const workspaceModule = await prisma.workspaceModule.findFirst({
      where: {
        workspaceId,
        enabled: true,
        module: {
          key: moduleKey,
        },
      },
      select: {
        id: true,
      },
    });

    return Boolean(workspaceModule);
  },
};
