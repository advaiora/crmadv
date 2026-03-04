import type { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';

const teamInviteSelect = {
  id: true,
  workspaceId: true,
  email: true,
  tokenHash: true,
  expiresAt: true,
  status: true,
  rolePresetName: true,
  invitedByUserId: true,
  acceptedByUserId: true,
  acceptedAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
  workspace: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  invitedByUser: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  acceptedByUser: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.TeamInviteSelect;

export type TeamInviteRecord = Prisma.TeamInviteGetPayload<{
  select: typeof teamInviteSelect;
}>;

const withClient = (tx?: Prisma.TransactionClient) => tx ?? prisma;

export const teamInviteRepository = {
  expirePendingInvites(
    workspaceId: string,
    now: Date,
    tx?: Prisma.TransactionClient,
  ) {
    return withClient(tx).teamInvite.updateMany({
      where: {
        workspaceId,
        status: 'PENDING',
        expiresAt: {
          lt: now,
        },
      },
      data: {
        status: 'EXPIRED',
      },
    });
  },

  expirePendingInviteById(
    inviteId: string,
    now: Date,
    tx?: Prisma.TransactionClient,
  ) {
    return withClient(tx).teamInvite.updateMany({
      where: {
        id: inviteId,
        status: 'PENDING',
        expiresAt: {
          lt: now,
        },
      },
      data: {
        status: 'EXPIRED',
      },
    });
  },

  findPendingInviteByEmail(
    workspaceId: string,
    email: string,
    tx?: Prisma.TransactionClient,
  ) {
    return withClient(tx).teamInvite.findFirst({
      where: {
        workspaceId,
        email,
        status: 'PENDING',
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: teamInviteSelect,
    });
  },

  createInvite(
    input: {
      workspaceId: string;
      email: string;
      tokenHash: string;
      expiresAt: Date;
      rolePresetName: string;
      invitedByUserId: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    return withClient(tx).teamInvite.create({
      data: {
        workspaceId: input.workspaceId,
        email: input.email,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        rolePresetName: input.rolePresetName,
        invitedByUserId: input.invitedByUserId,
      },
      select: teamInviteSelect,
    });
  },

  refreshPendingInvite(
    input: {
      inviteId: string;
      tokenHash: string;
      expiresAt: Date;
      rolePresetName: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    return withClient(tx).teamInvite.update({
      where: {
        id: input.inviteId,
      },
      data: {
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        rolePresetName: input.rolePresetName,
      },
      select: teamInviteSelect,
    });
  },

  listInvitesByWorkspace(workspaceId: string) {
    return prisma.teamInvite.findMany({
      where: {
        workspaceId,
      },
      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'asc',
        },
      ],
      select: teamInviteSelect,
    });
  },

  findInviteById(workspaceId: string, inviteId: string) {
    return prisma.teamInvite.findFirst({
      where: {
        workspaceId,
        id: inviteId,
      },
      select: teamInviteSelect,
    });
  },

  findInviteByTokenHash(tokenHash: string, tx?: Prisma.TransactionClient) {
    return withClient(tx).teamInvite.findFirst({
      where: {
        tokenHash,
      },
      select: teamInviteSelect,
    });
  },

  revokePendingInvite(
    workspaceId: string,
    inviteId: string,
    revokedAt: Date,
    tx?: Prisma.TransactionClient,
  ) {
    return withClient(tx).teamInvite.updateMany({
      where: {
        workspaceId,
        id: inviteId,
        status: 'PENDING',
      },
      data: {
        status: 'REVOKED',
        revokedAt,
      },
    });
  },

  deleteInviteById(
    workspaceId: string,
    inviteId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return withClient(tx).teamInvite.deleteMany({
      where: {
        workspaceId,
        id: inviteId,
      },
    });
  },

  markInviteAccepted(
    inviteId: string,
    acceptedByUserId: string,
    acceptedAt: Date,
    tx?: Prisma.TransactionClient,
  ) {
    return withClient(tx).teamInvite.updateMany({
      where: {
        id: inviteId,
        status: 'PENDING',
      },
      data: {
        status: 'ACCEPTED',
        acceptedAt,
        acceptedByUserId,
      },
    });
  },
};
