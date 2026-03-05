import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';

const PROJECT_TABLE = 'Project';
const PIPELINE_STAGE_TABLE = 'PipelineStage';
const CHECKLIST_ITEM_INCOMPLETE_STATES = ['pending', 'not_started', 'in_progress'] as const;
const CHECKLIST_ITEM_TERMINAL_STATES = ['completed', 'not_applicable'] as const;
const normalizeChecklistItemStateForPersistence = (
  state: 'pending' | 'not_started' | 'in_progress' | 'completed',
) => (state === 'completed' ? 'completed' : 'pending');

const templateSummarySelect = Prisma.validator<Prisma.ChecklistTemplateSelect>()({
  id: true,
  name: true,
  appliesTo: true,
  description: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      items: true,
    },
  },
});

const templateItemSelect = Prisma.validator<Prisma.ChecklistTemplateItemSelect>()({
  id: true,
  title: true,
  description: true,
  sortOrder: true,
  isRequired: true,
  requiresEvidenceSnapshot: true,
  isCriticalSnapshot: true,
  defaultAssignedToUserId: true,
  defaultAssignedToUser: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  createdAt: true,
  updatedAt: true,
});

const templateWithItemsSelect = Prisma.validator<Prisma.ChecklistTemplateSelect>()({
  id: true,
  name: true,
  appliesTo: true,
  description: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: templateItemSelect,
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  },
});

const templateGateSelect = Prisma.validator<Prisma.ChecklistTemplateSelect>()({
  id: true,
  workspaceId: true,
  appliesTo: true,
  isArchived: true,
});

const itemOrderSelect = Prisma.validator<Prisma.ChecklistTemplateItemSelect>()({
  id: true,
  sortOrder: true,
});

const checklistInstanceItemSelect = Prisma.validator<Prisma.ChecklistInstanceItemSelect>()({
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
  assignedToUserId: true,
  assignedByUserId: true,
  assignedAt: true,
  assignedToUser: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  assignedByUser: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  createdAt: true,
  updatedAt: true,
});

const checklistInstanceWithItemsSelect = Prisma.validator<Prisma.ChecklistInstanceSelect>()({
  id: true,
  workspaceId: true,
  projectId: true,
  pipelineStageId: true,
  checklistTemplateId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  template: {
    select: {
      id: true,
      name: true,
    },
  },
  items: {
    select: checklistInstanceItemSelect,
    orderBy: [{ sortOrderSnapshot: 'asc' }, { id: 'asc' }],
  },
});

const checklistInstanceSummarySelect = Prisma.validator<Prisma.ChecklistInstanceSelect>()({
  id: true,
  checklistTemplateId: true,
  pipelineStageId: true,
  status: true,
  createdAt: true,
  template: {
    select: {
      id: true,
      name: true,
    },
  },
});

const checklistInstanceItemWithInstanceSelect =
  Prisma.validator<Prisma.ChecklistInstanceItemSelect>()({
    ...checklistInstanceItemSelect,
    instance: {
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        pipelineStageId: true,
        checklistTemplateId: true,
        status: true,
      },
    },
  });

export type ChecklistTemplateSummaryRecord = Prisma.ChecklistTemplateGetPayload<{
  select: typeof templateSummarySelect;
}>;

export type ChecklistTemplateWithItemsRecord = Prisma.ChecklistTemplateGetPayload<{
  select: typeof templateWithItemsSelect;
}>;

export type ChecklistTemplateGateRecord = Prisma.ChecklistTemplateGetPayload<{
  select: typeof templateGateSelect;
}>;

export type ChecklistTemplateItemRecord = Prisma.ChecklistTemplateItemGetPayload<{
  select: typeof templateItemSelect;
}>;

export type ChecklistTemplateItemOrderRecord = Prisma.ChecklistTemplateItemGetPayload<{
  select: typeof itemOrderSelect;
}>;

export type ChecklistInstanceSummaryRecord = Prisma.ChecklistInstanceGetPayload<{
  select: typeof checklistInstanceSummarySelect;
}>;

export type ChecklistInstanceWithItemsRecord = Prisma.ChecklistInstanceGetPayload<{
  select: typeof checklistInstanceWithItemsSelect;
}>;

export type ChecklistInstanceItemRecord = Prisma.ChecklistInstanceItemGetPayload<{
  select: typeof checklistInstanceItemSelect;
}>;

