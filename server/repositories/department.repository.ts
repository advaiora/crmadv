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
        role: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { user: { email: 'asc' } },
    });

    return rows.map((row) => ({
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      role: row.role,
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

  async listExistingDepartmentIds(workspaceId: string, ids: string[]): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await prisma.department.findMany({
      where: { workspaceId, id: { in: ids } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  },

  findMember(workspaceId: string, departmentId: string, userId: string) {
    return prisma.departmentMember.findFirst({
      where: { workspaceId, departmentId, userId },
      select: { id: true, role: true },
    });
  },

  async setMemberRole(
    workspaceId: string,
    departmentId: string,
    userId: string,
    role: string,
  ): Promise<boolean> {
    const result = await prisma.departmentMember.updateMany({
      where: { workspaceId, departmentId, userId },
      data: { role },
    });
    return result.count > 0;
  },

  // User ids that are members of any of the given departments (the "subordinates"
  // a Capo Reparto can manage). Excludes nobody by role — leads included.
  async listMemberUserIdsForDepartments(
    workspaceId: string,
    departmentIds: string[],
  ): Promise<string[]> {
    if (departmentIds.length === 0) {
      return [];
    }
    const rows = await prisma.departmentMember.findMany({
      where: { workspaceId, departmentId: { in: departmentIds } },
      select: { userId: true },
    });
    return Array.from(new Set(rows.map((row) => row.userId)));
  },

  // Ids of the departments where the user is a lead (Capo Reparto).
  async listLedDepartmentIds(workspaceId: string, userId: string): Promise<string[]> {
    const rows = await prisma.departmentMember.findMany({
      where: { workspaceId, userId, role: 'lead' },
      select: { departmentId: true },
    });

    return rows.map((row) => row.departmentId);
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
