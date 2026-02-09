import { prisma } from '../prisma.js';

export const membershipRepository = {
  async isMember(userId: string, workspaceId: string): Promise<boolean> {
    const membership = await prisma.membership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      select: {
        id: true,
      },
    });

    return Boolean(membership);
  },
};
