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

  /**
   * Il workspace a cui attribuire un'azione fatta SENZA aver scelto un workspace.
   *
   * Serve al recupero password, che e' una rotta pubblica: chi l'ha persa non ha
   * fatto l'accesso, quindi non ha mandato nessuna intestazione
   * `x-workspace-id`. Ma il server di posta e' configurato per workspace
   * (`server/core/mail.ts`), e il registro attivita' vuole sapere dove e'
   * successa la cosa: senza questo, l'email di recupero partirebbe sempre dalle
   * variabili d'ambiente ignorando la pagina «Server di posta».
   *
   * Si prende la prima iscrizione attiva in ordine di anzianita'. Chi appartiene
   * a piu' workspace ne ha uno solo qui, ed e' accettabile: il recupero password
   * riguarda l'account, che e' uno solo, non il workspace.
   */
  async findPrimaryWorkspaceId(userId: string): Promise<string | null> {
    const membership = await prisma.membership.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { workspaceId: true },
    });

    return membership?.workspaceId ?? null;
  },
};
