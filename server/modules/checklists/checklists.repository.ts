import { Prisma, type ChecklistInstanceStatus, type ChecklistItemState } from '@prisma/client';
import { prisma } from '../../prisma.js';

const templateItemSelect = Prisma.validator<Prisma.ChecklistTemplateItemSelect>()({
  id: true,
  workspaceId: true,
  templateId: true,
  title: true,
  description: true,
  sortOrder: true,
  isRequired: true,
  requiresEvidence: true,
  isCritical: true,
  createdAt: true,
  updatedAt: true,
});

const templateSelect = Prisma.validator<Prisma.ChecklistTemplateSelect>()({
  id: true,
  workspaceId: true,
  name: true,
  description: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
});

const templateWithItemsSelect = Prisma.validator<Prisma.ChecklistTemplateSelect>()({
  id: true,
  workspaceId: true,
  name: true,
  description: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: templateItemSelect,
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  },
});

const instanceItemSelect = Prisma.validator<Prisma.ChecklistInstanceItemSelect>()({
  id: true,
  workspaceId: true,
  instanceId: true,
  templateItemId: true,
  titleSnapshot: true,
  isRequiredSnapshot: true,
  requiresEvidenceSnapshot: true,
  isCriticalSnapshot: true,
  sortOrderSnapshot: true,
  state: true,
  evidenceNote: true,
  evidenceUrl: true,
  notApplicableReason: true,
  completedAt: true,
  completedByUserId: true,
  createdAt: true,
  updatedAt: true,
});

