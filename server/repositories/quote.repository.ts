import { Prisma, type QuoteStatus } from '@prisma/client';
import { prisma } from '../prisma.js';

export type QuotesSort = 'createdAt_desc' | 'createdAt_asc';

type ListQuotesInput = {
  workspaceId: string;
  status?: QuoteStatus;
  q?: string;
  limit: number;
  cursor?: string;
  sort: QuotesSort;
};

type QuoteLineWriteInput = {
  title: string;
  qty: number;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  order: number | null;
};

type CreateQuoteInput = {
  clientId: string | null;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  notes: string | null;
  total: Prisma.Decimal;
  lines: QuoteLineWriteInput[];
};

type UpdateQuoteInput = {
  clientId?: string | null;
  clientName?: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  notes?: string | null;
};

type UpdateQuoteLineInput = {
  title?: string;
  qty?: number;
  unitPrice?: Prisma.Decimal;
  lineTotal?: Prisma.Decimal;
  order?: number | null;
};

const quoteListSelect: Prisma.QuoteSelect = {
  id: true,
  workspaceId: true,
  status: true,
  total: true,
  notes: true,
  clientId: true,
  clientName: true,
  createdAt: true,
  updatedAt: true,
  client: {
    select: {
      id: true,
      name: true,
    },
  },
  _count: {
    select: {
      lines: true,
    },
  },
};

