import type { Prisma, WebAssetStatus } from '@prisma/client';
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
  q?: string;
  clientId?: string;
  projectId?: string;
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

const buildWebsiteWhere = (
  workspaceId: string,
  filters: WebAssetListFilters,
): Prisma.WebsiteAssetWhereInput => ({
  workspaceId,
  ...(filters.status ? { status: filters.status } : {}),
  ...(filters.clientId ? { clientId: filters.clientId } : {}),
  ...(filters.projectId ? { projectId: filters.projectId } : {}),
  ...(buildSearchWhereClause(filters.q) ?? {}),
});

const buildWebAppWhere = (
  workspaceId: string,
  filters: WebAssetListFilters,
): Prisma.WebAppAssetWhereInput => ({
  workspaceId,
  ...(filters.status ? { status: filters.status } : {}),
  ...(filters.clientId ? { clientId: filters.clientId } : {}),
  ...(filters.projectId ? { projectId: filters.projectId } : {}),
  ...(buildSearchWhereClause(filters.q) ?? {}),
});

const buildEcommerceWhere = (
  workspaceId: string,
  filters: WebAssetListFilters,
): Prisma.EcommerceAssetWhereInput => ({
  workspaceId,
  ...(filters.status ? { status: filters.status } : {}),
  ...(filters.clientId ? { clientId: filters.clientId } : {}),
  ...(filters.projectId ? { projectId: filters.projectId } : {}),
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
  ...(patch.version !== undefined ? { version: patch.version } : {}),
  ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
  ...(patch.clientId !== undefined ? { clientId: patch.clientId } : {}),
  ...(patch.projectId !== undefined ? { projectId: patch.projectId } : {}),
  ...(patch.ownerUserId !== undefined ? { ownerUserId: patch.ownerUserId } : {}),
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
        where: {
          workspaceId,
          id: assetId,
        },
        include: WEB_ASSET_RELATIONS_INCLUDE,
      }),
      prisma.webAppAsset.findFirst({
        where: {
          workspaceId,
          id: assetId,
        },
        include: WEB_ASSET_RELATIONS_INCLUDE,
      }),
      prisma.ecommerceAsset.findFirst({
        where: {
          workspaceId,
          id: assetId,
        },
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
        const updated = await prisma.websiteAsset.update({
          where: { id: assetId },
          data: patchData,
          include: WEB_ASSET_RELATIONS_INCLUDE,
        });

        return mapWebsiteRecord(updated);
      }
      case 'webapp': {
        const updated = await prisma.webAppAsset.update({
          where: { id: assetId },
          data: patchData,
          include: WEB_ASSET_RELATIONS_INCLUDE,
        });

        return mapWebAppRecord(updated);
      }
      default: {
        const updated = await prisma.ecommerceAsset.update({
          where: { id: assetId },
          data: patchData,
          include: WEB_ASSET_RELATIONS_INCLUDE,
        });

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
        const deleted = await prisma.websiteAsset.delete({
          where: { id: assetId },
          include: WEB_ASSET_RELATIONS_INCLUDE,
        });
        return mapWebsiteRecord(deleted);
      }
      case 'webapp': {
        const deleted = await prisma.webAppAsset.delete({
          where: { id: assetId },
          include: WEB_ASSET_RELATIONS_INCLUDE,
        });
        return mapWebAppRecord(deleted);
      }
      default: {
        const deleted = await prisma.ecommerceAsset.delete({
          where: { id: assetId },
          include: WEB_ASSET_RELATIONS_INCLUDE,
        });
        return mapEcommerceRecord(deleted);
      }
    }
  },

  clientExists(workspaceId: string, clientId: string) {
    return prisma.client.findFirst({
      where: {
        workspaceId,
        id: clientId,
      },
      select: { id: true },
    });
  },

  projectExists(workspaceId: string, projectId: string) {
    return prisma.project.findFirst({
      where: {
        workspaceId,
        id: projectId,
      },
      select: { id: true },
    });
  },

  userIsWorkspaceMember(workspaceId: string, userId: string) {
    return prisma.membership.findFirst({
      where: {
        workspaceId,
        userId,
      },
      select: { id: true },
    });
  },

  async listClientsForLookup(
    workspaceId: string,
    filters: WebAssetLookupFilters,
  ): Promise<WebAssetLookupItem[]> {
    const items = await prisma.client.findMany({
      where: {
        workspaceId,
        ...(filters.q
          ? {
              OR: [
                { id: { contains: filters.q, mode: 'insensitive' } },
                { name: { contains: filters.q, mode: 'insensitive' } },
                { email: { contains: filters.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
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
      where: {
        workspaceId,
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
      },
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
};

