import { prisma } from '../prisma.js';

const workspaceSelect = {
  id: true,
  name: true,
  slug: true,
} as const;

export const workspaceRepository = {
  findById(workspaceId: string) {
    return prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: workspaceSelect,
    });
  },

  findBySlug(slug: string) {
    return prisma.workspace.findUnique({
      where: { slug },
      select: workspaceSelect,
    });
  },
};

export type WorkspaceRecord = Awaited<ReturnType<typeof workspaceRepository.findById>>;
