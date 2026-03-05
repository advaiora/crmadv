import { Prisma } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requirePermission } from '../../auth/guards.js';
import { audit } from '../../audit/audit.js';
import { HttpError, badRequest, notFound } from '../../core/errors.js';
import { prisma } from '../../prisma.js';
import {
  checklistsRepository,
  type ChecklistInstanceItemRecord,
  type ChecklistInstanceItemWithInstanceRecord,
  type ChecklistInstanceSummaryRecord,
  type ChecklistInstanceWithItemsRecord,
  type ChecklistTemplateItemRecord,
  type ChecklistTemplateSummaryRecord,
  type ChecklistTemplateWithItemsRecord,
} from './checklists.repository.js';

export const checklistsServiceRuntime = {
  runTransaction: <T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) =>
    prisma.$transaction(callback),
};

const MAX_TEMPLATE_NAME_LENGTH = 80;
const MAX_ITEM_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_EVIDENCE_NOTE_LENGTH = 1000;
const MAX_EVIDENCE_URL_LENGTH = 500;
const MIN_NOT_APPLICABLE_REASON_LENGTH = 5;
const MIN_GATE_OVERRIDE_REASON_LENGTH = 10;
const MAX_GATE_OVERRIDE_REASON_LENGTH = 500;
const MAX_GATE_OVERRIDE_REASON_AUDIT_LENGTH = 120;
const CHECKLISTS_OVERRIDE_GATE_PERMISSION = 'checklists.override_gate';
const CHECKLIST_ITEM_STATE_VALUES = ['not_started', 'in_progress', 'completed'] as const;
const CHECKLIST_TEMPLATE_APPLIES_TO_VALUES = ['PROJECT_STAGE', 'WEB_ASSET_STATUS'] as const;

const idSchema = z.string().trim().min(1);

const booleanQuerySchema = z.preprocess((value) => {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (typeof normalized === 'boolean') {
    return normalized;
  }
  if (typeof normalized !== 'string') {
    return normalized;
  }

  const token = normalized.trim().toLowerCase();
  if (token === 'true') {
    return true;
  }
  if (token === 'false') {
    return false;
  }

  return normalized;
}, z.boolean());

const templateSearchQuerySchema = z.string().trim().min(1).max(MAX_TEMPLATE_NAME_LENGTH);

const listTemplatesQuerySchema = z
  .object({
    q: templateSearchQuerySchema.optional(),
    query: templateSearchQuerySchema.optional(),
    search: templateSearchQuerySchema.optional(),
    isArchived: booleanQuerySchema.optional(),
    archived: booleanQuerySchema.optional(),
  })
  .passthrough();

const listProjectChecklistInstancesQuerySchema = z
  .object({
    includeItems: booleanQuerySchema.optional(),
    stageId: z.string().trim().min(1).optional(),
  })
  .strict();

const checklistRuleEntrySchema = z.object({
  checklistTemplateId: idSchema,
  gateEnabled: z.boolean().optional().default(true),
}).strict();

const upsertStageChecklistRulesBodySchema = z.object({
  rules: z.array(checklistRuleEntrySchema).default([]),
}).strict();

const checklistTemplateAppliesToSchema = z.enum(CHECKLIST_TEMPLATE_APPLIES_TO_VALUES);

const createTemplateItemSchema = z
  .object({
    title: z.string().trim().min(2).max(MAX_ITEM_TITLE_LENGTH),
    description: z.string().trim().max(MAX_DESCRIPTION_LENGTH).optional(),
    isRequired: z.boolean().optional(),
    requiresEvidenceSnapshot: z.boolean().optional(),
    isCriticalSnapshot: z.boolean().optional(),
    defaultAssignedToUserId: z.union([idSchema, z.null()]).optional(),
  })
  .strict();

const createTemplateBodySchema = z
  .object({
    name: z.string().trim().min(2).max(MAX_TEMPLATE_NAME_LENGTH),
    appliesTo: checklistTemplateAppliesToSchema.optional().default('PROJECT_STAGE'),
    description: z.string().trim().max(MAX_DESCRIPTION_LENGTH).optional(),
    items: z.array(createTemplateItemSchema).optional(),
  })
  .strict();

const updateTemplateBodySchema = z
  .object({
    name: z.string().trim().min(2).max(MAX_TEMPLATE_NAME_LENGTH).optional(),
    appliesTo: checklistTemplateAppliesToSchema.optional(),
    description: z.union([z.string().trim().max(MAX_DESCRIPTION_LENGTH), z.null()]).optional(),
    isArchived: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.name === undefined &&
      value.appliesTo === undefined &&
      value.description === undefined &&
      value.isArchived === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field is required',
      });
    }
  });

const updateTemplateItemBodySchema = z
  .object({
    title: z.string().trim().min(2).max(MAX_ITEM_TITLE_LENGTH).optional(),
    description: z.union([z.string().trim().max(MAX_DESCRIPTION_LENGTH), z.null()]).optional(),
    isRequired: z.boolean().optional(),
    requiresEvidenceSnapshot: z.boolean().optional(),
    isCriticalSnapshot: z.boolean().optional(),
    defaultAssignedToUserId: z.union([idSchema, z.null()]).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.title === undefined &&
      value.description === undefined &&
      value.isRequired === undefined &&
      value.requiresEvidenceSnapshot === undefined &&
      value.isCriticalSnapshot === undefined &&
      value.defaultAssignedToUserId === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field is required',
      });
    }
  });

const reorderTemplateItemsBodySchema = z
  .object({
    orderedItemIds: z.array(idSchema).min(1),
  })
  .strict()
  .superRefine((value, context) => {
    const uniqueIds = new Set(value.orderedItemIds);
    if (uniqueIds.size !== value.orderedItemIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['orderedItemIds'],
        message: 'orderedItemIds must not contain duplicate values',
      });
    }
  });

const createChecklistInstanceBodySchema = z
  .object({
    checklistTemplateId: idSchema,
    pipelineStageId: idSchema,
  })
  .strict();

const optionalTrimmedString = (maxLength: number) =>
  z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }, z.string().trim().max(maxLength).optional());

const optionalEvidenceUrlSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}, z.string().url().max(MAX_EVIDENCE_URL_LENGTH).optional());

const completeChecklistItemBodySchema = z
  .object({
    evidenceNote: optionalTrimmedString(MAX_EVIDENCE_NOTE_LENGTH),
    evidenceUrl: optionalEvidenceUrlSchema,
  })
  .strict();

const updateChecklistItemStateBodySchema = z
  .object({
    state: z.enum(CHECKLIST_ITEM_STATE_VALUES),
    evidenceNote: optionalTrimmedString(MAX_EVIDENCE_NOTE_LENGTH),
    evidenceUrl: optionalEvidenceUrlSchema,
  })
  .strict();

const markChecklistItemNotApplicableBodySchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(MIN_NOT_APPLICABLE_REASON_LENGTH)
      .max(MAX_DESCRIPTION_LENGTH),
  })
  .strict();

const assignChecklistItemBodySchema = z
  .object({
    assignedToUserId: z.union([idSchema, z.null()]).optional(),
  })
  .strict();

