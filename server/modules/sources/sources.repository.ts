import { prisma } from '../../prisma.js';

// Accesso ai dati delle fonti di progetto (V4 — Modulo Fonti).

type CreateSourceInput = {
  workspaceId: string;
  projectId: string;
  type: string;
  title: string;
  url: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  content: string | null;
  contentChars: number;
  status: string;
  error: string | null;
};

type UpdateSourceInput = {
  title?: string;
  content?: string | null;
  contentChars?: number;
  status?: string;
  error?: string | null;
};

export const sourcesRepository = {
  // Verifica che il progetto appartenga al workspace (perimetro multi-tenant).
  async projectBelongsToWorkspace(workspaceId: string, projectId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      select: { id: true },
    });
    return Boolean(project);
  },

  listByProject(workspaceId: string, projectId: string) {
    return prisma.projectSource.findMany({
      where: { workspaceId, projectId },
      orderBy: [{ createdAt: 'desc' }],
    });
  },

  findById(workspaceId: string, id: string) {
    return prisma.projectSource.findFirst({
      where: { id, workspaceId },
    });
  },

  create(input: CreateSourceInput) {
    return prisma.projectSource.create({ data: input });
  },

  async update(workspaceId: string, id: string, data: UpdateSourceInput) {
    const updated = await prisma.projectSource.updateMany({
      where: { id, workspaceId },
      data,
    });
    if (updated.count === 0) {
      return null;
    }
    return this.findById(workspaceId, id);
  },

  delete(workspaceId: string, id: string) {
    return prisma.projectSource.deleteMany({
      where: { id, workspaceId },
    });
  },
};