export type ChecklistInstanceItemWithInstanceRecord = Prisma.ChecklistInstanceItemGetPayload<{
  select: typeof checklistInstanceItemWithInstanceSelect;
}>;

type CreateTemplateItemInput = {
  title: string;
  description: string | null;
  isRequired: boolean;
  requiresEvidenceSnapshot: boolean;
  isCriticalSnapshot: boolean;
  defaultAssignedToUserId: string | null;
};

type UpdateTemplateInput = {
  name?: string;
  appliesTo?: 'PROJECT_STAGE' | 'WEB_ASSET_STATUS';
  description?: string | null;
  isArchived?: boolean;
};

const stageChecklistRuleSelect = Prisma.validator<Prisma.StageChecklistRuleSelect>()({
  id: true,
  workspaceId: true,
  projectCategoryId: true,
  pipelineStageId: true,
  checklistTemplateId: true,
  gateEnabled: true,
  createdAt: true,
  updatedAt: true,
  checklistTemplate: {
    select: {
      id: true,
      name: true,
      appliesTo: true,
      isArchived: true,
    },
  },
});

export type StageChecklistRuleRecord = Prisma.StageChecklistRuleGetPayload<{
  select: typeof stageChecklistRuleSelect;
}>;

type UpdateTemplateItemInput = {
  title?: string;
  description?: string | null;
  isRequired?: boolean;
  requiresEvidenceSnapshot?: boolean;
  isCriticalSnapshot?: boolean;
  defaultAssignedToUserId?: string | null;
};

const templateWhereByWorkspaceAndId = (workspaceId: string, templateId: string) => ({
  workspaceId,
  id: templateId,
});

const itemWhereByWorkspaceTemplateAndId = (
  workspaceId: string,
  templateId: string,
  itemId: string,
) => ({
  workspaceId,
  templateId,
  id: itemId,
});

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

const withClient = (tx?: Prisma.TransactionClient) => tx ?? prisma;

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
  const exists = await tableExists(tableName);
  if (!exists) {
    return false;
  }

  const checks = await Promise.all(columns.map((columnName) => tableHasColumn(tableName, columnName)));
  return checks.every(Boolean);
};

const pipelineStageRuleContextSelect = Prisma.validator<Prisma.PipelineStageSelect>()({
  id: true,
  workspaceId: true,
  categoryId: true,
});

const projectCategoryRuleContextSelect = Prisma.validator<Prisma.ProjectCategorySelect>()({
  id: true,
  workspaceId: true,
  name: true,
});

const recalculateChecklistInstanceStatusInTx = async (
  tx: Prisma.TransactionClient,
  workspaceId: string,
  instanceId: string,
) => {
  const pendingRequiredCount = await tx.checklistInstanceItem.count({
    where: {
      workspaceId,
      instanceId,
      isRequiredSnapshot: true,
      state: {
        notIn: CHECKLIST_ITEM_TERMINAL_STATES,
      },
    },
  });

  const nextStatus = pendingRequiredCount === 0 ? 'completed' : 'active';

  await tx.checklistInstance.updateMany({
    where: {
      workspaceId,
      id: instanceId,
    },
    data: {
      status: nextStatus,
    },
  });

  return nextStatus;
};

const createChecklistInstanceWithItemsInTx = async (
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    projectId: string;
    pipelineStageId: string;
    checklistTemplateId: string;
  },
) => {
  const created = await tx.checklistInstance.create({
    data: {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      pipelineStageId: input.pipelineStageId,
      checklistTemplateId: input.checklistTemplateId,
      status: 'active',
    },
    select: {
      id: true,
    },
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
      requiresEvidenceSnapshot: true,
      isCriticalSnapshot: true,
      defaultAssignedToUserId: true,
    },
  });

  if (templateItems.length > 0) {
    const now = new Date();
    await tx.checklistInstanceItem.createMany({
      data: templateItems.map((templateItem) => ({
        workspaceId: input.workspaceId,
        instanceId: created.id,
        templateItemId: templateItem.id,
        titleSnapshot: templateItem.title,
        isRequiredSnapshot: templateItem.isRequired,
        requiresEvidenceSnapshot: templateItem.requiresEvidenceSnapshot,
        isCriticalSnapshot: templateItem.isCriticalSnapshot,
        sortOrderSnapshot: templateItem.sortOrder,
        state: 'pending',
        assignedToUserId: templateItem.defaultAssignedToUserId,
        assignedAt: templateItem.defaultAssignedToUserId ? now : null,
      })),
    });
  }

  await recalculateChecklistInstanceStatusInTx(tx, input.workspaceId, created.id);

  return tx.checklistInstance.findFirst({
    where: {
      workspaceId: input.workspaceId,
      id: created.id,
    },
    select: checklistInstanceWithItemsSelect,
  });
};

