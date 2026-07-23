import {
  Prisma,
  type WebAssetAlertStatus,
  type WebAssetDeploymentEnvironment,
  type WebAssetHealthStatus,
  type WebAssetMaintenanceStatus,
  type WebAssetStatus,
  type WebAssetVersionStatus,
} from '@prisma/client';
import { z } from 'zod';
import { badRequest, conflict, notFound } from '../../core/errors.js';
import { safeFetch, SsrfBlockedError } from '../../core/net-guard.js';
import { analyzeSeoHtml } from './seo-analyzer.js';
import {
  type WebAssetListFilters,
  type WebAssetLookupFilters,
  type WebAssetMaintenanceWindowRecord,
  type WebAssetPatchInput,
  type WebAssetRecord,
  type WebAssetType,
  type WebAssetVersionRecord,
  type WebAssetWriteInput,
  webAssetsRepository,
} from './repository.js';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_LOOKUP_LIMIT = 50;
const DEFAULT_VERSION_HISTORY_LIMIT = 30;
const DEFAULT_HEALTH_HISTORY_LIMIT = 30;
const DEFAULT_SEO_REPORT_LIMIT = 20;
const DEFAULT_ANALYTICS_LIMIT = 30;
const DEFAULT_ANALYTICS_EVENTS_LIMIT = 200;
const DEFAULT_MAINTENANCE_LIMIT = 30;
const HEALTH_CHECK_TIMEOUT_MS = 10_000;
const HEALTH_DEGRADED_THRESHOLD_MS = 3000;

const WEB_ASSET_TYPES = ['website', 'webapp', 'ecommerce'] as const;
const WEB_ASSET_STATUSES = ['ACTIVE', 'MAINTENANCE', 'PAUSED', 'ARCHIVED'] as const;
const WEB_ASSET_VERSION_STATUSES = ['DRAFT', 'STAGED', 'LIVE'] as const;
const WEB_ASSET_DEPLOYMENT_ENVIRONMENTS = ['DEVELOPMENT', 'STAGING', 'PRODUCTION'] as const;
const WEB_ASSET_MAINTENANCE_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'] as const;
const WEB_ASSET_ALERT_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] as const;

type WebAssetListQuery = {
  type?: WebAssetType;
  status?: WebAssetStatus;
  environment?: WebAssetDeploymentEnvironment;
  q?: string;
  clientId?: string;
  projectId?: string;
  ownerUserId?: string;
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
  deploymentEnvironment?: WebAssetDeploymentEnvironment;
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
  deploymentEnvironment?: WebAssetDeploymentEnvironment;
  version?: string | null;
  metadata?: unknown;
  clientId?: string | null;
  projectId?: string | null;
  ownerUserId?: string | null;
};

type WebAssetVersionPayload = {
  versionNumber?: string | null;
  versionStatus?: WebAssetVersionStatus;
  changelog?: string | null;
  releaseNotes?: string | null;
};

type WebAssetDeploymentPayload = {
  environment: WebAssetDeploymentEnvironment;
  versionNumber?: string | null;
  changelog?: string | null;
  releaseNotes?: string | null;
};

type MonitoringHistoryQuery = {
  limit: number;
};

type SeoScanPayload = {
  keywords?: string[];
};

type AnalyticsSnapshotPayload = {
  provider: string;
  sourceLabel?: string | null;
  periodStart: string;
  periodEnd: string;
  sessions: number;
  users: number;
  pageViews: number;
  bounceRate?: number | null;
  avgLoadTimeMs?: number | null;
  uptimePercent?: number | null;
  errorRate?: number | null;
  topPages?: unknown;
  customEvents?: unknown;
};

type AnalyticsEventPayload = {
  eventName: string;
  eventLabel?: string | null;
  count?: number;
  metadata?: unknown;
  occurredAt?: string | null;
};

type WebAssetMaintenancePayload = {
  startsAt: string;
  endsAt: string;
  timezone?: string | null;
  reason?: string | null;
  notifyEmail?: string | null;
  notifySms?: string | null;
};

type WebAssetMaintenancePatchPayload = {
  startsAt?: string;
  endsAt?: string;
  timezone?: string | null;
  reason?: string | null;
  notifyEmail?: string | null;
  notifySms?: string | null;
  status?: WebAssetMaintenanceStatus;
};

type WebAssetAlertPatchPayload = {
  status: WebAssetAlertStatus;
};

type WebAssetVersionCompareQuery = {
  leftVersionId: string;
  rightVersionId: string;
};

type WebAssetSnapshot = {
  name: string;
  url: string;
  status: WebAssetStatus;
  deploymentEnvironment: WebAssetDeploymentEnvironment;
  version: string | null;
  metadata: Prisma.JsonValue | null;
  clientId: string | null;
  projectId: string | null;
  ownerUserId: string | null;
  updatedAt: string;
};

type VersionDiffEntry = {
  from: unknown;
  to: unknown;
};

