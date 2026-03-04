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
      // Only active memberships grant workspace access.
      // Inactive/pending memberships must be treated as non-members for guards.
      select: {
        id: true,
        status: true,
      },
    });

    return membership?.status === 'ACTIVE';
  },
};
