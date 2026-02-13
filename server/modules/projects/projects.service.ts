import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { audit } from '../../audit/audit.js';
import { HttpError, badRequest, notFound } from '../../core/errors.js';
import { checklistsService } from '../checklists/checklists.service.js';
import { projectsRepository } from './projects.repository.js';

const MIN_OVERRIDE_REASON_LENGTH = 10;
const MAX_OVERRIDE_REASON_LENGTH = 500;
const MAX_PROJECT_NAME_LENGTH = 160;
const MAX_CATEGORY_NAME_LENGTH = 120;
const MAX_STAGE_NAME_LENGTH = 120;
const MAX_STAGE_COLOR_LENGTH = 20;

const idSchema = z.string().trim().min(1);
const nonEmptyStringSchema = z.string().trim().min(1);
const sortOrderSchema = z.number().int().min(0).max(10000);

const createProjectBodySchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_PROJECT_NAME_LENGTH),
    categoryId: z.string().trim().min(1).optional(),
    stageId: z.string().trim().min(1).optional(),
    pipelineStageId: z.string().trim().min(1).optional(),
    clientId: z.string().trim().min(1).optional(),
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
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.name && !value.stageId && !value.pipelineStageId) {
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
    sortOrder: sortOrderSchema.optional(),
  })
  .strict();

const updateStageBodySchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_STAGE_NAME_LENGTH).optional(),
    isClosed: z.boolean().optional(),
    color: z.string().trim().max(MAX_STAGE_COLOR_LENGTH).nullable().optional(),
    sortOrder: sortOrderSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.name && value.isClosed === undefined && value.color === undefined && value.sortOrder === undefined) {
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

const hasDuplicates = (items: string[]) => new Set(items).size !== items.length;

export type MoveProjectStagePayload = {
  toStageId: string;
  overrideGate: boolean;
  overrideReason: string | null;
};

type CreateProjectPayload = {
  name: string;
  categoryId: string | null;
  stageId: string | null;
  clientId: string | null;
};

type UpdateProjectPayload = {
  name?: string;
  stageId?: string;
};

type CreateStagePayload = {
  categoryId?: string;
  name: string;
  isClosed: boolean;
  color: string | null;
  sortOrder?: number;
};

type UpdateStagePayload = {
  name?: string;
  isClosed?: boolean;
  color?: string | null;
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
  createdAt: stage.createdAt,
  updatedAt: stage.updatedAt,
});

const mapProject = (project: {
  id: string;
  workspaceId: string;
  name: string;
  pipelineStageId: string | null;
  createdAt: Date;
  updatedAt: Date;
  pipelineStage: {
    id: string;
    categoryId: string | null;
    name: string;
    sortOrder: number;
    isClosed: boolean;
    color: string | null;
    category: {
      id: string;
      name: string;
    } | null;
  } | null;
}) => ({
  id: project.id,
  workspaceId: project.workspaceId,
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
  // Reserved for future CRM relation fields.
  clientName: null,
  ownerName: null,
  value: null,
  dueDate: null,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
});

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

    return {
      name: parsed.name,
      categoryId: parsed.categoryId ?? null,
      stageId: parsed.stageId ?? parsed.pipelineStageId ?? null,
      clientId: parsed.clientId ?? null,
    };
  },

  parseUpdateBody(body: unknown): UpdateProjectPayload {
    const parsed = parseWithSchema(updateProjectBodySchema, body, 'Invalid update-project payload');

    return {
      ...(parsed.name ? { name: parsed.name } : {}),
      ...(parsed.stageId || parsed.pipelineStageId
        ? {
            stageId: parsed.stageId ?? parsed.pipelineStageId,
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
      ...(parsed.sortOrder !== undefined ? { sortOrder: parsed.sortOrder } : {}),
    };
  },

  parseUpdateStageBody(body: unknown): UpdateStagePayload {
    const parsed = parseWithSchema(updateStageBodySchema, body, 'Invalid update-stage payload');

    return {
      ...(parsed.name ? { name: parsed.name } : {}),
      ...(parsed.isClosed !== undefined ? { isClosed: parsed.isClosed } : {}),
      ...(parsed.color !== undefined ? { color: normalizeNullableTrimmed(parsed.color) } : {}),
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

    const createdStage = await projectsRepository.createStage({
      workspaceId: input.workspaceId,
      categoryId,
      name: payload.name,
      sortOrder,
      isClosed: payload.isClosed,
      color: payload.color ?? null,
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

    const updatedStage = await projectsRepository.updateStage(input.workspaceId, stageId, {
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.isClosed !== undefined ? { isClosed: payload.isClosed } : {}),
      ...(payload.color !== undefined ? { color: payload.color } : {}),
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
        search: undefined as string | undefined,
      };
    }

    if (typeof query !== 'object') {
      throw badRequest('Querystring is invalid');
    }

    const rawQuery = query as Record<string, unknown>;
    const categoryIdRaw = rawQuery.categoryId;
    const stageIdRaw = rawQuery.stageId ?? rawQuery.pipelineStageId;
    const searchRaw = rawQuery.query ?? rawQuery.q;

    const categoryId =
      categoryIdRaw === undefined || categoryIdRaw === null || categoryIdRaw === ''
        ? undefined
        : parseWithSchema(nonEmptyStringSchema, categoryIdRaw, 'categoryId is invalid');

    const stageId =
      stageIdRaw === undefined || stageIdRaw === null || stageIdRaw === ''
        ? undefined
        : parseWithSchema(nonEmptyStringSchema, stageIdRaw, 'stageId is invalid');

    const search =
      searchRaw === undefined || searchRaw === null || searchRaw === ''
        ? undefined
        : parseWithSchema(nonEmptyStringSchema, searchRaw, 'query is invalid');

    return {
      categoryId,
      stageId,
      search,
    };
  },

  async listProjects(workspaceId: string, query: unknown) {
    const filters = this.parseListProjectsQuery(query);
    const projects = await projectsRepository.listProjects({
      workspaceId,
      categoryId: filters.categoryId,
      stageId: filters.stageId,
      search: filters.search,
    });

    return projects.map((project) => mapProject(project));
  },

  async getProject(workspaceId: string, rawProjectId: string) {
    const projectId = this.parseProjectId(rawProjectId);
    const project = await projectsRepository.findProjectWithStage(workspaceId, projectId);
    if (!project) {
      throw notFound('Project not found');
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
    });

    await audit.log({
      event: 'projects.create',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'Project',
      entityId: createdProject.id,
      metadata: {
        projectId: createdProject.id,
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

    const updatedProject = await projectsRepository.updateProject(input.workspaceId, projectId, {
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.stageId ? { pipelineStageId: payload.stageId } : {}),
    });

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
  }) {
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

    const projectId = this.parseProjectId(input.projectId);
    const payload = input.payload;

    const project = await projectsRepository.findProjectById(input.workspaceId, projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    const toStage = await projectsRepository.findStageById(
      input.workspaceId,
      payload.toStageId,
    );
    if (!toStage) {
      throw notFound('Pipeline stage not found');
    }

    const gate = await checklistsService.enforceGateForStageTransition({
      workspaceId: input.workspaceId,
      projectId,
      toStageId: payload.toStageId,
      overrideGate: payload.overrideGate,
      overrideReason: payload.overrideReason,
      actorUserId: input.actorUserId,
      request: input.request,
      stageConfig: {
        isGated: toStage.isGated,
        gateChecklistTemplateId: toStage.gateChecklistTemplateId,
        autoCreateInstance: toStage.autoCreateInstance,
      },
    });

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
};
