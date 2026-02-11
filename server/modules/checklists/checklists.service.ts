import { Prisma, type ChecklistInstanceStatus } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { audit } from '../../audit/audit.js';
import { HttpError, badRequest, conflict, notFound } from '../../core/errors.js';
import {
  checklistsRepository,
  type ChecklistInstanceItemRecord,
  type ChecklistInstanceWithItemsRecord,
  type StageChecklistRuleRecord,
  type ChecklistTemplateItemRecord,
  type ChecklistTemplateRecord,
  type ChecklistTemplateWithItemsRecord,
  type CreateTemplateItemInput,
} from './checklists.repository.js';

const MAX_TEMPLATE_NAME_LENGTH = 80;
const MAX_ITEM_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_EVIDENCE_NOTE_LENGTH = 1000;
const MAX_EVIDENCE_URL_LENGTH = 500;
const MIN_NOT_APPLICABLE_REASON_LENGTH = 5;
const MIN_OVERRIDE_REASON_LENGTH = 10;

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

const listTemplatesQuerySchema = z
  .object({
    includeItems: booleanQuerySchema.optional().default(false),
    archived: booleanQuerySchema.optional().default(false),
  })
  .strict();

const getTemplateQuerySchema = z
  .object({
    includeItems: booleanQuerySchema.optional().default(true),
  })
  .strict();

const createTemplateItemSchema = z
  .object({
    title: z.string().trim().min(2).max(MAX_ITEM_TITLE_LENGTH),
    description: z.string().trim().max(MAX_DESCRIPTION_LENGTH).optional(),
    sortOrder: z.number().int().min(0).optional(),
    isRequired: z.boolean().optional(),
    requiresEvidence: z.boolean().optional(),
    isCritical: z.boolean().optional(),
  })
  .strict();

const createTemplateBodySchema = z
  .object({
    name: z.string().trim().min(2).max(MAX_TEMPLATE_NAME_LENGTH),
    description: z.string().trim().max(MAX_DESCRIPTION_LENGTH).optional(),
    items: z.array(createTemplateItemSchema).optional(),
  })
  .strict();

