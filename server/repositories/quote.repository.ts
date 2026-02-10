import type { Prisma, QuoteStatus } from '@prisma/client';
import { prisma } from '../prisma.js';

const quoteSelect: Prisma.QuoteSelect = {
  id: true,
  workspaceId: true,
  clientId: true,
  clientName: true,
  clientEmail: true,
  clientPhone: true,
  status: true,
  total: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  lines: {
    select: {
      id: true,
      quoteId: true,
      title: true,
      qty: true,
      unitPrice: true,
      lineTotal: true,
      order: true,
    },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  },
};

export type QuoteRecord = Awaited<ReturnType<typeof quoteRepository.findById>>;

type QuoteLineCreateInput = {
  title: string;
  qty: number;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  order: number | null;
};

type CreateQuoteInput = {
  notes: string | null;
  total: Prisma.Decimal;
  lines: QuoteLineCreateInput[];
  clientName: string;
};

type UpdateQuoteInput = {
  notes: string | null;
  total: Prisma.Decimal;
  lines: QuoteLineCreateInput[];
};

type QuoteFilters = {
  status?: QuoteStatus;
  q?: string;
};

export const quoteRepository = {
  list(workspaceId: string, filters: QuoteFilters) {
    const where: Prisma.QuoteWhereInput = {
      workspaceId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.q
        ? {
            OR: [
              {
                id: {
                  contains: filters.q,
                },
              },
              {
                notes: {
                  contains: filters.q,
                  mode: 'insensitive',
                },
              },
              {
                lines: {
                  some: {
                    title: {
                      contains: filters.q,
                      mode: 'insensitive',
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    return prisma.quote.findMany({
      where,
      select: quoteSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  },

  findById(workspaceId: string, quoteId: string) {
    return prisma.quote.findFirst({
      where: {
        workspaceId,
        id: quoteId,
      },
      select: quoteSelect,
    });
  },

  async createWithLines(workspaceId: string, input: CreateQuoteInput) {
    const quoteId = await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.create({
        data: {
          workspaceId,
          status: 'draft',
          notes: input.notes,
          total: input.total,
          clientName: input.clientName,
        },
        select: {
          id: true,
        },
      });

      await tx.quoteLine.createMany({
        data: input.lines.map((line) => ({
          quoteId: quote.id,
          title: line.title,
          qty: line.qty,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
          order: line.order,
        })),
      });

      return quote.id;
    });

    return this.findById(workspaceId, quoteId);
  },

  async updateWithLines(workspaceId: string, quoteId: string, input: UpdateQuoteInput) {
    await prisma.$transaction(async (tx) => {
      await tx.quote.updateMany({
        where: {
          id: quoteId,
          workspaceId,
        },
        data: {
          notes: input.notes,
          total: input.total,
        },
      });

      await tx.quoteLine.deleteMany({
        where: {
          quoteId,
          quote: {
            workspaceId,
          },
        },
      });

      await tx.quoteLine.createMany({
        data: input.lines.map((line) => ({
          quoteId,
          title: line.title,
          qty: line.qty,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
          order: line.order,
        })),
      });
    });

    return this.findById(workspaceId, quoteId);
  },

  async delete(workspaceId: string, quoteId: string): Promise<boolean> {
    const result = await prisma.quote.deleteMany({
      where: {
        id: quoteId,
        workspaceId,
      },
    });

    return result.count > 0;
  },

  async updateStatus(
    workspaceId: string,
    quoteId: string,
    nextStatus: QuoteStatus,
  ): Promise<boolean> {
    const result = await prisma.quote.updateMany({
      where: {
        workspaceId,
        id: quoteId,
      },
      data: {
        status: nextStatus,
      },
    });

    return result.count > 0;
  },
};