const quoteDetailSelect: Prisma.QuoteSelect = {
  id: true,
  workspaceId: true,
  status: true,
  total: true,
  notes: true,
  clientId: true,
  clientName: true,
  clientEmail: true,
  clientPhone: true,
  createdAt: true,
  updatedAt: true,
  client: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
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

const quoteStatusSelect: Prisma.QuoteSelect = {
  id: true,
  workspaceId: true,
  status: true,
};

const quoteSearchWhere = (q: string): Prisma.QuoteWhereInput => ({
  OR: [
    {
      id: {
        contains: q,
      },
    },
    {
      notes: {
        contains: q,
        mode: 'insensitive',
      },
    },
    {
      clientName: {
        contains: q,
        mode: 'insensitive',
      },
    },
    {
      clientEmail: {
        contains: q,
        mode: 'insensitive',
      },
    },
    {
      clientPhone: {
        contains: q,
        mode: 'insensitive',
      },
    },
    {
      client: {
        OR: [
          {
            name: {
              contains: q,
              mode: 'insensitive',
            },
          },
          {
            email: {
              contains: q,
              mode: 'insensitive',
            },
          },
          {
            phone: {
              contains: q,
              mode: 'insensitive',
            },
          },
        ],
      },
    },
  ],
});

export const quoteRepository = {
  findClientById(workspaceId: string, clientId: string) {
    return prisma.client.findFirst({
      where: {
        workspaceId,
        id: clientId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    });
  },

  async listQuotes(input: ListQuotesInput) {
    const cursorRecord = input.cursor
      ? await prisma.quote.findFirst({
          where: {
            workspaceId: input.workspaceId,
            id: input.cursor,
          },
          select: {
            id: true,
            createdAt: true,
          },
        })
      : null;

    const whereConditions: Prisma.QuoteWhereInput[] = [
      {
        workspaceId: input.workspaceId,
      },
      ...(input.status ? [{ status: input.status }] : []),
      ...(input.q ? [quoteSearchWhere(input.q)] : []),
    ];

    if (input.cursor) {
      if (!cursorRecord) {
        return {
          invalidCursor: true as const,
          items: [],
          hasMore: false,
          nextCursor: null,
        };
      }

      if (input.sort === 'createdAt_desc') {
        whereConditions.push({
          OR: [
            {
              createdAt: {
                lt: cursorRecord.createdAt,
              },
            },
            {
              createdAt: cursorRecord.createdAt,
              id: {
                lt: cursorRecord.id,
              },
            },
          ],
        });
      } else {
        whereConditions.push({
          OR: [
            {
              createdAt: {
                gt: cursorRecord.createdAt,
              },
            },
            {
              createdAt: cursorRecord.createdAt,
              id: {
                gt: cursorRecord.id,
              },
            },
          ],
        });
      }
    }

    const items = await prisma.quote.findMany({
      where: {
        AND: whereConditions,
      },
      select: quoteListSelect,
      orderBy:
        input.sort === 'createdAt_desc'
          ? [{ createdAt: 'desc' }, { id: 'desc' }]
          : [{ createdAt: 'asc' }, { id: 'asc' }],
      take: input.limit + 1,
    });

    const hasMore = items.length > input.limit;
    const pageItems = hasMore ? items.slice(0, input.limit) : items;
    const nextCursor = hasMore ? pageItems[pageItems.length - 1]?.id ?? null : null;

    return {
      invalidCursor: false as const,
      items: pageItems,
      hasMore,
      nextCursor,
    };
  },

  findQuoteById(workspaceId: string, quoteId: string) {
    return prisma.quote.findFirst({
      where: {
        workspaceId,
        id: quoteId,
      },
      select: quoteDetailSelect,
    });
  },

  findQuoteStatus(workspaceId: string, quoteId: string) {
    return prisma.quote.findFirst({
      where: {
        workspaceId,
        id: quoteId,
      },
      select: quoteStatusSelect,
    });
  },

  async createQuoteWithLines(workspaceId: string, input: CreateQuoteInput) {
    return prisma.$transaction(async (tx) => {
      const quote = await tx.quote.create({
        data: {
          workspaceId,
          clientId: input.clientId,
          clientName: input.clientName,
          clientEmail: input.clientEmail,
          clientPhone: input.clientPhone,
          status: 'draft',
          notes: input.notes,
          total: input.total,
        },
        select: {
          id: true,
        },
      });

      if (input.lines.length > 0) {
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
      }

      return tx.quote.findFirst({
        where: {
          workspaceId,
          id: quote.id,
        },
        select: quoteDetailSelect,
      });
    });
  },

  async updateDraftQuote(workspaceId: string, quoteId: string, data: UpdateQuoteInput) {
    const result = await prisma.quote.updateMany({
      where: {
        workspaceId,
        id: quoteId,
        status: 'draft',
      },
      data,
    });

    return result.count;
  },

  async deleteDraftQuote(workspaceId: string, quoteId: string) {
    const result = await prisma.quote.deleteMany({
      where: {
        workspaceId,
        id: quoteId,
        status: 'draft',
      },
    });

    return result.count;
  },

  async transitionQuoteStatus(
    workspaceId: string,
    quoteId: string,
    from: QuoteStatus,
    to: QuoteStatus,
  ) {
    const result = await prisma.quote.updateMany({
      where: {
        workspaceId,
        id: quoteId,
        status: from,
      },
      data: {
        status: to,
      },
    });

    return result.count;
  },

  findLineById(workspaceId: string, quoteId: string, lineId: string) {
    return prisma.quoteLine.findFirst({
      where: {
        id: lineId,
        quoteId,
        quote: {
          workspaceId,
        },
      },
      select: {
        id: true,
        quoteId: true,
        title: true,
        qty: true,
        unitPrice: true,
        lineTotal: true,
        order: true,
      },
    });
  },

  async addLineToDraftQuote(
    workspaceId: string,
    quoteId: string,
    line: QuoteLineWriteInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const lock = await tx.quote.updateMany({
        where: {
          workspaceId,
          id: quoteId,
          status: 'draft',
        },
        data: {
          updatedAt: new Date(),
        },
      });

      if (lock.count === 0) {
        return null;
      }

      const createdLine = await tx.quoteLine.create({
        data: {
          quoteId,
          title: line.title,
          qty: line.qty,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
          order: line.order,
        },
        select: {
          id: true,
        },
      });

      const sum = await tx.quoteLine.aggregate({
        where: {
          quoteId,
          quote: {
            workspaceId,
          },
        },
        _sum: {
          lineTotal: true,
        },
      });

      await tx.quote.updateMany({
        where: {
          workspaceId,
          id: quoteId,
          status: 'draft',
        },
        data: {
          total: sum._sum.lineTotal ?? new Prisma.Decimal(0),
        },
      });

      const quote = await tx.quote.findFirst({
        where: {
          workspaceId,
          id: quoteId,
        },
        select: quoteDetailSelect,
      });

      return {
        quote,
        lineId: createdLine.id,
      };
    });
  },

  async updateLineOnDraftQuote(
    workspaceId: string,
    quoteId: string,
    lineId: string,
    data: UpdateQuoteLineInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const lock = await tx.quote.updateMany({
        where: {
          workspaceId,
          id: quoteId,
          status: 'draft',
        },
        data: {
          updatedAt: new Date(),
        },
      });

      if (lock.count === 0) {
        return null;
      }

      const lineUpdate = await tx.quoteLine.updateMany({
        where: {
          id: lineId,
          quoteId,
          quote: {
            workspaceId,
          },
        },
        data,
      });

      if (lineUpdate.count === 0) {
        return {
          quote: null,
          lineUpdated: false,
        } as const;
      }

      const sum = await tx.quoteLine.aggregate({
        where: {
          quoteId,
          quote: {
            workspaceId,
          },
        },
        _sum: {
          lineTotal: true,
        },
      });

      await tx.quote.updateMany({
        where: {
          workspaceId,
          id: quoteId,
          status: 'draft',
        },
        data: {
          total: sum._sum.lineTotal ?? new Prisma.Decimal(0),
        },
      });

      const quote = await tx.quote.findFirst({
        where: {
          workspaceId,
          id: quoteId,
        },
        select: quoteDetailSelect,
      });

      return {
        quote,
        lineUpdated: true,
      } as const;
    });
  },

  async deleteLineFromDraftQuote(workspaceId: string, quoteId: string, lineId: string) {
    return prisma.$transaction(async (tx) => {
      const lock = await tx.quote.updateMany({
        where: {
          workspaceId,
          id: quoteId,
          status: 'draft',
        },
        data: {
          updatedAt: new Date(),
        },
      });

      if (lock.count === 0) {
        return null;
      }

      const deleted = await tx.quoteLine.deleteMany({
        where: {
          id: lineId,
          quoteId,
          quote: {
            workspaceId,
          },
        },
      });

      if (deleted.count === 0) {
        return {
          quote: null,
          lineDeleted: false,
        } as const;
      }

      const sum = await tx.quoteLine.aggregate({
        where: {
          quoteId,
          quote: {
            workspaceId,
          },
        },
        _sum: {
          lineTotal: true,
        },
      });

      await tx.quote.updateMany({
        where: {
          workspaceId,
          id: quoteId,
          status: 'draft',
        },
        data: {
          total: sum._sum.lineTotal ?? new Prisma.Decimal(0),
        },
      });

      const quote = await tx.quote.findFirst({
        where: {
          workspaceId,
          id: quoteId,
        },
        select: quoteDetailSelect,
      });

      return {
        quote,
        lineDeleted: true,
      } as const;
    });
  },
};
