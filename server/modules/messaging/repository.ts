import { prisma } from '../../prisma.js';
import { isTrashed, notDeleted } from '../../core/soft-delete.js';

export type WorkspaceMember = {
  userId: string;
  name: string | null;
  email: string;
  role: string;
  /**
   * Vero se il contatto e' nel Cestino. Non e' un dettaglio interno: la
   * conversazione con un cestinato resta leggibile (vedi le clausole qui
   * sotto), quindi chi la apre deve poter dire a schermo perche' quel nome
   * non compare piu' fra i contatti.
   */
  isTrashed: boolean;
};

type ListWorkspaceMembersInput = {
  workspaceId: string;
  excludeUserId?: string;
  query?: string;
  limit: number;
};

type ListConversationMessagesInput = {
  workspaceId: string;
  userId: string;
  peerUserId: string;
  limit: number;
  before?: Date;
};

type ListConversationMessagesForUserAndPeersInput = {
  workspaceId: string;
  userId: string;
  peerUserIds: string[];
  limit: number;
};

type CreateMessageInput = {
  workspaceId: string;
  senderUserId: string;
  recipientUserId: string;
  body: string;
};

type MarkConversationAsReadInput = {
  workspaceId: string;
  userId: string;
  peerUserId: string;
};

const mapMembershipRecordToMember = (item: {
  userId: string;
  deletedAt: Date | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  };
}): WorkspaceMember => ({
  userId: item.user.id,
  name: item.user.name,
  email: item.user.email,
  role: item.user.role,
  isTrashed: isTrashed(item),
});

const MEMBERSHIP_SELECT = {
  userId: true,
  deletedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
} as const;

/**
 * Il `where` del picker "nuova conversazione" (CRMA-133).
 *
 * ⚠️ `status: 'ACTIVE'` NON basta a escludere un cestinato, ed e' il punto in
 * cui il filtro sarebbe sfuggito: cestinare non cambia lo stato della
 * membership — la riga resta `ACTIVE` e si nasconde solo per la `deletedAt`
 * (vedi `server/core/soft-delete.ts`). Senza `notDeleted` qui, un contatto
 * messo nel cestino continuerebbe a comparire fra quelli con cui iniziare una
 * conversazione nuova.
 *
 * E' una funzione a se', invece che un oggetto scritto dentro la query, perche'
 * cosi' il filtro si puo' provare senza database: e' quello che fa
 * `repository.test.ts`.
 */
export const buildWorkspaceMembersWhere = (input: ListWorkspaceMembersInput) =>
  notDeleted({
    workspaceId: input.workspaceId,
    status: 'ACTIVE' as const,
    ...(input.excludeUserId
      ? {
          userId: {
            not: input.excludeUserId,
          },
        }
      : {}),
    ...(input.query
      ? {
          OR: [
            {
              user: {
                name: {
                  contains: input.query,
                  mode: 'insensitive' as const,
                },
              },
            },
            {
              user: {
                email: {
                  contains: input.query,
                  mode: 'insensitive' as const,
                },
              },
            },
          ],
        }
      : {}),
  });

/**
 * Il `where` per leggere UN contatto preciso.
 *
 * `includeTrashed` esiste per la regola centrale di questo compito: il picker
 * esclude i cestinati, ma la conversazione gia' scambiata con loro resta
 * leggibile. Le due letture chiedono la stessa riga con due domande diverse, e
 * il chiamante dichiara quale sta facendo (vedi `ensurePeer` nel service).
 */
export const buildWorkspaceMemberWhere = (
  workspaceId: string,
  userId: string,
  options: { includeTrashed?: boolean } = {},
) => {
  const base = {
    workspaceId,
    userId,
    status: 'ACTIVE' as const,
  };

  return options.includeTrashed ? base : notDeleted(base);
};

/**
 * Il `where` della conversazione aperta.
 *
 * Qui `notDeleted` filtra i MESSAGGI cestinati uno per uno, non il contatto: un
 * messaggio buttato via non si rilegge, ma la conversazione con una persona
 * finita nel cestino resta intera. Sono due cestini diversi che cadono sulla
 * stessa schermata, ed e' la distinzione da non perdere rileggendo questo file.
 */
