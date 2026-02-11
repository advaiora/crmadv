import type { ClientType, Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';

export type ClientSortField = 'name' | 'createdAt' | 'updatedAt';
export type ClientSortDirection = 'asc' | 'desc';

type ListClientsInput = {
  workspaceId: string;
  query?: string;
  type?: ClientType;
  page: number;
  pageSize: number;
  sortField: ClientSortField;
  sortDirection: ClientSortDirection;
};

type ExportClientsInput = {
  workspaceId: string;
  query?: string;
  type?: ClientType;
  sortField: ClientSortField;
  sortDirection: ClientSortDirection;
};

type CreateClientInput = {
  type: ClientType;
  name: string;
  email: string | null;
  phone: string | null;
  vatNumber: string | null;
  taxCode: string | null;
  street: string | null;
  city: string | null;
  zip: string | null;
  province: string | null;
  country: string | null;
  notes: string | null;
  tags: string[];
};

type UpdateClientInput = Partial<CreateClientInput>;

const clientSelect = {
  id: true,
  workspaceId: true,
  type: true,
  name: true,
  email: true,
  phone: true,
  vatNumber: true,
  taxCode: true,
  street: true,
  city: true,
  zip: true,
  province: true,
  country: true,
  notes: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
} as const;

const buildSearchWhere = (query: string): Prisma.ClientWhereInput => ({
  OR: [
    {
      name: {
        contains: query,
        mode: 'insensitive',
      },
    },
    {
      email: {
        contains: query,
        mode: 'insensitive',
      },
    },
    {
      phone: {
        contains: query,
        mode: 'insensitive',
      },
    },
  ],
});

export const clientsRepository = {
  async listClients(input: ListClientsInput) {
    const skip = (input.page - 1) * input.pageSize;
    const where: Prisma.ClientWhereInput = {
      workspaceId: input.workspaceId,
      ...(input.type ? { type: input.type } : {}),
      ...(input.query ? buildSearchWhere(input.query) : {}),
    };

    const orderBy: Prisma.ClientOrderByWithRelationInput[] = [
      { [input.sortField]: input.sortDirection },
      { id: input.sortDirection },
    ];

    const [items, total] = await prisma.$transaction([
      prisma.client.findMany({
        where,
        select: clientSelect,
        orderBy,
        skip,
        take: input.pageSize,
      }),
      prisma.client.count({
        where,
      }),
    ]);

    return {
      items,
      total,
    };
  },

  listForExport(input: ExportClientsInput) {
    const where: Prisma.ClientWhereInput = {
      workspaceId: input.workspaceId,
      ...(input.type ? { type: input.type } : {}),
      ...(input.query ? buildSearchWhere(input.query) : {}),
    };

    const orderBy: Prisma.ClientOrderByWithRelationInput[] = [
      { [input.sortField]: input.sortDirection },
      { id: input.sortDirection },
    ];

    return prisma.client.findMany({
      where,
      select: clientSelect,
      orderBy,
    });
  },

  findById(workspaceId: string, id: string) {
    return prisma.client.findFirst({
      where: {
        workspaceId,
        id,
      },
      select: clientSelect,
    });
  },

  create(workspaceId: string, input: CreateClientInput) {
    return prisma.client.create({
      data: {
        workspaceId,
        type: input.type,
        name: input.name,
        email: input.email,
        phone: input.phone,
        vatNumber: input.vatNumber,
        taxCode: input.taxCode,
        street: input.street,
        city: input.city,
        zip: input.zip,
        province: input.province,
        country: input.country,
        notes: input.notes,
        tags: input.tags,
      },
      select: clientSelect,
    });
  },

  async update(workspaceId: string, id: string, input: UpdateClientInput) {
    const updated = await prisma.client.updateMany({
      where: {
        workspaceId,
        id,
      },
      data: input,
    });

    if (updated.count === 0) {
      return null;
    }

    return this.findById(workspaceId, id);
  },

  delete(workspaceId: string, id: string) {
    return prisma.client.deleteMany({
      where: {
        workspaceId,
        id,
      },
    });
  },
};
