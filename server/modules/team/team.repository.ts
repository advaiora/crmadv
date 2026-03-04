import type { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';

export type TeamMemberRoleRecord = {
  roleId: string;
  roleName: string;
  isSuperadmin: boolean;
};

export type TeamMemberRecord = {
  memberId: string;
  userId: string;
  name: string | null;
  email: string;
  status: string;
  createdAt: Date;
  roles: TeamMemberRoleRecord[];
};

const buildMembershipSelect = (workspaceId: string) => ({
  id: true,
  userId: true,
  status: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      userRoles: {
        where: {
          workspaceId,
        },
        select: {
          role: {
            select: {
              id: true,
              name: true,
              isSuperadmin: true,
            },
          },
        },
        orderBy: {
          role: {
            name: 'asc',
          },
        },
      },
    },
  },
});

const mapMembershipToTeamMember = (membership: {
  id: string;
  userId: string;
  status: string;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    userRoles: Array<{
      role: {
        id: string;
        name: string;
        isSuperadmin: boolean;
      };
    }>;
  };
}): TeamMemberRecord => {
  const roles = membership.user.userRoles.map((entry) => ({
    roleId: entry.role.id,
    roleName: entry.role.name,
    isSuperadmin: entry.role.isSuperadmin,
  }));

  return {
    memberId: membership.id,
    userId: membership.userId,
    name: membership.user.name,
    email: membership.user.email,
    status: membership.status,
    createdAt: membership.createdAt,
    roles,
  };
};

const withClient = (tx?: Prisma.TransactionClient) => tx ?? prisma;

export const teamRepository = {
  async listMembers(workspaceId: string): Promise<TeamMemberRecord[]> {
    const memberships = await prisma.membership.findMany({
      where: {
        workspaceId,
      },
      select: buildMembershipSelect(workspaceId),
      orderBy: [
        {
          createdAt: 'asc',
        },
        {
          id: 'asc',
        },
      ],
    });

    return memberships.map(mapMembershipToTeamMember);
  },

  async findMemberById(
    workspaceId: string,
    memberId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<TeamMemberRecord | null> {
    const membership = await withClient(tx).membership.findFirst({
      where: {
        workspaceId,
        id: memberId,
      },
      select: buildMembershipSelect(workspaceId),
    });

    if (!membership) {
      return null;
    }

    return mapMembershipToTeamMember(membership);
  },

  findMembershipByUserId(
    workspaceId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return withClient(tx).membership.findFirst({
      where: {
        workspaceId,
        userId,
      },
      select: {
        id: true,
        status: true,
      },
    });
  },

  createMembership(
    workspaceId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return withClient(tx).membership.create({
      data: {
        workspaceId,
        userId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
      },
    });
  },

  async updateMembershipStatus(
    workspaceId: string,
    memberId: string,
    status: 'ACTIVE' | 'INACTIVE',
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const updated = await withClient(tx).membership.updateMany({
      where: {
        workspaceId,
        id: memberId,
      },
      data: {
        status,
      },
    });

    return updated.count > 0;
  },

  async deleteMember(
    workspaceId: string,
    memberId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const client = withClient(tx);
    const deletedMembership = await client.membership.deleteMany({
      where: {
        workspaceId,
        id: memberId,
        userId,
      },
    });

    if (deletedMembership.count === 0) {
      return false;
    }

    await client.userRole.deleteMany({
      where: {
        workspaceId,
        userId,
      },
    });

    return true;
  },

  async countActiveSuperadminMembers(
    workspaceId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const activeSuperadminAssignments = await withClient(tx).userRole.findMany({
      where: {
        workspaceId,
        role: {
          isSuperadmin: true,
        },
        user: {
          memberships: {
            some: {
              workspaceId,
              status: 'ACTIVE',
            },
          },
        },
      },
      distinct: ['userId'],
      select: {
        userId: true,
      },
    });

    return activeSuperadminAssignments.length;
  },

  countActiveSuperadmins(
    workspaceId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    return teamRepository.countActiveSuperadminMembers(workspaceId, tx);
  },

  async isSuperadmin(
    workspaceId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const assignment = await withClient(tx).userRole.findFirst({
      where: {
        workspaceId,
        userId,
        role: {
          isSuperadmin: true,
        },
        user: {
          memberships: {
            some: {
              workspaceId,
              status: 'ACTIVE',
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    return Boolean(assignment);
  },
};