export const checklistsRepository = {
  listTemplates(input: {
    workspaceId: string;
    q?: string;
    isArchived?: boolean;
  }) {
    return prisma.checklistTemplate.findMany({
      where: {
        workspaceId: input.workspaceId,
        ...(input.q
          ? {
              name: {
                contains: input.q,
                mode: 'insensitive',
              },
            }
          : {}),
        ...(input.isArchived === undefined ? {} : { isArchived: input.isArchived }),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      select: templateSummarySelect,
    });
  },

  findTemplateById(workspaceId: string, templateId: string) {
    return prisma.checklistTemplate.findFirst({
      where: templateWhereByWorkspaceAndId(workspaceId, templateId),
      select: templateSummarySelect,
    });
  },

  findTemplateByIdWithItems(workspaceId: string, templateId: string) {
    return prisma.checklistTemplate.findFirst({
      where: templateWhereByWorkspaceAndId(workspaceId, templateId),
      select: templateWithItemsSelect,
    });
  },

  createTemplateWithItems(input: {
    workspaceId: string;
    name: string;
    appliesTo: 'PROJECT_STAGE' | 'WEB_ASSET_STATUS';
    description: string | null;
    items: CreateTemplateItemInput[];
  }) {
    return prisma.checklistTemplate.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        appliesTo: input.appliesTo,
        description: input.description,
        ...(input.items.length === 0
          ? {}
          : {
              items: {
                create: input.items.map((item, index) => ({
                  workspaceId: input.workspaceId,
                  title: item.title,
                  description: item.description,
                  sortOrder: index,
                  isRequired: item.isRequired,
                  requiresEvidenceSnapshot: item.requiresEvidenceSnapshot,
                  isCriticalSnapshot: item.isCriticalSnapshot,
                  defaultAssignedToUserId: item.defaultAssignedToUserId,
                })),
              },
            }),
      },
      select: templateWithItemsSelect,
    });
  },

  updateTemplate(workspaceId: string, templateId: string, data: UpdateTemplateInput) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.checklistTemplate.findFirst({
        where: templateWhereByWorkspaceAndId(workspaceId, templateId),
        select: { id: true },
      });

      if (!existing) {
        return null;
      }

      await tx.checklistTemplate.update({
        where: { id: existing.id },
        data,
      });

      return tx.checklistTemplate.findFirst({
        where: templateWhereByWorkspaceAndId(workspaceId, templateId),
        select: templateWithItemsSelect,
      });
    });
  },

  async getTemplateUsageCounts(workspaceId: string, templateId: string) {
    const [instanceCount, gatedStageCount] = await Promise.all([
      prisma.checklistInstance.count({
        where: {
          workspaceId,
          checklistTemplateId: templateId,
        },
      }),
      prisma.stageChecklistRule.count({
        where: {
          workspaceId,
          checklistTemplateId: templateId,
        },
      }),
    ]);

    return {
      instanceCount,
      gatedStageCount,
    };
  },

  deleteTemplate(workspaceId: string, templateId: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.checklistTemplate.findFirst({
        where: templateWhereByWorkspaceAndId(workspaceId, templateId),
        select: { id: true },
      });

      if (!existing) {
        return null;
      }

      await tx.checklistTemplate.delete({
        where: { id: existing.id },
      });

      return existing;
    });
  },

  async createTemplateItem(input: {
    workspaceId: string;
    templateId: string;
    title: string;
    description: string | null;
    isRequired: boolean;
    requiresEvidenceSnapshot: boolean;
    isCriticalSnapshot: boolean;
    defaultAssignedToUserId: string | null;
  }) {
    return prisma.$transaction(async (tx) => {
      const template = await tx.checklistTemplate.findFirst({
        where: templateWhereByWorkspaceAndId(input.workspaceId, input.templateId),
        select: { id: true },
      });

      if (!template) {
        return null;
      }

      const maxSortOrder = await tx.checklistTemplateItem.aggregate({
        where: {
          workspaceId: input.workspaceId,
          templateId: input.templateId,
        },
        _max: {
          sortOrder: true,
        },
      });

      const nextSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;

      return tx.checklistTemplateItem.create({
        data: {
          workspaceId: input.workspaceId,
          templateId: input.templateId,
          title: input.title,
          description: input.description,
          sortOrder: nextSortOrder,
          isRequired: input.isRequired,
          requiresEvidenceSnapshot: input.requiresEvidenceSnapshot,
          isCriticalSnapshot: input.isCriticalSnapshot,
          defaultAssignedToUserId: input.defaultAssignedToUserId,
        },
        select: templateItemSelect,
      });
    });
  },

  findTemplateItemById(workspaceId: string, templateId: string, itemId: string) {
    return prisma.checklistTemplateItem.findFirst({
      where: itemWhereByWorkspaceTemplateAndId(workspaceId, templateId, itemId),
      select: templateItemSelect,
    });
  },

  updateTemplateItem(
    workspaceId: string,
    templateId: string,
    itemId: string,
    data: UpdateTemplateItemInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.checklistTemplateItem.findFirst({
        where: itemWhereByWorkspaceTemplateAndId(workspaceId, templateId, itemId),
        select: { id: true },
      });

      if (!existing) {
        return null;
      }

      await tx.checklistTemplateItem.update({
        where: { id: existing.id },
        data,
      });

      return tx.checklistTemplateItem.findFirst({
        where: itemWhereByWorkspaceTemplateAndId(workspaceId, templateId, itemId),
        select: templateItemSelect,
      });
    });
  },

  listTemplateItemIds(workspaceId: string, templateId: string) {
    return prisma.checklistTemplateItem.findMany({
      where: {
        workspaceId,
        templateId,
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
  },

  deleteTemplateItemAndCompact(workspaceId: string, templateId: string, itemId: string) {
    return prisma.$transaction(async (tx) => {
      const targetItem = await tx.checklistTemplateItem.findFirst({
        where: itemWhereByWorkspaceTemplateAndId(workspaceId, templateId, itemId),
        select: templateItemSelect,
      });

      if (!targetItem) {
        return null;
      }

      await tx.checklistTemplateItem.delete({
        where: { id: targetItem.id },
      });

      const remainingItems = await tx.checklistTemplateItem.findMany({
        where: {
          workspaceId,
          templateId,
        },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: itemOrderSelect,
      });

      const updates = remainingItems
        .map((item, index) => ({ id: item.id, nextSortOrder: index, sortOrder: item.sortOrder }))
        .filter((item) => item.sortOrder !== item.nextSortOrder);

      await Promise.all(
        updates.map((item) =>
          tx.checklistTemplateItem.update({
            where: { id: item.id },
            data: { sortOrder: item.nextSortOrder },
          }),
        ),
      );

      return targetItem;
    });
  },

  reorderTemplateItems(workspaceId: string, templateId: string, orderedItemIds: string[]) {
    return prisma.$transaction(async (tx) => {
      const maxSortOrder = await tx.checklistTemplateItem.aggregate({
        where: {
          workspaceId,
          templateId,
        },
        _max: {
          sortOrder: true,
        },
      });

      const offset = (maxSortOrder._max.sortOrder ?? -1) + orderedItemIds.length + 1;

      for (let index = 0; index < orderedItemIds.length; index += 1) {
        const itemId = orderedItemIds[index];
        await tx.checklistTemplateItem.updateMany({
          where: itemWhereByWorkspaceTemplateAndId(workspaceId, templateId, itemId),
          data: { sortOrder: offset + index },
        });
      }

      for (let index = 0; index < orderedItemIds.length; index += 1) {
        const itemId = orderedItemIds[index];
        await tx.checklistTemplateItem.updateMany({
          where: itemWhereByWorkspaceTemplateAndId(workspaceId, templateId, itemId),
          data: { sortOrder: index },
        });
      }

      return tx.checklistTemplateItem.findMany({
        where: {
          workspaceId,
          templateId,
        },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: itemOrderSelect,
      });
    });
  },

  async projectExistsInWorkspace(workspaceId: string, projectId: string) {
    const ready = await tableHasColumns(PROJECT_TABLE, ['id', 'workspaceId']);
    if (!ready) {
      return false;
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
    const ready = await tableHasColumns(PIPELINE_STAGE_TABLE, ['id', 'workspaceId']);
    if (!ready) {
      return false;
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

  findPipelineStageForRules(workspaceId: string, pipelineStageId: string) {
    return prisma.pipelineStage.findFirst({
      where: {
        workspaceId,
        id: pipelineStageId,
      },
      select: pipelineStageRuleContextSelect,
    });
  },

  findProjectCategoryForRules(workspaceId: string, projectCategoryId: string) {
    return prisma.projectCategory.findFirst({
      where: {
        workspaceId,
        id: projectCategoryId,
      },
      select: projectCategoryRuleContextSelect,
    });
  },

  findActiveTemplateById(
    workspaceId: string,
    templateId: string,
    tx?: Prisma.TransactionClient,
  ) {
    if (tx) {
      return tx.checklistTemplate.findFirst({
        where: {
          workspaceId,
          id: templateId,
          isArchived: false,
        },
        select: templateGateSelect,
      });
    }

    return prisma.checklistTemplate.findFirst({
      where: {
        workspaceId,
        id: templateId,
        isArchived: false,
      },
      select: templateGateSelect,
    });
  },

  findChecklistInstanceByUnique(
    input: {
      workspaceId: string;
      projectId: string;
      pipelineStageId: string;
      checklistTemplateId: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    if (tx) {
      return tx.checklistInstance.findFirst({
        where: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          pipelineStageId: input.pipelineStageId,
          checklistTemplateId: input.checklistTemplateId,
        },
        select: checklistInstanceWithItemsSelect,
      });
    }

    return prisma.checklistInstance.findFirst({
      where: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        pipelineStageId: input.pipelineStageId,
        checklistTemplateId: input.checklistTemplateId,
      },
      select: checklistInstanceWithItemsSelect,
    });
  },

  createChecklistInstanceWithItems(
    input: {
      workspaceId: string;
      projectId: string;
      pipelineStageId: string;
      checklistTemplateId: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    if (tx) {
      return createChecklistInstanceWithItemsInTx(tx, input);
    }

    return prisma.$transaction((innerTx) =>
      createChecklistInstanceWithItemsInTx(innerTx, input),
    );
  },

  async listMissingRequiredItemIds(
    workspaceId: string,
    instanceId: string,
    tx?: Prisma.TransactionClient,
  ) {
    if (tx) {
      const rows = await tx.checklistInstanceItem.findMany({
        where: {
          workspaceId,
          instanceId,
          isRequiredSnapshot: true,
          state: {
            in: CHECKLIST_ITEM_INCOMPLETE_STATES,
          },
        },
        orderBy: [{ sortOrderSnapshot: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
        },
      });

      return rows.map((row) => row.id);
    }

    const rows = await prisma.checklistInstanceItem.findMany({
      where: {
        workspaceId,
        instanceId,
        isRequiredSnapshot: true,
        state: {
          in: CHECKLIST_ITEM_INCOMPLETE_STATES,
        },
      },
      orderBy: [{ sortOrderSnapshot: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
      },
    });

    return rows.map((row) => row.id);
  },

  listChecklistInstancesByProject(workspaceId: string, projectId: string, pipelineStageId?: string) {
    return prisma.checklistInstance.findMany({
      where: {
        workspaceId,
        projectId,
        ...(pipelineStageId ? { pipelineStageId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: checklistInstanceSummarySelect,
    });
  },

  listChecklistInstancesByProjectWithItems(
    workspaceId: string,
    projectId: string,
    pipelineStageId?: string,
  ) {
    return prisma.checklistInstance.findMany({
      where: {
        workspaceId,
        projectId,
        ...(pipelineStageId ? { pipelineStageId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: checklistInstanceWithItemsSelect,
    });
  },

  listStageChecklistRules(workspaceId: string, projectCategoryId: string, pipelineStageId: string) {
    return prisma.stageChecklistRule.findMany({
      where: {
        workspaceId,
        projectCategoryId,
        pipelineStageId,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: stageChecklistRuleSelect,
    });
  },

  listEnabledStageChecklistRules(
    workspaceId: string,
    projectCategoryId: string,
    pipelineStageId: string,
    tx?: Prisma.TransactionClient,
  ) {
    if (tx) {
      return tx.stageChecklistRule.findMany({
        where: {
          workspaceId,
          projectCategoryId,
          pipelineStageId,
          gateEnabled: true,
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: stageChecklistRuleSelect,
      });
    }

    return prisma.stageChecklistRule.findMany({
      where: {
        workspaceId,
        projectCategoryId,
        pipelineStageId,
        gateEnabled: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: stageChecklistRuleSelect,
    });
  },

  async replaceStageChecklistRules(input: {
    workspaceId: string;
    projectCategoryId: string;
    pipelineStageId: string;
    rules: Array<{ checklistTemplateId: string; gateEnabled: boolean }>;
  }) {
    return prisma.$transaction(async (tx) => {
      await tx.stageChecklistRule.deleteMany({
        where: {
          workspaceId: input.workspaceId,
          projectCategoryId: input.projectCategoryId,
          pipelineStageId: input.pipelineStageId,
        },
      });

      if (input.rules.length > 0) {
        await tx.stageChecklistRule.createMany({
          data: input.rules.map((rule) => ({
            workspaceId: input.workspaceId,
            projectCategoryId: input.projectCategoryId,
            pipelineStageId: input.pipelineStageId,
            checklistTemplateId: rule.checklistTemplateId,
            gateEnabled: rule.gateEnabled,
          })),
          skipDuplicates: true,
        });
      }

      return tx.stageChecklistRule.findMany({
        where: {
          workspaceId: input.workspaceId,
          projectCategoryId: input.projectCategoryId,
          pipelineStageId: input.pipelineStageId,
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: stageChecklistRuleSelect,
      });
    });
  },

  findChecklistInstanceItemById(workspaceId: string, itemId: string) {
    return prisma.checklistInstanceItem.findFirst({
      where: {
        workspaceId,
        id: itemId,
      },
      select: checklistInstanceItemWithInstanceSelect,
    });
  },

  findActiveWorkspaceMemberByUserId(
    workspaceId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return withClient(tx).membership.findFirst({
      where: {
        workspaceId,
        userId,
        status: 'ACTIVE',
      },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  },

  listActiveWorkspaceMembers(workspaceId: string, tx?: Prisma.TransactionClient) {
    return withClient(tx).membership.findMany({
      where: {
        workspaceId,
        status: 'ACTIVE',
      },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        {
          createdAt: 'asc',
        },
        {
          id: 'asc',
        },
      ],
    });
  },

  async updateChecklistItemAssignee(input: {
    workspaceId: string;
    itemId: string;
    assignedToUserId: string | null;
    assignedByUserId: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.checklistInstanceItem.findFirst({
        where: {
          workspaceId: input.workspaceId,
          id: input.itemId,
        },
        select: checklistInstanceItemWithInstanceSelect,
      });

      if (!current) {
        return {
          updated: false as const,
          current: null,
        };
      }

      await tx.checklistInstanceItem.updateMany({
        where: {
          workspaceId: input.workspaceId,
          id: input.itemId,
        },
        data: {
          assignedToUserId: input.assignedToUserId,
          assignedByUserId: input.assignedToUserId ? input.assignedByUserId : null,
          assignedAt: input.assignedToUserId ? new Date() : null,
        },
      });

      const item = await tx.checklistInstanceItem.findFirst({
        where: {
          workspaceId: input.workspaceId,
          id: input.itemId,
        },
        select: checklistInstanceItemWithInstanceSelect,
      });

      if (!item) {
        return {
          updated: false as const,
          current,
        };
      }

      return {
        updated: true as const,
        item,
        previousAssignedToUserId: current.assignedToUserId,
      };
    });
  },

  async completeChecklistItemFromPending(input: {
    workspaceId: string;
    itemId: string;
    evidenceNote: string | null;
    evidenceUrl: string | null;
    completedByUserId: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const completedAt = new Date();
      const updated = await tx.checklistInstanceItem.updateMany({
        where: {
          workspaceId: input.workspaceId,
          id: input.itemId,
          state: {
            in: CHECKLIST_ITEM_INCOMPLETE_STATES,
          },
        },
        data: {
          state: 'completed',
          evidenceNote: input.evidenceNote,
          evidenceUrl: input.evidenceUrl,
          notApplicableReason: null,
          completedAt,
          completedByUserId: input.completedByUserId,
        },
      });

      if (updated.count === 0) {
        const current = await tx.checklistInstanceItem.findFirst({
          where: {
            workspaceId: input.workspaceId,
            id: input.itemId,
          },
          select: checklistInstanceItemWithInstanceSelect,
        });

        return { updated: false as const, current };
      }

      const item = await tx.checklistInstanceItem.findFirst({
        where: {
          workspaceId: input.workspaceId,
          id: input.itemId,
        },
        select: checklistInstanceItemWithInstanceSelect,
      });

      if (!item) {
        return { updated: false as const, current: null };
      }

      await recalculateChecklistInstanceStatusInTx(tx, input.workspaceId, item.instanceId);

      return { updated: true as const, item };
    });
  },

  async markChecklistItemNotApplicableFromPending(input: {
    workspaceId: string;
    itemId: string;
    reason: string;
    completedByUserId: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const completedAt = new Date();
      const updated = await tx.checklistInstanceItem.updateMany({
        where: {
          workspaceId: input.workspaceId,
          id: input.itemId,
          state: {
            in: CHECKLIST_ITEM_INCOMPLETE_STATES,
          },
        },
        data: {
          state: 'not_applicable',
          notApplicableReason: input.reason,
          evidenceNote: null,
          evidenceUrl: null,
          completedAt,
          completedByUserId: input.completedByUserId,
        },
      });

      if (updated.count === 0) {
        const current = await tx.checklistInstanceItem.findFirst({
          where: {
            workspaceId: input.workspaceId,
            id: input.itemId,
          },
          select: checklistInstanceItemWithInstanceSelect,
        });

        return { updated: false as const, current };
      }

      const item = await tx.checklistInstanceItem.findFirst({
        where: {
          workspaceId: input.workspaceId,
          id: input.itemId,
        },
        select: checklistInstanceItemWithInstanceSelect,
      });

      if (!item) {
        return { updated: false as const, current: null };
      }

      await recalculateChecklistInstanceStatusInTx(tx, input.workspaceId, item.instanceId);

      return { updated: true as const, item };
    });
  },

  async resetChecklistItem(workspaceId: string, itemId: string) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.checklistInstanceItem.updateMany({
        where: {
          workspaceId,
          id: itemId,
        },
        data: {
          state: 'pending',
          evidenceNote: null,
          evidenceUrl: null,
          notApplicableReason: null,
          completedAt: null,
          completedByUserId: null,
        },
      });

      if (updated.count === 0) {
        return null;
      }

      const item = await tx.checklistInstanceItem.findFirst({
        where: {
          workspaceId,
          id: itemId,
        },
        select: checklistInstanceItemWithInstanceSelect,
      });

      if (!item) {
        return null;
      }

      await recalculateChecklistInstanceStatusInTx(tx, workspaceId, item.instanceId);

      return item;
    });
  },

  async updateChecklistItemState(input: {
    workspaceId: string;
    itemId: string;
    state: 'not_started' | 'in_progress' | 'completed';
    evidenceNote: string | null | undefined;
    evidenceUrl: string | null | undefined;
    completedByUserId: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.checklistInstanceItem.findFirst({
        where: {
          workspaceId: input.workspaceId,
          id: input.itemId,
        },
        select: checklistInstanceItemWithInstanceSelect,
      });

      if (!current) {
        return {
          updated: false as const,
          current: null,
          previousState: null,
        };
      }

      const previousState = current.state;
      const nextState = normalizeChecklistItemStateForPersistence(input.state);
      const completedAt = nextState === 'completed' ? new Date() : null;

      await tx.checklistInstanceItem.updateMany({
        where: {
          workspaceId: input.workspaceId,
          id: input.itemId,
        },
        data: {
          state: nextState,
          evidenceNote:
            nextState === 'pending'
              ? null
              : (input.evidenceNote === undefined ? current.evidenceNote : input.evidenceNote),
          evidenceUrl:
            nextState === 'pending'
              ? null
              : (input.evidenceUrl === undefined ? current.evidenceUrl : input.evidenceUrl),
          notApplicableReason: null,
          completedAt,
          completedByUserId: completedAt ? input.completedByUserId : null,
        },
      });

      const item = await tx.checklistInstanceItem.findFirst({
        where: {
          workspaceId: input.workspaceId,
          id: input.itemId,
        },
        select: checklistInstanceItemWithInstanceSelect,
      });

      if (!item) {
        return {
          updated: false as const,
          current,
          previousState,
        };
      }

      await recalculateChecklistInstanceStatusInTx(tx, input.workspaceId, item.instanceId);

      return {
        updated: true as const,
        item,
        previousState,
      };
    });
  },

  recalculateChecklistInstanceStatus(workspaceId: string, instanceId: string) {
    return prisma.$transaction((tx) =>
      recalculateChecklistInstanceStatusInTx(tx, workspaceId, instanceId),
    );
  },
};