const toggleChecklistInstanceItemBodySchema = z
  .object({
    completed: z.boolean().optional(),
    notes: optionalTrimmedString(MAX_EVIDENCE_NOTE_LENGTH),
    evidenceUrl: optionalEvidenceUrlSchema,
    notApplicable: z.boolean().optional(),
    notApplicableReason: z.string().trim().max(MAX_DESCRIPTION_LENGTH).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.notApplicable) {
      const reason = value.notApplicableReason?.trim() ?? '';
      if (reason.length < MIN_NOT_APPLICABLE_REASON_LENGTH) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['notApplicableReason'],
          message: `notApplicableReason must be at least ${MIN_NOT_APPLICABLE_REASON_LENGTH} characters`,
        });
      }
      return;
    }

    if (value.completed === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['completed'],
        message: 'Either completed or notApplicable flag is required',
      });
    }
  });

const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const isForeignKeyConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';

const parseWithSchema = <TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown,
  message: string,
): z.infer<TSchema> => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw badRequest(message, {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const readFirstQueryValue = (value: unknown): unknown =>
  Array.isArray(value) ? value[0] : value;

const normalizeOptionalQuerySearchValue = (value: unknown): string | undefined => {
  const candidate = readFirstQueryValue(value);
  if (typeof candidate !== 'string') {
    return undefined;
  }

  const normalized = candidate.trim();
  if (!normalized) {
    return undefined;
  }

  return normalized.slice(0, MAX_TEMPLATE_NAME_LENGTH);
};

const normalizeOptionalQueryBooleanValue = (value: unknown): boolean | undefined => {
  const candidate = readFirstQueryValue(value);
  if (typeof candidate === 'boolean') {
    return candidate;
  }

  if (typeof candidate !== 'string') {
    return undefined;
  }

  const normalized = candidate.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }

  return undefined;
};

const normalizeOptionalString = (value: string | undefined) => {
  if (value === undefined) {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
};

const normalizePatchString = (value: string | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
};

const normalizeChecklistItemState = (state: string) =>
  state === 'pending' ? 'not_started' : state;

const mapTemplateSummary = (record: ChecklistTemplateSummaryRecord) => ({
  id: record.id,
  name: record.name,
  appliesTo: record.appliesTo,
  description: record.description,
  isArchived: record.isArchived,
  itemsCount: record._count.items,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const mapTemplateItem = (record: ChecklistTemplateItemRecord) => ({
  id: record.id,
  title: record.title,
  description: record.description,
  sortOrder: record.sortOrder,
  isRequired: record.isRequired,
  requiresEvidenceSnapshot: record.requiresEvidenceSnapshot,
  isCriticalSnapshot: record.isCriticalSnapshot,
  defaultAssignedToUserId: record.defaultAssignedToUserId,
  defaultAssignedToUserName:
    record.defaultAssignedToUser?.name ?? record.defaultAssignedToUser?.email ?? null,
});

const mapTemplateWithItems = (record: ChecklistTemplateWithItemsRecord) => ({
  id: record.id,
  name: record.name,
  appliesTo: record.appliesTo,
  description: record.description,
  isArchived: record.isArchived,
  items: record.items.map((item) => mapTemplateItem(item)),
});

const mapChecklistInstanceItem = (
  record: ChecklistInstanceItemRecord | ChecklistInstanceItemWithInstanceRecord,
  options?: {
    activeUserIds?: Set<string>;
  },
) => ({
  id: record.id,
  templateItemId: record.templateItemId,
  title: record.titleSnapshot,
  sortOrder: record.sortOrderSnapshot,
  isRequired: record.isRequiredSnapshot,
  requiresEvidenceSnapshot: record.requiresEvidenceSnapshot,
  isCriticalSnapshot: record.isCriticalSnapshot,
  state: normalizeChecklistItemState(record.state),
  evidenceNote: record.evidenceNote,
  evidenceUrl: record.evidenceUrl,
  notApplicableReason: record.notApplicableReason,
  completedAt: record.completedAt,
  completedByUserId: record.completedByUserId,
  assignedToUserId: record.assignedToUserId,
  assignedByUserId: record.assignedByUserId,
  assignedAt: record.assignedAt,
  assignedToUserName: record.assignedToUser?.name ?? record.assignedToUser?.email ?? null,
  assignedByUserName: record.assignedByUser?.name ?? record.assignedByUser?.email ?? null,
  assignedToUserInactive:
    record.assignedToUserId && options?.activeUserIds
      ? !options.activeUserIds.has(record.assignedToUserId)
      : false,
});

const mapChecklistInstance = (
  record: ChecklistInstanceWithItemsRecord,
  options?: {
    activeUserIds?: Set<string>;
  },
) => ({
  id: record.id,
  checklistTemplateId: record.checklistTemplateId,
  checklistTemplateName: record.template?.name ?? null,
  pipelineStageId: record.pipelineStageId,
  status: record.status,
  createdAt: record.createdAt,
  items: record.items.map((item) => mapChecklistInstanceItem(item, options)),
});

const mapChecklistInstanceSummary = (record: ChecklistInstanceSummaryRecord) => ({
  id: record.id,
  checklistTemplateId: record.checklistTemplateId,
  checklistTemplateName: record.template?.name ?? null,
  pipelineStageId: record.pipelineStageId,
  status: record.status,
  createdAt: record.createdAt,
});

const mapStageChecklistRule = (rule: Awaited<ReturnType<typeof checklistsRepository.listStageChecklistRules>>[number]) => ({
  id: rule.id,
  projectCategoryId: rule.projectCategoryId,
  pipelineStageId: rule.pipelineStageId,
  checklistTemplateId: rule.checklistTemplateId,
  checklistTemplateName: rule.checklistTemplate.name,
  gateEnabled: rule.gateEnabled,
  createdAt: rule.createdAt,
  updatedAt: rule.updatedAt,
});

const createDuplicateTemplateNameError = (name: string) =>
  new HttpError(409, 'DUPLICATE_TEMPLATE_NAME', 'Checklist template name already exists in this workspace', {
    name,
  });

const createReorderMismatchError = (details: {
  expectedCount: number;
  receivedCount: number;
  missingItemIds: string[];
  unknownItemIds: string[];
}) =>
  new HttpError(400, 'REORDER_MISMATCH', 'orderedItemIds must contain exactly all item ids of the template', details);

const createEvidenceRequiredError = () =>
  new HttpError(400, 'EVIDENCE_REQUIRED', 'Evidence is required to complete this checklist item', {
    requiresEvidence: true,
  });

const createTemplateArchivedError = (templateId: string) =>
  new HttpError(400, 'TEMPLATE_ARCHIVED', 'Checklist template is archived', {
    templateId,
  });

const createTemplateNotArchivedForDeleteError = (templateId: string) =>
  new HttpError(
    400,
    'TEMPLATE_DELETE_REQUIRES_ARCHIVE',
    'Checklist template must be archived before permanent deletion',
    {
      templateId,
    },
  );

const createTemplateDeleteBlockedError = (details: {
  templateId: string;
  instanceCount: number;
  gatedStageCount: number;
}) =>
  new HttpError(
    409,
    'TEMPLATE_DELETE_BLOCKED',
    'Checklist template cannot be deleted because it is still referenced',
    details,
  );

const createItemAlreadyCompletedError = (state?: string) =>
  new HttpError(409, 'ITEM_ALREADY_COMPLETED', 'Checklist item is already completed', {
    state: state ? normalizeChecklistItemState(state) : undefined,
  });

const createGateBlockedError = (details: {
  missingItems: Array<{
    ruleId: string;
    templateId: string;
    instanceId: string | null;
    missingRequiredItemIds: string[];
  }>;
}) =>
  new HttpError(403, 'GATE_BLOCKED', 'Checklist gate blocked', details);

type ChecklistInstanceLookup = {
  workspaceId: string;
  projectId: string;
  pipelineStageId: string;
  checklistTemplateId: string;
};

type EnsureChecklistInstanceResult = {
  created: boolean;
  instance: ChecklistInstanceWithItemsRecord | null;
};

const ensureChecklistInstance = async (input: {
  lookup: ChecklistInstanceLookup;
  autoCreateInstance: boolean;
  tx?: Prisma.TransactionClient;
}): Promise<EnsureChecklistInstanceResult> => {
  const existing = await checklistsRepository.findChecklistInstanceByUnique(input.lookup, input.tx);
  if (existing) {
    return { created: false, instance: existing };
  }

  if (!input.autoCreateInstance) {
    return { created: false, instance: null };
  }

  try {
    const created = await checklistsRepository.createChecklistInstanceWithItems(
      input.lookup,
      input.tx,
    );

    return {
      created: true,
      instance: created ?? null,
    };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const concurrent = await checklistsRepository.findChecklistInstanceByUnique(
      input.lookup,
      input.tx,
    );

    return {
      created: false,
      instance: concurrent ?? null,
    };
  }
};

const validateOverrideReason = (reason: string | null) => {
  const normalized = reason?.trim() ?? '';
  if (normalized.length < MIN_GATE_OVERRIDE_REASON_LENGTH) {
    throw badRequest(
      `overrideReason must be at least ${MIN_GATE_OVERRIDE_REASON_LENGTH} characters`,
    );
  }

  if (normalized.length > MAX_GATE_OVERRIDE_REASON_LENGTH) {
    throw badRequest(
      `overrideReason must be at most ${MAX_GATE_OVERRIDE_REASON_LENGTH} characters`,
    );
  }

  return normalized;
};

const validateGateForInstance = async (input: {
  workspaceId: string;
  instanceId: string | null;
  tx?: Prisma.TransactionClient;
}) => {
  if (!input.instanceId) {
    return {
      ok: false,
      missingRequiredItemIds: [] as string[],
    };
  }

  const missingRequiredItemIds = await checklistsRepository.listMissingRequiredItemIds(
    input.workspaceId,
    input.instanceId,
    input.tx,
  );

  return {
    ok: missingRequiredItemIds.length === 0,
    missingRequiredItemIds,
  };
};

const truncateOverrideReasonForAudit = (reason: string) =>
  reason.length <= MAX_GATE_OVERRIDE_REASON_AUDIT_LENGTH
    ? reason
    : reason.slice(0, MAX_GATE_OVERRIDE_REASON_AUDIT_LENGTH);

export const checklistsService = {
  parseTemplateId(rawTemplateId: string) {
    return parseWithSchema(idSchema, rawTemplateId, 'Template id is invalid');
  },

  parseTemplateItemId(rawItemId: string) {
    return parseWithSchema(idSchema, rawItemId, 'Template item id is invalid');
  },

  parseProjectId(rawProjectId: string) {
    return parseWithSchema(idSchema, rawProjectId, 'Project id is invalid');
  },

  parseCategoryId(rawCategoryId: string) {
    return parseWithSchema(idSchema, rawCategoryId, 'Project category id is invalid');
  },

  parseChecklistInstanceItemId(rawItemId: string) {
    return parseWithSchema(idSchema, rawItemId, 'Checklist item id is invalid');
  },

  parseChecklistInstanceId(rawInstanceId: string) {
    return parseWithSchema(idSchema, rawInstanceId, 'Checklist instance id is invalid');
  },

  parsePipelineStageId(rawPipelineStageId: string) {
    return parseWithSchema(idSchema, rawPipelineStageId, 'Pipeline stage id is invalid');
  },

  parseListTemplatesQuery(query: unknown) {
    const source =
      query && typeof query === 'object'
        ? (query as Record<string, unknown>)
        : {};

    return {
      q:
        normalizeOptionalQuerySearchValue(source.q) ||
        normalizeOptionalQuerySearchValue(source.query) ||
        normalizeOptionalQuerySearchValue(source.search),
      isArchived:
        normalizeOptionalQueryBooleanValue(source.isArchived) ??
        normalizeOptionalQueryBooleanValue(source.archived),
    };
  },

  parseCreateTemplateBody(body: unknown) {
    return parseWithSchema(
      createTemplateBodySchema,
      body,
      'Invalid checklist template payload',
    );
  },

  parseUpdateTemplateBody(body: unknown) {
    return parseWithSchema(
      updateTemplateBodySchema,
      body,
      'Invalid checklist template update payload',
    );
  },

  parseCreateTemplateItemBody(body: unknown) {
    return parseWithSchema(
      createTemplateItemSchema,
      body,
      'Invalid checklist template item payload',
    );
  },

  parseUpdateTemplateItemBody(body: unknown) {
    return parseWithSchema(
      updateTemplateItemBodySchema,
      body,
      'Invalid checklist template item update payload',
    );
  },

  parseReorderTemplateItemsBody(body: unknown) {
    return parseWithSchema(
      reorderTemplateItemsBodySchema,
      body,
      'Invalid reorder payload',
    );
  },

  parseCreateChecklistInstanceBody(body: unknown) {
    return parseWithSchema(
      createChecklistInstanceBodySchema,
      body,
      'Invalid checklist instance payload',
    );
  },

  parseCompleteChecklistItemBody(body: unknown) {
    return parseWithSchema(
      completeChecklistItemBodySchema,
      body,
      'Invalid checklist item completion payload',
    );
  },

  parseMarkChecklistItemNotApplicableBody(body: unknown) {
    return parseWithSchema(
      markChecklistItemNotApplicableBodySchema,
      body,
      'Invalid checklist item not-applicable payload',
    );
  },

  parseListProjectChecklistInstancesQuery(query: unknown) {
    return parseWithSchema(
      listProjectChecklistInstancesQuerySchema,
      query,
      'Invalid checklist instance list query params',
    );
  },

  parseUpdateChecklistItemStateBody(body: unknown) {
    return parseWithSchema(
      updateChecklistItemStateBodySchema,
      body,
      'Invalid checklist item state payload',
    );
  },

  parseToggleChecklistInstanceItemBody(body: unknown) {
    return parseWithSchema(
      toggleChecklistInstanceItemBodySchema,
      body,
      'Invalid checklist instance item completion payload',
    );
  },

  parseAssignChecklistItemBody(body: unknown) {
    return parseWithSchema(
      assignChecklistItemBodySchema,
      body,
      'Invalid checklist item assignee payload',
    );
  },

  parseUpsertStageChecklistRulesBody(body: unknown) {
    return parseWithSchema(
      upsertStageChecklistRulesBodySchema,
      body,
      'Invalid stage checklist-rules payload',
    );
  },

  async requireTemplate(workspaceId: string, rawTemplateId: string) {
    const templateId = this.parseTemplateId(rawTemplateId);
    const template = await checklistsRepository.findTemplateById(workspaceId, templateId);
    if (!template) {
      throw notFound('Checklist template not found');
    }

    return template;
  },

  async requireTemplateItem(workspaceId: string, rawTemplateId: string, rawItemId: string) {
    const templateId = this.parseTemplateId(rawTemplateId);
    const itemId = this.parseTemplateItemId(rawItemId);
    const item = await checklistsRepository.findTemplateItemById(workspaceId, templateId, itemId);
    if (!item) {
      throw notFound('Checklist template item not found');
    }

    return item;
  },

  async requireChecklistInstanceItem(workspaceId: string, rawItemId: string) {
    const itemId = this.parseChecklistInstanceItemId(rawItemId);
    const item = await checklistsRepository.findChecklistInstanceItemById(workspaceId, itemId);
    if (!item) {
      throw notFound('Checklist item not found');
    }

    return item;
  },

  async requireActiveWorkspaceMember(workspaceId: string, userId: string) {
    const member = await checklistsRepository.findActiveWorkspaceMemberByUserId(
      workspaceId,
      userId,
    );

    if (!member) {
      throw badRequest('Assigned user must be an active workspace member');
    }

    return member;
  },

  async ensureProjectBelongsToWorkspace(workspaceId: string, projectId: string) {
    const existsInWorkspace = await checklistsRepository.projectExistsInWorkspace(
      workspaceId,
      projectId,
    );

    if (!existsInWorkspace) {
      throw notFound('Project not found');
    }
  },

  async ensurePipelineStageBelongsToWorkspace(
    workspaceId: string,
    pipelineStageId: string,
  ) {
    const existsInWorkspace = await checklistsRepository.pipelineStageExistsInWorkspace(
      workspaceId,
      pipelineStageId,
    );

    if (!existsInWorkspace) {
      throw notFound('Pipeline stage not found');
    }
  },

  async recalculateInstanceStatus(workspaceId: string, instanceId: string) {
    return checklistsRepository.recalculateChecklistInstanceStatus(workspaceId, instanceId);
  },

  async listTemplates(workspaceId: string, query: unknown) {
    const parsed = this.parseListTemplatesQuery(query);
    const templates = await checklistsRepository.listTemplates({
      workspaceId,
      q: parsed.q,
      isArchived: parsed.isArchived,
    });

    return templates.map((template) => mapTemplateSummary(template));
  },

  async getTemplate(workspaceId: string, rawTemplateId: string) {
    const templateId = this.parseTemplateId(rawTemplateId);
    const template = await checklistsRepository.findTemplateByIdWithItems(workspaceId, templateId);
    if (!template) {
      throw notFound('Checklist template not found');
    }

    return mapTemplateWithItems(template);
  },

  async createTemplate(input: {
    workspaceId: string;
    actorUserId: string;
    body: unknown;
    request?: FastifyRequest;
  }) {
    const payload = this.parseCreateTemplateBody(input.body);
    const items = payload.items ?? [];
    const normalizedItems = await Promise.all(
      items.map(async (item) => {
        const defaultAssignedToUserId = item.defaultAssignedToUserId ?? null;
        if (defaultAssignedToUserId) {
          await this.requireActiveWorkspaceMember(input.workspaceId, defaultAssignedToUserId);
        }

        return {
          title: item.title,
          description: normalizeOptionalString(item.description),
          isRequired: item.isRequired ?? true,
          requiresEvidenceSnapshot: item.requiresEvidenceSnapshot ?? false,
          isCriticalSnapshot: item.isCriticalSnapshot ?? false,
          defaultAssignedToUserId,
        };
      }),
    );

    try {
      const created = await checklistsRepository.createTemplateWithItems({
        workspaceId: input.workspaceId,
        name: payload.name,
        appliesTo: payload.appliesTo,
        description: normalizeOptionalString(payload.description),
        items: normalizedItems,
      });

      await audit.log({
        event: 'checklists.template.create',
        actorUserId: input.actorUserId,
        workspaceId: input.workspaceId,
        entityType: 'ChecklistTemplate',
        entityId: created.id,
        metadata: {
          templateId: created.id,
        },
        request: input.request,
      });

      return mapTemplateWithItems(created);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw createDuplicateTemplateNameError(payload.name);
      }

      throw error;
    }
  },

  async updateTemplate(input: {
    workspaceId: string;
    templateId: string;
    actorUserId: string;
    body: unknown;
    request?: FastifyRequest;
  }) {
    const payload = this.parseUpdateTemplateBody(input.body);
    const templateId = this.parseTemplateId(input.templateId);

    const current = await checklistsRepository.findTemplateByIdWithItems(
      input.workspaceId,
      templateId,
    );
    if (!current) {
      throw notFound('Checklist template not found');
    }

    const nextName = payload.name;
    const nextAppliesTo = payload.appliesTo;
    const nextDescription = normalizePatchString(payload.description);
    const nextArchived = payload.isArchived;

    const fieldsChanged: string[] = [];
    if (nextName !== undefined && nextName !== current.name) {
      fieldsChanged.push('name');
    }
    if (nextAppliesTo !== undefined && nextAppliesTo !== current.appliesTo) {
      fieldsChanged.push('appliesTo');
    }
    if (nextDescription !== undefined && nextDescription !== current.description) {
      fieldsChanged.push('description');
    }
    if (nextArchived !== undefined && nextArchived !== current.isArchived) {
      fieldsChanged.push('isArchived');
    }

    let updated = current;
    if (fieldsChanged.length > 0) {
      try {
        const result = await checklistsRepository.updateTemplate(input.workspaceId, templateId, {
          ...(nextName !== undefined ? { name: nextName } : {}),
          ...(nextAppliesTo !== undefined ? { appliesTo: nextAppliesTo } : {}),
          ...(nextDescription !== undefined ? { description: nextDescription } : {}),
          ...(nextArchived !== undefined ? { isArchived: nextArchived } : {}),
        });

        if (!result) {
          throw notFound('Checklist template not found');
        }

        updated = result;
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw createDuplicateTemplateNameError(nextName ?? current.name);
        }

        throw error;
      }
    }

    await audit.log({
      event: 'checklists.template.update',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'ChecklistTemplate',
      entityId: templateId,
      metadata: {
        templateId,
        fieldsChanged,
      },
      request: input.request,
    });

    return mapTemplateWithItems(updated);
  },

  async archiveTemplate(input: {
    workspaceId: string;
    templateId: string;
    actorUserId: string;
    request?: FastifyRequest;
  }) {
    const templateId = this.parseTemplateId(input.templateId);
    await this.requireTemplate(input.workspaceId, templateId);

    await checklistsRepository.updateTemplate(input.workspaceId, templateId, {
      isArchived: true,
    });

    await audit.log({
      event: 'checklists.template.archive',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'ChecklistTemplate',
      entityId: templateId,
      metadata: {
        templateId,
      },
      request: input.request,
    });
  },

  async deleteTemplatePermanently(input: {
    workspaceId: string;
    templateId: string;
    actorUserId: string;
    request?: FastifyRequest;
  }) {
    const templateId = this.parseTemplateId(input.templateId);
    const template = await this.requireTemplate(input.workspaceId, templateId);

    if (!template.isArchived) {
      throw createTemplateNotArchivedForDeleteError(templateId);
    }

    const usage = await checklistsRepository.getTemplateUsageCounts(input.workspaceId, templateId);
    if (usage.instanceCount > 0 || usage.gatedStageCount > 0) {
      throw createTemplateDeleteBlockedError({
        templateId,
        instanceCount: usage.instanceCount,
        gatedStageCount: usage.gatedStageCount,
      });
    }

    try {
      const deleted = await checklistsRepository.deleteTemplate(input.workspaceId, templateId);
      if (!deleted) {
        throw notFound('Checklist template not found');
      }
    } catch (error) {
      if (isForeignKeyConstraintError(error)) {
        const refreshedUsage = await checklistsRepository.getTemplateUsageCounts(
          input.workspaceId,
          templateId,
        );
        throw createTemplateDeleteBlockedError({
          templateId,
          instanceCount: refreshedUsage.instanceCount,
          gatedStageCount: refreshedUsage.gatedStageCount,
        });
      }

      throw error;
    }

    await audit.log({
      event: 'checklists.template.delete_permanent',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'ChecklistTemplate',
      entityId: templateId,
      metadata: {
        templateId,
      },
      request: input.request,
    });
  },

  async createTemplateItem(input: {
    workspaceId: string;
    templateId: string;
    actorUserId: string;
    body: unknown;
    request?: FastifyRequest;
  }) {
    const templateId = this.parseTemplateId(input.templateId);
    const payload = this.parseCreateTemplateItemBody(input.body);
    const defaultAssignedToUserId = payload.defaultAssignedToUserId ?? null;

    await this.requireTemplate(input.workspaceId, templateId);
    if (defaultAssignedToUserId) {
      await this.requireActiveWorkspaceMember(input.workspaceId, defaultAssignedToUserId);
    }

    const createdItem = await checklistsRepository.createTemplateItem({
      workspaceId: input.workspaceId,
      templateId,
      title: payload.title,
      description: normalizeOptionalString(payload.description),
      isRequired: payload.isRequired ?? true,
      requiresEvidenceSnapshot: payload.requiresEvidenceSnapshot ?? false,
      isCriticalSnapshot: payload.isCriticalSnapshot ?? false,
      defaultAssignedToUserId,
    });

    if (!createdItem) {
      throw notFound('Checklist template not found');
    }

    await audit.log({
      event: 'checklists.template_item.create',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'ChecklistTemplateItem',
      entityId: createdItem.id,
      metadata: {
        templateId,
        itemId: createdItem.id,
      },
      request: input.request,
    });

    return mapTemplateItem(createdItem);
  },

  async updateTemplateItem(input: {
    workspaceId: string;
    templateId: string;
    itemId: string;
    actorUserId: string;
    body: unknown;
    request?: FastifyRequest;
  }) {
    const templateId = this.parseTemplateId(input.templateId);
    const itemId = this.parseTemplateItemId(input.itemId);
    const payload = this.parseUpdateTemplateItemBody(input.body);

    const currentItem = await this.requireTemplateItem(input.workspaceId, templateId, itemId);

    const nextTitle = payload.title;
    const nextDescription = normalizePatchString(payload.description);
    const nextRequired = payload.isRequired;
    const nextRequiresEvidence = payload.requiresEvidenceSnapshot;
    const nextCritical = payload.isCriticalSnapshot;
    const nextDefaultAssignedToUserId = payload.defaultAssignedToUserId;

    if (nextDefaultAssignedToUserId) {
      await this.requireActiveWorkspaceMember(input.workspaceId, nextDefaultAssignedToUserId);
    }

    const fieldsChanged: string[] = [];
    if (nextTitle !== undefined && nextTitle !== currentItem.title) {
      fieldsChanged.push('title');
    }
    if (nextDescription !== undefined && nextDescription !== currentItem.description) {
      fieldsChanged.push('description');
    }
    if (nextRequired !== undefined && nextRequired !== currentItem.isRequired) {
      fieldsChanged.push('isRequired');
    }
    if (
      nextRequiresEvidence !== undefined &&
      nextRequiresEvidence !== currentItem.requiresEvidenceSnapshot
    ) {
      fieldsChanged.push('requiresEvidenceSnapshot');
    }
    if (nextCritical !== undefined && nextCritical !== currentItem.isCriticalSnapshot) {
      fieldsChanged.push('isCriticalSnapshot');
    }
    if (
      nextDefaultAssignedToUserId !== undefined &&
      nextDefaultAssignedToUserId !== currentItem.defaultAssignedToUserId
    ) {
      fieldsChanged.push('defaultAssignedToUserId');
    }

    let updatedItem = currentItem;
    if (fieldsChanged.length > 0) {
      const result = await checklistsRepository.updateTemplateItem(
        input.workspaceId,
        templateId,
        itemId,
        {
          ...(nextTitle !== undefined ? { title: nextTitle } : {}),
          ...(nextDescription !== undefined ? { description: nextDescription } : {}),
          ...(nextRequired !== undefined ? { isRequired: nextRequired } : {}),
          ...(nextRequiresEvidence !== undefined
            ? { requiresEvidenceSnapshot: nextRequiresEvidence }
            : {}),
          ...(nextCritical !== undefined ? { isCriticalSnapshot: nextCritical } : {}),
          ...(nextDefaultAssignedToUserId !== undefined
            ? { defaultAssignedToUserId: nextDefaultAssignedToUserId }
            : {}),
        },
      );

      if (!result) {
        throw notFound('Checklist template item not found');
      }

      updatedItem = result;
    }

    await audit.log({
      event: 'checklists.template_item.update',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'ChecklistTemplateItem',
      entityId: itemId,
      metadata: {
        templateId,
        itemId,
        fieldsChanged,
      },
      request: input.request,
    });

    return mapTemplateItem(updatedItem);
  },

  async deleteTemplateItem(input: {
    workspaceId: string;
    templateId: string;
    itemId: string;
    actorUserId: string;
    request?: FastifyRequest;
  }) {
    const templateId = this.parseTemplateId(input.templateId);
    const itemId = this.parseTemplateItemId(input.itemId);

    await this.requireTemplateItem(input.workspaceId, templateId, itemId);

    await checklistsRepository.deleteTemplateItemAndCompact(
      input.workspaceId,
      templateId,
      itemId,
    );

    await audit.log({
      event: 'checklists.template_item.delete',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'ChecklistTemplateItem',
      entityId: itemId,
      metadata: {
        templateId,
        itemId,
      },
      request: input.request,
    });
  },

  async reorderTemplateItems(input: {
    workspaceId: string;
    templateId: string;
    actorUserId: string;
    body: unknown;
    request?: FastifyRequest;
  }) {
    const templateId = this.parseTemplateId(input.templateId);
    const payload = this.parseReorderTemplateItemsBody(input.body);

    await this.requireTemplate(input.workspaceId, templateId);

    const currentIds = (await checklistsRepository.listTemplateItemIds(
      input.workspaceId,
      templateId,
    )).map((item) => item.id);

    const expected = new Set(currentIds);
    const received = new Set(payload.orderedItemIds);

    const missingItemIds = currentIds.filter((itemId) => !received.has(itemId));
    const unknownItemIds = payload.orderedItemIds.filter((itemId) => !expected.has(itemId));

    const hasMismatch =
      currentIds.length !== payload.orderedItemIds.length ||
      missingItemIds.length > 0 ||
      unknownItemIds.length > 0;

    if (hasMismatch) {
      throw createReorderMismatchError({
        expectedCount: currentIds.length,
        receivedCount: payload.orderedItemIds.length,
        missingItemIds,
        unknownItemIds,
      });
    }

    const reorderedItems = await checklistsRepository.reorderTemplateItems(
      input.workspaceId,
      templateId,
      payload.orderedItemIds,
    );

    await audit.log({
      event: 'checklists.template_item.reorder',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'ChecklistTemplate',
      entityId: templateId,
      metadata: {
        templateId,
        orderedItemIds: payload.orderedItemIds,
      },
      request: input.request,
    });

    return {
      items: reorderedItems.map((item) => ({
        id: item.id,
        sortOrder: item.sortOrder,
      })),
    };
  },

  async createChecklistInstance(input: {
    workspaceId: string;
    projectId: string;
    actorUserId: string;
    body: unknown;
    request?: FastifyRequest;
  }) {
    const projectId = this.parseProjectId(input.projectId);
    const payload = this.parseCreateChecklistInstanceBody(input.body);
    const checklistTemplateId = this.parseTemplateId(payload.checklistTemplateId);
    const pipelineStageId = this.parsePipelineStageId(payload.pipelineStageId);

    await this.ensureProjectBelongsToWorkspace(input.workspaceId, projectId);
    await this.ensurePipelineStageBelongsToWorkspace(input.workspaceId, pipelineStageId);

    const template = await checklistsRepository.findTemplateById(
      input.workspaceId,
      checklistTemplateId,
    );
    if (!template) {
      throw notFound('Checklist template not found');
    }
    if (template.isArchived) {
      throw createTemplateArchivedError(template.id);
    }

    const lookup = {
      workspaceId: input.workspaceId,
      projectId,
      pipelineStageId,
      checklistTemplateId,
    };

    const ensured = await ensureChecklistInstance({
      lookup,
      autoCreateInstance: true,
    });

    if (!ensured.instance) {
      throw notFound('Checklist instance not found');
    }

    return {
      created: ensured.created,
      instance: mapChecklistInstance(ensured.instance),
    };
  },

  async ensureChecklistInstancesForProjectStage(input: {
    workspaceId: string;
    projectId: string;
    pipelineStageId: string;
    actorUserId: string;
    request?: FastifyRequest;
  }) {
    const projectId = this.parseProjectId(input.projectId);
    const pipelineStageId = this.parsePipelineStageId(input.pipelineStageId);

    await this.ensureProjectBelongsToWorkspace(input.workspaceId, projectId);

    const stage = await checklistsRepository.findPipelineStageForRules(
      input.workspaceId,
      pipelineStageId,
    );
    if (!stage) {
      throw notFound('Pipeline stage not found');
    }

    if (!stage.categoryId) {
      return {
        created: [],
        existing: [],
      };
    }

    const rules = await checklistsRepository.listStageChecklistRules(
      input.workspaceId,
      stage.categoryId,
      pipelineStageId,
    );

    const created: string[] = [];
    const existing: string[] = [];

    for (const rule of rules) {
      const ensured = await ensureChecklistInstance({
        lookup: {
          workspaceId: input.workspaceId,
          projectId,
          pipelineStageId,
          checklistTemplateId: rule.checklistTemplateId,
        },
        autoCreateInstance: true,
      });

      if (ensured.created && ensured.instance) {
        created.push(ensured.instance.id);
      } else if (ensured.instance) {
        existing.push(ensured.instance.id);
      }
    }

    await audit.log({
      event: 'checklists.instances.ensure',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      targetType: 'Project',
      targetId: projectId,
      metadata: {
        projectId,
        stageId: pipelineStageId,
        rulesCount: rules.length,
        createdInstanceIds: created,
        existingInstanceIds: existing,
      },
      request: input.request,
    });

    return {
      created,
      existing,
    };
  },

  async listStageChecklistRules(input: {
    workspaceId: string;
    categoryId: string;
    stageId: string;
  }) {
    const categoryId = this.parseCategoryId(input.categoryId);
    const stageId = this.parsePipelineStageId(input.stageId);

    const [category, stage] = await Promise.all([
      checklistsRepository.findProjectCategoryForRules(input.workspaceId, categoryId),
      checklistsRepository.findPipelineStageForRules(input.workspaceId, stageId),
    ]);

    if (!category) {
      throw notFound('Project category not found');
    }

    if (!stage) {
      throw notFound('Pipeline stage not found');
    }

    if (stage.categoryId !== category.id) {
      throw badRequest('Stage does not belong to category', {
        categoryId,
        stageId,
      });
    }

    const rules = await checklistsRepository.listStageChecklistRules(
      input.workspaceId,
      category.id,
      stage.id,
    );

    return {
      items: rules.map((rule) => mapStageChecklistRule(rule)),
    };
  },

  async replaceStageChecklistRules(input: {
    workspaceId: string;
    categoryId: string;
    stageId: string;
    actorUserId: string;
    body: unknown;
    request?: FastifyRequest;
  }) {
    const categoryId = this.parseCategoryId(input.categoryId);
    const stageId = this.parsePipelineStageId(input.stageId);
    const payload = this.parseUpsertStageChecklistRulesBody(input.body);

    const [category, stage] = await Promise.all([
      checklistsRepository.findProjectCategoryForRules(input.workspaceId, categoryId),
      checklistsRepository.findPipelineStageForRules(input.workspaceId, stageId),
    ]);

    if (!category) {
      throw notFound('Project category not found');
    }

    if (!stage) {
      throw notFound('Pipeline stage not found');
    }

    if (stage.categoryId !== category.id) {
      throw badRequest('Stage does not belong to category', {
        categoryId,
        stageId,
      });
    }

    const uniqueTemplateIds = Array.from(new Set(payload.rules.map((rule) => rule.checklistTemplateId)));
    const templates = uniqueTemplateIds.length > 0
      ? await Promise.all(
          uniqueTemplateIds.map((templateId) =>
            checklistsRepository.findActiveTemplateById(input.workspaceId, templateId),
          ),
        )
      : [];

    if (templates.some((template) => !template)) {
      throw badRequest('One or more checklist templates are invalid or archived');
    }

    if (templates.some((template) => template?.appliesTo !== 'PROJECT_STAGE')) {
      throw badRequest('Only PROJECT_STAGE templates can be assigned to stage rules');
    }

    const rules = await checklistsRepository.replaceStageChecklistRules({
      workspaceId: input.workspaceId,
      projectCategoryId: category.id,
      pipelineStageId: stage.id,
      rules: payload.rules.map((rule) => ({
        checklistTemplateId: rule.checklistTemplateId,
        gateEnabled: rule.gateEnabled,
      })),
    });

    await audit.log({
      event: 'checklists.rules.update',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      targetType: 'PipelineStage',
      targetId: stage.id,
      metadata: {
        categoryId: category.id,
        stageId: stage.id,
        rules: rules.map((rule) => ({
          ruleId: rule.id,
          checklistTemplateId: rule.checklistTemplateId,
          gateEnabled: rule.gateEnabled,
        })),
      },
      request: input.request,
    });

    return {
      items: rules.map((rule) => mapStageChecklistRule(rule)),
    };
  },

  async listProjectChecklistInstances(
    workspaceId: string,
    rawProjectId: string,
    query: unknown,
  ) {
    const projectId = this.parseProjectId(rawProjectId);
    const parsedQuery = this.parseListProjectChecklistInstancesQuery(query);
    const stageId = parsedQuery.stageId
      ? this.parsePipelineStageId(parsedQuery.stageId)
      : undefined;
    await this.ensureProjectBelongsToWorkspace(workspaceId, projectId);
    if (stageId) {
      await this.ensurePipelineStageBelongsToWorkspace(workspaceId, stageId);
    }

    if (parsedQuery.includeItems) {
      const [instancesWithItems, activeMembers] = await Promise.all([
        checklistsRepository.listChecklistInstancesByProjectWithItems(
          workspaceId,
          projectId,
          stageId,
        ),
        checklistsRepository.listActiveWorkspaceMembers(workspaceId),
      ]);
      const activeUserIds = new Set(activeMembers.map((member) => member.userId));

      return {
        items: instancesWithItems.map((instance) =>
          mapChecklistInstance(instance, { activeUserIds })),
      };
    }

    const instances = await checklistsRepository.listChecklistInstancesByProject(
      workspaceId,
      projectId,
      stageId,
    );

    return {
      items: instances.map((instance) => mapChecklistInstanceSummary(instance)),
    };
  },

  async listAssignableUsers(workspaceId: string) {
    const members = await checklistsRepository.listActiveWorkspaceMembers(workspaceId);
    return {
      items: members.map((member) => ({
        userId: member.userId,
        name: member.user.name ?? member.user.email,
        email: member.user.email,
      })),
    };
  },

  async completeChecklistItem(input: {
    workspaceId: string;
    itemId: string;
    actorUserId: string;
    body: unknown;
    request?: FastifyRequest;
  }) {
    const item = await this.requireChecklistInstanceItem(input.workspaceId, input.itemId);
    const payload = this.parseCompleteChecklistItemBody(input.body);

    if (['completed', 'not_applicable'].includes(item.state)) {
      throw createItemAlreadyCompletedError(item.state);
    }

    const evidenceNote = normalizeOptionalString(payload.evidenceNote);
    const evidenceUrl = normalizeOptionalString(payload.evidenceUrl);

    if (item.requiresEvidenceSnapshot && !evidenceNote && !evidenceUrl) {
      throw createEvidenceRequiredError();
    }

    const updated = await checklistsRepository.completeChecklistItemFromPending({
      workspaceId: input.workspaceId,
      itemId: item.id,
      evidenceNote,
      evidenceUrl,
      completedByUserId: input.actorUserId,
    });

    if (!updated.updated) {
      if (!updated.current) {
        throw notFound('Checklist item not found');
      }
      throw createItemAlreadyCompletedError(updated.current.state);
    }

    await audit.log({
      event: 'checklists.item.complete',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'ChecklistInstanceItem',
      entityId: updated.item.id,
      metadata: {
        instanceId: updated.item.instanceId,
        itemId: updated.item.id,
        projectId: updated.item.instance.projectId,
      },
      request: input.request,
    });

    return mapChecklistInstanceItem(updated.item);
  },

  async markChecklistItemNotApplicable(input: {
    workspaceId: string;
    itemId: string;
    actorUserId: string;
    body: unknown;
    request?: FastifyRequest;
  }) {
    const item = await this.requireChecklistInstanceItem(input.workspaceId, input.itemId);
    const payload = this.parseMarkChecklistItemNotApplicableBody(input.body);

    if (['completed', 'not_applicable'].includes(item.state)) {
      throw createItemAlreadyCompletedError(item.state);
    }

    const updated = await checklistsRepository.markChecklistItemNotApplicableFromPending({
      workspaceId: input.workspaceId,
      itemId: item.id,
      reason: payload.reason.trim(),
      completedByUserId: input.actorUserId,
    });

    if (!updated.updated) {
      if (!updated.current) {
        throw notFound('Checklist item not found');
      }
      throw createItemAlreadyCompletedError(updated.current.state);
    }

    if (updated.item.isCriticalSnapshot) {
      await audit.log({
        event: 'checklists.item.not_applicable',
        actorUserId: input.actorUserId,
        workspaceId: input.workspaceId,
        entityType: 'ChecklistInstanceItem',
        entityId: updated.item.id,
        metadata: {
          instanceId: updated.item.instanceId,
          itemId: updated.item.id,
          projectId: updated.item.instance.projectId,
        },
        request: input.request,
      });
    }

    return mapChecklistInstanceItem(updated.item);
  },

  async updateChecklistItemState(input: {
    workspaceId: string;
    itemId: string;
    actorUserId: string;
    body: unknown;
    request?: FastifyRequest;
  }) {
    const item = await this.requireChecklistInstanceItem(input.workspaceId, input.itemId);
    const payload = this.parseUpdateChecklistItemStateBody(input.body);
    const evidenceNote = payload.evidenceNote === undefined
      ? undefined
      : normalizeOptionalString(payload.evidenceNote);
    const evidenceUrl = payload.evidenceUrl === undefined
      ? undefined
      : normalizeOptionalString(payload.evidenceUrl);
    const hasEvidence = Boolean((evidenceNote ?? item.evidenceNote) || (evidenceUrl ?? item.evidenceUrl));

    if (payload.state === 'completed' && item.requiresEvidenceSnapshot && !hasEvidence) {
      throw createEvidenceRequiredError();
    }

    const updated = await checklistsRepository.updateChecklistItemState({
      workspaceId: input.workspaceId,
      itemId: item.id,
      state: payload.state,
      evidenceNote,
      evidenceUrl,
      completedByUserId: input.actorUserId,
    });

    if (!updated.updated) {
      throw notFound('Checklist item not found');
    }

    await audit.log({
      event: 'checklists.item.state_change',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'ChecklistInstanceItem',
      entityId: updated.item.id,
      metadata: {
        instanceId: updated.item.instanceId,
        itemId: updated.item.id,
        projectId: updated.item.instance.projectId,
        previousState: normalizeChecklistItemState(updated.previousState),
        nextState: normalizeChecklistItemState(updated.item.state),
      },
      request: input.request,
    });

    if (payload.state === 'completed') {
      await audit.log({
        event: 'checklists.item.complete',
        actorUserId: input.actorUserId,
        workspaceId: input.workspaceId,
        entityType: 'ChecklistInstanceItem',
        entityId: updated.item.id,
        metadata: {
          instanceId: updated.item.instanceId,
          itemId: updated.item.id,
          projectId: updated.item.instance.projectId,
        },
        request: input.request,
      });
    }

    return mapChecklistInstanceItem(updated.item);
  },

  async resetChecklistItem(input: {
    workspaceId: string;
    itemId: string;
  }) {
    const itemId = this.parseChecklistInstanceItemId(input.itemId);
    const resetItem = await checklistsRepository.resetChecklistItem(input.workspaceId, itemId);
    if (!resetItem) {
      throw notFound('Checklist item not found');
    }

    return mapChecklistInstanceItem(resetItem);
  },

  async assignChecklistItem(input: {
    workspaceId: string;
    itemId?: string;
    itemInstanceId?: string;
    checklistInstanceId?: string;
    actorUserId: string;
    body: unknown;
    request?: FastifyRequest;
  }) {
    const rawItemId = input.itemInstanceId ?? input.itemId;
    if (!rawItemId) {
      throw badRequest('Checklist item id is required');
    }

    const item = await this.requireChecklistInstanceItem(input.workspaceId, rawItemId);
    const checklistInstanceId = input.checklistInstanceId
      ? this.parseChecklistInstanceId(input.checklistInstanceId)
      : null;
    if (checklistInstanceId && item.instanceId !== checklistInstanceId) {
      throw notFound('Checklist instance item not found');
    }

    const payload = this.parseAssignChecklistItemBody(input.body);
    const assignedToUserId = payload.assignedToUserId ?? null;

    if (assignedToUserId) {
      await this.requireActiveWorkspaceMember(input.workspaceId, assignedToUserId);
    }

    const updated = await checklistsRepository.updateChecklistItemAssignee({
      workspaceId: input.workspaceId,
      itemId: item.id,
      assignedToUserId,
      assignedByUserId: input.actorUserId,
    });

    if (!updated.updated) {
      throw notFound('Checklist item not found');
    }

    await audit.log({
      event: assignedToUserId ? 'checklists.item.assign' : 'checklists.item.unassign',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'ChecklistInstanceItem',
      entityId: updated.item.id,
      metadata: {
        instanceId: updated.item.instanceId,
        itemInstanceId: updated.item.id,
        projectId: updated.item.instance.projectId,
        stageId: updated.item.instance.pipelineStageId,
        fromUserId: updated.previousAssignedToUserId,
        toUserId: assignedToUserId,
      },
      request: input.request,
    });

    return mapChecklistInstanceItem(updated.item);
  },

  async toggleChecklistInstanceItemCompletion(input: {
    workspaceId: string;
    checklistInstanceId: string;
    itemId: string;
    actorUserId: string;
    body: unknown;
    request?: FastifyRequest;
  }) {
    const checklistInstanceId = this.parseChecklistInstanceId(input.checklistInstanceId);
    const item = await this.requireChecklistInstanceItem(input.workspaceId, input.itemId);
    if (item.instanceId !== checklistInstanceId) {
      throw notFound('Checklist instance item not found');
    }

    const payload = this.parseToggleChecklistInstanceItemBody(input.body);

    if (payload.notApplicable) {
      return this.markChecklistItemNotApplicable({
        workspaceId: input.workspaceId,
        itemId: item.id,
        actorUserId: input.actorUserId,
        body: {
          reason: payload.notApplicableReason,
        },
        request: input.request,
      });
    }

    if (payload.completed) {
      return this.completeChecklistItem({
        workspaceId: input.workspaceId,
        itemId: item.id,
        actorUserId: input.actorUserId,
        body: {
          evidenceNote: payload.notes,
          evidenceUrl: payload.evidenceUrl,
        },
        request: input.request,
      });
    }

    const reset = await this.resetChecklistItem({
      workspaceId: input.workspaceId,
      itemId: item.id,
    });

    await audit.log({
      event: 'checklists.item.uncomplete',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      targetType: 'ChecklistInstanceItem',
      targetId: item.id,
      metadata: {
        instanceId: item.instanceId,
        itemId: item.id,
      },
      request: input.request,
    });

    return reset;
  },

  async enforceGateForStageTransition(input: {
    workspaceId: string;
    projectId: string;
    toStageId: string;
    overrideGate: boolean;
    overrideReason: string | null;
    actorUserId: string;
    request?: FastifyRequest;
    stageConfig: {
      categoryId: string | null;
      isGated: boolean;
      gateChecklistTemplateId: string | null;
      autoCreateInstance: boolean;
    };
  }) {
    const stageRules = input.stageConfig.categoryId
      ? await checklistsRepository.listEnabledStageChecklistRules(
          input.workspaceId,
          input.stageConfig.categoryId,
          input.toStageId,
        )
      : [];

    const gateRules = stageRules.length > 0
      ? stageRules.map((rule) => ({
          ruleId: rule.id,
          templateId: rule.checklistTemplateId,
          autoCreateInstance: true,
        }))
      : (
          input.stageConfig.isGated && input.stageConfig.gateChecklistTemplateId
            ? [{
                ruleId: input.toStageId,
                templateId: input.stageConfig.gateChecklistTemplateId,
                autoCreateInstance: input.stageConfig.autoCreateInstance,
              }]
            : []
        );

    if (gateRules.length === 0) {
      return {
        enforced: false,
        overridden: false,
        ruleId: null,
        checklistInstanceId: null,
        missingRequiredItemIds: [] as string[],
      };
    }

    const transactionalGateStates = await checklistsServiceRuntime.runTransaction(async (tx) => Promise.all(
      gateRules.map(async (gateRule) => {
        const template = await checklistsRepository.findActiveTemplateById(
          input.workspaceId,
          gateRule.templateId,
          tx,
        );

        if (!template) {
          throw badRequest('Gated pipeline stage template is invalid', {
            toStageId: input.toStageId,
            templateId: gateRule.templateId,
            reason: 'Template not found in workspace or archived',
          });
        }

        if (template.appliesTo !== 'PROJECT_STAGE') {
          throw badRequest('Gated pipeline stage template is invalid', {
            toStageId: input.toStageId,
            templateId: gateRule.templateId,
            reason: 'Template appliesTo must be PROJECT_STAGE',
          });
        }

        const lookup = {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          pipelineStageId: input.toStageId,
          checklistTemplateId: template.id,
        };

        const ensured = await ensureChecklistInstance({
          lookup,
          autoCreateInstance: gateRule.autoCreateInstance,
          tx,
        });

        const gateValidation = await validateGateForInstance({
          workspaceId: input.workspaceId,
          instanceId: ensured.instance?.id ?? null,
          tx,
        });

        return {
          ruleId: gateRule.ruleId,
          templateId: template.id,
          instanceId: ensured.instance?.id ?? null,
          missingRequiredItemIds: gateValidation.missingRequiredItemIds,
          gateOk: gateValidation.ok,
        };
      }),
    ));

    const missingItems = transactionalGateStates
      .filter((entry) => !entry.gateOk)
      .map((entry) => ({
        ruleId: entry.ruleId,
        templateId: entry.templateId,
        instanceId: entry.instanceId,
        missingRequiredItemIds: entry.missingRequiredItemIds,
      }));

    if (missingItems.length > 0) {
      if (!input.overrideGate) {
        throw createGateBlockedError({
          missingItems,
        });
      }

      const normalizedReason = validateOverrideReason(input.overrideReason);
      await requirePermission(
        input.workspaceId,
        input.actorUserId,
        CHECKLISTS_OVERRIDE_GATE_PERMISSION,
      );

      await audit.log({
        event: 'checklists.override_gate',
        actorUserId: input.actorUserId,
        workspaceId: input.workspaceId,
        entityType: 'Project',
        entityId: input.projectId,
        metadata: {
          projectId: input.projectId,
          stageId: input.toStageId,
          missingItems,
          overrideReason: truncateOverrideReasonForAudit(normalizedReason),
        },
        request: input.request,
      });

      const flattenedMissingIds = Array.from(
        new Set(
          missingItems.flatMap((entry) => entry.missingRequiredItemIds),
        ),
      );

      return {
        enforced: true,
        overridden: true,
        ruleId: missingItems[0]?.ruleId ?? null,
        checklistInstanceId: missingItems[0]?.instanceId ?? null,
        missingRequiredItemIds: flattenedMissingIds,
      };
    }

    const primaryState = transactionalGateStates[0] ?? null;

    return {
      enforced: true,
      overridden: false,
      ruleId: primaryState?.ruleId ?? null,
      checklistInstanceId: primaryState?.instanceId ?? null,
      missingRequiredItemIds: [] as string[],
    };
  },
};