const idSchema = z.string().trim().min(1);
const assetTypeSchema = z.enum(WEB_ASSET_TYPES);
const assetStatusSchema = z.enum(WEB_ASSET_STATUSES);
const versionStatusSchema = z.enum(WEB_ASSET_VERSION_STATUSES);
const deploymentEnvironmentSchema = z.enum(WEB_ASSET_DEPLOYMENT_ENVIRONMENTS);
const maintenanceStatusSchema = z.enum(WEB_ASSET_MAINTENANCE_STATUSES);
const alertStatusSchema = z.enum(WEB_ASSET_ALERT_STATUSES);

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
  environment: deploymentEnvironmentSchema.optional(),
  q: z.string().trim().max(160).optional(),
  clientId: idSchema.optional(),
  projectId: idSchema.optional(),
  ownerUserId: idSchema.optional(),
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
  deploymentEnvironment: deploymentEnvironmentSchema.optional(),
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
  deploymentEnvironment: deploymentEnvironmentSchema.optional(),
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

const versionPayloadSchema = z.object({
  versionNumber: optionalNullableTrimmedString(64),
  versionStatus: versionStatusSchema.optional().default('DRAFT'),
  changelog: optionalNullableTrimmedString(2000),
  releaseNotes: optionalNullableTrimmedString(4000),
}).strict();

const deploymentPayloadSchema = z.object({
  environment: deploymentEnvironmentSchema,
  versionNumber: optionalNullableTrimmedString(64),
  changelog: optionalNullableTrimmedString(2000),
  releaseNotes: optionalNullableTrimmedString(4000),
}).strict();

const versionCompareQuerySchema = z.object({
  leftVersionId: idSchema,
  rightVersionId: idSchema,
}).strict();

const monitoringHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(300).optional().default(DEFAULT_HEALTH_HISTORY_LIMIT),
}).strict();

const seoScanPayloadSchema = z.object({
  keywords: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
}).strict();

const analyticsSnapshotPayloadSchema = z.object({
  provider: z.string().trim().min(1).max(60),
  sourceLabel: optionalNullableTrimmedString(160),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  sessions: z.coerce.number().int().min(0),
  users: z.coerce.number().int().min(0),
  pageViews: z.coerce.number().int().min(0),
  bounceRate: z.coerce.number().min(0).max(100).optional().nullable(),
  avgLoadTimeMs: z.coerce.number().int().min(0).optional().nullable(),
  uptimePercent: z.coerce.number().min(0).max(100).optional().nullable(),
  errorRate: z.coerce.number().min(0).max(100).optional().nullable(),
  topPages: z.unknown().optional(),
  customEvents: z.unknown().optional(),
}).strict();

const analyticsEventPayloadSchema = z.object({
  eventName: z.string().trim().min(1).max(120),
  eventLabel: optionalNullableTrimmedString(255),
  count: z.coerce.number().int().min(1).max(100000).optional().default(1),
  metadata: z.unknown().optional(),
  occurredAt: z.string().datetime().optional().nullable(),
}).strict();

const maintenancePayloadSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  timezone: optionalNullableTrimmedString(120),
  reason: optionalNullableTrimmedString(1000),
  notifyEmail: optionalNullableTrimmedString(255),
  notifySms: optionalNullableTrimmedString(60),
}).strict();

const maintenancePatchPayloadSchema = z.object({
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  timezone: optionalNullableTrimmedString(120),
  reason: optionalNullableTrimmedString(1000),
  notifyEmail: optionalNullableTrimmedString(255),
  notifySms: optionalNullableTrimmedString(60),
  status: maintenanceStatusSchema.optional(),
}).strict().superRefine((value, context) => {
  if (Object.keys(value).length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one field is required',
      path: [],
    });
  }
});

const alertPatchPayloadSchema = z.object({
  status: alertStatusSchema,
}).strict();

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

const mapAssetStatusToVersionStatus = (status: WebAssetStatus): WebAssetVersionStatus => {
  switch (status) {
    case 'ACTIVE':
      return 'LIVE';
    case 'PAUSED':
      return 'STAGED';
    default:
      return 'DRAFT';
  }
};

const mapDeploymentToVersionStatus = (
  environment: WebAssetDeploymentEnvironment,
): WebAssetVersionStatus => {
  switch (environment) {
    case 'PRODUCTION':
      return 'LIVE';
    case 'STAGING':
      return 'STAGED';
    default:
      return 'DRAFT';
  }
};

const nowIso = () => new Date().toISOString();

const parseIsoDate = (value: string, field: string): Date => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest(`${field} must be a valid datetime`);
  }

  return parsed;
};

const toPercent = (value: number): number => Math.max(0, Math.min(100, Number(value.toFixed(2))));

