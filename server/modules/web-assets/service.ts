import { Prisma, type WebAssetStatus } from '@prisma/client';
import { z } from 'zod';
import { badRequest, conflict, notFound } from '../../core/errors.js';
import {
  type WebAssetListFilters,
  type WebAssetLookupFilters,
  type WebAssetPatchInput,
  type WebAssetRecord,
  type WebAssetType,
  type WebAssetWriteInput,
  webAssetsRepository,
} from './repository.js';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_LOOKUP_LIMIT = 50;

const WEB_ASSET_TYPES = ['website', 'webapp', 'ecommerce'] as const;
const WEB_ASSET_STATUSES = ['ACTIVE', 'MAINTENANCE', 'PAUSED', 'ARCHIVED'] as const;

type WebAssetListQuery = {
  type?: WebAssetType;
  status?: WebAssetStatus;
  q?: string;
  clientId?: string;
  projectId?: string;
  page?: number;
  pageSize?: number;
};

type WebAssetLookupQuery = {
  q?: string;
  clientId?: string;
  limit?: number;
};

type WebAssetCreatePayload = {
  assetType: WebAssetType;
  name: string;
  url: string;
  status?: WebAssetStatus;
  version?: string | null;
  metadata?: unknown;
  clientId?: string | null;
  projectId?: string | null;
  ownerUserId?: string | null;
};

type WebAssetUpdatePayload = {
  name?: string;
  url?: string;
  status?: WebAssetStatus;
  version?: string | null;
  metadata?: unknown;
  clientId?: string | null;
  projectId?: string | null;
  ownerUserId?: string | null;
};

const idSchema = z.string().trim().min(1);
const assetTypeSchema = z.enum(WEB_ASSET_TYPES);
const assetStatusSchema = z.enum(WEB_ASSET_STATUSES);

const optionalNullableTrimmedString = (maxLength: number) =>
  z.preprocess(
    (value) => {
      if (value === undefined) {
        return undefined;
      }

      if (value === null) {
        return null;
      }

      if (typeof value === 'string') {
        const normalized = value.trim();
        return normalized.length > 0 ? normalized : null;
      }

      return value;
    },
    z.union([z.string().max(maxLength), z.null()]).optional(),
  );

const listQuerySchema = z.object({
  type: assetTypeSchema.optional(),
  status: assetStatusSchema.optional(),
  q: z.string().trim().max(160).optional(),
  clientId: idSchema.optional(),
  projectId: idSchema.optional(),
  page: z.coerce.number().int().min(1).optional().default(DEFAULT_PAGE),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional().default(DEFAULT_PAGE_SIZE),
}).strict();

const lookupQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  clientId: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LOOKUP_LIMIT).optional().default(20),
}).strict();

const createPayloadSchema = z.object({
  assetType: assetTypeSchema,
  name: z.string().trim().min(1).max(160),
  url: z.string().trim().url().max(2048),
  status: assetStatusSchema.optional(),
  version: optionalNullableTrimmedString(64),
  metadata: z.unknown().optional(),
  clientId: z.union([idSchema, z.null()]).optional(),
  projectId: z.union([idSchema, z.null()]).optional(),
  ownerUserId: z.union([idSchema, z.null()]).optional(),
}).strict();

const updatePayloadSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  url: z.string().trim().url().max(2048).optional(),
  status: assetStatusSchema.optional(),
  version: optionalNullableTrimmedString(64),
  metadata: z.unknown().optional(),
  clientId: z.union([idSchema, z.null()]).optional(),
  projectId: z.union([idSchema, z.null()]).optional(),
  ownerUserId: z.union([idSchema, z.null()]).optional(),
}).strict().superRefine((value, context) => {
  if (Object.keys(value).length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one field is required',
      path: [],
    });
  }
});

const parseWithSchema = <TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown,
  errorMessage: string,
) => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw badRequest(errorMessage, {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const normalizeNullableId = (value: string | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeMetadata = (value: unknown): Prisma.InputJsonValue | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  try {
    JSON.stringify(value);
  } catch {
    throw badRequest('metadata must be JSON serializable');
  }

  return value as Prisma.InputJsonValue;
};

const ensureRelatedReferences = async (
  workspaceId: string,
  input: {
    clientId?: string | null;
    projectId?: string | null;
    ownerUserId?: string | null;
  },
) => {
  if (input.clientId) {
    const exists = await webAssetsRepository.clientExists(workspaceId, input.clientId);
    if (!exists) {
      throw badRequest('Client not found in workspace', {
        clientId: input.clientId,
      });
    }
  }

  if (input.projectId) {
    const exists = await webAssetsRepository.projectExists(workspaceId, input.projectId);
    if (!exists) {
      throw badRequest('Project not found in workspace', {
        projectId: input.projectId,
      });
    }
  }

  if (input.ownerUserId) {
    const exists = await webAssetsRepository.userIsWorkspaceMember(workspaceId, input.ownerUserId);
    if (!exists) {
      throw badRequest('Owner must be a workspace member', {
        ownerUserId: input.ownerUserId,
      });
    }
  }
};

const mapPrismaWriteError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw conflict('A web asset with the same URL already exists', {
      prismaCode: error.code,
      target: error.meta?.target,
    });
  }

  throw error;
};

const paginateItems = <TItem>(
  items: TItem[],
  page: number,
  pageSize: number,
) => {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const offset = (safePage - 1) * pageSize;

  return {
    items: items.slice(offset, offset + pageSize),
    pageInfo: {
      page: safePage,
      pageSize,
      totalItems,
      totalPages,
      hasPrevPage: safePage > 1,
      hasNextPage: safePage < totalPages,
    },
  };
};

