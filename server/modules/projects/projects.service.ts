import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { audit } from '../../audit/audit.js';
import { HttpError, badRequest, notFound } from '../../core/errors.js';
import { checklistsService } from '../checklists/checklists.service.js';
import { departmentRepository } from '../../repositories/department.repository.js';
import { rbacRepository } from '../../repositories/rbac.repository.js';
import { projectsRepository } from './projects.repository.js';

const MIN_OVERRIDE_REASON_LENGTH = 10;
const MAX_OVERRIDE_REASON_LENGTH = 500;
const MAX_PROJECT_NAME_LENGTH = 160;
const MAX_PROJECT_DESCRIPTION_LENGTH = 2000;
const MAX_CATEGORY_NAME_LENGTH = 120;
const MAX_STAGE_NAME_LENGTH = 120;
const MAX_STAGE_COLOR_LENGTH = 20;

const idSchema = z.string().trim().min(1);
const nonEmptyStringSchema = z.string().trim().min(1);
const sortOrderSchema = z.number().int().min(0).max(10000);
const clientIdsSchema = z.array(idSchema).max(100);
const nullableProjectNumberSchema = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) {
    return value === '' ? null : value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (normalized.length === 0) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
}, z.number().finite().nullable().optional());
const nullableProjectDueDateSchema = z.union([z.string().trim(), z.date(), z.null()]).optional();

const createProjectBodySchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_PROJECT_NAME_LENGTH),
    categoryId: z.string().trim().min(1).optional(),
    stageId: z.string().trim().min(1).optional(),
    pipelineStageId: z.string().trim().min(1).optional(),
    clientId: z.string().trim().min(1).nullable().optional(),
    clientIds: clientIdsSchema.optional(),
    description: z.string().trim().max(MAX_PROJECT_DESCRIPTION_LENGTH).nullable().optional(),
    value: nullableProjectNumberSchema,
    dueDate: nullableProjectDueDateSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.stageId && value.pipelineStageId && value.stageId !== value.pipelineStageId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stageId'],
        message: 'stageId and pipelineStageId must match when both are provided',
      });
    }
  });

const updateProjectBodySchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_PROJECT_NAME_LENGTH).optional(),
    stageId: z.string().trim().min(1).optional(),
    pipelineStageId: z.string().trim().min(1).optional(),
    clientId: z.string().trim().min(1).nullable().optional(),
    clientIds: clientIdsSchema.optional(),
    description: z.string().trim().max(MAX_PROJECT_DESCRIPTION_LENGTH).nullable().optional(),
    value: nullableProjectNumberSchema,
    dueDate: nullableProjectDueDateSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      !value.name
      && !value.stageId
      && !value.pipelineStageId
      && value.clientId === undefined
      && value.clientIds === undefined
      && value.description === undefined
      && value.value === undefined
      && value.dueDate === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: 'At least one field is required',
      });
    }

    if (value.stageId && value.pipelineStageId && value.stageId !== value.pipelineStageId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stageId'],
        message: 'stageId and pipelineStageId must match when both are provided',
      });
    }
  });

const createCategoryBodySchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_CATEGORY_NAME_LENGTH),
    sortOrder: sortOrderSchema.optional(),
  })
  .strict();

const updateCategoryBodySchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_CATEGORY_NAME_LENGTH).optional(),
    sortOrder: sortOrderSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.name && value.sortOrder === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: 'At least one field is required',
      });
    }
  });

const createStageBodySchema = z
  .object({
    categoryId: idSchema.optional(),
    name: z.string().trim().min(1).max(MAX_STAGE_NAME_LENGTH),
    isClosed: z.boolean().optional().default(false),
    color: z.string().trim().max(MAX_STAGE_COLOR_LENGTH).nullable().optional(),
    isGated: z.boolean().optional().default(false),
    gateChecklistTemplateId: idSchema.nullable().optional(),
    autoCreateInstance: z.boolean().optional().default(true),
    sortOrder: sortOrderSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.isGated && !value.gateChecklistTemplateId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gateChecklistTemplateId'],
        message: 'gateChecklistTemplateId is required when isGated=true',
      });
    }
  })
  .strict();

const updateStageBodySchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_STAGE_NAME_LENGTH).optional(),
    isClosed: z.boolean().optional(),
    color: z.string().trim().max(MAX_STAGE_COLOR_LENGTH).nullable().optional(),
    isGated: z.boolean().optional(),
    gateChecklistTemplateId: idSchema.nullable().optional(),
    autoCreateInstance: z.boolean().optional(),
    sortOrder: sortOrderSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      !value.name
      && value.isClosed === undefined
      && value.color === undefined
      && value.sortOrder === undefined
      && value.isGated === undefined
      && value.gateChecklistTemplateId === undefined
      && value.autoCreateInstance === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: 'At least one field is required',
      });
    }
  });

const reorderStagesBodySchema = z
  .object({
    categoryId: idSchema.optional(),
    stageIds: z.array(idSchema).min(1),
  })
  .strict();

