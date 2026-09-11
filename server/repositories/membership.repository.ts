import { prisma } from '../prisma.js';
import { MEMBERSHIP_ACCESS_SELECT, grantsWorkspaceAccess } from '../core/membership-access.js';

export const membershipRepository = {
  async isMember(userId: string, workspaceId: string): Promise<boolean> {
    const membership = await prisma.membership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      // Solo le membership attive E non cestinate danno accesso al workspace.
      // Le membership inattive o in attesa vanno trattate come non-membri dai
      // guard; dal Cestino in poi, anche quelle cestinate — che restano
      // `ACTIVE`, quindi il solo stato non basta piu' (CRMA-157).
      // Il filtro non puo' stare nel `where`: `findUnique` accetta li' i soli
      // campi della chiave unica. Si legge `deletedAt` e si decide qui.
      select: MEMBERSHIP_ACCESS_SELECT,
    });

    return grantsWorkspaceAccess(membership);
  },
};
