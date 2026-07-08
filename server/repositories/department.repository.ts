import { prisma } from '../prisma.js';

export const departmentRepository = {
  async listDepartments(workspaceId: string) {
    const rows = await prisma.department.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        description: true,
        _count: { select: { members: true } },
      },
      orderBy: { name: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      memberCount: row._count.members,
    }));
  },

  findByName(workspaceId: string, name: string) {
    return prisma.department.findFirst({
      where: { workspaceId, name },
      select: { id: true },
    });
  },

  findById(workspaceId: string, departmentId: string) {
    return prisma.department.findFirst({
      where: { id: departmentId, workspaceId },
      select: { id: true, name: true, description: true },
    });
  },

  create(workspaceId: string, name: string, description: string | null) {
    return prisma.department.create({
      data: { workspaceId, name, description },
      select: { id: true, name: true, description: true },
    });
  },

  async update(
    workspaceId: string,
    departmentId: string,
    name: string,
    description: string | null,
  ) {
    await prisma.department.updateMany({
      where: { id: departmentId, workspaceId },
      data: { name, description },
    });

    return this.findById(workspaceId, departmentId);
  },

  async delete(workspaceId: string, departmentId: string): Promise<boolean> {
    const result = await prisma.department.deleteMany({
      where: { id: departmentId, workspaceId },
    });

    return result.count > 0;
  },

  async listMembers(workspaceId: string, departmentId: string) {
    const rows = await prisma.departmentMember.findMany({
      where: { workspaceId, departmentId },
      select: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { user: { email: 'asc' } },
    });

    return rows.map((row) => ({
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
    }));
  },

  async listMemberUserIds(workspaceId: string, departmentId: string): Promise<string[]> {
    const rows = await prisma.departmentMember.findMany({
      where: { workspaceId, departmentId },
      select: { userId: true },
      orderBy: { userId: 'asc' },
    });

    return rows.map((row) => row.userId);
  },

  async listActiveWorkspaceMemberUserIds(workspaceId: string): Promise<string[]> {
    const rows = await prisma.membership.findMany({
      where: { workspaceId, status: 'ACTIVE' },
      select: { userId: true },
    });

    return rows.map((row) => row.userId);
  },

  // Replace the department's members with the given set. Callers must validate
  // that userIds are active members of the workspace.
  async replaceMembers(
    workspaceId: string,
    departmentId: string,
    userIds: string[],
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.departmentMember.deleteMany({
        where: { workspaceId, departmentId },
      });

      if (userIds.length > 0) {
        await tx.departmentMember.createMany({
          data: userIds.map((userId) => ({ workspaceId, departmentId, userId })),
          skipDuplicates: true,
        });
      }
    });
  },
};
