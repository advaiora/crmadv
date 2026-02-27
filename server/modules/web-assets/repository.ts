import type {
  Prisma,
  WebAssetAlertSeverity,
  WebAssetAlertStatus,
  WebAssetAlertType,
  WebAssetDeploymentEnvironment,
  WebAssetHealthStatus,
  WebAssetMaintenanceStatus,
  WebAssetStatus,
  WebAssetVersionStatus,
} from '@prisma/client';
import { prisma } from '../../prisma.js';

export type WebAssetType = 'website' | 'webapp' | 'ecommerce';

export type WebAssetRecord = {
  id: string;
  assetType: WebAssetType;
  workspaceId: string;
  clientId: string | null;
  projectId: string | null;
  ownerUserId: string | null;
  name: string;
  url: string;
  status: WebAssetStatus;
  deploymentEnvironment: WebAssetDeploymentEnvironment;
  version: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  clientName: string | null;
  projectName: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
};

export type WebAssetListFilters = {
  assetType?: WebAssetType;
  status?: WebAssetStatus;
  environment?: WebAssetDeploymentEnvironment;
  q?: string;
  clientId?: string;
  projectId?: string;
  ownerUserId?: string;
};

export type WebAssetLookupFilters = {
  q?: string;
  clientId?: string;
  limit: number;
};

export type WebAssetWriteInput = {
  assetType: WebAssetType;
  name: string;
  url: string;
  status: WebAssetStatus;
  deploymentEnvironment: WebAssetDeploymentEnvironment;
  version: string | null;
  metadata: Prisma.InputJsonValue | null;
  clientId: string | null;
  projectId: string | null;
  ownerUserId: string | null;
};

export type WebAssetPatchInput = Partial<Omit<WebAssetWriteInput, 'assetType'>>;

export type WebAssetLookupItem = {
  id: string;
  name: string;
  email?: string | null;
  clientId?: string | null;
  clientName?: string | null;
};

export type WebAssetVersionRecord = {
  id: string;
  workspaceId: string;
  assetType: WebAssetType;
  assetId: string;
  versionNumber: string | null;
  versionStatus: WebAssetVersionStatus;
  changelog: string | null;
  releaseNotes: string | null;
  sourceAction: string;
  isRollback: boolean;
  sourceVersionId: string | null;
  snapshot: Prisma.JsonValue;
  createdByUserId: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: Date;
};

export type WebAssetHealthCheckRecord = {
  id: string;
  workspaceId: string;
  assetType: WebAssetType;
  assetId: string;
  environment: WebAssetDeploymentEnvironment;
  status: WebAssetHealthStatus;
  url: string;
  httpStatus: number | null;
  responseTimeMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdByUserId: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  checkedAt: Date;
};

export type WebAssetSeoReportRecord = {
  id: string;
  workspaceId: string;
  assetType: WebAssetType;
  assetId: string;
  score: number;
  status: WebAssetVersionStatus;
  metaTitle: string | null;
  metaDescription: string | null;
  h1Count: number;
  keywordList: string[];
  issues: Prisma.JsonValue | null;
  suggestions: Prisma.JsonValue | null;
  createdByUserId: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: Date;
};

export type WebAssetAnalyticsSnapshotRecord = {
  id: string;
  workspaceId: string;
  assetType: WebAssetType;
  assetId: string;
  environment: WebAssetDeploymentEnvironment;
  provider: string;
  sourceLabel: string | null;
  periodStart: Date;
  periodEnd: Date;
  sessions: number;
  users: number;
  pageViews: number;
  bounceRate: number | null;
  avgLoadTimeMs: number | null;
  uptimePercent: number | null;
  errorRate: number | null;
  topPages: Prisma.JsonValue | null;
  customEvents: Prisma.JsonValue | null;
  createdByUserId: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: Date;
};

export type WebAssetAnalyticsEventRecord = {
  id: string;
  workspaceId: string;
  assetType: WebAssetType;
  assetId: string;
  environment: WebAssetDeploymentEnvironment;
  eventName: string;
  eventLabel: string | null;
  count: number;
  metadata: Prisma.JsonValue | null;
  createdByUserId: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  occurredAt: Date;
  createdAt: Date;
};