export const buildConversationMessagesWhere = (input: ListConversationMessagesInput) =>
  notDeleted({
    workspaceId: input.workspaceId,
    OR: [
      {
        senderUserId: input.userId,
        recipientUserId: input.peerUserId,
      },
      {
        senderUserId: input.peerUserId,
        recipientUserId: input.userId,
      },
    ],
    ...(input.before
      ? {
          createdAt: {
            lt: input.before,
          },
        }
      : {}),
  });

/**
 * Il `where` della fotografia che alimenta anteprima e non-letti della lista
 * contatti — e, di rimbalzo, il pallino sulla campanella in `TopNav.jsx`.
 *
 * Il conteggio dei non-letti non ha una query sua: esce di qui. Quindi un
 * messaggio cestinato smette di contare come "nuovo" perche' lo esclude questo
 * filtro, e un contatto cestinato smette di contare perche' non entra
 * nemmeno nell'elenco dei `peerUserIds` (lo esclude
 * `buildWorkspaceMembersWhere`).
 */
export const buildConversationMessagesForPeersWhere = (
  input: ListConversationMessagesForUserAndPeersInput,
) =>
  notDeleted({
    workspaceId: input.workspaceId,
    OR: [
      {
        senderUserId: input.userId,
        recipientUserId: {
          in: input.peerUserIds,
        },
      },
      {
        recipientUserId: input.userId,
        senderUserId: {
          in: input.peerUserIds,
        },
      },
    ],
  });

/**
 * Il `where` di "segna come letti".
 *
 * Un messaggio cestinato non si vede, quindi non si puo' nemmeno essere letto:
 * senza `notDeleted` questa `updateMany` timbrerebbe `readAt` su righe che
 * nessuno ha aperto, e un ripristino le riporterebbe indietro gia' lette.
 */
export const buildMarkConversationAsReadWhere = (input: MarkConversationAsReadInput) =>
  notDeleted({
    workspaceId: input.workspaceId,
    senderUserId: input.peerUserId,
    recipientUserId: input.userId,
    readAt: null,
  });

export const messagingRepository = {
  async listWorkspaceMembers(input: ListWorkspaceMembersInput) {
    const items = await prisma.membership.findMany({
      where: buildWorkspaceMembersWhere(input),
      select: MEMBERSHIP_SELECT,
      orderBy: {
        createdAt: 'asc',
      },
      take: input.limit,
    });

    return items.map(mapMembershipRecordToMember).sort((left, right) => {
      const leftLabel = (left.name || left.email).toLowerCase();
      const rightLabel = (right.name || right.email).toLowerCase();
      return leftLabel.localeCompare(rightLabel);
    });
  },

  async getWorkspaceMember(
    workspaceId: string,
    userId: string,
    options: { includeTrashed?: boolean } = {},
  ) {
    const membership = await prisma.membership.findFirst({
      where: buildWorkspaceMemberWhere(workspaceId, userId, options),
      select: MEMBERSHIP_SELECT,
    });

    if (!membership) {
      return null;
    }

    return mapMembershipRecordToMember(membership);
  },

  listConversationMessages(input: ListConversationMessagesInput) {
    return prisma.workspaceMessage.findMany({
      where: buildConversationMessagesWhere(input),
      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],
      take: input.limit,
      select: {
        id: true,
        senderUserId: true,
        recipientUserId: true,
        body: true,
        readAt: true,
        createdAt: true,
      },
    });
  },

  listConversationMessagesForUserAndPeers(
    input: ListConversationMessagesForUserAndPeersInput,
  ) {
    return prisma.workspaceMessage.findMany({
      where: buildConversationMessagesForPeersWhere(input),
      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],
      take: input.limit,
      select: {
        id: true,
        senderUserId: true,
        recipientUserId: true,
        body: true,
        readAt: true,
        createdAt: true,
      },
    });
  },

  createMessage(input: CreateMessageInput) {
    return prisma.workspaceMessage.create({
      data: {
        workspaceId: input.workspaceId,
        senderUserId: input.senderUserId,
        recipientUserId: input.recipientUserId,
        body: input.body,
      },
      select: {
        id: true,
        senderUserId: true,
        recipientUserId: true,
        body: true,
        readAt: true,
        createdAt: true,
      },
    });
  },

  markConversationAsRead(input: MarkConversationAsReadInput) {
    return prisma.workspaceMessage.updateMany({
      where: buildMarkConversationAsReadWhere(input),
      data: {
        readAt: new Date(),
      },
    });
  },
};
