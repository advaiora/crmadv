import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';

export type ProjectStageRecord = {
  id: string;
  workspaceId: string;
  pipelineStageId: string | null;
};

export type PipelineStageGateRecord = {
  id: string;
  workspaceId: string;
  categoryId: string | null;
  isGated: boolean;
  isClosed: boolean;
  color: string | null;
  gateChecklistTemplateId: string | null;
  autoCreateInstance: boolean;
};

const projectCategorySelect = {
  id: true,
  workspaceId: true,
  name: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

const pipelineStageSelect = {
  id: true,
  workspaceId: true,
  categoryId: true,
  name: true,
  sortOrder: true,
  isClosed: true,
  color: true,
  isGated: true,
  gateChecklistTemplateId: true,
  autoCreateInstance: true,
  createdAt: true,
  updatedAt: true,
} as const;

const projectSelect = {
  id: true,
  workspaceId: true,
  name: true,
  pipelineStageId: true,
  createdAt: true,
  updatedAt: true,
  pipelineStage: {
    select: {
      id: true,
      categoryId: true,
      name: true,
      sortOrder: true,
      isClosed: true,
      color: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} as const;

const PROJECT_TABLE = 'Project';
const PIPELINE_STAGE_TABLE = 'PipelineStage';

const tableExists = async (tableName: string) => {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = ${tableName}
    ) AS "exists"
  `);

  return rows[0]?.exists === true;
};

const tableHasColumn = async (tableName: string, columnName: string) => {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = ${tableName}
      AND column_name = ${columnName}
    ) AS "exists"
  `);

  return rows[0]?.exists === true;
};

const tableHasColumns = async (tableName: string, columns: readonly string[]) => {
  const checks = await Promise.all(columns.map((columnName) => tableHasColumn(tableName, columnName)));
  return checks.every(Boolean);
};

export const projectsRepository = {
  listCategories(workspaceId: string) {
    return prisma.projectCategory.findMany({
      where: {
        workspaceId,
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
      select: projectCategorySelect,
    });
  },

  findCategoryById(workspaceId: string, categoryId: string) {
    return prisma.projectCategory.findFirst({
      where: {
        workspaceId,
        id: categoryId,
      },
      select: projectCategorySelect,
    });
  },

  findCategoryByName(workspaceId: string, name: string) {
    return prisma.projectCategory.findFirst({
      where: {
        workspaceId,
        name,
      },
      select: projectCategorySelect,
    });
  },

  async getNextCategorySortOrder(workspaceId: string) {
    const maxCategory = await prisma.projectCategory.findFirst({
      where: {
        workspaceId,
      },
      orderBy: {
        sortOrder: 'desc',
      },
      select: {
        sortOrder: true,
      },
    });

    return (maxCategory?.sortOrder ?? -1) + 1;
  },

  createCategory(input: {
    workspaceId: string;
    name: string;
    sortOrder: number;
  }) {
    return prisma.projectCategory.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        sortOrder: input.sortOrder,
      },
      select: projectCategorySelect,
    });
  },

  async updateCategory(
    workspaceId: string,
    categoryId: string,
    patch: {
      name?: string;
      sortOrder?: number;
    },
  ) {
    const updated = await prisma.projectCategory.updateMany({
      where: {
        workspaceId,
        id: categoryId,
      },
      data: patch,
    });

    if (updated.count === 0) {
      return null;
    }

    return this.findCategoryById(workspaceId, categoryId);
  },

  async deleteCategory(workspaceId: string, categoryId: string) {
    const deleted = await prisma.projectCategory.deleteMany({
      where: {
        workspaceId,
        id: categoryId,
      },
    });

    return deleted.count > 0;
  },

  countStagesByCategory(workspaceId: string, categoryId: string) {
    return prisma.pipelineStage.count({
      where: {
        workspaceId,
        categoryId,
      },
    });
  },

  countProjectsByCategory(workspaceId: string, categoryId: string) {
    return prisma.project.count({
      where: {
        workspaceId,
        pipelineStage: {
          categoryId,
        },
      },
    });
  },

  listStages(workspaceId: string) {
    return prisma.pipelineStage.findMany({
      where: {
        workspaceId,
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
      select: pipelineStageSelect,
    });
  },

  listStagesByCategory(workspaceId: string, categoryId: string) {
    return prisma.pipelineStage.findMany({
      where: {
        workspaceId,
        categoryId,
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
      select: pipelineStageSelect,
    });
  },

  findStageForWorkspace(workspaceId: string, stageId: string) {
    return prisma.pipelineStage.findFirst({
      where: {
        workspaceId,
        id: stageId,
      },
      select: pipelineStageSelect,
    });
  },

  findFirstStage(workspaceId: string, categoryId?: string) {
    return prisma.pipelineStage.findFirst({
      where: {
        workspaceId,
        ...(categoryId ? { categoryId } : {}),
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
      select: pipelineStageSelect,
    });
  },

  createStage(input: {
    workspaceId: string;
    categoryId: string;
    name: string;
    sortOrder: number;
    isClosed: boolean;
    color: string | null;
  }) {
    return prisma.pipelineStage.create({
      data: {
        workspaceId: input.workspaceId,
        categoryId: input.categoryId,
        name: input.name,
        sortOrder: input.sortOrder,
        isClosed: input.isClosed,
        color: input.color,
      },
      select: pipelineStageSelect,
    });
  },

  async updateStage(
    workspaceId: string,
    stageId: string,
    patch: {
      name?: string;
      sortOrder?: number;
      isClosed?: boolean;
      color?: string | null;
    },
  ) {
    const updated = await prisma.pipelineStage.updateMany({
      where: {
        workspaceId,
        id: stageId,
      },
      data: patch,
    });

    if (updated.count === 0) {
      return null;
    }

    return this.findStageForWorkspace(workspaceId, stageId);
  },

  async deleteStage(workspaceId: string, stageId: string) {
    const deleted = await prisma.pipelineStage.deleteMany({
      where: {
        workspaceId,
        id: stageId,
      },
    });

    return deleted.count > 0;
  },

  countProjectsInStage(workspaceId: string, stageId: string) {
    return prisma.project.count({
      where: {
        workspaceId,
        pipelineStageId: stageId,
      },
    });
  },

  async getNextStageSortOrder(workspaceId: string, categoryId: string) {
    const maxStage = await prisma.pipelineStage.findFirst({
      where: {
        workspaceId,
        categoryId,
      },
      orderBy: {
        sortOrder: 'desc',
      },
      select: {
        sortOrder: true,
      },
    });

    return (maxStage?.sortOrder ?? -1) + 1;
  },

  async reorderStages(workspaceId: string, categoryId: string, orderedStageIds: string[]) {
    return prisma.$transaction(
      orderedStageIds.map((stageId, index) =>
        prisma.pipelineStage.updateMany({
          where: {
            workspaceId,
            categoryId,
            id: stageId,
          },
          data: {
            sortOrder: index,
          },
        })),
    );
  },

  listProjects(input: {
    workspaceId: string;
    categoryId?: string;
    stageId?: string;
    search?: string;
  }) {
    return prisma.project.findMany({
      where: {
        workspaceId: input.workspaceId,
        ...(input.categoryId
          ? {
              pipelineStage: {
                categoryId: input.categoryId,
              },
            }
          : {}),
        ...(input.stageId ? { pipelineStageId: input.stageId } : {}),
        ...(input.search
          ? {
              name: {
                contains: input.search,
                mode: 'insensitive',
              },
            }
          : {}),
      },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      select: projectSelect,
    });
  },

  findProjectWithStage(workspaceId: string, projectId: string) {
    return prisma.project.findFirst({
      where: {
        workspaceId,
        id: projectId,
      },
      select: projectSelect,
    });
  },

  createProject(input: {
    workspaceId: string;
    name: string;
    pipelineStageId: string;
  }) {
    return prisma.project.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        pipelineStageId: input.pipelineStageId,
      },
      select: projectSelect,
    });
  },

  async updateProject(
    workspaceId: string,
    projectId: string,
    patch: {
      name?: string;
      pipelineStageId?: string;
    },
  ) {
    const updated = await prisma.project.updateMany({
      where: {
        workspaceId,
        id: projectId,
      },
      data: patch,
    });

    if (updated.count === 0) {
      return null;
    }

    return this.findProjectWithStage(workspaceId, projectId);
  },

  async deleteProject(workspaceId: string, projectId: string) {
    const existingProject = await this.findProjectWithStage(workspaceId, projectId);
    if (!existingProject) {
      return null;
    }

    await prisma.project.deleteMany({
      where: {
        workspaceId,
        id: projectId,
      },
    });

    return existingProject;
  },

  async isMoveStageSchemaReady() {
    const [projectTableExists, pipelineStageTableExists] = await Promise.all([
      tableExists(PROJECT_TABLE),
      tableExists(PIPELINE_STAGE_TABLE),
    ]);

    if (!projectTableExists || !pipelineStageTableExists) {
      return false;
    }

    const [projectColumnsReady, pipelineStageColumnsReady] = await Promise.all([
      tableHasColumns(PROJECT_TABLE, ['id', 'workspaceId', 'pipelineStageId']),
      tableHasColumns(PIPELINE_STAGE_TABLE, [
        'id',
        'workspaceId',
        'isGated',
        'gateChecklistTemplateId',
        'autoCreateInstance',
      ]),
    ]);

    return projectColumnsReady && pipelineStageColumnsReady;
  },

  async findProjectById(workspaceId: string, projectId: string) {
    const rows = await prisma.$queryRaw<ProjectStageRecord[]>(Prisma.sql`
      SELECT "id", "workspaceId", "pipelineStageId"
      FROM "Project"
      WHERE "id" = ${projectId}
      AND "workspaceId" = ${workspaceId}
      LIMIT 1
    `);

    return rows[0] ?? null;
  },

  async findStageById(workspaceId: string, stageId: string) {
    const rows = await prisma.$queryRaw<PipelineStageGateRecord[]>(Prisma.sql`
      SELECT
        "id",
        "workspaceId",
        "categoryId",
        "isClosed",
        "color",
        "isGated",
        "gateChecklistTemplateId",
        "autoCreateInstance"
      FROM "PipelineStage"
      WHERE "id" = ${stageId}
      AND "workspaceId" = ${workspaceId}
      LIMIT 1
    `);

    return rows[0] ?? null;
  },

  async moveProjectToStage(workspaceId: string, projectId: string, toStageId: string) {
    const rows = await prisma.$queryRaw<ProjectStageRecord[]>(Prisma.sql`
      UPDATE "Project"
      SET "pipelineStageId" = ${toStageId}
      WHERE "id" = ${projectId}
      AND "workspaceId" = ${workspaceId}
      RETURNING "id", "workspaceId", "pipelineStageId"
    `);

    return rows[0] ?? null;
  },
};
