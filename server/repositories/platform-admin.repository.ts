import type { Prisma, WorkspaceStatus } from '@prisma/client';
import { prisma } from '../prisma.js';

const workspaceAdminSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  suspendedAt: true,
  createdAt: true,
  _count: {
    select: {
      memberships: true,
      projects: true,
    },
  },
} as const;

const platformAdminUserSelect = {
  id: true,
  email: true,
  name: true,
  isPlatformAdmin: true,
  createdAt: true,
} as const;

export const platformAdminRepository = {
  listWorkspaces() {
    return prisma.workspace.findMany({
      select: workspaceAdminSelect,
      orderBy: { createdAt: 'asc' },
    });
  },

  findWorkspaceById(workspaceId: string) {
    return prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: workspaceAdminSelect,
    });
  },

  findWorkspaceBySlug(slug: string) {
    return prisma.workspace.findUnique({
      where: { slug },
      select: workspaceAdminSelect,
    });
  },

  createWorkspace(name: string, slug: string) {
    return prisma.workspace.create({
      data: { name, slug },
      select: workspaceAdminSelect,
    });
  },

  updateWorkspace(workspaceId: string, data: Prisma.WorkspaceUpdateInput) {
    return prisma.workspace.update({
      where: { id: workspaceId },
      data,
      select: workspaceAdminSelect,
    });
  },

  setWorkspaceStatus(workspaceId: string, status: WorkspaceStatus, suspendedAt: Date | null) {
    return prisma.workspace.update({
      where: { id: workspaceId },
      data: { status, suspendedAt },
      select: workspaceAdminSelect,
    });
  },

  listPlatformAdmins() {
    return prisma.user.findMany({
      where: { isPlatformAdmin: true },
      select: platformAdminUserSelect,
      orderBy: { createdAt: 'asc' },
    });
  },

  countPlatformAdmins() {
    return prisma.user.count({ where: { isPlatformAdmin: true } });
  },

  findUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: platformAdminUserSelect,
    });
  },

  searchUsers(query: string, limit: number) {
    return prisma.user.findMany({
      where: query
        ? {
            OR: [
              { email: { contains: query, mode: 'insensitive' } },
              { name: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {},
      select: platformAdminUserSelect,
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  },

  setUserPlatformAdmin(userId: string, isPlatformAdmin: boolean) {
    return prisma.user.update({
      where: { id: userId },
      data: { isPlatformAdmin },
      select: platformAdminUserSelect,
    });
  },
};

export type WorkspaceAdminRecord = Awaited<
  ReturnType<typeof platformAdminRepository.findWorkspaceById>
>;