export type WebAssetMaintenanceWindowRecord = {
  id: string;
  workspaceId: string;
  assetType: WebAssetType;
  assetId: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string | null;
  reason: string | null;
  status: WebAssetMaintenanceStatus;
  notifyEmail: string | null;
  notifySms: string | null;
  lastNotifiedAt: Date | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  updatedByName: string | null;
  updatedByEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type WebAssetAlertRecord = {
  id: string;
  workspaceId: string;
  assetType: WebAssetType;
  assetId: string;
  type: WebAssetAlertType;
  severity: WebAssetAlertSeverity;
  status: WebAssetAlertStatus;
  title: string;
  message: string;
  metadata: Prisma.JsonValue | null;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  emailNotifiedAt: Date | null;
  smsNotifiedAt: Date | null;
  createdByUserId: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const WEB_ASSET_RELATIONS_INCLUDE = {
  client: {
    select: {
      id: true,
      name: true,
    },
  },
  project: {
    select: {
      id: true,
      name: true,
    },
  },
  ownerUser: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

const buildSearchWhereClause = (query: string | undefined) => {
  const normalizedQuery = query?.trim();
  if (!normalizedQuery) {
    return undefined;
  }

  return {
    OR: [
      {
        id: {
          contains: normalizedQuery,
          mode: 'insensitive',
        },
      },
      {
        name: {
          contains: normalizedQuery,
          mode: 'insensitive',
        },
      },
      {
        url: {
          contains: normalizedQuery,
          mode: 'insensitive',
        },
      },
      {
        version: {
          contains: normalizedQuery,
          mode: 'insensitive',
        },
      },
    ],
  } as const;
};

type WorkspaceScopedWhereInput = {
  workspaceId?: string;
};

const whereWorkspace = <TWhere extends WorkspaceScopedWhereInput>(
  workspaceId: string,
  where: Omit<TWhere, 'workspaceId'> = {} as Omit<TWhere, 'workspaceId'>,
): TWhere => ({
  ...where,
  workspaceId,
} as TWhere);

const buildWebsiteWhere = (
  workspaceId: string,
  filters: WebAssetListFilters,
): Prisma.WebsiteAssetWhereInput => whereWorkspace<Prisma.WebsiteAssetWhereInput>(workspaceId, {
  ...(filters.status ? { status: filters.status } : {}),
  ...(filters.environment ? { deploymentEnvironment: filters.environment } : {}),
  ...(filters.clientId ? { clientId: filters.clientId } : {}),
  ...(filters.projectId ? { projectId: filters.projectId } : {}),
  ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
  ...(buildSearchWhereClause(filters.q) ?? {}),
});

const buildWebAppWhere = (
  workspaceId: string,
  filters: WebAssetListFilters,
): Prisma.WebAppAssetWhereInput => whereWorkspace<Prisma.WebAppAssetWhereInput>(workspaceId, {
  ...(filters.status ? { status: filters.status } : {}),
  ...(filters.environment ? { deploymentEnvironment: filters.environment } : {}),
  ...(filters.clientId ? { clientId: filters.clientId } : {}),
  ...(filters.projectId ? { projectId: filters.projectId } : {}),
  ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
  ...(buildSearchWhereClause(filters.q) ?? {}),
});

const buildEcommerceWhere = (
  workspaceId: string,
  filters: WebAssetListFilters,
): Prisma.EcommerceAssetWhereInput => whereWorkspace<Prisma.EcommerceAssetWhereInput>(workspaceId, {
  ...(filters.status ? { status: filters.status } : {}),
  ...(filters.environment ? { deploymentEnvironment: filters.environment } : {}),
  ...(filters.clientId ? { clientId: filters.clientId } : {}),
  ...(filters.projectId ? { projectId: filters.projectId } : {}),
  ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
  ...(buildSearchWhereClause(filters.q) ?? {}),
});

const mapWebsiteRecord = (
  item: Awaited<ReturnType<typeof prisma.websiteAsset.findFirstOrThrow>>,
): WebAssetRecord => ({
  id: item.id,
  assetType: 'website',
  workspaceId: item.workspaceId,
  clientId: item.clientId,
  projectId: item.projectId,
  ownerUserId: item.ownerUserId,
  name: item.name,
  url: item.url,
  status: item.status,
  deploymentEnvironment: item.deploymentEnvironment,
  version: item.version,
  metadata: item.metadata as Prisma.JsonValue | null,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  clientName: item.client?.name ?? null,
  projectName: item.project?.name ?? null,
  ownerName: item.ownerUser?.name ?? null,
  ownerEmail: item.ownerUser?.email ?? null,
});

const mapWebAppRecord = (
  item: Awaited<ReturnType<typeof prisma.webAppAsset.findFirstOrThrow>>,
): WebAssetRecord => ({
  id: item.id,
  assetType: 'webapp',
  workspaceId: item.workspaceId,
  clientId: item.clientId,
  projectId: item.projectId,
  ownerUserId: item.ownerUserId,
  name: item.name,
  url: item.url,
  status: item.status,
  deploymentEnvironment: item.deploymentEnvironment,
  version: item.version,
  metadata: item.metadata as Prisma.JsonValue | null,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  clientName: item.client?.name ?? null,
  projectName: item.project?.name ?? null,
  ownerName: item.ownerUser?.name ?? null,
  ownerEmail: item.ownerUser?.email ?? null,
});

const mapEcommerceRecord = (
  item: Awaited<ReturnType<typeof prisma.ecommerceAsset.findFirstOrThrow>>,
): WebAssetRecord => ({
  id: item.id,
  assetType: 'ecommerce',
  workspaceId: item.workspaceId,
  clientId: item.clientId,
  projectId: item.projectId,
  ownerUserId: item.ownerUserId,
  name: item.name,
  url: item.url,
  status: item.status,
  deploymentEnvironment: item.deploymentEnvironment,
  version: item.version,
  metadata: item.metadata as Prisma.JsonValue | null,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  clientName: item.client?.name ?? null,
  projectName: item.project?.name ?? null,
  ownerName: item.ownerUser?.name ?? null,
  ownerEmail: item.ownerUser?.email ?? null,
});

const toCreateData = (
  workspaceId: string,
  input: Omit<WebAssetWriteInput, 'assetType'>,
) => ({
  workspaceId,
  name: input.name,
  url: input.url,
  status: input.status,
  deploymentEnvironment: input.deploymentEnvironment,
  version: input.version,
  metadata: input.metadata,
  clientId: input.clientId,
  projectId: input.projectId,
  ownerUserId: input.ownerUserId,
});

const toPatchData = (patch: WebAssetPatchInput) => ({
  ...(patch.name !== undefined ? { name: patch.name } : {}),
  ...(patch.url !== undefined ? { url: patch.url } : {}),
  ...(patch.status !== undefined ? { status: patch.status } : {}),
  ...(patch.deploymentEnvironment !== undefined ? { deploymentEnvironment: patch.deploymentEnvironment } : {}),
  ...(patch.version !== undefined ? { version: patch.version } : {}),
  ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
  ...(patch.clientId !== undefined ? { clientId: patch.clientId } : {}),
  ...(patch.projectId !== undefined ? { projectId: patch.projectId } : {}),
  ...(patch.ownerUserId !== undefined ? { ownerUserId: patch.ownerUserId } : {}),
});

const USER_SUMMARY_INCLUDE = {
  select: {
    id: true,
    name: true,
    email: true,
  },
} as const;

const WEB_ASSET_VERSION_INCLUDE = {
  createdByUser: USER_SUMMARY_INCLUDE,
} as const;

const WEB_ASSET_HEALTH_CHECK_INCLUDE = {
  createdByUser: USER_SUMMARY_INCLUDE,
} as const;

const WEB_ASSET_SEO_REPORT_INCLUDE = {
  createdByUser: USER_SUMMARY_INCLUDE,
} as const;

const WEB_ASSET_ANALYTICS_SNAPSHOT_INCLUDE = {
  createdByUser: USER_SUMMARY_INCLUDE,
} as const;

const WEB_ASSET_ANALYTICS_EVENT_INCLUDE = {
  createdByUser: USER_SUMMARY_INCLUDE,
} as const;

const WEB_ASSET_MAINTENANCE_WINDOW_INCLUDE = {
  createdByUser: USER_SUMMARY_INCLUDE,
  updatedByUser: USER_SUMMARY_INCLUDE,
} as const;

const WEB_ASSET_ALERT_INCLUDE = {
  createdByUser: USER_SUMMARY_INCLUDE,
} as const;

const decimalToNumber = (value: Prisma.Decimal | null): number | null => {
  if (!value) {
    return null;
  }

  return Number(value);
};

const mapVersionRecord = (
  item: Awaited<ReturnType<typeof prisma.webAssetVersion.findFirstOrThrow>>,
): WebAssetVersionRecord => ({
  id: item.id,
  workspaceId: item.workspaceId,
  assetType: item.assetType as WebAssetType,
  assetId: item.assetId,
  versionNumber: item.versionNumber,
  versionStatus: item.versionStatus,
  changelog: item.changelog,
  releaseNotes: item.releaseNotes,
  sourceAction: item.sourceAction,
  isRollback: item.isRollback,
  sourceVersionId: item.sourceVersionId,
  snapshot: item.snapshot as Prisma.JsonValue,
  createdByUserId: item.createdByUserId,
  createdByName: item.createdByUser?.name ?? null,
  createdByEmail: item.createdByUser?.email ?? null,
  createdAt: item.createdAt,
});

const mapHealthCheckRecord = (
  item: Awaited<ReturnType<typeof prisma.webAssetHealthCheck.findFirstOrThrow>>,
): WebAssetHealthCheckRecord => ({
  id: item.id,
  workspaceId: item.workspaceId,
  assetType: item.assetType as WebAssetType,
  assetId: item.assetId,
  environment: item.environment,
  status: item.status,
  url: item.url,
  httpStatus: item.httpStatus,
  responseTimeMs: item.responseTimeMs,
  errorCode: item.errorCode,
  errorMessage: item.errorMessage,
  createdByUserId: item.createdByUserId,
  createdByName: item.createdByUser?.name ?? null,
  createdByEmail: item.createdByUser?.email ?? null,
  checkedAt: item.checkedAt,
});

const mapSeoReportRecord = (
  item: Awaited<ReturnType<typeof prisma.webAssetSeoReport.findFirstOrThrow>>,
): WebAssetSeoReportRecord => ({
  id: item.id,
  workspaceId: item.workspaceId,
  assetType: item.assetType as WebAssetType,
  assetId: item.assetId,
  score: item.score,
  status: item.status,
  metaTitle: item.metaTitle,
  metaDescription: item.metaDescription,
  h1Count: item.h1Count,
  keywordList: item.keywordList,
  issues: item.issues as Prisma.JsonValue | null,
  suggestions: item.suggestions as Prisma.JsonValue | null,
  createdByUserId: item.createdByUserId,
  createdByName: item.createdByUser?.name ?? null,
  createdByEmail: item.createdByUser?.email ?? null,
  createdAt: item.createdAt,
});

const mapAnalyticsSnapshotRecord = (
  item: Awaited<ReturnType<typeof prisma.webAssetAnalyticsSnapshot.findFirstOrThrow>>,
): WebAssetAnalyticsSnapshotRecord => ({
  id: item.id,
  workspaceId: item.workspaceId,
  assetType: item.assetType as WebAssetType,
  assetId: item.assetId,
  environment: item.environment,
  provider: item.provider,
  sourceLabel: item.sourceLabel,
  periodStart: item.periodStart,
  periodEnd: item.periodEnd,
  sessions: item.sessions,
  users: item.users,
  pageViews: item.pageViews,
  bounceRate: decimalToNumber(item.bounceRate),
  avgLoadTimeMs: item.avgLoadTimeMs,
  uptimePercent: decimalToNumber(item.uptimePercent),
  errorRate: decimalToNumber(item.errorRate),
  topPages: item.topPages as Prisma.JsonValue | null,
  customEvents: item.customEvents as Prisma.JsonValue | null,
  createdByUserId: item.createdByUserId,
  createdByName: item.createdByUser?.name ?? null,
  createdByEmail: item.createdByUser?.email ?? null,
  createdAt: item.createdAt,
});

const mapAnalyticsEventRecord = (
  item: Awaited<ReturnType<typeof prisma.webAssetAnalyticsEvent.findFirstOrThrow>>,
): WebAssetAnalyticsEventRecord => ({
  id: item.id,
  workspaceId: item.workspaceId,
  assetType: item.assetType as WebAssetType,
  assetId: item.assetId,
  environment: item.environment,
  eventName: item.eventName,
  eventLabel: item.eventLabel,
  count: item.count,
  metadata: item.metadata as Prisma.JsonValue | null,
  createdByUserId: item.createdByUserId,
  createdByName: item.createdByUser?.name ?? null,
  createdByEmail: item.createdByUser?.email ?? null,
  occurredAt: item.occurredAt,
  createdAt: item.createdAt,
});

const mapMaintenanceWindowRecord = (
  item: Awaited<ReturnType<typeof prisma.webAssetMaintenanceWindow.findFirstOrThrow>>,
): WebAssetMaintenanceWindowRecord => ({
  id: item.id,
  workspaceId: item.workspaceId,
  assetType: item.assetType as WebAssetType,
  assetId: item.assetId,
  startsAt: item.startsAt,
  endsAt: item.endsAt,
  timezone: item.timezone,
  reason: item.reason,
  status: item.status,
  notifyEmail: item.notifyEmail,
  notifySms: item.notifySms,
  lastNotifiedAt: item.lastNotifiedAt,
  createdByUserId: item.createdByUserId,
  updatedByUserId: item.updatedByUserId,
  createdByName: item.createdByUser?.name ?? null,
  createdByEmail: item.createdByUser?.email ?? null,
  updatedByName: item.updatedByUser?.name ?? null,
  updatedByEmail: item.updatedByUser?.email ?? null,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

const mapAlertRecord = (
  item: Awaited<ReturnType<typeof prisma.webAssetAlert.findFirstOrThrow>>,
): WebAssetAlertRecord => ({
  id: item.id,
  workspaceId: item.workspaceId,
  assetType: item.assetType as WebAssetType,
  assetId: item.assetId,
  type: item.type,
  severity: item.severity,
  status: item.status,
  title: item.title,
  message: item.message,
  metadata: item.metadata as Prisma.JsonValue | null,
  acknowledgedAt: item.acknowledgedAt,
  resolvedAt: item.resolvedAt,
  emailNotifiedAt: item.emailNotifiedAt,
  smsNotifiedAt: item.smsNotifiedAt,
  createdByUserId: item.createdByUserId,
  createdByName: item.createdByUser?.name ?? null,
  createdByEmail: item.createdByUser?.email ?? null,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

export const webAssetsRepository = {
  async listAssets(workspaceId: string, filters: WebAssetListFilters): Promise<WebAssetRecord[]> {
    const shouldListWebsite = !filters.assetType || filters.assetType === 'website';
    const shouldListWebApp = !filters.assetType || filters.assetType === 'webapp';
    const shouldListEcommerce = !filters.assetType || filters.assetType === 'ecommerce';

    const [websites, webapps, ecommerceSites] = await Promise.all([
      shouldListWebsite
        ? prisma.websiteAsset.findMany({
            where: buildWebsiteWhere(workspaceId, filters),
            include: WEB_ASSET_RELATIONS_INCLUDE,
          })
        : Promise.resolve([]),
      shouldListWebApp
        ? prisma.webAppAsset.findMany({
            where: buildWebAppWhere(workspaceId, filters),
            include: WEB_ASSET_RELATIONS_INCLUDE,
          })
        : Promise.resolve([]),
      shouldListEcommerce
        ? prisma.ecommerceAsset.findMany({
            where: buildEcommerceWhere(workspaceId, filters),
            include: WEB_ASSET_RELATIONS_INCLUDE,
          })
        : Promise.resolve([]),
    ]);

    const items = [
      ...websites.map(mapWebsiteRecord),
      ...webapps.map(mapWebAppRecord),
      ...ecommerceSites.map(mapEcommerceRecord),
    ];

    return items.sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  },

  async findById(workspaceId: string, assetId: string): Promise<WebAssetRecord | null> {
    const [website, webapp, ecommerce] = await Promise.all([
      prisma.websiteAsset.findFirst({
        where: whereWorkspace<Prisma.WebsiteAssetWhereInput>(workspaceId, {
          id: assetId,
        }),
        include: WEB_ASSET_RELATIONS_INCLUDE,
      }),
      prisma.webAppAsset.findFirst({
        where: whereWorkspace<Prisma.WebAppAssetWhereInput>(workspaceId, {
          id: assetId,
        }),
        include: WEB_ASSET_RELATIONS_INCLUDE,
      }),
      prisma.ecommerceAsset.findFirst({
        where: whereWorkspace<Prisma.EcommerceAssetWhereInput>(workspaceId, {
          id: assetId,
        }),
        include: WEB_ASSET_RELATIONS_INCLUDE,
      }),
    ]);

    if (website) {
      return mapWebsiteRecord(website);
    }

    if (webapp) {
      return mapWebAppRecord(webapp);
    }

    if (ecommerce) {
      return mapEcommerceRecord(ecommerce);
    }

    return null;
  },

  async createAsset(workspaceId: string, input: WebAssetWriteInput): Promise<WebAssetRecord> {
    const createData = toCreateData(workspaceId, input);

    switch (input.assetType) {
      case 'website': {
        const created = await prisma.websiteAsset.create({
          data: createData,
          include: WEB_ASSET_RELATIONS_INCLUDE,
        });

        return mapWebsiteRecord(created);
      }
      case 'webapp': {
        const created = await prisma.webAppAsset.create({
          data: createData,
          include: WEB_ASSET_RELATIONS_INCLUDE,
        });

        return mapWebAppRecord(created);
      }
      default: {
        const created = await prisma.ecommerceAsset.create({
          data: createData,
          include: WEB_ASSET_RELATIONS_INCLUDE,
        });

        return mapEcommerceRecord(created);
      }
    }
  },

  async updateAsset(
    workspaceId: string,
    assetId: string,
    patch: WebAssetPatchInput,
  ): Promise<WebAssetRecord | null> {
    const existing = await this.findById(workspaceId, assetId);
    if (!existing) {
      return null;
    }

    const patchData = toPatchData(patch);

    switch (existing.assetType) {
      case 'website': {
        const updatedCount = await prisma.websiteAsset.updateMany({
          where: whereWorkspace<Prisma.WebsiteAssetWhereInput>(workspaceId, {
            id: assetId,
          }),
          data: patchData,
        });
        if (!updatedCount.count) {
          return null;
        }

        const updated = await prisma.websiteAsset.findFirst({
          where: whereWorkspace<Prisma.WebsiteAssetWhereInput>(workspaceId, {
            id: assetId,
          }),
          include: WEB_ASSET_RELATIONS_INCLUDE,
        });
        if (!updated) {
          return null;
        }

        return mapWebsiteRecord(updated);
      }
      case 'webapp': {
        const updatedCount = await prisma.webAppAsset.updateMany({
          where: whereWorkspace<Prisma.WebAppAssetWhereInput>(workspaceId, {
            id: assetId,
          }),
          data: patchData,
        });
        if (!updatedCount.count) {
          return null;
        }

        const updated = await prisma.webAppAsset.findFirst({
          where: whereWorkspace<Prisma.WebAppAssetWhereInput>(workspaceId, {
            id: assetId,
          }),
          include: WEB_ASSET_RELATIONS_INCLUDE,
        });
        if (!updated) {
          return null;
        }

        return mapWebAppRecord(updated);
      }
      default: {
        const updatedCount = await prisma.ecommerceAsset.updateMany({
          where: whereWorkspace<Prisma.EcommerceAssetWhereInput>(workspaceId, {
            id: assetId,
          }),
          data: patchData,
        });
        if (!updatedCount.count) {
          return null;
        }

        const updated = await prisma.ecommerceAsset.findFirst({
          where: whereWorkspace<Prisma.EcommerceAssetWhereInput>(workspaceId, {
            id: assetId,
          }),
          include: WEB_ASSET_RELATIONS_INCLUDE,
        });
        if (!updated) {
          return null;
        }

        return mapEcommerceRecord(updated);
      }
    }
  },

  async deleteAsset(workspaceId: string, assetId: string): Promise<WebAssetRecord | null> {
    const existing = await this.findById(workspaceId, assetId);
    if (!existing) {
      return null;
    }

    switch (existing.assetType) {
      case 'website': {
        const deletedCount = await prisma.websiteAsset.deleteMany({
          where: whereWorkspace<Prisma.WebsiteAssetWhereInput>(workspaceId, {
            id: assetId,
          }),
        });
        return deletedCount.count ? existing : null;
      }
      case 'webapp': {
        const deletedCount = await prisma.webAppAsset.deleteMany({
          where: whereWorkspace<Prisma.WebAppAssetWhereInput>(workspaceId, {
            id: assetId,
          }),
        });
        return deletedCount.count ? existing : null;
      }
      default: {
        const deletedCount = await prisma.ecommerceAsset.deleteMany({
          where: whereWorkspace<Prisma.EcommerceAssetWhereInput>(workspaceId, {
            id: assetId,
          }),
        });
        return deletedCount.count ? existing : null;
      }
    }
  },

  clientExists(workspaceId: string, clientId: string) {
    return prisma.client.findFirst({
      where: whereWorkspace<Prisma.ClientWhereInput>(workspaceId, {
        id: clientId,
      }),
      select: { id: true },
    });
  },

  projectExists(workspaceId: string, projectId: string) {
    return prisma.project.findFirst({
      where: whereWorkspace<Prisma.ProjectWhereInput>(workspaceId, {
        id: projectId,
      }),
      select: { id: true },
    });
  },

  userIsWorkspaceMember(workspaceId: string, userId: string) {
    return prisma.membership.findFirst({
      where: whereWorkspace<Prisma.MembershipWhereInput>(workspaceId, {
        userId,
      }),
      select: { id: true },
    });
  },

  async listClientsForLookup(
    workspaceId: string,
    filters: WebAssetLookupFilters,
  ): Promise<WebAssetLookupItem[]> {
    const items = await prisma.client.findMany({
      where: whereWorkspace<Prisma.ClientWhereInput>(workspaceId, {
        ...(filters.q
          ? {
              OR: [
                { id: { contains: filters.q, mode: 'insensitive' } },
                { name: { contains: filters.q, mode: 'insensitive' } },
                { email: { contains: filters.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      }),
      orderBy: [{ updatedAt: 'desc' }],
      take: filters.limit,
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return items.map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
    }));
  },

  async listProjectsForLookup(
    workspaceId: string,
    filters: WebAssetLookupFilters,
  ): Promise<WebAssetLookupItem[]> {
    const items = await prisma.project.findMany({
      where: whereWorkspace<Prisma.ProjectWhereInput>(workspaceId, {
        ...(filters.clientId
          ? {
              OR: [
                {
                  clientId: filters.clientId,
                },
                {
                  clientLinks: {
                    some: {
                      clientId: filters.clientId,
                    },
                  },
                },
              ],
            }
          : {}),
        ...(filters.q
          ? {
              OR: [
                { id: { contains: filters.q, mode: 'insensitive' } },
                { name: { contains: filters.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      }),
      orderBy: [{ updatedAt: 'desc' }],
      take: filters.limit,
      select: {
        id: true,
        name: true,
        clientId: true,
        client: {
          select: {
            name: true,
          },
        },
      },
    });

    return items.map((item) => ({
      id: item.id,
      name: item.name,
      clientId: item.clientId,
      clientName: item.client?.name ?? null,
    }));
  },

  async listOwnersForLookup(
    workspaceId: string,
    filters: WebAssetLookupFilters,
  ): Promise<WebAssetLookupItem[]> {
    const memberships = await prisma.membership.findMany({
      where: whereWorkspace<Prisma.MembershipWhereInput>(workspaceId, {
        status: 'active',
        ...(filters.q
          ? {
              user: {
                OR: [
                  { id: { contains: filters.q, mode: 'insensitive' } },
                  { name: { contains: filters.q, mode: 'insensitive' } },
                  { email: { contains: filters.q, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      }),
      orderBy: [{ updatedAt: 'desc' }],
      take: filters.limit,
      select: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const uniqueUsers = new Map<string, WebAssetLookupItem>();
    for (const membership of memberships) {
      const user = membership.user;
      if (!uniqueUsers.has(user.id)) {
        uniqueUsers.set(user.id, {
          id: user.id,
          name: user.name || user.email,
          email: user.email,
        });
      }
    }

    return Array.from(uniqueUsers.values());
  },

  async createVersion(input: {
    workspaceId: string;
    assetType: WebAssetType;
    assetId: string;
    versionNumber: string | null;
    versionStatus: WebAssetVersionStatus;
    changelog: string | null;
    releaseNotes: string | null;
    sourceAction: string;
    isRollback?: boolean;
    sourceVersionId?: string | null;
    snapshot: Prisma.InputJsonValue;
    createdByUserId: string | null;
  }): Promise<WebAssetVersionRecord> {
    const created = await prisma.webAssetVersion.create({
      data: {
        workspaceId: input.workspaceId,
        assetType: input.assetType,
        assetId: input.assetId,
        versionNumber: input.versionNumber,
        versionStatus: input.versionStatus,
        changelog: input.changelog,
        releaseNotes: input.releaseNotes,
        sourceAction: input.sourceAction,
        isRollback: input.isRollback ?? false,
        sourceVersionId: input.sourceVersionId ?? null,
        snapshot: input.snapshot,
        createdByUserId: input.createdByUserId,
      },
      include: WEB_ASSET_VERSION_INCLUDE,
    });

    return mapVersionRecord(created);
  },

  async listVersions(
    workspaceId: string,
    assetType: WebAssetType,
    assetId: string,
    limit = 50,
  ): Promise<WebAssetVersionRecord[]> {
    const items = await prisma.webAssetVersion.findMany({
      where: whereWorkspace<Prisma.WebAssetVersionWhereInput>(workspaceId, {
        assetType,
        assetId,
      }),
      orderBy: {
        createdAt: 'desc',
      },
      take: Math.max(1, Math.min(limit, 200)),
      include: WEB_ASSET_VERSION_INCLUDE,
    });

    return items.map(mapVersionRecord);
  },

  async findVersionById(
    workspaceId: string,
    assetType: WebAssetType,
    assetId: string,
    versionId: string,
  ): Promise<WebAssetVersionRecord | null> {
    const item = await prisma.webAssetVersion.findFirst({
      where: whereWorkspace<Prisma.WebAssetVersionWhereInput>(workspaceId, {
        id: versionId,
        assetType,
        assetId,
      }),
      include: WEB_ASSET_VERSION_INCLUDE,
    });

    return item ? mapVersionRecord(item) : null;
  },

  async createHealthCheck(input: {
    workspaceId: string;
    assetType: WebAssetType;
    assetId: string;
    environment: WebAssetDeploymentEnvironment;
    status: WebAssetHealthStatus;
    url: string;
    httpStatus?: number | null;
    responseTimeMs?: number | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    createdByUserId?: string | null;
  }): Promise<WebAssetHealthCheckRecord> {
    const created = await prisma.webAssetHealthCheck.create({
      data: {
        workspaceId: input.workspaceId,
        assetType: input.assetType,
        assetId: input.assetId,
        environment: input.environment,
        status: input.status,
        url: input.url,
        httpStatus: input.httpStatus ?? null,
        responseTimeMs: input.responseTimeMs ?? null,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        createdByUserId: input.createdByUserId ?? null,
      },
      include: WEB_ASSET_HEALTH_CHECK_INCLUDE,
    });

    return mapHealthCheckRecord(created);
  },

  async listHealthChecks(input: {
    workspaceId: string;
    assetType: WebAssetType;
    assetId: string;
    limit?: number;
  }): Promise<WebAssetHealthCheckRecord[]> {
    const items = await prisma.webAssetHealthCheck.findMany({
      where: whereWorkspace<Prisma.WebAssetHealthCheckWhereInput>(input.workspaceId, {
        assetType: input.assetType,
        assetId: input.assetId,
      }),
      orderBy: {
        checkedAt: 'desc',
      },
      take: Math.max(1, Math.min(input.limit ?? 50, 300)),
      include: WEB_ASSET_HEALTH_CHECK_INCLUDE,
    });

    return items.map(mapHealthCheckRecord);
  },

  async createSeoReport(input: {
    workspaceId: string;
    assetType: WebAssetType;
    assetId: string;
    score: number;
    status: WebAssetVersionStatus;
    metaTitle?: string | null;
    metaDescription?: string | null;
    h1Count: number;
    keywordList: string[];
    issues?: Prisma.InputJsonValue | null;
    suggestions?: Prisma.InputJsonValue | null;
    createdByUserId?: string | null;
  }): Promise<WebAssetSeoReportRecord> {
    const created = await prisma.webAssetSeoReport.create({
      data: {
        workspaceId: input.workspaceId,
        assetType: input.assetType,
        assetId: input.assetId,
        score: input.score,
        status: input.status,
        metaTitle: input.metaTitle ?? null,
        metaDescription: input.metaDescription ?? null,
        h1Count: input.h1Count,
        keywordList: input.keywordList,
        issues: input.issues ?? null,
        suggestions: input.suggestions ?? null,
        createdByUserId: input.createdByUserId ?? null,
      },
      include: WEB_ASSET_SEO_REPORT_INCLUDE,
    });

    return mapSeoReportRecord(created);
  },

  async listSeoReports(input: {
    workspaceId: string;
    assetType: WebAssetType;
    assetId: string;
    limit?: number;
  }): Promise<WebAssetSeoReportRecord[]> {
    const items = await prisma.webAssetSeoReport.findMany({
      where: whereWorkspace<Prisma.WebAssetSeoReportWhereInput>(input.workspaceId, {
        assetType: input.assetType,
        assetId: input.assetId,
      }),
      orderBy: {
        createdAt: 'desc',
      },
      take: Math.max(1, Math.min(input.limit ?? 20, 200)),
      include: WEB_ASSET_SEO_REPORT_INCLUDE,
    });

    return items.map(mapSeoReportRecord);
  },

  async createAnalyticsSnapshot(input: {
    workspaceId: string;
    assetType: WebAssetType;
    assetId: string;
    environment: WebAssetDeploymentEnvironment;
    provider: string;
    sourceLabel?: string | null;
    periodStart: Date;
    periodEnd: Date;
    sessions: number;
    users: number;
    pageViews: number;
    bounceRate?: Prisma.Decimal | number | null;
    avgLoadTimeMs?: number | null;
    uptimePercent?: Prisma.Decimal | number | null;
    errorRate?: Prisma.Decimal | number | null;
    topPages?: Prisma.InputJsonValue | null;
    customEvents?: Prisma.InputJsonValue | null;
    createdByUserId?: string | null;
  }): Promise<WebAssetAnalyticsSnapshotRecord> {
    const created = await prisma.webAssetAnalyticsSnapshot.create({
      data: {
        workspaceId: input.workspaceId,
        assetType: input.assetType,
        assetId: input.assetId,
        environment: input.environment,
        provider: input.provider,
        sourceLabel: input.sourceLabel ?? null,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        sessions: input.sessions,
        users: input.users,
        pageViews: input.pageViews,
        bounceRate: input.bounceRate ?? null,
        avgLoadTimeMs: input.avgLoadTimeMs ?? null,
        uptimePercent: input.uptimePercent ?? null,
        errorRate: input.errorRate ?? null,
        topPages: input.topPages ?? null,
        customEvents: input.customEvents ?? null,
        createdByUserId: input.createdByUserId ?? null,
      },
      include: WEB_ASSET_ANALYTICS_SNAPSHOT_INCLUDE,
    });

    return mapAnalyticsSnapshotRecord(created);
  },

  async listAnalyticsSnapshots(input: {
    workspaceId: string;
    assetType: WebAssetType;
    assetId: string;
    limit?: number;
  }): Promise<WebAssetAnalyticsSnapshotRecord[]> {
    const items = await prisma.webAssetAnalyticsSnapshot.findMany({
      where: whereWorkspace<Prisma.WebAssetAnalyticsSnapshotWhereInput>(input.workspaceId, {
        assetType: input.assetType,
        assetId: input.assetId,
      }),
      orderBy: {
        periodEnd: 'desc',
      },
      take: Math.max(1, Math.min(input.limit ?? 30, 200)),
      include: WEB_ASSET_ANALYTICS_SNAPSHOT_INCLUDE,
    });

    return items.map(mapAnalyticsSnapshotRecord);
  },

  async createAnalyticsEvent(input: {
    workspaceId: string;
    assetType: WebAssetType;
    assetId: string;
    environment: WebAssetDeploymentEnvironment;
    eventName: string;
    eventLabel?: string | null;
    count?: number;
    metadata?: Prisma.InputJsonValue | null;
    occurredAt?: Date;
    createdByUserId?: string | null;
  }): Promise<WebAssetAnalyticsEventRecord> {
    const created = await prisma.webAssetAnalyticsEvent.create({
      data: {
        workspaceId: input.workspaceId,
        assetType: input.assetType,
        assetId: input.assetId,
        environment: input.environment,
        eventName: input.eventName,
        eventLabel: input.eventLabel ?? null,
        count: input.count ?? 1,
        metadata: input.metadata ?? null,
        occurredAt: input.occurredAt ?? new Date(),
        createdByUserId: input.createdByUserId ?? null,
      },
      include: WEB_ASSET_ANALYTICS_EVENT_INCLUDE,
    });

    return mapAnalyticsEventRecord(created);
  },

  async listAnalyticsEvents(input: {
    workspaceId: string;
    assetType: WebAssetType;
    assetId: string;
    limit?: number;
  }): Promise<WebAssetAnalyticsEventRecord[]> {
    const items = await prisma.webAssetAnalyticsEvent.findMany({
      where: whereWorkspace<Prisma.WebAssetAnalyticsEventWhereInput>(input.workspaceId, {
        assetType: input.assetType,
        assetId: input.assetId,
      }),
      orderBy: {
        occurredAt: 'desc',
      },
      take: Math.max(1, Math.min(input.limit ?? 100, 500)),
      include: WEB_ASSET_ANALYTICS_EVENT_INCLUDE,
    });

    return items.map(mapAnalyticsEventRecord);
  },

  async createMaintenanceWindow(input: {
    workspaceId: string;
    assetType: WebAssetType;
    assetId: string;
    startsAt: Date;
    endsAt: Date;
    timezone?: string | null;
    reason?: string | null;
    status?: WebAssetMaintenanceStatus;
    notifyEmail?: string | null;
    notifySms?: string | null;
    lastNotifiedAt?: Date | null;
    createdByUserId?: string | null;
    updatedByUserId?: string | null;
  }): Promise<WebAssetMaintenanceWindowRecord> {
    const created = await prisma.webAssetMaintenanceWindow.create({
      data: {
        workspaceId: input.workspaceId,
        assetType: input.assetType,
        assetId: input.assetId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        timezone: input.timezone ?? null,
        reason: input.reason ?? null,
        status: input.status ?? 'SCHEDULED',
        notifyEmail: input.notifyEmail ?? null,
        notifySms: input.notifySms ?? null,
        lastNotifiedAt: input.lastNotifiedAt ?? null,
        createdByUserId: input.createdByUserId ?? null,
        updatedByUserId: input.updatedByUserId ?? input.createdByUserId ?? null,
      },
      include: WEB_ASSET_MAINTENANCE_WINDOW_INCLUDE,
    });

    return mapMaintenanceWindowRecord(created);
  },

  async updateMaintenanceWindow(input: {
    workspaceId: string;
    maintenanceId: string;
    patch: {
      startsAt?: Date;
      endsAt?: Date;
      timezone?: string | null;
      reason?: string | null;
      status?: WebAssetMaintenanceStatus;
      notifyEmail?: string | null;
      notifySms?: string | null;
      lastNotifiedAt?: Date | null;
      updatedByUserId?: string | null;
    };
  }): Promise<WebAssetMaintenanceWindowRecord | null> {
    const existing = await prisma.webAssetMaintenanceWindow.findFirst({
      where: whereWorkspace<Prisma.WebAssetMaintenanceWindowWhereInput>(input.workspaceId, {
        id: input.maintenanceId,
      }),
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    const updatedCount = await prisma.webAssetMaintenanceWindow.updateMany({
      where: whereWorkspace<Prisma.WebAssetMaintenanceWindowWhereInput>(input.workspaceId, {
        id: existing.id,
      }),
      data: {
        ...(input.patch.startsAt !== undefined ? { startsAt: input.patch.startsAt } : {}),
        ...(input.patch.endsAt !== undefined ? { endsAt: input.patch.endsAt } : {}),
        ...(input.patch.timezone !== undefined ? { timezone: input.patch.timezone } : {}),
        ...(input.patch.reason !== undefined ? { reason: input.patch.reason } : {}),
        ...(input.patch.status !== undefined ? { status: input.patch.status } : {}),
        ...(input.patch.notifyEmail !== undefined ? { notifyEmail: input.patch.notifyEmail } : {}),
        ...(input.patch.notifySms !== undefined ? { notifySms: input.patch.notifySms } : {}),
        ...(input.patch.lastNotifiedAt !== undefined ? { lastNotifiedAt: input.patch.lastNotifiedAt } : {}),
        ...(input.patch.updatedByUserId !== undefined ? { updatedByUserId: input.patch.updatedByUserId } : {}),
      },
    });
    if (!updatedCount.count) {
      return null;
    }

    const updated = await prisma.webAssetMaintenanceWindow.findFirst({
      where: whereWorkspace<Prisma.WebAssetMaintenanceWindowWhereInput>(input.workspaceId, {
        id: existing.id,
      }),
      include: WEB_ASSET_MAINTENANCE_WINDOW_INCLUDE,
    });
    if (!updated) {
      return null;
    }

    return mapMaintenanceWindowRecord(updated);
  },

  async listMaintenanceWindows(input: {
    workspaceId: string;
    assetType: WebAssetType;
    assetId: string;
    limit?: number;
  }): Promise<WebAssetMaintenanceWindowRecord[]> {
    const items = await prisma.webAssetMaintenanceWindow.findMany({
      where: whereWorkspace<Prisma.WebAssetMaintenanceWindowWhereInput>(input.workspaceId, {
        assetType: input.assetType,
        assetId: input.assetId,
      }),
      orderBy: {
        startsAt: 'desc',
      },
      take: Math.max(1, Math.min(input.limit ?? 50, 200)),
      include: WEB_ASSET_MAINTENANCE_WINDOW_INCLUDE,
    });

    return items.map(mapMaintenanceWindowRecord);
  },

  async findMaintenanceWindowById(input: {
    workspaceId: string;
    assetType: WebAssetType;
    assetId: string;
    maintenanceId: string;
  }): Promise<WebAssetMaintenanceWindowRecord | null> {
    const item = await prisma.webAssetMaintenanceWindow.findFirst({
      where: whereWorkspace<Prisma.WebAssetMaintenanceWindowWhereInput>(input.workspaceId, {
        assetType: input.assetType,
        assetId: input.assetId,
        id: input.maintenanceId,
      }),
      include: WEB_ASSET_MAINTENANCE_WINDOW_INCLUDE,
    });

    return item ? mapMaintenanceWindowRecord(item) : null;
  },

  async createAlert(input: {
    workspaceId: string;
    assetType: WebAssetType;
    assetId: string;
    type: WebAssetAlertType;
    severity: WebAssetAlertSeverity;
    status?: WebAssetAlertStatus;
    title: string;
    message: string;
    metadata?: Prisma.InputJsonValue | null;
    emailNotifiedAt?: Date | null;
    smsNotifiedAt?: Date | null;
    createdByUserId?: string | null;
  }): Promise<WebAssetAlertRecord> {
    const created = await prisma.webAssetAlert.create({
      data: {
        workspaceId: input.workspaceId,
        assetType: input.assetType,
        assetId: input.assetId,
        type: input.type,
        severity: input.severity,
        status: input.status ?? 'OPEN',
        title: input.title,
        message: input.message,
        metadata: input.metadata ?? null,
        emailNotifiedAt: input.emailNotifiedAt ?? null,
        smsNotifiedAt: input.smsNotifiedAt ?? null,
        createdByUserId: input.createdByUserId ?? null,
      },
      include: WEB_ASSET_ALERT_INCLUDE,
    });

    return mapAlertRecord(created);
  },

  async listAlerts(input: {
    workspaceId: string;
    assetType: WebAssetType;
    assetId: string;
    status?: WebAssetAlertStatus;
    limit?: number;
  }): Promise<WebAssetAlertRecord[]> {
    const items = await prisma.webAssetAlert.findMany({
      where: whereWorkspace<Prisma.WebAssetAlertWhereInput>(input.workspaceId, {
        assetType: input.assetType,
        assetId: input.assetId,
        ...(input.status ? { status: input.status } : {}),
      }),
      orderBy: {
        createdAt: 'desc',
      },
      take: Math.max(1, Math.min(input.limit ?? 50, 300)),
      include: WEB_ASSET_ALERT_INCLUDE,
    });

    return items.map(mapAlertRecord);
  },

  async findLatestOpenAlertByType(input: {
    workspaceId: string;
    assetType: WebAssetType;
    assetId: string;
    type: WebAssetAlertType;
  }): Promise<WebAssetAlertRecord | null> {
    const item = await prisma.webAssetAlert.findFirst({
      where: whereWorkspace<Prisma.WebAssetAlertWhereInput>(input.workspaceId, {
        assetType: input.assetType,
        assetId: input.assetId,
        type: input.type,
        status: 'OPEN',
      }),
      orderBy: {
        createdAt: 'desc',
      },
      include: WEB_ASSET_ALERT_INCLUDE,
    });

    return item ? mapAlertRecord(item) : null;
  },

  async updateAlert(input: {
    workspaceId: string;
    alertId: string;
    patch: {
      status?: WebAssetAlertStatus;
      acknowledgedAt?: Date | null;
      resolvedAt?: Date | null;
      emailNotifiedAt?: Date | null;
      smsNotifiedAt?: Date | null;
      message?: string;
      metadata?: Prisma.InputJsonValue | null;
    };
  }): Promise<WebAssetAlertRecord | null> {
    const existing = await prisma.webAssetAlert.findFirst({
      where: whereWorkspace<Prisma.WebAssetAlertWhereInput>(input.workspaceId, {
        id: input.alertId,
      }),
      select: {
        id: true,
      },
    });

    if (!existing) {
      return null;
    }

    const updatedCount = await prisma.webAssetAlert.updateMany({
      where: whereWorkspace<Prisma.WebAssetAlertWhereInput>(input.workspaceId, {
        id: existing.id,
      }),
      data: {
        ...(input.patch.status !== undefined ? { status: input.patch.status } : {}),
        ...(input.patch.acknowledgedAt !== undefined ? { acknowledgedAt: input.patch.acknowledgedAt } : {}),
        ...(input.patch.resolvedAt !== undefined ? { resolvedAt: input.patch.resolvedAt } : {}),
        ...(input.patch.emailNotifiedAt !== undefined ? { emailNotifiedAt: input.patch.emailNotifiedAt } : {}),
        ...(input.patch.smsNotifiedAt !== undefined ? { smsNotifiedAt: input.patch.smsNotifiedAt } : {}),
        ...(input.patch.message !== undefined ? { message: input.patch.message } : {}),
        ...(input.patch.metadata !== undefined ? { metadata: input.patch.metadata } : {}),
      },
    });
    if (!updatedCount.count) {
      return null;
    }

    const updated = await prisma.webAssetAlert.findFirst({
      where: whereWorkspace<Prisma.WebAssetAlertWhereInput>(input.workspaceId, {
        id: existing.id,
      }),
      include: WEB_ASSET_ALERT_INCLUDE,
    });
    if (!updated) {
      return null;
    }

    return mapAlertRecord(updated);
  },

  async resolveOpenAlertsByType(input: {
    workspaceId: string;
    assetType: WebAssetType;
    assetId: string;
    type: WebAssetAlertType;
  }) {
    return prisma.webAssetAlert.updateMany({
      where: whereWorkspace<Prisma.WebAssetAlertWhereInput>(input.workspaceId, {
        assetType: input.assetType,
        assetId: input.assetId,
        type: input.type,
        status: 'OPEN',
      }),
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });
  },
};

