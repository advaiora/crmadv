import { prisma } from '../../prisma.js';

export type WorkspaceMember = {
  userId: string;
  name: string | null;
  email: string;
  role: string;
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

type CreateAttachmentInput = {
  workspaceId: string;
  messageId: string;
  createdByUserId: string;
  label: string;
  mimeType: string;
  fileSize: number;
  data: Buffer;
};

// Campi dell'allegato che escono verso il client. I BYTE non ci sono: si leggono solo
// nel download, con findAttachmentBinary.
const ATTACHMENT_SELECT = {
  id: true,
  messageId: true,
  label: true,
  mimeType: true,
  fileSize: true,
  createdAt: true,
  createdByUserId: true,
} as const;

const mapMembershipRecordToMember = (item: {
  userId: string;
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
});

export const messagingRepository = {
  async listWorkspaceMembers(input: ListWorkspaceMembersInput) {
    const items = await prisma.membership.findMany({
      where: {
        workspaceId: input.workspaceId,
        status: 'ACTIVE',
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
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  user: {
                    email: {
                      contains: input.query,
                      mode: 'insensitive',
                    },
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
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

  async getWorkspaceMember(workspaceId: string, userId: string) {
    const membership = await prisma.membership.findFirst({
      where: {
        workspaceId,
        userId,
        status: 'ACTIVE',
      },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!membership) {
      return null;
    }

    return mapMembershipRecordToMember(membership);
  },

  listConversationMessages(input: ListConversationMessagesInput) {
    return prisma.workspaceMessage.findMany({
      where: {
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
      },
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
      where: {
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
      },
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
      where: {
        workspaceId: input.workspaceId,
        senderUserId: input.peerUserId,
        recipientUserId: input.userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
  },

  // --- Allegati (A1 punto 8a) ---

  // Il messaggio a cui si vuole allegare, con i due capi della conversazione: chi
  // chiama deve poter verificare workspace E appartenenza prima di scrivere.
  findMessageForAttachment(workspaceId: string, messageId: string) {
    return prisma.workspaceMessage.findFirst({
      where: {
        id: messageId,
        workspaceId,
      },
      select: {
        id: true,
        workspaceId: true,
        senderUserId: true,
        recipientUserId: true,
      },
    });
  },

  countAttachmentsForMessage(messageId: string) {
    return prisma.workspaceMessageAttachment.count({
      where: { messageId },
    });
  },

  // Record + byte in una transazione sola: un allegato senza i suoi byte sarebbe una
  // riga che il download non puo' servire.
  createAttachment(input: CreateAttachmentInput) {
    return prisma.workspaceMessageAttachment.create({
      data: {
        workspaceId: input.workspaceId,
        messageId: input.messageId,
        createdByUserId: input.createdByUserId,
        label: input.label,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        binary: {
          create: {
            data: input.data,
          },
        },
      },
      select: ATTACHMENT_SELECT,
    });
  },

  listAttachmentsForMessages(messageIds: string[]) {
    if (messageIds.length === 0) {
      return Promise.resolve([]);
    }

    return prisma.workspaceMessageAttachment.findMany({
      where: {
        messageId: { in: messageIds },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: ATTACHMENT_SELECT,
    });
  },

  // Byte veri + i due capi del messaggio che possiede l'allegato. La verifica di
  // workspace e di appartenenza la fa il service: qui si legge e basta.
  findAttachmentBinary(attachmentId: string) {
    return prisma.workspaceMessageAttachment.findFirst({
      where: {
        id: attachmentId,
        binary: { isNot: null },
      },
      select: {
        id: true,
        workspaceId: true,
        label: true,
        mimeType: true,
        message: {
          select: {
            id: true,
            senderUserId: true,
            recipientUserId: true,
          },
        },
        binary: { select: { data: true } },
      },
    });
  },

  findAttachmentForDelete(attachmentId: string) {
    return prisma.workspaceMessageAttachment.findFirst({
      where: { id: attachmentId },
      select: {
        id: true,
        workspaceId: true,
        createdByUserId: true,
        message: {
          select: {
            id: true,
            senderUserId: true,
            recipientUserId: true,
          },
        },
      },
    });
  },

  deleteAttachment(attachmentId: string) {
    return prisma.workspaceMessageAttachment.delete({
      where: { id: attachmentId },
    });
  },
};