const moveStageBodySchema = z
  .object({
    toStageId: idSchema,
    overrideGate: z.boolean().optional().default(false),
    overrideReason: z.string().trim().max(MAX_OVERRIDE_REASON_LENGTH).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.overrideGate) {
      return;
    }

    const reason = value.overrideReason?.trim() ?? '';
    if (reason.length < MIN_OVERRIDE_REASON_LENGTH) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['overrideReason'],
        message: `overrideReason must be at least ${MIN_OVERRIDE_REASON_LENGTH} characters`,
      });
    }
  });

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

const normalizeQueryStringValue = (value: unknown) => {
  if (Array.isArray(value)) {
    const firstValid = value.find((entry) => entry !== undefined && entry !== null && entry !== '');
    return normalizeQueryStringValue(firstValid);
  }

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
};

const normalizeNullableTrimmed = (value: string | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeNullableDate = (value: string | Date | null | undefined, fieldName: string) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw badRequest(`${fieldName} is invalid`);
    }

    return value;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest(`${fieldName} is invalid`);
  }

  return parsed;
};

const normalizeClientIds = (clientIds: string[] | undefined, clientId: string | null | undefined) => {
  const sourceClientIds = clientIds ?? [];
  const merged = [
    ...sourceClientIds,
    ...(clientId ? [clientId] : []),
  ];

  return Array.from(
    new Set(
      merged
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  );
};

const hasDuplicates = (items: string[]) => new Set(items).size !== items.length;

export type MoveProjectStagePayload = {
  toStageId: string;
  overrideGate: boolean;
  overrideReason: string | null;
};

type MoveStageContext = {
  project: {
    id: string;
    workspaceId: string;
    pipelineStageId: string | null;
  };
  toStage: {
    id: string;
    workspaceId: string;
    categoryId: string | null;
    isClosed: boolean;
    color: string | null;
    isGated: boolean;
    gateChecklistTemplateId: string | null;
    autoCreateInstance: boolean;
  };
  gate: {
    enforced: boolean;
    overridden: boolean;
    ruleId: string | null;
    checklistInstanceId: string | null;
    missingRequiredItemIds: string[];
  };
};

type CreateProjectPayload = {
  name: string;
  categoryId: string | null;
  stageId: string | null;
  clientId: string | null;
  clientIds?: string[];
  description?: string | null;
  value?: number | null;
  dueDate?: Date | null;
};

type UpdateProjectPayload = {
  name?: string;
  stageId?: string;
  clientId?: string | null;
  clientIds?: string[];
  description?: string | null;
  value?: number | null;
  dueDate?: Date | null;
};

type CreateStagePayload = {
  categoryId?: string;
  name: string;
  isClosed: boolean;
  color: string | null;
  isGated: boolean;
  gateChecklistTemplateId: string | null;
  autoCreateInstance: boolean;
  sortOrder?: number;
};

type UpdateStagePayload = {
  name?: string;
  isClosed?: boolean;
  color?: string | null;
  isGated?: boolean;
  gateChecklistTemplateId?: string | null;
  autoCreateInstance?: boolean;
  sortOrder?: number;
};

type ReorderStagesPayload = {
  categoryId?: string;
  stageIds: string[];
};

const mapCategory = (category: {
  id: string;
  workspaceId: string;
  name: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: category.id,
  workspaceId: category.workspaceId,
  name: category.name,
  sortOrder: category.sortOrder,
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
});

const mapStage = (stage: {
  id: string;
  workspaceId: string;
  categoryId: string | null;
  name: string;
  sortOrder: number;
  isClosed: boolean;
  color: string | null;
  isGated: boolean;
  gateChecklistTemplateId: string | null;
  autoCreateInstance: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: stage.id,
  workspaceId: stage.workspaceId,
  categoryId: stage.categoryId,
  name: stage.name,
  sortOrder: stage.sortOrder,
  isClosed: stage.isClosed,
  color: stage.color,
  isGated: stage.isGated,
  gateChecklistTemplateId: stage.gateChecklistTemplateId,
  autoCreateInstance: stage.autoCreateInstance,
  createdAt: stage.createdAt,
  updatedAt: stage.updatedAt,
});

const mapProject = (project: any) => {
  const linkedClients = (project.clientLinks ?? [])
    .map((link: any) => link?.client)
    .filter((client: any): client is { id: string; name: string } => Boolean(client));
  const fallbackClient = project.client
    ? [{ id: project.client.id, name: project.client.name }]
    : [];
  const allClientsById = new Map<string, { id: string; name: string }>();
  [...linkedClients, ...fallbackClient].forEach((client) => {
    allClientsById.set(client.id, client);
  });

  const clients = Array.from(allClientsById.values());
  const primaryClient = clients[0] ?? null;

  return {
    id: project.id,
    workspaceId: project.workspaceId,
    clientId: primaryClient?.id ?? project.clientId ?? null,
    clientIds: clients.map((client) => client.id),
    name: project.name,
    categoryId: project.pipelineStage?.categoryId ?? null,
    stageId: project.pipelineStageId,
    pipelineStageId: project.pipelineStageId,
    stage: project.pipelineStage
      ? {
          id: project.pipelineStage.id,
          categoryId: project.pipelineStage.categoryId,
          name: project.pipelineStage.name,
          sortOrder: project.pipelineStage.sortOrder,
          isClosed: project.pipelineStage.isClosed,
          color: project.pipelineStage.color,
        }
      : null,
    categoryName: project.pipelineStage?.category?.name ?? null,
    client: primaryClient,
    clients,
    clientName: primaryClient?.name ?? null,
    clientNames: clients.map((client) => client.name),
    ...(Object.prototype.hasOwnProperty.call(project, 'description')
      ? { description: project.description ?? null }
      : {}),
    // Reserved for future CRM relation fields.
    ownerName: null,
    ...(Object.prototype.hasOwnProperty.call(project, 'value')
      ? { value: project.value ?? null }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(project, 'dueDate')
      ? { dueDate: project.dueDate ?? null }
      : {}),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
};

const hasProjectDetailsPatch = (
  payload: {
    description?: string | null;
    value?: number | null;
    dueDate?: Date | null;
  },
) => payload.description !== undefined || payload.value !== undefined || payload.dueDate !== undefined;

const extractProjectClientId = (project: unknown) => {
  if (!project || typeof project !== 'object') {
    return null;
  }

  if (!Object.prototype.hasOwnProperty.call(project, 'clientId')) {
    return null;
  }

  const clientId = (project as { clientId?: unknown }).clientId;
  if (typeof clientId === 'string') {
    return clientId;
  }

  return null;
};

const extractProjectClientIds = (project: unknown) => {
  if (!project || typeof project !== 'object') {
    return [] as string[];
  }

  if (Object.prototype.hasOwnProperty.call(project, 'clientLinks')) {
    const clientLinks = (project as { clientLinks?: Array<{ client?: { id?: unknown } | null }> }).clientLinks;
    if (Array.isArray(clientLinks)) {
      return Array.from(new Set(clientLinks
        .map((link) => link?.client?.id)
        .filter((clientId): clientId is string => typeof clientId === 'string' && clientId.trim().length > 0)));
    }
  }

  const legacyClientId = extractProjectClientId(project);
  return legacyClientId ? [legacyClientId] : [];
};

export const projectsService = {
  parseProjectId(rawProjectId: string) {
    return parseWithSchema(idSchema, rawProjectId, 'Project id is invalid');
  },

  parseCategoryId(rawCategoryId: string) {
    return parseWithSchema(idSchema, rawCategoryId, 'Category id is invalid');
  },

  parseStageId(rawStageId: string) {
    return parseWithSchema(idSchema, rawStageId, 'Stage id is invalid');
  },

  parseCreateBody(body: unknown): CreateProjectPayload {
    const parsed = parseWithSchema(createProjectBodySchema, body, 'Invalid create-project payload');
    const normalizedDescription = normalizeNullableTrimmed(parsed.description);
    const normalizedDueDate = normalizeNullableDate(parsed.dueDate, 'dueDate');
    const normalizedClientIds = normalizeClientIds(parsed.clientIds, parsed.clientId ?? null);

    return {
      name: parsed.name,
      categoryId: parsed.categoryId ?? null,
      stageId: parsed.stageId ?? parsed.pipelineStageId ?? null,
      clientId: normalizedClientIds[0] ?? null,
      ...(parsed.clientIds !== undefined || parsed.clientId !== undefined
        ? {
            clientIds: normalizedClientIds,
          }
        : {}),
      ...(normalizedDescription !== undefined ? { description: normalizedDescription } : {}),
      ...(parsed.value !== undefined ? { value: parsed.value } : {}),
      ...(normalizedDueDate !== undefined ? { dueDate: normalizedDueDate } : {}),
    };
  },

  parseUpdateBody(body: unknown): UpdateProjectPayload {
    const parsed = parseWithSchema(updateProjectBodySchema, body, 'Invalid update-project payload');
    const normalizedDescription = normalizeNullableTrimmed(parsed.description);
    const normalizedDueDate = normalizeNullableDate(parsed.dueDate, 'dueDate');
    const hasClientPatch = parsed.clientIds !== undefined || parsed.clientId !== undefined;
    const normalizedClientIds = hasClientPatch
      ? normalizeClientIds(parsed.clientIds, parsed.clientId ?? null)
      : [];

    return {
      ...(parsed.name ? { name: parsed.name } : {}),
      ...(parsed.stageId || parsed.pipelineStageId
        ? {
            stageId: parsed.stageId ?? parsed.pipelineStageId,
          }
        : {}),
      ...(hasClientPatch
        ? {
            clientId: normalizedClientIds[0] ?? null,
            clientIds: normalizedClientIds,
          }
        : {}),
      ...(normalizedDescription !== undefined
        ? {
            description: normalizedDescription,
          }
        : {}),
      ...(parsed.value !== undefined
        ? {
            value: parsed.value,
          }
        : {}),
      ...(normalizedDueDate !== undefined
        ? {
            dueDate: normalizedDueDate,
          }
        : {}),
    };
  },

  parseCreateCategoryBody(body: unknown) {
    return parseWithSchema(createCategoryBodySchema, body, 'Invalid create-category payload');
  },

  parseUpdateCategoryBody(body: unknown) {
    return parseWithSchema(updateCategoryBodySchema, body, 'Invalid update-category payload');
  },

  parseCreateStageBody(body: unknown): CreateStagePayload {
    const parsed = parseWithSchema(createStageBodySchema, body, 'Invalid create-stage payload');

    return {
      ...(parsed.categoryId ? { categoryId: parsed.categoryId } : {}),
      name: parsed.name,
      isClosed: parsed.isClosed,
      color: normalizeNullableTrimmed(parsed.color ?? null) ?? null,
      isGated: parsed.isGated,
      gateChecklistTemplateId: parsed.gateChecklistTemplateId ?? null,
      autoCreateInstance: parsed.autoCreateInstance,
      ...(parsed.sortOrder !== undefined ? { sortOrder: parsed.sortOrder } : {}),
    };
  },

  parseUpdateStageBody(body: unknown): UpdateStagePayload {
    const parsed = parseWithSchema(updateStageBodySchema, body, 'Invalid update-stage payload');

    return {
      ...(parsed.name ? { name: parsed.name } : {}),
      ...(parsed.isClosed !== undefined ? { isClosed: parsed.isClosed } : {}),
      ...(parsed.color !== undefined ? { color: normalizeNullableTrimmed(parsed.color) } : {}),
      ...(parsed.isGated !== undefined ? { isGated: parsed.isGated } : {}),
      ...(parsed.gateChecklistTemplateId !== undefined
        ? { gateChecklistTemplateId: parsed.gateChecklistTemplateId }
        : {}),
      ...(parsed.autoCreateInstance !== undefined
        ? { autoCreateInstance: parsed.autoCreateInstance }
        : {}),
      ...(parsed.sortOrder !== undefined ? { sortOrder: parsed.sortOrder } : {}),
    };
  },

  parseReorderStagesBody(body: unknown): ReorderStagesPayload {
    const parsed = parseWithSchema(reorderStagesBodySchema, body, 'Invalid reorder-stages payload');

    return {
      ...(parsed.categoryId ? { categoryId: parsed.categoryId } : {}),
      stageIds: parsed.stageIds,
    };
  },

  parseMoveStageBody(body: unknown): MoveProjectStagePayload {
    const parsed = parseWithSchema(
      moveStageBodySchema,
      body,
      'Invalid move-stage payload',
    );

    return {
      toStageId: parsed.toStageId,
      overrideGate: parsed.overrideGate,
      overrideReason: parsed.overrideReason?.trim() ?? null,
    };
  },

  async listCategories(workspaceId: string) {
    const categories = await projectsRepository.listCategories(workspaceId);
    return categories.map((category) => mapCategory(category));
  },

  async createCategory(input: {
    workspaceId: string;
    actorUserId: string;
    body: unknown;
    request: FastifyRequest;
  }) {
    const payload = this.parseCreateCategoryBody(input.body);
    const sortOrder =
      payload.sortOrder === undefined
        ? await projectsRepository.getNextCategorySortOrder(input.workspaceId)
        : payload.sortOrder;

    const existingCategory = await projectsRepository.findCategoryByName(input.workspaceId, payload.name);
    if (existingCategory) {
      throw badRequest('Category name already exists');
    }

    const createdCategory = await projectsRepository.createCategory({
      workspaceId: input.workspaceId,
      name: payload.name,
      sortOrder,
    });

    await audit.log({
      event: 'projects.pipeline.category.create',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'ProjectCategory',
      entityId: createdCategory.id,
      metadata: {
        categoryId: createdCategory.id,
      },
      request: input.request,
    });

    return mapCategory(createdCategory);
  },

  async updateCategory(input: {
    workspaceId: string;
    actorUserId: string;
    categoryId: string;
    body: unknown;
    request: FastifyRequest;
  }) {
    const categoryId = this.parseCategoryId(input.categoryId);
    const payload = this.parseUpdateCategoryBody(input.body);

    if (payload.name) {
      const duplicate = await projectsRepository.findCategoryByName(input.workspaceId, payload.name);
      if (duplicate && duplicate.id !== categoryId) {
        throw badRequest('Category name already exists');
      }
    }

    const updatedCategory = await projectsRepository.updateCategory(input.workspaceId, categoryId, {
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.sortOrder !== undefined ? { sortOrder: payload.sortOrder } : {}),
    });

    if (!updatedCategory) {
      throw notFound('Category not found');
    }

    await audit.log({
      event: 'projects.pipeline.category.update',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'ProjectCategory',
      entityId: updatedCategory.id,
      metadata: {
        categoryId: updatedCategory.id,
      },
      request: input.request,
    });

    return mapCategory(updatedCategory);
  },

  async deleteCategory(input: {
    workspaceId: string;
    actorUserId: string;
    categoryId: string;
    request: FastifyRequest;
  }) {
    const categoryId = this.parseCategoryId(input.categoryId);
    const category = await projectsRepository.findCategoryById(input.workspaceId, categoryId);

    if (!category) {
      throw notFound('Category not found');
    }

    const [stagesCount, projectsCount] = await Promise.all([
      projectsRepository.countStagesByCategory(input.workspaceId, categoryId),
      projectsRepository.countProjectsByCategory(input.workspaceId, categoryId),
    ]);

    if (stagesCount > 0 || projectsCount > 0) {
      throw new HttpError(409, 'IN_USE', 'Categoria in uso: rimuovi prima stage e progetti', {
        stagesCount,
        projectsCount,
      });
    }

    await projectsRepository.deleteCategory(input.workspaceId, categoryId);

    await audit.log({
      event: 'projects.pipeline.category.delete',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'ProjectCategory',
      entityId: categoryId,
      metadata: {
        categoryId,
      },
      request: input.request,
    });
  },

  async listStages(workspaceId: string, rawCategoryId?: string) {
    const categoryId = rawCategoryId ? this.parseCategoryId(rawCategoryId) : undefined;
    const stages = categoryId
      ? await projectsRepository.listStagesByCategory(workspaceId, categoryId)
      : await projectsRepository.listStages(workspaceId);

    return stages.map((stage) => mapStage(stage));
  },

  async createStage(input: {
    workspaceId: string;
    actorUserId: string;
    categoryId?: string;
    body: unknown;
    request: FastifyRequest;
  }) {
    const payload = this.parseCreateStageBody(input.body);
    const rawCategoryId = input.categoryId ?? payload.categoryId;
    if (!rawCategoryId) {
      throw badRequest('categoryId is required');
    }

    const categoryId = this.parseCategoryId(rawCategoryId);
    const category = await projectsRepository.findCategoryById(input.workspaceId, categoryId);
    if (!category) {
      throw notFound('Category not found');
    }

    const sortOrder =
      payload.sortOrder === undefined
        ? await projectsRepository.getNextStageSortOrder(input.workspaceId, categoryId)
        : payload.sortOrder;

    if (payload.gateChecklistTemplateId) {
      const template = await checklistsService.requireTemplate(
        input.workspaceId,
        payload.gateChecklistTemplateId,
      );
      if (template.isArchived) {
        throw badRequest('Checklist template is archived');
      }
    }

    const createdStage = await projectsRepository.createStage({
      workspaceId: input.workspaceId,
      categoryId,
      name: payload.name,
      sortOrder,
      isClosed: payload.isClosed,
      color: payload.color ?? null,
      isGated: payload.isGated,
      gateChecklistTemplateId: payload.isGated ? payload.gateChecklistTemplateId : null,
      autoCreateInstance: payload.autoCreateInstance,
    });

    await audit.log({
      event: 'projects.pipeline.stage.create',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'PipelineStage',
      entityId: createdStage.id,
      metadata: {
        stageId: createdStage.id,
        categoryId,
      },
      request: input.request,
    });

    return mapStage(createdStage);
  },

  async updateStage(input: {
    workspaceId: string;
    actorUserId: string;
    stageId: string;
    body: unknown;
    request: FastifyRequest;
  }) {
    const stageId = this.parseStageId(input.stageId);
    const payload = this.parseUpdateStageBody(input.body);
    const currentStage = await projectsRepository.findStageForWorkspace(input.workspaceId, stageId);
    if (!currentStage) {
      throw notFound('Stage not found');
    }

    const nextIsGated = payload.isGated ?? currentStage.isGated;
    const nextGateChecklistTemplateId =
      payload.gateChecklistTemplateId !== undefined
        ? payload.gateChecklistTemplateId
        : currentStage.gateChecklistTemplateId;
    const nextAutoCreateInstance = payload.autoCreateInstance ?? currentStage.autoCreateInstance;

    if (nextIsGated && !nextGateChecklistTemplateId) {
      throw badRequest('gateChecklistTemplateId is required when isGated=true');
    }

    if (nextGateChecklistTemplateId) {
      const template = await checklistsService.requireTemplate(
        input.workspaceId,
        nextGateChecklistTemplateId,
      );
      if (template.isArchived) {
        throw badRequest('Checklist template is archived');
      }
    }

    const updatedStage = await projectsRepository.updateStage(input.workspaceId, stageId, {
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.isClosed !== undefined ? { isClosed: payload.isClosed } : {}),
      ...(payload.color !== undefined ? { color: payload.color } : {}),
      isGated: nextIsGated,
      gateChecklistTemplateId: nextIsGated ? nextGateChecklistTemplateId : null,
      autoCreateInstance: nextAutoCreateInstance,
      ...(payload.sortOrder !== undefined ? { sortOrder: payload.sortOrder } : {}),
    });

    if (!updatedStage) {
      throw notFound('Stage not found');
    }

    await audit.log({
      event: 'projects.pipeline.stage.update',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'PipelineStage',
      entityId: updatedStage.id,
      metadata: {
        stageId: updatedStage.id,
        categoryId: updatedStage.categoryId,
      },
      request: input.request,
    });

    return mapStage(updatedStage);
  },

  async deleteStage(input: {
    workspaceId: string;
    actorUserId: string;
    stageId: string;
    request: FastifyRequest;
  }) {
    const stageId = this.parseStageId(input.stageId);
    const stage = await projectsRepository.findStageForWorkspace(input.workspaceId, stageId);
    if (!stage) {
      throw notFound('Stage not found');
    }

    const stagesInCategory = stage.categoryId
      ? await projectsRepository.countStagesByCategory(input.workspaceId, stage.categoryId)
      : (await projectsRepository.listStages(input.workspaceId)).length;

    if (stagesInCategory <= 1) {
      throw new HttpError(400, 'LAST_STAGE_REQUIRED', 'Devi avere almeno uno stage nella categoria');
    }

    const projectsInStage = await projectsRepository.countProjectsInStage(input.workspaceId, stageId);
    if (projectsInStage > 0) {
      throw new HttpError(409, 'IN_USE', 'Stage in uso: sposta prima i progetti', {
        projectsInStage,
      });
    }

    await projectsRepository.deleteStage(input.workspaceId, stageId);

    await audit.log({
      event: 'projects.pipeline.stage.delete',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'PipelineStage',
      entityId: stageId,
      metadata: {
        stageId,
        categoryId: stage.categoryId,
      },
      request: input.request,
    });
  },

  async reorderStages(input: {
    workspaceId: string;
    actorUserId: string;
    categoryId?: string;
    body: unknown;
    request: FastifyRequest;
  }) {
    const payload = this.parseReorderStagesBody(input.body);
    const rawCategoryId = input.categoryId ?? payload.categoryId;
    if (!rawCategoryId) {
      throw badRequest('categoryId is required');
    }

    const categoryId = this.parseCategoryId(rawCategoryId);
    const category = await projectsRepository.findCategoryById(input.workspaceId, categoryId);
    if (!category) {
      throw notFound('Category not found');
    }

    if (hasDuplicates(payload.stageIds)) {
      throw badRequest('stageIds contains duplicates');
    }

    const currentStages = await projectsRepository.listStagesByCategory(input.workspaceId, categoryId);
    const currentStageIds = new Set(currentStages.map((stage) => stage.id));

    if (payload.stageIds.length !== currentStages.length) {
      throw badRequest('stageIds must include all category stages');
    }

    const invalidStageId = payload.stageIds.find((stageId) => !currentStageIds.has(stageId));
    if (invalidStageId) {
      throw badRequest('stageIds contains stages not in category');
    }

    await projectsRepository.reorderStages(input.workspaceId, categoryId, payload.stageIds);

    await audit.log({
      event: 'projects.pipeline.stage.reorder',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'ProjectCategory',
      entityId: categoryId,
      metadata: {
        categoryId,
        stageIds: payload.stageIds,
      },
      request: input.request,
    });

    return { ok: true };
  },

  parseListProjectsQuery(query: unknown) {
    if (query === undefined || query === null) {
      return {
        categoryId: undefined as string | undefined,
        stageId: undefined as string | undefined,
        clientId: undefined as string | undefined,
        search: undefined as string | undefined,
      };
    }

    if (typeof query !== 'object') {
      throw badRequest('Querystring is invalid');
    }

    const rawQuery = query as Record<string, unknown>;
    const categoryIdRaw = normalizeQueryStringValue(rawQuery.categoryId);
    const stageIdRaw = normalizeQueryStringValue(rawQuery.stageId ?? rawQuery.pipelineStageId);
    const clientIdRaw = normalizeQueryStringValue(rawQuery.clientId);
    const searchRaw = normalizeQueryStringValue(rawQuery.query ?? rawQuery.q);

    const categoryId = categoryIdRaw
      ? parseWithSchema(nonEmptyStringSchema, categoryIdRaw, 'categoryId is invalid')
      : undefined;

    const stageId = stageIdRaw
      ? parseWithSchema(nonEmptyStringSchema, stageIdRaw, 'stageId is invalid')
      : undefined;

    const search = searchRaw
      ? parseWithSchema(nonEmptyStringSchema, searchRaw, 'query is invalid')
      : undefined;

    const clientId = clientIdRaw
      ? parseWithSchema(nonEmptyStringSchema, clientIdRaw, 'clientId is invalid')
      : undefined;

    return {
      categoryId,
      stageId,
      clientId,
      search,
    };
  },

  // Perimetro di visibilità dell'utente. Restituisce null se l'utente ha
  // projects.view_all (vede tutto); altrimenti lo scope per il filtro.
  async resolveProjectVisibility(workspaceId: string, userId: string) {
    const hasViewAll = await rbacRepository.hasPermission(userId, workspaceId, 'projects.view_all');
    if (hasViewAll) {
      return null;
    }

    const ledDepartmentIds = await departmentRepository.listLedDepartmentIds(workspaceId, userId);
    return { userId, ledDepartmentIds, isLead: ledDepartmentIds.length > 0 };
  },

  async listProjects(workspaceId: string, userId: string, query: unknown) {
    const filters = this.parseListProjectsQuery(query);
    const visibility = await this.resolveProjectVisibility(workspaceId, userId);

    const projects = await projectsRepository.listProjects({
      workspaceId,
      categoryId: filters.categoryId,
      stageId: filters.stageId,
      clientId: filters.clientId,
      search: filters.search,
      visibility,
    });

    return projects.map((project) => mapProject(project));
  },

  async getProject(workspaceId: string, userId: string, rawProjectId: string) {
    const projectId = this.parseProjectId(rawProjectId);
    const project = await projectsRepository.findProjectWithStage(workspaceId, projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    const visibility = await this.resolveProjectVisibility(workspaceId, userId);
    if (visibility) {
      const canAccess = await projectsRepository.userCanAccessProject({
        workspaceId,
        projectId,
        scope: visibility,
      });
      // 404 (non 403) per non rivelare l'esistenza di progetti fuori perimetro.
      if (!canAccess) {
        throw notFound('Project not found');
      }
    }

    return mapProject(project);
  },

  async createProject(input: {
    workspaceId: string;
    actorUserId: string;
    body: unknown;
    request: FastifyRequest;
  }) {
    const payload = this.parseCreateBody(input.body);

    if (payload.categoryId) {
      const category = await projectsRepository.findCategoryById(input.workspaceId, payload.categoryId);
      if (!category) {
        throw badRequest('Category not found in workspace');
      }
    }

    const [clientRelationReady, projectClientsReady, projectDetailsReady] = await Promise.all([
      projectsRepository.isProjectClientSchemaReady(),
      projectsRepository.isProjectClientsSchemaReady(),
      projectsRepository.isProjectDetailsSchemaReady(),
    ]);

    if (hasProjectDetailsPatch(payload) && !projectDetailsReady) {
      throw badRequest('Project details schema is not available');
    }

    if (payload.clientIds && payload.clientIds.length > 1 && !projectClientsReady) {
      throw badRequest('Project multi-client schema is not available');
    }

    if (payload.clientIds && payload.clientIds.length > 0) {
      if (!clientRelationReady) {
        throw badRequest('Project client schema is not available');
      }

      const clients = await projectsRepository.findClientsByIds(input.workspaceId, payload.clientIds);
      if (clients.length !== payload.clientIds.length) {
        const foundIds = new Set(clients.map((client) => client.id));
        const missingClientIds = payload.clientIds.filter((clientId) => !foundIds.has(clientId));
        throw badRequest('Client not found in workspace', {
          missingClientIds,
        });
      }
    }

    let stageId = payload.stageId;

    if (stageId) {
      const stage = await projectsRepository.findStageForWorkspace(input.workspaceId, stageId);
      if (!stage) {
        throw badRequest('Stage not found in workspace');
      }

      if (payload.categoryId && stage.categoryId !== payload.categoryId) {
        throw badRequest('Stage does not belong to category');
      }
    } else {
      const firstStage = await projectsRepository.findFirstStage(input.workspaceId, payload.categoryId ?? undefined);
      if (!firstStage) {
        if (payload.categoryId) {
          throw badRequest('No stage configured for category');
        }

        throw badRequest('No stage configured for workspace');
      }

      stageId = firstStage.id;
    }

    const createdProject = await projectsRepository.createProject({
      workspaceId: input.workspaceId,
      name: payload.name,
      pipelineStageId: stageId,
      clientId: clientRelationReady ? payload.clientId : null,
      ...(projectClientsReady && payload.clientIds !== undefined ? { clientIds: payload.clientIds } : {}),
      ...(projectDetailsReady && payload.description !== undefined ? { description: payload.description } : {}),
      ...(projectDetailsReady && payload.value !== undefined ? { value: payload.value } : {}),
      ...(projectDetailsReady && payload.dueDate !== undefined ? { dueDate: payload.dueDate } : {}),
    });
    if (!createdProject) {
      throw notFound('Project not found');
    }
    const createdProjectClientId = extractProjectClientId(createdProject);
    const createdProjectClientIds = extractProjectClientIds(createdProject);

    await audit.log({
      event: 'projects.create',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'Project',
      entityId: createdProject.id,
      metadata: {
        projectId: createdProject.id,
        clientId: createdProjectClientId,
        clientIds: createdProjectClientIds,
        stageId: createdProject.pipelineStageId,
      },
      request: input.request,
    });

    return mapProject(createdProject);
  },

  async updateProject(input: {
    workspaceId: string;
    actorUserId: string;
    projectId: string;
    body: unknown;
    request: FastifyRequest;
  }) {
    const projectId = this.parseProjectId(input.projectId);
    const payload = this.parseUpdateBody(input.body);

    if (payload.stageId) {
      const stage = await projectsRepository.findStageForWorkspace(input.workspaceId, payload.stageId);
      if (!stage) {
        throw badRequest('Stage not found in workspace');
      }
    }

    const [clientRelationReady, projectClientsReady, projectDetailsReady] = await Promise.all([
      projectsRepository.isProjectClientSchemaReady(),
      projectsRepository.isProjectClientsSchemaReady(),
      projectsRepository.isProjectDetailsSchemaReady(),
    ]);

    if (hasProjectDetailsPatch(payload) && !projectDetailsReady) {
      throw badRequest('Project details schema is not available');
    }

    if (payload.clientIds && payload.clientIds.length > 1 && !projectClientsReady) {
      throw badRequest('Project multi-client schema is not available');
    }

    if (payload.clientIds && payload.clientIds.length > 0) {
      if (!clientRelationReady) {
        throw badRequest('Project client schema is not available');
      }

      const clients = await projectsRepository.findClientsByIds(input.workspaceId, payload.clientIds);
      if (clients.length !== payload.clientIds.length) {
        const foundIds = new Set(clients.map((client) => client.id));
        const missingClientIds = payload.clientIds.filter((clientId) => !foundIds.has(clientId));
        throw badRequest('Client not found in workspace', {
          missingClientIds,
        });
      }
    }

    const updatedProject = await projectsRepository.updateProject(input.workspaceId, projectId, {
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.stageId ? { pipelineStageId: payload.stageId } : {}),
      ...(clientRelationReady && payload.clientId !== undefined ? { clientId: payload.clientId } : {}),
      ...(projectClientsReady && payload.clientIds !== undefined ? { clientIds: payload.clientIds } : {}),
      ...(projectDetailsReady && payload.description !== undefined ? { description: payload.description } : {}),
      ...(projectDetailsReady && payload.value !== undefined ? { value: payload.value } : {}),
      ...(projectDetailsReady && payload.dueDate !== undefined ? { dueDate: payload.dueDate } : {}),
    });
    const updatedProjectClientId = updatedProject ? extractProjectClientId(updatedProject) : null;
    const updatedProjectClientIds = updatedProject ? extractProjectClientIds(updatedProject) : [];

    if (!updatedProject) {
      throw notFound('Project not found');
    }

    await audit.log({
      event: 'projects.update',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'Project',
      entityId: updatedProject.id,
      metadata: {
        projectId: updatedProject.id,
        clientId: updatedProjectClientId,
        clientIds: updatedProjectClientIds,
        stageId: updatedProject.pipelineStageId,
      },
      request: input.request,
    });

    return mapProject(updatedProject);
  },

  async deleteProject(input: {
    workspaceId: string;
    actorUserId: string;
    projectId: string;
    request: FastifyRequest;
  }) {
    const projectId = this.parseProjectId(input.projectId);
    const deletedProject = await projectsRepository.deleteProject(input.workspaceId, projectId);
    if (!deletedProject) {
      throw notFound('Project not found');
    }

    await audit.log({
      event: 'projects.delete',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'Project',
      entityId: deletedProject.id,
      metadata: {
        projectId: deletedProject.id,
        stageId: deletedProject.pipelineStageId,
      },
      request: input.request,
    });
  },

  async moveStage(input: {
    workspaceId: string;
    actorUserId: string;
    projectId: string;
    payload: MoveProjectStagePayload;
    request: FastifyRequest;
    prevalidatedContext?: MoveStageContext;
  }) {
    const projectId = this.parseProjectId(input.projectId);
    const payload = input.payload;
    const moveContext = input.prevalidatedContext ?? await this.buildMoveStageContext({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      projectId,
      payload,
      request: input.request,
    });
    const { project, gate } = moveContext;

    const movedProject = await projectsRepository.moveProjectToStage(
      input.workspaceId,
      projectId,
      payload.toStageId,
    );
    if (!movedProject) {
      throw notFound('Project not found');
    }

    await audit.log({
      event: 'projects.move_stage',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'Project',
      entityId: projectId,
      metadata: {
        projectId,
        fromStageId: project.pipelineStageId,
        toStageId: movedProject.pipelineStageId,
        gateEnforced: gate.enforced,
        gateOverridden: gate.overridden,
        gateRuleId: gate.ruleId,
        checklistInstanceId: gate.checklistInstanceId,
        missingRequiredItemIds: gate.missingRequiredItemIds,
      },
      request: input.request,
    });

    return {
      project: {
        id: movedProject.id,
        workspaceId: movedProject.workspaceId,
        pipelineStageId: movedProject.pipelineStageId,
        previousPipelineStageId: project.pipelineStageId,
      },
      gate: {
        enforced: gate.enforced,
        overridden: gate.overridden,
        ruleId: gate.ruleId,
        checklistInstanceId: gate.checklistInstanceId,
      },
    };
  },

  async buildMoveStageContext(input: {
    workspaceId: string;
    actorUserId: string;
    projectId: string;
    payload: MoveProjectStagePayload;
    request: FastifyRequest;
  }): Promise<MoveStageContext> {
    const schemaReady = await projectsRepository.isMoveStageSchemaReady();
    if (!schemaReady) {
      throw badRequest('Projects move-stage schema is not available', {
        requiredTables: ['Project', 'PipelineStage'],
        requiredColumns: {
          Project: ['id', 'workspaceId', 'pipelineStageId'],
          PipelineStage: [
            'id',
            'workspaceId',
            'isGated',
            'gateChecklistTemplateId',
            'autoCreateInstance',
          ],
        },
      });
    }

    const project = await projectsRepository.findProjectById(input.workspaceId, input.projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    const toStage = await projectsRepository.findStageById(
      input.workspaceId,
      input.payload.toStageId,
    );
    if (!toStage) {
      throw notFound('Pipeline stage not found');
    }

    const gate = await checklistsService.enforceGateForStageTransition({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      toStageId: input.payload.toStageId,
      overrideGate: input.payload.overrideGate,
      overrideReason: input.payload.overrideReason,
      actorUserId: input.actorUserId,
      request: input.request,
      stageConfig: {
        categoryId: toStage.categoryId,
        isGated: toStage.isGated,
        gateChecklistTemplateId: toStage.gateChecklistTemplateId,
        autoCreateInstance: toStage.autoCreateInstance,
      },
    });

    return {
      project,
      toStage,
      gate,
    };
  },
};