const toAssetSnapshot = (asset: WebAssetRecord): Prisma.InputJsonValue => ({
  name: asset.name,
  url: asset.url,
  status: asset.status,
  deploymentEnvironment: asset.deploymentEnvironment,
  version: asset.version,
  metadata: asset.metadata as Prisma.InputJsonValue | null,
  clientId: asset.clientId,
  projectId: asset.projectId,
  ownerUserId: asset.ownerUserId,
  updatedAt: asset.updatedAt.toISOString(),
} satisfies WebAssetSnapshot);

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const safeStableStringify = (value: unknown) => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const diffSnapshots = (
  leftSnapshot: Prisma.JsonValue,
  rightSnapshot: Prisma.JsonValue,
): Record<string, VersionDiffEntry> => {
  const left = isObjectRecord(leftSnapshot) ? leftSnapshot : {};
  const right = isObjectRecord(rightSnapshot) ? rightSnapshot : {};
  const keys = new Set<string>([
    ...Object.keys(left),
    ...Object.keys(right),
  ]);

  const changes: Record<string, VersionDiffEntry> = {};
  for (const key of keys) {
    const leftValue = left[key];
    const rightValue = right[key];

    if (safeStableStringify(leftValue) === safeStableStringify(rightValue)) {
      continue;
    }

    changes[key] = {
      from: leftValue ?? null,
      to: rightValue ?? null,
    };
  }

  return changes;
};

const buildRollbackPayloadFromSnapshot = (snapshot: Prisma.JsonValue): WebAssetUpdatePayload => {
  if (!isObjectRecord(snapshot)) {
    throw badRequest('Version snapshot is invalid');
  }

  const payload: WebAssetUpdatePayload = {};

  if (typeof snapshot.name === 'string') {
    payload.name = snapshot.name;
  }

  if (typeof snapshot.url === 'string') {
    payload.url = snapshot.url;
  }

  if (typeof snapshot.status === 'string' && WEB_ASSET_STATUSES.includes(snapshot.status as WebAssetStatus)) {
    payload.status = snapshot.status as WebAssetStatus;
  }

  if (
    typeof snapshot.deploymentEnvironment === 'string'
    && WEB_ASSET_DEPLOYMENT_ENVIRONMENTS.includes(snapshot.deploymentEnvironment as WebAssetDeploymentEnvironment)
  ) {
    payload.deploymentEnvironment = snapshot.deploymentEnvironment as WebAssetDeploymentEnvironment;
  }

  if (typeof snapshot.version === 'string' || snapshot.version === null) {
    payload.version = snapshot.version;
  }

  if ('metadata' in snapshot) {
    payload.metadata = snapshot.metadata;
  }

  if (typeof snapshot.clientId === 'string' || snapshot.clientId === null) {
    payload.clientId = snapshot.clientId;
  }

  if (typeof snapshot.projectId === 'string' || snapshot.projectId === null) {
    payload.projectId = snapshot.projectId;
  }

  if (typeof snapshot.ownerUserId === 'string' || snapshot.ownerUserId === null) {
    payload.ownerUserId = snapshot.ownerUserId;
  }

  if (Object.keys(payload).length === 0) {
    throw badRequest('Version snapshot does not contain any rollback fields');
  }

  return payload;
};