export const webAssetsService = {
  parseListQuery(query: unknown): WebAssetListQuery {
    return parseWithSchema(listQuerySchema, query ?? {}, 'Invalid web assets query params');
  },

  parseLookupQuery(query: unknown): WebAssetLookupQuery {
    return parseWithSchema(lookupQuerySchema, query ?? {}, 'Invalid lookup query params');
  },

  parseCreatePayload(payload: unknown): WebAssetCreatePayload {
    return parseWithSchema(createPayloadSchema, payload, 'Invalid web asset payload');
  },

  parseUpdatePayload(payload: unknown): WebAssetUpdatePayload {
    return parseWithSchema(updatePayloadSchema, payload, 'Invalid web asset payload');
  },

  async listWebAssets(workspaceId: string, query: WebAssetListQuery) {
    const filters: WebAssetListFilters = {
      assetType: query.type,
      status: query.status,
      q: query.q,
      clientId: query.clientId,
      projectId: query.projectId,
    };

    const items = await webAssetsRepository.listAssets(workspaceId, filters);
    return paginateItems(items, query.page ?? DEFAULT_PAGE, query.pageSize ?? DEFAULT_PAGE_SIZE);
  },

  async getWebAsset(workspaceId: string, assetId: string): Promise<WebAssetRecord> {
    const item = await webAssetsRepository.findById(workspaceId, assetId);
    if (!item) {
      throw notFound('Web asset not found', { assetId });
    }

    return item;
  },

  async createWebAsset(input: {
    workspaceId: string;
    actorUserId: string;
    payload: WebAssetCreatePayload;
  }): Promise<WebAssetRecord> {
    const clientId = normalizeNullableId(input.payload.clientId);
    const projectId = normalizeNullableId(input.payload.projectId);
    const ownerUserId = normalizeNullableId(input.payload.ownerUserId) ?? input.actorUserId;
    const metadata = normalizeMetadata(input.payload.metadata);

    await ensureRelatedReferences(input.workspaceId, {
      clientId,
      projectId,
      ownerUserId,
    });

    const createInput: WebAssetWriteInput = {
      assetType: input.payload.assetType,
      name: input.payload.name.trim(),
      url: input.payload.url.trim(),
      status: input.payload.status ?? 'ACTIVE',
      version: input.payload.version ?? null,
      metadata: metadata ?? null,
      clientId: clientId ?? null,
      projectId: projectId ?? null,
      ownerUserId: ownerUserId ?? null,
    };

    try {
      return await webAssetsRepository.createAsset(input.workspaceId, createInput);
    } catch (error) {
      mapPrismaWriteError(error);
    }
  },

  async updateWebAsset(input: {
    workspaceId: string;
    assetId: string;
    payload: WebAssetUpdatePayload;
  }): Promise<WebAssetRecord> {
    const metadata = normalizeMetadata(input.payload.metadata);
    const patch: WebAssetPatchInput = {
      ...(input.payload.name !== undefined ? { name: input.payload.name.trim() } : {}),
      ...(input.payload.url !== undefined ? { url: input.payload.url.trim() } : {}),
      ...(input.payload.status !== undefined ? { status: input.payload.status } : {}),
      ...(input.payload.version !== undefined ? { version: input.payload.version } : {}),
      ...(metadata !== undefined ? { metadata } : {}),
      ...(input.payload.clientId !== undefined ? { clientId: normalizeNullableId(input.payload.clientId) } : {}),
      ...(input.payload.projectId !== undefined ? { projectId: normalizeNullableId(input.payload.projectId) } : {}),
      ...(input.payload.ownerUserId !== undefined ? { ownerUserId: normalizeNullableId(input.payload.ownerUserId) } : {}),
    };

    await ensureRelatedReferences(input.workspaceId, {
      ...(patch.clientId !== undefined ? { clientId: patch.clientId } : {}),
      ...(patch.projectId !== undefined ? { projectId: patch.projectId } : {}),
      ...(patch.ownerUserId !== undefined ? { ownerUserId: patch.ownerUserId } : {}),
    });

    try {
      const updated = await webAssetsRepository.updateAsset(input.workspaceId, input.assetId, patch);
      if (!updated) {
        throw notFound('Web asset not found', {
          assetId: input.assetId,
        });
      }

      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw conflict('A web asset with the same URL already exists', {
          prismaCode: error.code,
          target: error.meta?.target,
        });
      }

      throw error;
    }
  },

  async deleteWebAsset(workspaceId: string, assetId: string): Promise<WebAssetRecord> {
    const deleted = await webAssetsRepository.deleteAsset(workspaceId, assetId);
    if (!deleted) {
      throw notFound('Web asset not found', {
        assetId,
      });
    }

    return deleted;
  },

  async listClientsForPicker(workspaceId: string, query: WebAssetLookupQuery) {
    const filters: WebAssetLookupFilters = {
      q: query.q,
      limit: query.limit ?? 20,
    };

    return webAssetsRepository.listClientsForLookup(workspaceId, filters);
  },

  async listProjectsForPicker(workspaceId: string, query: WebAssetLookupQuery) {
    const filters: WebAssetLookupFilters = {
      q: query.q,
      clientId: query.clientId,
      limit: query.limit ?? 20,
    };

    return webAssetsRepository.listProjectsForLookup(workspaceId, filters);
  },
};