const instanceSelect = Prisma.validator<Prisma.ChecklistInstanceSelect>()({
  id: true,
  workspaceId: true,
  projectId: true,
  pipelineStageId: true,
  checklistTemplateId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

const instanceWithItemsAndTemplateSelect = Prisma.validator<Prisma.ChecklistInstanceSelect>()({
  ...instanceSelect,
  checklistTemplate: {
    select: {
      id: true,
      name: true,
    },
  },
  items: {
    select: instanceItemSelect,
    orderBy: [{ sortOrderSnapshot: 'asc' }, { id: 'asc' }],
  },
});

const stageChecklistRuleSelect = Prisma.validator<Prisma.StageChecklistRuleSelect>()({
  id: true,
  workspaceId: true,
  pipelineStageId: true,
  checklistTemplateId: true,
  isBlocking: true,
  autoCreateInstance: true,
  createdAt: true,
  updatedAt: true,
});

export type ChecklistTemplateRecord = Prisma.ChecklistTemplateGetPayload<{
  select: typeof templateSelect;
}>;

export type ChecklistTemplateWithItemsRecord = Prisma.ChecklistTemplateGetPayload<{
  select: typeof templateWithItemsSelect;
}>;

export type ChecklistTemplateItemRecord = Prisma.ChecklistTemplateItemGetPayload<{
  select: typeof templateItemSelect;
}>;

export type ChecklistInstanceRecord = Prisma.ChecklistInstanceGetPayload<{
  select: typeof instanceSelect;
}>;

export type ChecklistInstanceWithItemsRecord = Prisma.ChecklistInstanceGetPayload<{
  select: typeof instanceWithItemsAndTemplateSelect;
}>;

export type ChecklistInstanceItemRecord = Prisma.ChecklistInstanceItemGetPayload<{
  select: typeof instanceItemSelect;
}>;

export type StageChecklistRuleRecord = Prisma.StageChecklistRuleGetPayload<{
  select: typeof stageChecklistRuleSelect;
}>;

export type CreateTemplateItemInput = {
  title: string;
  description: string | null;
  sortOrder: number;
  isRequired: boolean;
  requiresEvidence: boolean;
  isCritical: boolean;
};

export type UpdateTemplateInput = {
  name?: string;
  description?: string | null;
  isArchived?: boolean;
};

export type UpdateTemplateItemInput = {
  title?: string;
  description?: string | null;
  sortOrder?: number;
  isRequired?: boolean;
  requiresEvidence?: boolean;
  isCritical?: boolean;
};

export type UpdateInstanceItemInput = {
  state?: ChecklistItemState;
  evidenceNote?: string | null;
  evidenceUrl?: string | null;
  notApplicableReason?: string | null;
  completedAt?: Date | null;
  completedByUserId?: string | null;
};

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

export const checklistsRepository = {
  listTemplates(workspaceId: string, isArchived: boolean) {
    return prisma.checklistTemplate.findMany({
      where: {
        workspaceId,
        isArchived,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      select: templateSelect,
    });
  },

  listTemplatesWithItems(workspaceId: string, isArchived: boolean) {
    return prisma.checklistTemplate.findMany({
      where: {
        workspaceId,
        isArchived,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      select: templateWithItemsSelect,
    });
  },

  findTemplateById(workspaceId: string, templateId: string) {
    return prisma.checklistTemplate.findFirst({
      where: {
        id: templateId,
        workspaceId,
      },
      select: templateSelect,
    });
  },

  findTemplateByIdWithItems(workspaceId: string, templateId: string) {
    return prisma.checklistTemplate.findFirst({
      where: {
        id: templateId,
        workspaceId,
      },
      select: templateWithItemsSelect,
    });
  },

  findTemplateByName(workspaceId: string, name: string) {
    return prisma.checklistTemplate.findFirst({
      where: {
        workspaceId,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
      },
    });
  },

  createTemplateWithItems(input: {
    workspaceId: string;
    name: string;
    description: string | null;
    items: CreateTemplateItemInput[];
  }) {
    return prisma.$transaction((tx) =>
      tx.checklistTemplate.create({
        data: {
          workspaceId: input.workspaceId,
          name: input.name,
          description: input.description,
          ...(input.items.length > 0
            ? {
                items: {
                  create: input.items.map((item) => ({
                    workspaceId: input.workspaceId,
                    title: item.title,
                    description: item.description,
                    sortOrder: item.sortOrder,
                    isRequired: item.isRequired,
                    requiresEvidence: item.requiresEvidence,
                    isCritical: item.isCritical,
                  })),
                },
              }
            : {}),
        },
        select: templateWithItemsSelect,
      }),
    );
  },

  listTemplateItems(workspaceId: string, templateId: string) {
    return prisma.checklistTemplateItem.findMany({
      where: {
        workspaceId,
        templateId,
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: templateItemSelect,
    });
  },

  async updateTemplate(workspaceId: string, templateId: string, data: UpdateTemplateInput) {
    const updated = await prisma.checklistTemplate.updateMany({
      where: {
        id: templateId,
        workspaceId,
      },
      data,
    });

    if (updated.count === 0) {
      return null;
    }

    return this.findTemplateById(workspaceId, templateId);
  },

  archiveTemplate(workspaceId: string, templateId: string) {
    return prisma.checklistTemplate.updateMany({
      where: {
        id: templateId,
        workspaceId,
      },
      data: {
        isArchived: true,
      },
    });
  },

  findTemplateItemById(workspaceId: string, templateId: string, itemId: string) {
    return prisma.checklistTemplateItem.findFirst({
      where: {
        id: itemId,
        templateId,
        workspaceId,
      },
      select: templateItemSelect,
    });
  },

  async getNextSortOrder(workspaceId: string, templateId: string) {
    const maxSortOrder = await prisma.checklistTemplateItem.aggregate({
      where: {
        workspaceId,
        templateId,
      },
      _max: {
        sortOrder: true,
      },
    });

    return (maxSortOrder._max.sortOrder ?? -1) + 1;
  },

  createTemplateItem(input: {
    workspaceId: string;
    templateId: string;
    title: string;
    description: string | null;
    sortOrder: number;
    isRequired: boolean;
    requiresEvidence: boolean;
    isCritical: boolean;
  }) {
    return prisma.checklistTemplateItem.create({
      data: {
        workspaceId: input.workspaceId,
        templateId: input.templateId,
        title: input.title,
        description: input.description,
        sortOrder: input.sortOrder,
        isRequired: input.isRequired,
        requiresEvidence: input.requiresEvidence,
        isCritical: input.isCritical,
      },
      select: templateItemSelect,
    });
  },

  async updateTemplateItem(
    workspaceId: string,
    templateId: string,
    itemId: string,
    data: UpdateTemplateItemInput,
  ) {
    const updated = await prisma.checklistTemplateItem.updateMany({
      where: {
        id: itemId,
        templateId,
        workspaceId,
      },
      data,
    });

    if (updated.count === 0) {
      return null;
    }

    return this.findTemplateItemById(workspaceId, templateId, itemId);
  },

  deleteTemplateItem(workspaceId: string, templateId: string, itemId: string) {
    return prisma.checklistTemplateItem.deleteMany({
      where: {
        id: itemId,
        templateId,
        workspaceId,
      },
    });
  },

  listTemplateItemIds(workspaceId: string, templateId: string) {
    return prisma.checklistTemplateItem.findMany({
      where: {
        workspaceId,
        templateId,
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
      },
    });
  },

  reorderTemplateItems(workspaceId: string, templateId: string, orderedItemIds: string[]) {
    return prisma.$transaction(async (tx) => {
      for (let index = 0; index < orderedItemIds.length; index += 1) {
        const itemId = orderedItemIds[index];

        await tx.checklistTemplateItem.updateMany({
          where: {
            id: itemId,
            templateId,
            workspaceId,
          },
          data: {
            sortOrder: index,
          },
        });
      }

      return tx.checklistTemplateItem.findMany({
        where: {
          workspaceId,
          templateId,
        },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: templateItemSelect,
      });
    });
  },

  async projectExistsInWorkspace(workspaceId: string, projectId: string) {
    const hasProjectTable = await tableExists('Project');
    if (!hasProjectTable) {
      return null;
    }

    const hasWorkspaceIdColumn = await tableHasColumn('Project', 'workspaceId');
    if (!hasWorkspaceIdColumn) {
      return null;
    }

    const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "Project"
      WHERE "id" = ${projectId}
      AND "workspaceId" = ${workspaceId}
      LIMIT 1
    `);

    return rows.length > 0;
  },

  async pipelineStageExistsInWorkspace(workspaceId: string, pipelineStageId: string) {
    const hasPipelineStageTable = await tableExists('PipelineStage');
    if (!hasPipelineStageTable) {
      return null;
    }

    const hasWorkspaceIdColumn = await tableHasColumn('PipelineStage', 'workspaceId');
    if (!hasWorkspaceIdColumn) {
      return null;
    }

    const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "PipelineStage"
      WHERE "id" = ${pipelineStageId}
      AND "workspaceId" = ${workspaceId}
      LIMIT 1
    `);

    return rows.length > 0;
  },

  findChecklistInstanceDuplicate(input: {
    workspaceId: string;
    projectId: string;
    pipelineStageId: string | null;
    checklistTemplateId: string;
  }) {
    return prisma.checklistInstance.findFirst({
      where: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        pipelineStageId: input.pipelineStageId,
        checklistTemplateId: input.checklistTemplateId,
      },
      select: instanceSelect,
    });
  },

  findChecklistInstanceByUnique(input: {
    workspaceId: string;
    projectId: string;
    pipelineStageId: string | null;
    checklistTemplateId: string;
  }) {
    return prisma.checklistInstance.findFirst({
      where: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        pipelineStageId: input.pipelineStageId,
        checklistTemplateId: input.checklistTemplateId,
      },
      select: instanceWithItemsAndTemplateSelect,
    });
  },

  findBlockingStageChecklistRule(workspaceId: string, pipelineStageId: string) {
    return prisma.stageChecklistRule.findFirst({
      where: {
        workspaceId,
        pipelineStageId,
        isBlocking: true,
      },
      select: stageChecklistRuleSelect,
    });
  },

  findChecklistInstanceForStageRule(input: {
    workspaceId: string;
    projectId: string;
    pipelineStageId: string;
    checklistTemplateId: string;
  }) {
    return prisma.checklistInstance.findFirst({
      where: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        pipelineStageId: input.pipelineStageId,
        checklistTemplateId: input.checklistTemplateId,
      },
      select: instanceWithItemsAndTemplateSelect,
    });
  },

  createChecklistInstanceWithItems(input: {
    workspaceId: string;
    projectId: string;
    pipelineStageId: string | null;
    checklistTemplateId: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const instance = await tx.checklistInstance.create({
        data: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          pipelineStageId: input.pipelineStageId,
          checklistTemplateId: input.checklistTemplateId,
        },
        select: instanceSelect,
      });

      const templateItems = await tx.checklistTemplateItem.findMany({
        where: {
          workspaceId: input.workspaceId,
          templateId: input.checklistTemplateId,
        },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          title: true,
          sortOrder: true,
          isRequired: true,
          requiresEvidence: true,
          isCritical: true,
        },
      });

      if (templateItems.length > 0) {
        await tx.checklistInstanceItem.createMany({
          data: templateItems.map((item) => ({
            workspaceId: input.workspaceId,
            instanceId: instance.id,
            templateItemId: item.id,
            titleSnapshot: item.title,
            isRequiredSnapshot: item.isRequired,
            requiresEvidenceSnapshot: item.requiresEvidence,
            isCriticalSnapshot: item.isCritical,
            sortOrderSnapshot: item.sortOrder,
          })),
        });
      }

      const created = await tx.checklistInstance.findFirst({
        where: {
          id: instance.id,
          workspaceId: input.workspaceId,
        },
        select: instanceWithItemsAndTemplateSelect,
      });

      return created as ChecklistInstanceWithItemsRecord;
    });
  },

  listChecklistInstancesByProject(workspaceId: string, projectId: string) {
    return prisma.checklistInstance.findMany({
      where: {
        workspaceId,
        projectId,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      select: instanceWithItemsAndTemplateSelect,
    });
  },

  findChecklistInstanceById(workspaceId: string, instanceId: string) {
    return prisma.checklistInstance.findFirst({
      where: {
        id: instanceId,
        workspaceId,
      },
      select: instanceSelect,
    });
  },

  listChecklistInstanceItems(workspaceId: string, instanceId: string) {
    return prisma.checklistInstanceItem.findMany({
      where: {
        workspaceId,
        instanceId,
      },
      orderBy: [{ sortOrderSnapshot: 'asc' }, { id: 'asc' }],
      select: instanceItemSelect,
    });
  },

  findChecklistInstanceItemById(workspaceId: string, itemId: string) {
    return prisma.checklistInstanceItem.findFirst({
      where: {
        id: itemId,
        workspaceId,
      },
      select: instanceItemSelect,
    });
  },

  async updateChecklistInstanceItemIfState(
    workspaceId: string,
    itemId: string,
    expectedState: ChecklistItemState,
    data: UpdateInstanceItemInput,
  ) {
    const updated = await prisma.checklistInstanceItem.updateMany({
      where: {
        id: itemId,
        workspaceId,
        state: expectedState,
      },
      data,
    });

    if (updated.count === 0) {
      return null;
    }

    return this.findChecklistInstanceItemById(workspaceId, itemId);
  },

  async updateChecklistInstanceItem(
    workspaceId: string,
    itemId: string,
    data: UpdateInstanceItemInput,
  ) {
    const updated = await prisma.checklistInstanceItem.updateMany({
      where: {
        id: itemId,
        workspaceId,
      },
      data,
    });

    if (updated.count === 0) {
      return null;
    }

    return this.findChecklistInstanceItemById(workspaceId, itemId);
  },

  async updateChecklistInstanceStatus(
    workspaceId: string,
    instanceId: string,
    status: ChecklistInstanceStatus,
  ) {
    const updated = await prisma.checklistInstance.updateMany({
      where: {
        id: instanceId,
        workspaceId,
        status: {
          not: 'archived',
        },
      },
      data: {
        status,
      },
    });

    if (updated.count === 0) {
      return null;
    }

    return this.findChecklistInstanceById(workspaceId, instanceId);
  },
};
