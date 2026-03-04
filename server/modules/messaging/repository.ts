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
};
