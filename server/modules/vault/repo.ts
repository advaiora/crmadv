import { prisma } from '../../prisma.js';
import type {
  CreateVaultItemInput,
  ListVaultItemsInput,
  ListVaultItemsResult,
  UpdateVaultItemInput,
  VaultItemMeta,
  VaultItemRecord,
} from './types.js';

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

const clampListLimit = (value: number | undefined): number => {
  if (!Number.isFinite(value)) {
    return DEFAULT_LIST_LIMIT;
  }

  const integerValue = Math.floor(value as number);
  if (integerValue < 1) {
    return 1;
  }

  if (integerValue > MAX_LIST_LIMIT) {
    return MAX_LIST_LIMIT;
  }

  return integerValue;
};

const metaSelect = {
  id: true,
  name: true,
  username: true,
  url: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
} as const;

const recordSelect = {
  ...metaSelect,
  workspaceId: true,
  ciphertext: true,
  iv: true,
  authTag: true,
  version: true,
  createdByUserId: true,
  updatedByUserId: true,
} as const;

const mapMeta = (item: {
  id: string;
  name: string;
  username: string | null;
  url: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}): VaultItemMeta => ({
  id: item.id,
  name: item.name,
  username: item.username,
  url: item.url,
  tags: [...item.tags],
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

const mapRecord = (item: {
  id: string;
  workspaceId: string;
  name: string;
  username: string | null;
  url: string | null;
  tags: string[];
  ciphertext: string;
  iv: string;
  authTag: string;
  version: number;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): VaultItemRecord => ({
  id: item.id,
  workspaceId: item.workspaceId,
  name: item.name,
  username: item.username,
  url: item.url,
  tags: [...item.tags],
  ciphertext: item.ciphertext,
  iv: item.iv,
  authTag: item.authTag,
  version: item.version,
  createdByUserId: item.createdByUserId,
  updatedByUserId: item.updatedByUserId,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

export const vaultRepo = {
  async listVaultItems(
    workspaceId: string,
    options: ListVaultItemsInput = {},
  ): Promise<ListVaultItemsResult> {
    const limit = clampListLimit(options.limit);
    const normalizedSearch = options.search?.trim() || undefined;
    const normalizedTag = options.tag?.trim() || undefined;
    const normalizedCursor = options.cursor?.trim() || undefined;

    const items = await prisma.vaultItem.findMany({
      where: {
        workspaceId,
        ...(normalizedSearch
          ? {
              OR: [
                {
                  name: {
                    contains: normalizedSearch,
                    mode: 'insensitive',
                  },
                },
                {
                  username: {
                    contains: normalizedSearch,
                    mode: 'insensitive',
                  },
                },
                {
                  url: {
                    contains: normalizedSearch,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
        ...(normalizedTag
          ? {
              tags: {
                has: normalizedTag,
              },
            }
          : {}),
      },
      orderBy: [
        { updatedAt: 'desc' },
        { id: 'desc' },
      ],
      ...(normalizedCursor
        ? {
            cursor: { id: normalizedCursor },
            skip: 1,
          }
        : {}),
      take: limit + 1,
      select: metaSelect,
    });

    const hasMore = items.length > limit;
    const pageItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? pageItems[pageItems.length - 1]?.id ?? null : null;

    return {
      items: pageItems.map(mapMeta),
      nextCursor,
    };
  },

  async getVaultItemById(workspaceId: string, id: string): Promise<VaultItemRecord | null> {
    const item = await prisma.vaultItem.findFirst({
      where: {
        workspaceId,
        id,
      },
      select: recordSelect,
    });

    return item ? mapRecord(item) : null;
  },

  async createVaultItem(workspaceId: string, data: CreateVaultItemInput): Promise<VaultItemRecord> {
    const item = await prisma.vaultItem.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        workspaceId,
        name: data.name,
        username: data.username ?? null,
        url: data.url ?? null,
        tags: data.tags ?? [],
        ciphertext: data.payload.ciphertext,
        iv: data.payload.iv,
        authTag: data.payload.authTag,
        version: data.payload.version,
        createdByUserId: data.actorUserId ?? null,
        updatedByUserId: data.actorUserId ?? null,
      },
      select: recordSelect,
    });

    return mapRecord(item);
  },

  async updateVaultItem(
    workspaceId: string,
    id: string,
    data: UpdateVaultItemInput,
  ): Promise<VaultItemRecord | null> {
    const updated = await prisma.vaultItem.updateMany({
      where: {
        workspaceId,
        id,
      },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.username !== undefined ? { username: data.username } : {}),
        ...(data.url !== undefined ? { url: data.url } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
        ...(data.payload
          ? {
              ciphertext: data.payload.ciphertext,
              iv: data.payload.iv,
              authTag: data.payload.authTag,
              version: data.payload.version,
            }
          : {}),
        ...(data.actorUserId !== undefined ? { updatedByUserId: data.actorUserId } : {}),
      },
    });

    if (updated.count === 0) {
      return null;
    }

    return this.getVaultItemById(workspaceId, id);
  },

  async deleteVaultItem(workspaceId: string, id: string): Promise<boolean> {
    const deleted = await prisma.vaultItem.deleteMany({
      where: {
        workspaceId,
        id,
      },
    });

    return deleted.count > 0;
  },
};
