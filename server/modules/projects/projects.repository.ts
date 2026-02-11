import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';

export type ProjectStageRecord = {
  id: string;
  workspaceId: string;
  pipelineStageId: string | null;
};

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
      tableHasColumns(PIPELINE_STAGE_TABLE, ['id', 'workspaceId']),
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

  async stageExistsInWorkspace(workspaceId: string, stageId: string) {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "PipelineStage"
      WHERE "id" = ${stageId}
      AND "workspaceId" = ${workspaceId}
      LIMIT 1
    `);

    return rows.length > 0;
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