const computeHealthSummary = (checks: Array<{
  status: WebAssetHealthStatus;
  responseTimeMs: number | null;
  checkedAt: Date;
  httpStatus: number | null;
}>) => {
  if (checks.length === 0) {
    return {
      totalChecks: 0,
      uptimePercent: 0,
      errorRate: 0,
      avgResponseTimeMs: null,
      lastCheckAt: null,
      lastDowntimeAt: null,
      httpStatusBreakdown: {} as Record<string, number>,
    };
  }

  const upLikeCount = checks.filter((check) => check.status !== 'DOWN').length;
  const downCount = checks.length - upLikeCount;
  const responseTimes = checks
    .map((check) => check.responseTimeMs)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const avgResponseTimeMs = responseTimes.length > 0
    ? Number((responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length).toFixed(2))
    : null;
  const httpStatusBreakdown = checks.reduce<Record<string, number>>((acc, check) => {
    if (!check.httpStatus) {
      return acc;
    }

    const key = String(check.httpStatus);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const lastDowntime = checks.find((check) => check.status === 'DOWN');

  return {
    totalChecks: checks.length,
    uptimePercent: toPercent((upLikeCount / checks.length) * 100),
    errorRate: toPercent((downCount / checks.length) * 100),
    avgResponseTimeMs,
    lastCheckAt: checks[0]?.checkedAt?.toISOString?.() ?? null,
    lastDowntimeAt: lastDowntime?.checkedAt?.toISOString?.() ?? null,
    httpStatusBreakdown,
  };
};

const resolveMaintenanceStatus = (
  window: Pick<WebAssetMaintenanceWindowRecord, 'startsAt' | 'endsAt' | 'status'>,
  now: Date,
): WebAssetMaintenanceStatus => {
  if (window.status === 'CANCELED') {
    return 'CANCELED';
  }

  if (window.status === 'COMPLETED' && now.getTime() <= window.endsAt.getTime()) {
    return 'IN_PROGRESS';
  }

  if (now.getTime() < window.startsAt.getTime()) {
    return 'SCHEDULED';
  }

  if (now.getTime() > window.endsAt.getTime()) {
    return 'COMPLETED';
  }

  return 'IN_PROGRESS';
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

  parseVersionPayload(payload: unknown): WebAssetVersionPayload {
    return parseWithSchema(versionPayloadSchema, payload ?? {}, 'Invalid web asset version payload');
  },

  parseVersionCompareQuery(query: unknown): WebAssetVersionCompareQuery {
    return parseWithSchema(versionCompareQuerySchema, query ?? {}, 'Invalid version compare query params');
  },

  parseDeploymentPayload(payload: unknown): WebAssetDeploymentPayload {
    return parseWithSchema(deploymentPayloadSchema, payload ?? {}, 'Invalid deployment payload');
  },

  parseMonitoringHistoryQuery(query: unknown): MonitoringHistoryQuery {
    return parseWithSchema(monitoringHistoryQuerySchema, query ?? {}, 'Invalid monitoring query params');
  },

  parseSeoScanPayload(payload: unknown): SeoScanPayload {
    return parseWithSchema(seoScanPayloadSchema, payload ?? {}, 'Invalid SEO scan payload');
  },

  parseAnalyticsSnapshotPayload(payload: unknown): AnalyticsSnapshotPayload {
    return parseWithSchema(analyticsSnapshotPayloadSchema, payload ?? {}, 'Invalid analytics snapshot payload');
  },

  parseAnalyticsEventPayload(payload: unknown): AnalyticsEventPayload {
    return parseWithSchema(analyticsEventPayloadSchema, payload ?? {}, 'Invalid analytics event payload');
  },

  parseMaintenancePayload(payload: unknown): WebAssetMaintenancePayload {
    return parseWithSchema(maintenancePayloadSchema, payload ?? {}, 'Invalid maintenance payload');
  },

  parseMaintenancePatchPayload(payload: unknown): WebAssetMaintenancePatchPayload {
    return parseWithSchema(maintenancePatchPayloadSchema, payload ?? {}, 'Invalid maintenance payload');
  },

  parseAlertPatchPayload(payload: unknown): WebAssetAlertPatchPayload {
    return parseWithSchema(alertPatchPayloadSchema, payload ?? {}, 'Invalid alert payload');
  },

  async listWebAssets(workspaceId: string, query: WebAssetListQuery) {
    const filters: WebAssetListFilters = {
      assetType: query.type,
      status: query.status,
      environment: query.environment,
      q: query.q,
      clientId: query.clientId,
      projectId: query.projectId,
      ownerUserId: query.ownerUserId,
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
      deploymentEnvironment: input.payload.deploymentEnvironment ?? 'DEVELOPMENT',
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
      ...(input.payload.deploymentEnvironment !== undefined ? { deploymentEnvironment: input.payload.deploymentEnvironment } : {}),
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

  async createWebAssetVersion(input: {
    workspaceId: string;
    asset: WebAssetRecord;
    actorUserId: string;
    sourceAction: string;
    payload?: WebAssetVersionPayload;
    isRollback?: boolean;
    sourceVersionId?: string | null;
  }): Promise<WebAssetVersionRecord> {
    return webAssetsRepository.createVersion({
      workspaceId: input.workspaceId,
      assetType: input.asset.assetType,
      assetId: input.asset.id,
      versionNumber: input.payload?.versionNumber ?? input.asset.version ?? null,
      versionStatus: input.payload?.versionStatus ?? mapAssetStatusToVersionStatus(input.asset.status),
      changelog: input.payload?.changelog ?? null,
      releaseNotes: input.payload?.releaseNotes ?? null,
      sourceAction: input.sourceAction,
      isRollback: input.isRollback ?? false,
      sourceVersionId: input.sourceVersionId ?? null,
      snapshot: toAssetSnapshot(input.asset),
      createdByUserId: input.actorUserId,
    });
  },

  async listWebAssetVersions(workspaceId: string, assetId: string, limit = DEFAULT_VERSION_HISTORY_LIMIT) {
    const asset = await this.getWebAsset(workspaceId, assetId);
    const versions = await webAssetsRepository.listVersions(
      workspaceId,
      asset.assetType,
      asset.id,
      limit,
    );

    return versions.map((version, index) => ({
      ...version,
      changes:
        index < versions.length - 1
          ? diffSnapshots(
              versions[index + 1].snapshot,
              version.snapshot,
            )
      : {},
    }));
  },

  async getWebAssetVersion(
    workspaceId: string,
    assetId: string,
    versionId: string,
  ): Promise<WebAssetVersionRecord> {
    const asset = await this.getWebAsset(workspaceId, assetId);
    const version = await webAssetsRepository.findVersionById(
      workspaceId,
      asset.assetType,
      asset.id,
      versionId,
    );

    if (!version) {
      throw notFound('Version not found', {
        versionId,
      });
    }

    return version;
  },

  async compareWebAssetVersions(input: {
    workspaceId: string;
    assetId: string;
    leftVersionId: string;
    rightVersionId: string;
  }) {
    const asset = await this.getWebAsset(input.workspaceId, input.assetId);
    const [leftVersion, rightVersion] = await Promise.all([
      webAssetsRepository.findVersionById(
        input.workspaceId,
        asset.assetType,
        asset.id,
        input.leftVersionId,
      ),
      webAssetsRepository.findVersionById(
        input.workspaceId,
        asset.assetType,
        asset.id,
        input.rightVersionId,
      ),
    ]);

    if (!leftVersion) {
      throw notFound('Left version not found', {
        versionId: input.leftVersionId,
      });
    }

    if (!rightVersion) {
      throw notFound('Right version not found', {
        versionId: input.rightVersionId,
      });
    }

    return {
      leftVersion,
      rightVersion,
      changes: diffSnapshots(leftVersion.snapshot, rightVersion.snapshot),
    };
  },

  async rollbackWebAssetToVersion(input: {
    workspaceId: string;
    assetId: string;
    versionId: string;
    actorUserId: string;
  }) {
    const asset = await this.getWebAsset(input.workspaceId, input.assetId);
    const sourceVersion = await webAssetsRepository.findVersionById(
      input.workspaceId,
      asset.assetType,
      asset.id,
      input.versionId,
    );

    if (!sourceVersion) {
      throw notFound('Version not found', {
        versionId: input.versionId,
      });
    }

    const rollbackPayload = buildRollbackPayloadFromSnapshot(sourceVersion.snapshot);
    const updatedAsset = await this.updateWebAsset({
      workspaceId: input.workspaceId,
      assetId: asset.id,
      payload: rollbackPayload,
    });

    const rollbackVersion = await this.createWebAssetVersion({
      workspaceId: input.workspaceId,
      asset: updatedAsset,
      actorUserId: input.actorUserId,
      sourceAction: 'rollback',
      payload: {
        versionStatus: sourceVersion.versionStatus,
        versionNumber: sourceVersion.versionNumber,
        changelog: `Rollback from version ${sourceVersion.versionNumber ?? sourceVersion.id}`,
      },
      isRollback: true,
      sourceVersionId: sourceVersion.id,
    });

    return {
      asset: updatedAsset,
      sourceVersion,
      rollbackVersion,
    };
  },

  async switchWebAssetDeploymentEnvironment(input: {
    workspaceId: string;
    assetId: string;
    actorUserId: string;
    payload: WebAssetDeploymentPayload;
  }) {
    const currentAsset = await this.getWebAsset(input.workspaceId, input.assetId);
    if (currentAsset.deploymentEnvironment === input.payload.environment) {
      return {
        asset: currentAsset,
        version: null,
      };
    }

    const asset = await this.updateWebAsset({
      workspaceId: input.workspaceId,
      assetId: input.assetId,
      payload: {
        deploymentEnvironment: input.payload.environment,
      },
    });

    const version = await this.createWebAssetVersion({
      workspaceId: input.workspaceId,
      asset,
      actorUserId: input.actorUserId,
      sourceAction: 'deployment.switch',
      payload: {
        versionNumber: input.payload.versionNumber ?? asset.version ?? null,
        versionStatus: mapDeploymentToVersionStatus(input.payload.environment),
        changelog: input.payload.changelog ?? `Switched deployment to ${input.payload.environment}`,
        releaseNotes: input.payload.releaseNotes ?? null,
      },
    });

    return {
      asset,
      version,
    };
  },

  async runWebAssetHealthCheck(input: {
    workspaceId: string;
    assetId: string;
    actorUserId: string;
  }) {
    const asset = await this.getWebAsset(input.workspaceId, input.assetId);
    const startedAt = Date.now();
    let status: WebAssetHealthStatus = 'UP';
    let httpStatus: number | null = null;
    let errorCode: string | null = null;
    let errorMessage: string | null = null;

    try {
      const response = await safeFetch(asset.url, { timeoutMs: HEALTH_CHECK_TIMEOUT_MS });

      httpStatus = response.status;
      if (!response.ok) {
        status = 'DOWN';
      }
    } catch (error) {
      status = 'DOWN';
      errorCode = error instanceof SsrfBlockedError ? 'URL_BLOCKED' : 'REQUEST_FAILED';
      errorMessage = error instanceof Error ? error.message : 'Health check failed';
    }

    const responseTimeMs = Math.max(0, Date.now() - startedAt);
    if (status !== 'DOWN' && responseTimeMs > HEALTH_DEGRADED_THRESHOLD_MS) {
      status = 'DEGRADED';
    }

    const check = await webAssetsRepository.createHealthCheck({
      workspaceId: input.workspaceId,
      assetType: asset.assetType,
      assetId: asset.id,
      environment: asset.deploymentEnvironment,
      status,
      url: asset.url,
      httpStatus,
      responseTimeMs,
      errorCode,
      errorMessage,
      createdByUserId: input.actorUserId,
    });

    if (status === 'DOWN') {
      const existing = await webAssetsRepository.findLatestOpenAlertByType({
        workspaceId: input.workspaceId,
        assetType: asset.assetType,
        assetId: asset.id,
        type: 'DOWNTIME',
      });
      if (!existing) {
        await webAssetsRepository.createAlert({
          workspaceId: input.workspaceId,
          assetType: asset.assetType,
          assetId: asset.id,
          type: 'DOWNTIME',
          severity: 'CRITICAL',
          title: 'Asset downtime detected',
          message: `Asset ${asset.name} is unreachable (${httpStatus ?? errorCode ?? 'NO_STATUS'}).`,
          metadata: {
            checkedAt: nowIso(),
            httpStatus,
            responseTimeMs,
          },
          createdByUserId: input.actorUserId,
        });
      }
    } else {
      await webAssetsRepository.resolveOpenAlertsByType({
        workspaceId: input.workspaceId,
        assetType: asset.assetType,
        assetId: asset.id,
        type: 'DOWNTIME',
      });
    }

    if (status === 'DEGRADED') {
      const existing = await webAssetsRepository.findLatestOpenAlertByType({
        workspaceId: input.workspaceId,
        assetType: asset.assetType,
        assetId: asset.id,
        type: 'PERFORMANCE',
      });
      if (!existing) {
        await webAssetsRepository.createAlert({
          workspaceId: input.workspaceId,
          assetType: asset.assetType,
          assetId: asset.id,
          type: 'PERFORMANCE',
          severity: 'WARNING',
          title: 'Performance degradation',
          message: `Asset ${asset.name} responded in ${responseTimeMs}ms.`,
          metadata: {
            checkedAt: nowIso(),
            responseTimeMs,
          },
          createdByUserId: input.actorUserId,
        });
      }
    } else {
      await webAssetsRepository.resolveOpenAlertsByType({
        workspaceId: input.workspaceId,
        assetType: asset.assetType,
        assetId: asset.id,
        type: 'PERFORMANCE',
      });
    }

    const checks = await webAssetsRepository.listHealthChecks({
      workspaceId: input.workspaceId,
      assetType: asset.assetType,
      assetId: asset.id,
      limit: DEFAULT_HEALTH_HISTORY_LIMIT,
    });
    const openAlerts = await webAssetsRepository.listAlerts({
      workspaceId: input.workspaceId,
      assetType: asset.assetType,
      assetId: asset.id,
      status: 'OPEN',
      limit: 20,
    });

    return {
      check,
      summary: computeHealthSummary(checks),
      alerts: openAlerts,
    };
  },

  async listWebAssetHealth(input: {
    workspaceId: string;
    assetId: string;
    limit?: number;
  }) {
    const asset = await this.getWebAsset(input.workspaceId, input.assetId);
    const checks = await webAssetsRepository.listHealthChecks({
      workspaceId: input.workspaceId,
      assetType: asset.assetType,
      assetId: asset.id,
      limit: input.limit ?? DEFAULT_HEALTH_HISTORY_LIMIT,
    });
    const alerts = await webAssetsRepository.listAlerts({
      workspaceId: input.workspaceId,
      assetType: asset.assetType,
      assetId: asset.id,
      status: 'OPEN',
      limit: 20,
    });

    return {
      checks,
      summary: computeHealthSummary(checks),
      alerts,
    };
  },

  async runWebAssetSeoScan(input: {
    workspaceId: string;
    assetId: string;
    actorUserId: string;
    payload: SeoScanPayload;
  }) {
    const asset = await this.getWebAsset(input.workspaceId, input.assetId);
    const requestedKeywords = input.payload.keywords ?? [];

    let html = '';
    let finalUrl = asset.url;
    try {
      const response = await safeFetch(asset.url, { timeoutMs: HEALTH_CHECK_TIMEOUT_MS });
      if (!response.ok) {
        throw badRequest(`La pagina ha risposto con stato ${response.status}.`);
      }
      finalUrl = response.url || asset.url;
      html = await response.text();
    } catch (error) {
      if (error instanceof SsrfBlockedError) {
        throw badRequest(`URL non analizzabile: ${error.message}`);
      }
      throw error;
    }

    const analysis = analyzeSeoHtml({ html, url: finalUrl, requestedKeywords });

    const report = await webAssetsRepository.createSeoReport({
      workspaceId: input.workspaceId,
      assetType: asset.assetType,
      assetId: asset.id,
      score: analysis.score,
      status: mapDeploymentToVersionStatus(asset.deploymentEnvironment),
      metaTitle: analysis.metaTitle,
      metaDescription: analysis.metaDescription,
      h1Count: analysis.h1Count,
      keywordList: analysis.detectedKeywords,
      issues: analysis.issues,
      suggestions: analysis.suggestions,
      createdByUserId: input.actorUserId,
    });

    return {
      report,
      keywordCoverage: {
        requested: requestedKeywords,
        detected: analysis.detectedKeywords,
        missing: analysis.missingKeywords,
      },
    };
  },

  async listWebAssetSeoReports(input: {
    workspaceId: string;
    assetId: string;
    limit?: number;
  }) {
    const asset = await this.getWebAsset(input.workspaceId, input.assetId);
    return webAssetsRepository.listSeoReports({
      workspaceId: input.workspaceId,
      assetType: asset.assetType,
      assetId: asset.id,
      limit: input.limit ?? DEFAULT_SEO_REPORT_LIMIT,
    });
  },

  async createWebAssetAnalyticsSnapshot(input: {
    workspaceId: string;
    assetId: string;
    actorUserId: string;
    payload: AnalyticsSnapshotPayload;
  }) {
    const asset = await this.getWebAsset(input.workspaceId, input.assetId);
    const periodStart = parseIsoDate(input.payload.periodStart, 'periodStart');
    const periodEnd = parseIsoDate(input.payload.periodEnd, 'periodEnd');
    if (periodEnd.getTime() < periodStart.getTime()) {
      throw badRequest('periodEnd must be greater than or equal to periodStart');
    }

    return webAssetsRepository.createAnalyticsSnapshot({
      workspaceId: input.workspaceId,
      assetType: asset.assetType,
      assetId: asset.id,
      environment: asset.deploymentEnvironment,
      provider: input.payload.provider,
      sourceLabel: input.payload.sourceLabel ?? null,
      periodStart,
      periodEnd,
      sessions: input.payload.sessions,
      users: input.payload.users,
      pageViews: input.payload.pageViews,
      bounceRate: input.payload.bounceRate ?? null,
      avgLoadTimeMs: input.payload.avgLoadTimeMs ?? null,
      uptimePercent: input.payload.uptimePercent ?? null,
      errorRate: input.payload.errorRate ?? null,
      topPages: normalizeMetadata(input.payload.topPages) ?? null,
      customEvents: normalizeMetadata(input.payload.customEvents) ?? null,
      createdByUserId: input.actorUserId,
    });
  },

  async createWebAssetAnalyticsEvent(input: {
    workspaceId: string;
    assetId: string;
    actorUserId: string;
    payload: AnalyticsEventPayload;
  }) {
    const asset = await this.getWebAsset(input.workspaceId, input.assetId);
    const occurredAt = input.payload.occurredAt
      ? parseIsoDate(input.payload.occurredAt, 'occurredAt')
      : new Date();

    return webAssetsRepository.createAnalyticsEvent({
      workspaceId: input.workspaceId,
      assetType: asset.assetType,
      assetId: asset.id,
      environment: asset.deploymentEnvironment,
      eventName: input.payload.eventName,
      eventLabel: input.payload.eventLabel ?? null,
      count: input.payload.count ?? 1,
      metadata: normalizeMetadata(input.payload.metadata) ?? null,
      occurredAt,
      createdByUserId: input.actorUserId,
    });
  },

  async listWebAssetAnalytics(input: {
    workspaceId: string;
    assetId: string;
    snapshotsLimit?: number;
    eventsLimit?: number;
  }) {
    const asset = await this.getWebAsset(input.workspaceId, input.assetId);
    const [snapshots, events] = await Promise.all([
      webAssetsRepository.listAnalyticsSnapshots({
        workspaceId: input.workspaceId,
        assetType: asset.assetType,
        assetId: asset.id,
        limit: input.snapshotsLimit ?? DEFAULT_ANALYTICS_LIMIT,
      }),
      webAssetsRepository.listAnalyticsEvents({
        workspaceId: input.workspaceId,
        assetType: asset.assetType,
        assetId: asset.id,
        limit: input.eventsLimit ?? DEFAULT_ANALYTICS_EVENTS_LIMIT,
      }),
    ]);

    const latestSnapshot = snapshots[0] ?? null;
    const previousSnapshot = snapshots[1] ?? null;
    const topEvents = Object.entries(events.reduce<Record<string, number>>((acc, event) => {
      acc[event.eventName] = (acc[event.eventName] ?? 0) + event.count;
      return acc;
    }, {}))
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10)
      .map(([eventName, count]) => ({
        eventName,
        count,
      }));

    return {
      snapshots,
      events,
      summary: {
        latestSnapshot,
        sessionsDelta:
          latestSnapshot && previousSnapshot
            ? latestSnapshot.sessions - previousSnapshot.sessions
            : null,
        usersDelta:
          latestSnapshot && previousSnapshot
            ? latestSnapshot.users - previousSnapshot.users
            : null,
        pageViewsDelta:
          latestSnapshot && previousSnapshot
            ? latestSnapshot.pageViews - previousSnapshot.pageViews
            : null,
      },
      topEvents,
    };
  },

  async listWebAssetMaintenanceWindows(input: {
    workspaceId: string;
    assetId: string;
    actorUserId?: string;
    limit?: number;
  }) {
    const asset = await this.getWebAsset(input.workspaceId, input.assetId);
    const windows = await webAssetsRepository.listMaintenanceWindows({
      workspaceId: input.workspaceId,
      assetType: asset.assetType,
      assetId: asset.id,
      limit: input.limit ?? DEFAULT_MAINTENANCE_LIMIT,
    });

    const now = new Date();
    const normalizedWindows = await Promise.all(
      windows.map(async (window) => {
        const expectedStatus = resolveMaintenanceStatus(window, now);
        if (expectedStatus === window.status) {
          return window;
        }

        const updated = await webAssetsRepository.updateMaintenanceWindow({
          workspaceId: input.workspaceId,
          maintenanceId: window.id,
          patch: {
            status: expectedStatus,
            updatedByUserId: input.actorUserId ?? null,
          },
        });

        return updated ?? window;
      }),
    );

    return normalizedWindows;
  },

  async createWebAssetMaintenanceWindow(input: {
    workspaceId: string;
    assetId: string;
    actorUserId: string;
    payload: WebAssetMaintenancePayload;
  }) {
    const asset = await this.getWebAsset(input.workspaceId, input.assetId);
    const startsAt = parseIsoDate(input.payload.startsAt, 'startsAt');
    const endsAt = parseIsoDate(input.payload.endsAt, 'endsAt');

    if (endsAt.getTime() <= startsAt.getTime()) {
      throw badRequest('endsAt must be greater than startsAt');
    }

    const window = await webAssetsRepository.createMaintenanceWindow({
      workspaceId: input.workspaceId,
      assetType: asset.assetType,
      assetId: asset.id,
      startsAt,
      endsAt,
      timezone: input.payload.timezone ?? null,
      reason: input.payload.reason ?? null,
      notifyEmail: input.payload.notifyEmail ?? null,
      notifySms: input.payload.notifySms ?? null,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    });

    await webAssetsRepository.createAlert({
      workspaceId: input.workspaceId,
      assetType: asset.assetType,
      assetId: asset.id,
      type: 'MAINTENANCE',
      severity: 'INFO',
      title: 'Maintenance scheduled',
      message: `${asset.name} maintenance scheduled for ${window.startsAt.toISOString()}.`,
      metadata: {
        maintenanceId: window.id,
        startsAt: window.startsAt.toISOString(),
        endsAt: window.endsAt.toISOString(),
        notifyEmail: window.notifyEmail,
        notifySms: window.notifySms,
      },
      createdByUserId: input.actorUserId,
    });

    return window;
  },

  async updateWebAssetMaintenanceWindow(input: {
    workspaceId: string;
    assetId: string;
    maintenanceId: string;
    actorUserId: string;
    payload: WebAssetMaintenancePatchPayload;
  }) {
    const asset = await this.getWebAsset(input.workspaceId, input.assetId);
    const existing = await webAssetsRepository.findMaintenanceWindowById({
      workspaceId: input.workspaceId,
      assetType: asset.assetType,
      assetId: asset.id,
      maintenanceId: input.maintenanceId,
    });
    if (!existing) {
      throw notFound('Maintenance window not found', {
        maintenanceId: input.maintenanceId,
      });
    }

    const startsAt = input.payload.startsAt ? parseIsoDate(input.payload.startsAt, 'startsAt') : existing.startsAt;
    const endsAt = input.payload.endsAt ? parseIsoDate(input.payload.endsAt, 'endsAt') : existing.endsAt;
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw badRequest('endsAt must be greater than startsAt');
    }

    const updated = await webAssetsRepository.updateMaintenanceWindow({
      workspaceId: input.workspaceId,
      maintenanceId: existing.id,
      patch: {
        ...(input.payload.startsAt !== undefined ? { startsAt } : {}),
        ...(input.payload.endsAt !== undefined ? { endsAt } : {}),
        ...(input.payload.timezone !== undefined ? { timezone: input.payload.timezone } : {}),
        ...(input.payload.reason !== undefined ? { reason: input.payload.reason } : {}),
        ...(input.payload.notifyEmail !== undefined ? { notifyEmail: input.payload.notifyEmail } : {}),
        ...(input.payload.notifySms !== undefined ? { notifySms: input.payload.notifySms } : {}),
        ...(input.payload.status !== undefined ? { status: input.payload.status } : {}),
        updatedByUserId: input.actorUserId,
      },
    });

    if (!updated) {
      throw notFound('Maintenance window not found', {
        maintenanceId: input.maintenanceId,
      });
    }

    return updated;
  },

  async listWebAssetAlerts(input: {
    workspaceId: string;
    assetId: string;
    status?: WebAssetAlertStatus;
    limit?: number;
  }) {
    const asset = await this.getWebAsset(input.workspaceId, input.assetId);
    return webAssetsRepository.listAlerts({
      workspaceId: input.workspaceId,
      assetType: asset.assetType,
      assetId: asset.id,
      status: input.status,
      limit: input.limit ?? 100,
    });
  },

  async updateWebAssetAlert(input: {
    workspaceId: string;
    assetId: string;
    alertId: string;
    payload: WebAssetAlertPatchPayload;
  }) {
    const asset = await this.getWebAsset(input.workspaceId, input.assetId);
    const updated = await webAssetsRepository.updateAlert({
      workspaceId: input.workspaceId,
      alertId: input.alertId,
      patch: {
        status: input.payload.status,
        ...(input.payload.status === 'ACKNOWLEDGED' ? { acknowledgedAt: new Date() } : {}),
        ...(input.payload.status === 'RESOLVED' ? { resolvedAt: new Date() } : {}),
      },
    });

    if (!updated || updated.assetId !== asset.id || updated.assetType !== asset.assetType) {
      throw notFound('Alert not found', {
        alertId: input.alertId,
      });
    }

    return updated;
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

  async listOwnersForPicker(workspaceId: string, query: WebAssetLookupQuery) {
    const filters: WebAssetLookupFilters = {
      q: query.q,
      limit: query.limit ?? 20,
    };

    return webAssetsRepository.listOwnersForLookup(workspaceId, filters);
  },
};
