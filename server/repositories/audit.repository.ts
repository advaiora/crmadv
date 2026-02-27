import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';

type CreateAuditLogInput = {
  action: string;
  actorUserId?: string;
  workspaceId: string;
  metadata?: Prisma.InputJsonValue;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
};

const auditListSelect = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  metadata: true,
  createdAt: true,
  actorUser: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

const BUSINESS_ACTION_PREFIXES = [
  'clients.',
  'projects.',
  'checklists.',
  'quotes.',
  'web.',
  'web_assets.',
  'branding.',
  'role.',
  'modules.',
] as const;

const TECHNICAL_ACTION_PREFIXES = ['auth.', 'me.', 'rbac.', 'debug.'] as const;
const TECHNICAL_ACTION_SUFFIXES = ['.list', '.view', '.preview', '.pdf'] as const;

const isBusinessAction = (action: string) => {
  if (!action) {
    return false;
  }

  if (TECHNICAL_ACTION_PREFIXES.some((prefix) => action.startsWith(prefix))) {
    return false;
  }

  if (TECHNICAL_ACTION_SUFFIXES.some((suffix) => action.endsWith(suffix))) {
    return false;
  }

  return BUSINESS_ACTION_PREFIXES.some((prefix) => action.startsWith(prefix));
};

export const auditRepository = {
  create(input: CreateAuditLogInput) {
    return prisma.auditLog.create({
      data: {
        action: input.action,
        actorUserId: input.actorUserId,
        workspaceId: input.workspaceId,
        metadata: input.metadata,
        entityType: input.entityType,
        entityId: input.entityId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
      select: {
        id: true,
      },
    });
  },

  listRecentByWorkspace(workspaceId: string, limit = 6) {
    return prisma.auditLog.findMany({
      where: {
        workspaceId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: Math.max(1, Math.min(limit, 20)),
      select: auditListSelect,
    });
  },

  async listRecentBusinessByWorkspace(workspaceId: string, limit = 6) {
    const safeLimit = Math.max(1, Math.min(limit, 20));
    const fetchLimit = Math.max(24, safeLimit * 4);

    const items = await prisma.auditLog.findMany({
      where: {
        workspaceId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: fetchLimit,
      select: auditListSelect,
    });

    return items.filter((item) => isBusinessAction(item.action)).slice(0, safeLimit);
  },

  async listWebAssetActivityByWorkspace(input: {
    workspaceId: string;
    page: number;
    pageSize: number;
    action?: string;
    assetId?: string;
  }) {
    const page = Math.max(1, Math.floor(input.page || 1));
    const pageSize = Math.max(1, Math.min(Math.floor(input.pageSize || 20), 100));
    const where: Prisma.AuditLogWhereInput = {
      workspaceId: input.workspaceId,
      ...(input.action
        ? { action: input.action }
        : {
            OR: [
              { action: { startsWith: 'web.' } },
              { action: { startsWith: 'web_assets.' } },
            ],
          }),
      ...(input.assetId
        ? {
            entityType: 'web_asset',
            entityId: input.assetId,
          }
        : {}),
    };

    const [totalItems, items] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: auditListSelect,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(page, totalPages);

    return {
      items,
      pageInfo: {
        page: safePage,
        pageSize,
        totalItems,
        totalPages,
        hasPrevPage: safePage > 1,
        hasNextPage: safePage < totalPages,
      },
    };
  },
};