const updateTemplateBodySchema = z
  .object({
    name: z.string().trim().min(2).max(MAX_TEMPLATE_NAME_LENGTH).optional(),
    description: z.union([z.string().trim().max(MAX_DESCRIPTION_LENGTH), z.null()]).optional(),
    isArchived: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.name === undefined &&
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
    sortOrder: z.number().int().min(0).optional(),
    isRequired: z.boolean().optional(),
    requiresEvidence: z.boolean().optional(),
    isCritical: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.title === undefined &&
      value.description === undefined &&
      value.sortOrder === undefined &&
      value.isRequired === undefined &&
      value.requiresEvidence === undefined &&
      value.isCritical === undefined
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
    pipelineStageId: idSchema.optional(),
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

const completeChecklistItemBodySchema = z
  .object({
    evidenceNote: optionalTrimmedString(MAX_EVIDENCE_NOTE_LENGTH),
    evidenceUrl: optionalTrimmedString(MAX_EVIDENCE_URL_LENGTH).pipe(z.string().url().optional()),
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

const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

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

const mapTemplateItem = (record: ChecklistTemplateItemRecord) => ({
  id: record.id,
  workspaceId: record.workspaceId,
  templateId: record.templateId,
  title: record.title,
  description: record.description,
  sortOrder: record.sortOrder,
  isRequired: record.isRequired,
  requiresEvidence: record.requiresEvidence,
  isCritical: record.isCritical,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const mapTemplate = (record: ChecklistTemplateRecord) => ({
  id: record.id,
  workspaceId: record.workspaceId,
  name: record.name,
  description: record.description,
  isArchived: record.isArchived,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const mapTemplateWithItems = (record: ChecklistTemplateWithItemsRecord) => ({
  ...mapTemplate(record),
  items: record.items.map((item) => mapTemplateItem(item)),
});

const mapChecklistInstanceItem = (record: ChecklistInstanceItemRecord) => ({
  id: record.id,
  workspaceId: record.workspaceId,
  instanceId: record.instanceId,
  templateItemId: record.templateItemId,
  title: record.titleSnapshot,
  state: record.state,
  isRequired: record.isRequiredSnapshot,
  requiresEvidence: record.requiresEvidenceSnapshot,
  isCritical: record.isCriticalSnapshot,
  sortOrder: record.sortOrderSnapshot,
  evidenceNote: record.evidenceNote,
  evidenceUrl: record.evidenceUrl,
  notApplicableReason: record.notApplicableReason,
  completedAt: record.completedAt,
  completedByUserId: record.completedByUserId,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const mapChecklistInstance = (record: ChecklistInstanceWithItemsRecord) => ({
  id: record.id,
  workspaceId: record.workspaceId,
  projectId: record.projectId,
  pipelineStageId: record.pipelineStageId,
  checklistTemplateId: record.checklistTemplateId,
  templateName: record.checklistTemplate.name,
  status: record.status,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  items: record.items.map((item) => mapChecklistInstanceItem(item)),
});

const createGateBlockedError = (input: {
  projectId: string;
  toStageId: string;
  checklistInstanceId: string | null;
  missingRequiredItemIds: string[];
  reason?: string;
}) =>
  new HttpError(409, 'CHECKLIST_GATE_BLOCKED', 'Checklist gate not satisfied', {
    projectId: input.projectId,
    toStageId: input.toStageId,
    checklistInstanceId: input.checklistInstanceId,
    missingRequiredCount: input.missingRequiredItemIds.length,
    missingRequiredItemIds: input.missingRequiredItemIds,
    ...(input.reason ? { reason: input.reason } : {}),
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

const createItemAlreadyCompletedError = () =>
  new HttpError(409, 'ITEM_ALREADY_COMPLETED', 'Checklist item is already completed');

const createDuplicateInstanceError = (input: {
  projectId: string;
  pipelineStageId: string | null;
  checklistTemplateId: string;
}) =>
  new HttpError(409, 'DUPLICATE_INSTANCE', 'Checklist instance already exists for this project and stage', input);

const getUnsatisfiedRequiredItemIds = (items: ChecklistInstanceItemRecord[]) => {
  const unsatisfied: string[] = [];

  items.forEach((item) => {
    if (!item.isRequiredSnapshot) {
      return;
    }

    if (item.state === 'completed') {
      if (item.requiresEvidenceSnapshot && !item.evidenceNote && !item.evidenceUrl) {
        unsatisfied.push(item.id);
      }
      return;
    }

    if (item.state === 'not_applicable') {
      const normalizedReason = item.notApplicableReason?.trim() ?? '';
      if (normalizedReason.length < MIN_NOT_APPLICABLE_REASON_LENGTH) {
        unsatisfied.push(item.id);
      }
      return;
    }

    unsatisfied.push(item.id);
  });

  return unsatisfied;
};

const resolveChecklistInstanceStatusFromItems = (
  items: ChecklistInstanceItemRecord[],
): ChecklistInstanceStatus =>
  getUnsatisfiedRequiredItemIds(items).length === 0 ? 'completed' : 'active';

const toCreateTemplateItem = (
  item: z.infer<typeof createTemplateItemSchema>,
  fallbackSortOrder: number,
): CreateTemplateItemInput => ({
  title: item.title,
  description: normalizeOptionalString(item.description),
  sortOrder: item.sortOrder ?? fallbackSortOrder,
  isRequired: item.isRequired ?? true,
  requiresEvidence: item.requiresEvidence ?? false,
  isCritical: item.isCritical ?? false,
});

export type EnforceGateForStageTransitionInput = {
  workspaceId: string;
  projectId: string;
  toStageId: string;
  overrideGate: boolean;
  overrideReason: string | null;
  actorUserId: string;
  request: FastifyRequest;
};

export type EnforceGateForStageTransitionResult = {
  enforced: boolean;
  blocked: boolean;
  overridden: boolean;
  ruleId: string | null;
  checklistInstanceId: string | null;
  missingRequiredItemIds: string[];
};

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

  parseChecklistInstanceItemId(rawItemId: string) {
    return parseWithSchema(idSchema, rawItemId, 'Checklist item id is invalid');
  },

  parsePipelineStageId(rawPipelineStageId: string) {
    return parseWithSchema(idSchema, rawPipelineStageId, 'Pipeline stage id is invalid');
  },

  parseListTemplatesQuery(query: unknown) {
    return parseWithSchema(
      listTemplatesQuerySchema,
      query ?? {},
      'Invalid checklist templates query',
    );
  },

  parseGetTemplateQuery(query: unknown) {
    return parseWithSchema(getTemplateQuerySchema, query ?? {}, 'Invalid template query');
  },

  parseCreateTemplateBody(body: unknown) {
    const parsed = parseWithSchema(
      createTemplateBodySchema,
      body,
      'Invalid checklist template payload',
    );

    return {
      name: parsed.name,
      description: normalizeOptionalString(parsed.description),
      items: (parsed.items ?? []).map((item, index) => toCreateTemplateItem(item, index)),
    };
  },

  parseUpdateTemplateBody(body: unknown) {
    const parsed = parseWithSchema(
      updateTemplateBodySchema,
      body,
      'Invalid checklist template patch payload',
    );

    return {
      ...(parsed.name !== undefined ? { name: parsed.name } : {}),
      ...(parsed.description !== undefined
        ? { description: normalizePatchString(parsed.description) }
        : {}),
      ...(parsed.isArchived !== undefined ? { isArchived: parsed.isArchived } : {}),
    };
  },

  parseCreateTemplateItemBody(body: unknown) {
    const parsed = parseWithSchema(
      createTemplateItemSchema,
      body,
      'Invalid checklist template item payload',
    );

    return {
      title: parsed.title,
      description: normalizeOptionalString(parsed.description),
      sortOrder: parsed.sortOrder,
      isRequired: parsed.isRequired ?? true,
      requiresEvidence: parsed.requiresEvidence ?? false,
      isCritical: parsed.isCritical ?? false,
    };
  },

  parseUpdateTemplateItemBody(body: unknown) {
    const parsed = parseWithSchema(
      updateTemplateItemBodySchema,
      body,
      'Invalid checklist template item patch payload',
    );

    return {
      ...(parsed.title !== undefined ? { title: parsed.title } : {}),
      ...(parsed.description !== undefined
        ? { description: normalizePatchString(parsed.description) }
        : {}),
      ...(parsed.sortOrder !== undefined ? { sortOrder: parsed.sortOrder } : {}),
      ...(parsed.isRequired !== undefined ? { isRequired: parsed.isRequired } : {}),
      ...(parsed.requiresEvidence !== undefined
        ? { requiresEvidence: parsed.requiresEvidence }
        : {}),
      ...(parsed.isCritical !== undefined ? { isCritical: parsed.isCritical } : {}),
    };
  },

  parseReorderTemplateItemsBody(body: unknown) {
    return parseWithSchema(
      reorderTemplateItemsBodySchema,
      body,
      'Invalid checklist template item reorder payload',
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
      'Invalid checklist item not applicable payload',
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
    const item = await checklistsRepository.findChecklistInstanceItemById(
      workspaceId,
      itemId,
    );
    if (!item) {
      throw notFound('Checklist instance item not found');
    }

    return item;
  },

  async syncChecklistInstanceStatus(workspaceId: string, instanceId: string) {
    const instance = await checklistsRepository.findChecklistInstanceById(workspaceId, instanceId);
    if (!instance || instance.status === 'archived') {
      return;
    }

    const items = await checklistsRepository.listChecklistInstanceItems(workspaceId, instanceId);
    const nextStatus = resolveChecklistInstanceStatusFromItems(items);
    if (instance.status === nextStatus) {
      return;
    }

    await checklistsRepository.updateChecklistInstanceStatus(workspaceId, instanceId, nextStatus);
  },

  async ensureProjectBelongsToWorkspace(workspaceId: string, projectId: string) {
    const existsInWorkspace = await checklistsRepository.projectExistsInWorkspace(
      workspaceId,
      projectId,
    );

    // Project model is not yet part of Prisma schema in this repository.
    // If DB has no "Project" table yet, validation is deferred to upcoming projects module.
    if (existsInWorkspace === false) {
      throw notFound('Project not found');
    }
  },

  async ensurePipelineStageBelongsToWorkspace(
    workspaceId: string,
    pipelineStageId: string | undefined,
  ) {
    if (!pipelineStageId) {
      return;
    }

    const existsInWorkspace = await checklistsRepository.pipelineStageExistsInWorkspace(
      workspaceId,
      pipelineStageId,
    );

    // PipelineStage model is not yet part of Prisma schema in this repository.
    if (existsInWorkspace === false) {
      throw notFound('Pipeline stage not found');
    }
  },

  async ensureChecklistInstanceForStageRule(input: {
    workspaceId: string;
    projectId: string;
    toStageId: string;
    rule: StageChecklistRuleRecord;
  }) {
    const instanceLookup = {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      pipelineStageId: input.toStageId,
      checklistTemplateId: input.rule.checklistTemplateId,
    };

    const existing = await checklistsRepository.findChecklistInstanceForStageRule(instanceLookup);
    if (existing) {
      return existing;
    }

    if (!input.rule.autoCreateInstance) {
      return null;
    }

    try {
      return await checklistsRepository.createChecklistInstanceWithItems({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        pipelineStageId: input.toStageId,
        checklistTemplateId: input.rule.checklistTemplateId,
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const afterRace = await checklistsRepository.findChecklistInstanceForStageRule(instanceLookup);
      if (afterRace) {
        return afterRace;
      }

      throw conflict('Checklist instance already exists for this project and stage', {
        projectId: input.projectId,
        pipelineStageId: input.toStageId,
        checklistTemplateId: input.rule.checklistTemplateId,
      });
    }
  },

  async listTemplates(workspaceId: string, query: unknown) {
    const filters = this.parseListTemplatesQuery(query);

    if (filters.includeItems) {
      const templates = await checklistsRepository.listTemplatesWithItems(
        workspaceId,
        filters.archived,
      );
      return {
        items: templates.map((template) => mapTemplateWithItems(template)),
      };
    }

    const templates = await checklistsRepository.listTemplates(
      workspaceId,
      filters.archived,
    );
    return {
      items: templates.map((template) => mapTemplate(template)),
    };
  },

  async createTemplate(input: {
    workspaceId: string;
    actorUserId: string;
    body: unknown;
    request: FastifyRequest;
  }) {
    const payload = this.parseCreateTemplateBody(input.body);

    const existingTemplate = await checklistsRepository.findTemplateByName(
      input.workspaceId,
      payload.name,
    );
    if (existingTemplate) {
      throw createDuplicateTemplateNameError(payload.name);
    }

    let createdTemplate: ChecklistTemplateWithItemsRecord;
    try {
      createdTemplate = await checklistsRepository.createTemplateWithItems({
        workspaceId: input.workspaceId,
        name: payload.name,
        description: payload.description,
        items: payload.items,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw createDuplicateTemplateNameError(payload.name);
      }

      throw error;
    }

    await audit.log({
      event: 'checklists.template.create',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'ChecklistTemplate',
      entityId: createdTemplate.id,
      metadata: {
        templateId: createdTemplate.id,
        itemCount: createdTemplate.items.length,
      },
      request: input.request,
    });

    return mapTemplateWithItems(createdTemplate);
  },

  async getTemplate(workspaceId: string, rawTemplateId: string, query: unknown) {
    const templateId = this.parseTemplateId(rawTemplateId);
    const parsedQuery = this.parseGetTemplateQuery(query);

    if (parsedQuery.includeItems) {
      const template = await checklistsRepository.findTemplateByIdWithItems(workspaceId, templateId);
      if (!template) {
        throw notFound('Checklist template not found');
      }

      return mapTemplateWithItems(template);
    }

    const template = await checklistsRepository.findTemplateById(workspaceId, templateId);
    if (!template) {
      throw notFound('Checklist template not found');
    }

    return mapTemplate(template);
  },

  async updateTemplate(input: {
    workspaceId: string;
    templateId: string;
    actorUserId: string;
    body: unknown;
    request: FastifyRequest;
  }) {
    const currentTemplate = await this.requireTemplate(input.workspaceId, input.templateId);
    const payload = this.parseUpdateTemplateBody(input.body);

    if (payload.name !== undefined) {
      const conflictingTemplate = await checklistsRepository.findTemplateByName(
        input.workspaceId,
        payload.name,
      );
      if (conflictingTemplate && conflictingTemplate.id !== currentTemplate.id) {
        throw createDuplicateTemplateNameError(payload.name);
      }
    }

    let updatedTemplate: ChecklistTemplateRecord | null;
    try {
      updatedTemplate = await checklistsRepository.updateTemplate(
        input.workspaceId,
        currentTemplate.id,
        payload,
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw createDuplicateTemplateNameError(payload.name ?? currentTemplate.name);
      }

      throw error;
    }

    if (!updatedTemplate) {
      throw notFound('Checklist template not found');
    }

    const changedFields: string[] = [];
    if (payload.name !== undefined && payload.name !== currentTemplate.name) {
      changedFields.push('name');
    }
    if (
      payload.description !== undefined &&
      payload.description !== currentTemplate.description
    ) {
      changedFields.push('description');
    }
    if (
      payload.isArchived !== undefined &&
      payload.isArchived !== currentTemplate.isArchived
    ) {
      changedFields.push('isArchived');
    }

    await audit.log({
      event: 'checklists.template.update',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'ChecklistTemplate',
      entityId: updatedTemplate.id,
      metadata: {
        templateId: updatedTemplate.id,
        fields: changedFields,
      },
      request: input.request,
    });

    return mapTemplate(updatedTemplate);
  },

  async archiveTemplate(input: {
    workspaceId: string;
    templateId: string;
    actorUserId: string;
    request: FastifyRequest;
  }) {
    // MVP choice: DELETE archives templates via soft-delete (isArchived = true).
    const template = await this.requireTemplate(input.workspaceId, input.templateId);
    const archived = await checklistsRepository.archiveTemplate(input.workspaceId, template.id);
    if (archived.count === 0) {
      throw notFound('Checklist template not found');
    }

    await audit.log({
      event: 'checklists.template.archive',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'ChecklistTemplate',
      entityId: template.id,
      metadata: {
        templateId: template.id,
        wasArchived: template.isArchived,
      },
      request: input.request,
    });
  },

  async createTemplateItem(input: {
    workspaceId: string;
    templateId: string;
    actorUserId: string;
    body: unknown;
    request: FastifyRequest;
  }) {
    const template = await this.requireTemplate(input.workspaceId, input.templateId);
    const payload = this.parseCreateTemplateItemBody(input.body);
    const nextSortOrder =
      payload.sortOrder ??
      (await checklistsRepository.getNextSortOrder(input.workspaceId, template.id));

    const createdItem = await checklistsRepository.createTemplateItem({
      workspaceId: input.workspaceId,
      templateId: template.id,
      title: payload.title,
      description: payload.description,
      sortOrder: nextSortOrder,
      isRequired: payload.isRequired,
      requiresEvidence: payload.requiresEvidence,
      isCritical: payload.isCritical,
    });

    await audit.log({
      event: 'checklists.template_item.create',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'ChecklistTemplateItem',
      entityId: createdItem.id,
      metadata: {
        templateId: template.id,
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
    request: FastifyRequest;
  }) {
    const currentItem = await this.requireTemplateItem(
      input.workspaceId,
      input.templateId,
      input.itemId,
    );
    const payload = this.parseUpdateTemplateItemBody(input.body);

    const updatedItem = await checklistsRepository.updateTemplateItem(
      input.workspaceId,
      currentItem.templateId,
      currentItem.id,
      payload,
    );
    if (!updatedItem) {
      throw notFound('Checklist template item not found');
    }

    const changedFields: string[] = [];
    if (payload.title !== undefined && payload.title !== currentItem.title) {
      changedFields.push('title');
    }
    if (
      payload.description !== undefined &&
      payload.description !== currentItem.description
    ) {
      changedFields.push('description');
    }
    if (
      payload.sortOrder !== undefined &&
      payload.sortOrder !== currentItem.sortOrder
    ) {
      changedFields.push('sortOrder');
    }
    if (
      payload.isRequired !== undefined &&
      payload.isRequired !== currentItem.isRequired
    ) {
      changedFields.push('isRequired');
    }
    if (
      payload.requiresEvidence !== undefined &&
      payload.requiresEvidence !== currentItem.requiresEvidence
    ) {
      changedFields.push('requiresEvidence');
    }
    if (
      payload.isCritical !== undefined &&
      payload.isCritical !== currentItem.isCritical
    ) {
      changedFields.push('isCritical');
    }

    await audit.log({
      event: 'checklists.template_item.update',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'ChecklistTemplateItem',
      entityId: updatedItem.id,
      metadata: {
        templateId: updatedItem.templateId,
        itemId: updatedItem.id,
        fields: changedFields,
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
    request: FastifyRequest;
  }) {
    const item = await this.requireTemplateItem(
      input.workspaceId,
      input.templateId,
      input.itemId,
    );

    const deleted = await checklistsRepository.deleteTemplateItem(
      input.workspaceId,
      item.templateId,
      item.id,
    );
    if (deleted.count === 0) {
      throw notFound('Checklist template item not found');
    }

    await audit.log({
      event: 'checklists.template_item.delete',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'ChecklistTemplateItem',
      entityId: item.id,
      metadata: {
        templateId: item.templateId,
        itemId: item.id,
      },
      request: input.request,
    });
  },

  async reorderTemplateItems(input: {
    workspaceId: string;
    templateId: string;
    actorUserId: string;
    body: unknown;
    request: FastifyRequest;
  }) {
    const template = await this.requireTemplate(input.workspaceId, input.templateId);
    const payload = this.parseReorderTemplateItemsBody(input.body);
    const currentItemIds = (await checklistsRepository.listTemplateItemIds(
      input.workspaceId,
      template.id,
    )).map((item) => item.id);

    const incomingItemIds = payload.orderedItemIds;
    const currentItemIdSet = new Set(currentItemIds);
    const incomingItemIdSet = new Set(incomingItemIds);
    const missingItemIds = currentItemIds.filter((itemId) => !incomingItemIdSet.has(itemId));
    const unknownItemIds = incomingItemIds.filter((itemId) => !currentItemIdSet.has(itemId));

    const hasExactMatch =
      currentItemIds.length === incomingItemIds.length &&
      missingItemIds.length === 0 &&
      unknownItemIds.length === 0;

    if (!hasExactMatch) {
      throw createReorderMismatchError({
        expectedCount: currentItemIds.length,
        receivedCount: incomingItemIds.length,
        missingItemIds,
        unknownItemIds,
      });
    }

    const reorderedItems = await checklistsRepository.reorderTemplateItems(
      input.workspaceId,
      template.id,
      incomingItemIds,
    );

    await audit.log({
      event: 'checklists.template_item.reorder',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'ChecklistTemplate',
      entityId: template.id,
      metadata: {
        templateId: template.id,
        itemCount: reorderedItems.length,
      },
      request: input.request,
    });

    return {
      items: reorderedItems.map((item) => mapTemplateItem(item)),
    };
  },

  async createChecklistInstance(input: {
    workspaceId: string;
    projectId: string;
    actorUserId: string;
    body: unknown;
    request: FastifyRequest;
  }) {
    const projectId = this.parseProjectId(input.projectId);
    const payload = this.parseCreateChecklistInstanceBody(input.body);
    const checklistTemplateId = this.parseTemplateId(payload.checklistTemplateId);
    const pipelineStageId = payload.pipelineStageId
      ? this.parsePipelineStageId(payload.pipelineStageId)
      : null;

    await this.ensureProjectBelongsToWorkspace(input.workspaceId, projectId);
    await this.ensurePipelineStageBelongsToWorkspace(
      input.workspaceId,
      pipelineStageId ?? undefined,
    );
    await this.requireTemplate(input.workspaceId, checklistTemplateId);

    const lookup = {
      workspaceId: input.workspaceId,
      projectId,
      pipelineStageId,
      checklistTemplateId,
    };

    const duplicate = await checklistsRepository.findChecklistInstanceByUnique(lookup);
    if (duplicate) {
      return {
        created: false,
        instance: {
          id: duplicate.id,
          projectId: duplicate.projectId,
          checklistTemplateId: duplicate.checklistTemplateId,
          items: duplicate.items.map((item) => mapChecklistInstanceItem(item)),
        },
      };
    }

    let created: ChecklistInstanceWithItemsRecord;
    try {
      created = await checklistsRepository.createChecklistInstanceWithItems({
        workspaceId: input.workspaceId,
        projectId,
        pipelineStageId,
        checklistTemplateId,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const existing = await checklistsRepository.findChecklistInstanceByUnique(lookup);
        if (existing) {
          return {
            created: false,
            instance: {
              id: existing.id,
              projectId: existing.projectId,
              checklistTemplateId: existing.checklistTemplateId,
              items: existing.items.map((item) => mapChecklistInstanceItem(item)),
            },
          };
        }

        throw createDuplicateInstanceError({
          projectId,
          pipelineStageId,
          checklistTemplateId,
        });
      }

      throw error;
    }

    return {
      created: true,
      instance: {
        id: created.id,
        projectId: created.projectId,
        checklistTemplateId: created.checklistTemplateId,
        items: created.items.map((item) => mapChecklistInstanceItem(item)),
      },
    };
  },

  async listProjectChecklistInstances(workspaceId: string, rawProjectId: string) {
    const projectId = this.parseProjectId(rawProjectId);
    await this.ensureProjectBelongsToWorkspace(workspaceId, projectId);

    const instances = await checklistsRepository.listChecklistInstancesByProject(
      workspaceId,
      projectId,
    );

    return {
      items: instances.map((instance) => mapChecklistInstance(instance)),
    };
  },

  async completeChecklistItem(input: {
    workspaceId: string;
    itemId: string;
    actorUserId: string;
    body: unknown;
    request: FastifyRequest;
  }) {
    const item = await this.requireChecklistInstanceItem(input.workspaceId, input.itemId);
    const payload = this.parseCompleteChecklistItemBody(input.body);

    if (item.state === 'completed') {
      throw createItemAlreadyCompletedError();
    }

    const nextEvidenceNote =
      payload.evidenceNote !== undefined
        ? normalizeOptionalString(payload.evidenceNote)
        : item.evidenceNote;
    const nextEvidenceUrl =
      payload.evidenceUrl !== undefined
        ? normalizeOptionalString(payload.evidenceUrl)
        : item.evidenceUrl;

    if (item.requiresEvidenceSnapshot && !nextEvidenceNote && !nextEvidenceUrl) {
      throw createEvidenceRequiredError();
    }

    const updated = await checklistsRepository.updateChecklistInstanceItemIfState(
      input.workspaceId,
      item.id,
      'pending',
      {
        state: 'completed',
        completedAt: new Date(),
        completedByUserId: input.actorUserId,
        notApplicableReason: null,
        ...(payload.evidenceNote !== undefined ? { evidenceNote: nextEvidenceNote } : {}),
        ...(payload.evidenceUrl !== undefined ? { evidenceUrl: nextEvidenceUrl } : {}),
      },
    );
    if (!updated) {
      const current = await checklistsRepository.findChecklistInstanceItemById(
        input.workspaceId,
        item.id,
      );
      if (!current) {
        throw notFound('Checklist instance item not found');
      }
      if (current.state === 'completed') {
        throw createItemAlreadyCompletedError();
      }

      throw conflict('Checklist item is not in pending state');
    }

    if (updated.isCriticalSnapshot) {
      await audit.log({
        event: 'checklists.item.complete',
        actorUserId: input.actorUserId,
        workspaceId: input.workspaceId,
        entityType: 'ChecklistInstanceItem',
        entityId: updated.id,
        metadata: {
          itemId: updated.id,
          instanceId: updated.instanceId,
          isCritical: true,
        },
        request: input.request,
      });
    }

    await this.syncChecklistInstanceStatus(input.workspaceId, updated.instanceId);

    return mapChecklistInstanceItem(updated);
  },

  async markChecklistItemNotApplicable(input: {
    workspaceId: string;
    itemId: string;
    actorUserId: string;
    body: unknown;
    request: FastifyRequest;
  }) {
    const item = await this.requireChecklistInstanceItem(input.workspaceId, input.itemId);
    const payload = this.parseMarkChecklistItemNotApplicableBody(input.body);

    if (item.state === 'completed') {
      throw createItemAlreadyCompletedError();
    }

    const updated = await checklistsRepository.updateChecklistInstanceItemIfState(
      input.workspaceId,
      item.id,
      'pending',
      {
        state: 'not_applicable',
        notApplicableReason: payload.reason,
        completedAt: null,
        completedByUserId: null,
      },
    );
    if (!updated) {
      const current = await checklistsRepository.findChecklistInstanceItemById(
        input.workspaceId,
        item.id,
      );
      if (!current) {
        throw notFound('Checklist instance item not found');
      }
      if (current.state === 'completed') {
        throw createItemAlreadyCompletedError();
      }

      throw conflict('Checklist item is not in pending state');
    }

    if (updated.isCriticalSnapshot) {
      await audit.log({
        event: 'checklists.item.not_applicable',
        actorUserId: input.actorUserId,
        workspaceId: input.workspaceId,
        entityType: 'ChecklistInstanceItem',
        entityId: updated.id,
        metadata: {
          itemId: updated.id,
          instanceId: updated.instanceId,
          isCritical: true,
        },
        request: input.request,
      });
    }

    await this.syncChecklistInstanceStatus(input.workspaceId, updated.instanceId);

    return mapChecklistInstanceItem(updated);
  },

  async resetChecklistItem(input: {
    workspaceId: string;
    itemId: string;
  }) {
    const item = await this.requireChecklistInstanceItem(input.workspaceId, input.itemId);
    const updated = await checklistsRepository.updateChecklistInstanceItem(
      input.workspaceId,
      item.id,
      {
        state: 'pending',
        evidenceNote: null,
        evidenceUrl: null,
        notApplicableReason: null,
        completedAt: null,
        completedByUserId: null,
      },
    );
    if (!updated) {
      throw notFound('Checklist instance item not found');
    }

    await this.syncChecklistInstanceStatus(input.workspaceId, updated.instanceId);

    return mapChecklistInstanceItem(updated);
  },

  async enforceGateForStageTransition(
    input: EnforceGateForStageTransitionInput,
  ): Promise<EnforceGateForStageTransitionResult> {
    const workspaceId = input.workspaceId;
    const projectId = this.parseProjectId(input.projectId);
    const toStageId = this.parsePipelineStageId(input.toStageId);

    const rule = await checklistsRepository.findBlockingStageChecklistRule(
      workspaceId,
      toStageId,
    );
    if (!rule) {
      return {
        enforced: false,
        blocked: false,
        overridden: false,
        ruleId: null,
        checklistInstanceId: null,
        missingRequiredItemIds: [],
      };
    }

    const checklistInstance = await this.ensureChecklistInstanceForStageRule({
      workspaceId,
      projectId,
      toStageId,
      rule,
    });

    if (!checklistInstance) {
      throw createGateBlockedError({
        projectId,
        toStageId,
        checklistInstanceId: null,
        missingRequiredItemIds: [],
        reason: 'missing_instance',
      });
    }

    const missingRequiredItemIds = getUnsatisfiedRequiredItemIds(checklistInstance.items);
    if (missingRequiredItemIds.length === 0) {
      return {
        enforced: true,
        blocked: false,
        overridden: false,
        ruleId: rule.id,
        checklistInstanceId: checklistInstance.id,
        missingRequiredItemIds: [],
      };
    }

    if (!input.overrideGate) {
      throw createGateBlockedError({
        projectId,
        toStageId,
        checklistInstanceId: checklistInstance.id,
        missingRequiredItemIds,
      });
    }

    const normalizedOverrideReason = input.overrideReason?.trim() ?? '';
    if (normalizedOverrideReason.length < MIN_OVERRIDE_REASON_LENGTH) {
      throw badRequest('overrideReason is required when overrideGate=true', {
        minLength: MIN_OVERRIDE_REASON_LENGTH,
      });
    }

    await audit.log({
      event: 'checklists.gate.override',
      actorUserId: input.actorUserId,
      workspaceId,
      entityType: 'Project',
      entityId: projectId,
      metadata: {
        toStageId,
        ruleId: rule.id,
        instanceId: checklistInstance.id,
        reason: normalizedOverrideReason,
        missingRequiredItemIds,
      },
      request: input.request,
    });

    return {
      enforced: true,
      blocked: false,
      overridden: true,
      ruleId: rule.id,
      checklistInstanceId: checklistInstance.id,
      missingRequiredItemIds,
    };
  },
};
