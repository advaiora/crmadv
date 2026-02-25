import { Prisma, type QuoteDiscountType, type QuoteStatus } from '@prisma/client';
import { prisma } from '../../prisma.js';

export type QuoteListFilters = {
  status?: QuoteStatus;
  clientId?: string;
  projectId?: string;
  q?: string;
  createdFrom?: Date;
  createdTo?: Date;
  page: number;
  pageSize: number;
};

export type QuoteItemWriteInput = {
  position: number;
  title: string;
  description: string | null;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discountType: QuoteDiscountType | null;
  discountValue: Prisma.Decimal | null;
  lineTotal: Prisma.Decimal;
};

export type QuoteWriteInput = {
  clientId: string;
  projectId: string | null;
  templateId: string | null;
  createdByUserId: string | null;
  status: QuoteStatus;
  currency: string;
  subtotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  total: Prisma.Decimal;
  taxRate: Prisma.Decimal | null;
  issueDate: Date | null;
  validUntil: Date | null;
  notes: string | null;
  internalNotes: string | null;
};

export type QuoteTemplateItemWriteInput = {
  position: number;
  title: string;
  description: string | null;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discountType: QuoteDiscountType | null;
  discountValue: Prisma.Decimal | null;
};

export type QuoteTemplateWriteInput = {
  name: string;
  description: string | null;
  defaultNotes: string | null;
  items: QuoteTemplateItemWriteInput[];
};

export type QuoteTemplatePatchInput = {
  name?: string;
  description?: string | null;
  defaultNotes?: string | null;
};

export type QuoteLookupFilters = {
  q?: string;
  clientId?: string;
  limit: number;
  createdFrom?: Date;
  createdTo?: Date;
};

export type QuoteNotificationSettingsWriteInput = {
  enabled?: boolean;
  sentSubject?: string | null;
  sentBody?: string | null;
  acceptedSubject?: string | null;
  acceptedBody?: string | null;
  rejectedSubject?: string | null;
  rejectedBody?: string | null;
};

const quoteItemSelect = Prisma.validator<Prisma.QuoteItemSelect>()({
  id: true,
  workspaceId: true,
  quoteId: true,
  position: true,
  title: true,
  description: true,
  quantity: true,
  unitPrice: true,
  discountType: true,
  discountValue: true,
  lineTotal: true,
  createdAt: true,
  updatedAt: true,
});

const quoteSummarySelect = Prisma.validator<Prisma.QuoteSelect>()({
  id: true,
  workspaceId: true,
  clientId: true,
  projectId: true,
  templateId: true,
  status: true,
  currency: true,
  subtotal: true,
  taxTotal: true,
  total: true,
  taxRate: true,
  issueDate: true,
  validUntil: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
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
});

const quoteDetailSelect = Prisma.validator<Prisma.QuoteSelect>()({
  id: true,
  workspaceId: true,
  clientId: true,
  projectId: true,
  templateId: true,
  createdByUserId: true,
  status: true,
  currency: true,
  subtotal: true,
  taxTotal: true,
  total: true,
  taxRate: true,
  issueDate: true,
  validUntil: true,
  notes: true,
  internalNotes: true,
  createdAt: true,
  updatedAt: true,
  client: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      street: true,
      city: true,
      zip: true,
      province: true,
      country: true,
    },
  },
  project: {
    select: {
      id: true,
      name: true,
    },
  },
  template: {
    select: {
      id: true,
      name: true,
    },
  },
  items: {
    select: quoteItemSelect,
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
  },
});

const quoteStatusSelect = Prisma.validator<Prisma.QuoteSelect>()({
  id: true,
  status: true,
});

const quoteTemplateItemSelect = Prisma.validator<Prisma.QuoteTemplateItemSelect>()({
  id: true,
  workspaceId: true,
  templateId: true,
  position: true,
  title: true,
  description: true,
  quantity: true,
  unitPrice: true,
  discountType: true,
  discountValue: true,
  createdAt: true,
  updatedAt: true,
});

const quoteTemplateSummarySelect = Prisma.validator<Prisma.QuoteTemplateSelect>()({
  id: true,
  workspaceId: true,
  name: true,
  description: true,
  defaultNotes: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      items: true,
    },
  },
});

const quoteTemplateDetailSelect = Prisma.validator<Prisma.QuoteTemplateSelect>()({
  id: true,
  workspaceId: true,
  name: true,
  description: true,
  defaultNotes: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: quoteTemplateItemSelect,
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
  },
});

const quoteNotificationSettingsSelect = Prisma.validator<Prisma.QuoteNotificationSettingsSelect>()({
  id: true,
  workspaceId: true,
  enabled: true,
  sentSubject: true,
  sentBody: true,
  acceptedSubject: true,
  acceptedBody: true,
  rejectedSubject: true,
  rejectedBody: true,
  createdAt: true,
  updatedAt: true,
});

export type QuoteSummaryRecord = Prisma.QuoteGetPayload<{
  select: typeof quoteSummarySelect;
}>;

export type QuoteDetailRecord = Prisma.QuoteGetPayload<{
  select: typeof quoteDetailSelect;
}>;

export type QuoteStatusRecord = Prisma.QuoteGetPayload<{
  select: typeof quoteStatusSelect;
}>;

export type QuoteTemplateSummaryRecord = Prisma.QuoteTemplateGetPayload<{
  select: typeof quoteTemplateSummarySelect;
}>;

export type QuoteTemplateDetailRecord = Prisma.QuoteTemplateGetPayload<{
  select: typeof quoteTemplateDetailSelect;
}>;

export type QuoteLookupRecord = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  createdAt?: Date;
};

export type QuoteNotificationSettingsRecord = Prisma.QuoteNotificationSettingsGetPayload<{
  select: typeof quoteNotificationSettingsSelect;
}>;

export type QuotesRepository = {
  clientExists(workspaceId: string, clientId: string): Promise<{ id: string } | null>;
  projectExists(workspaceId: string, projectId: string): Promise<{ id: string } | null>;
  listQuotes(
    workspaceId: string,
    filters: QuoteListFilters,
  ): Promise<{ items: QuoteSummaryRecord[]; total: number }>;
  listClientsForLookup(workspaceId: string, filters: QuoteLookupFilters): Promise<QuoteLookupRecord[]>;
  listProjectsForLookup(workspaceId: string, filters: QuoteLookupFilters): Promise<QuoteLookupRecord[]>;
  findQuoteById(workspaceId: string, quoteId: string): Promise<QuoteDetailRecord | null>;
  findQuoteStatus(workspaceId: string, quoteId: string): Promise<QuoteStatusRecord | null>;
  createQuote(
    workspaceId: string,
    quote: QuoteWriteInput,
    items: QuoteItemWriteInput[],
  ): Promise<QuoteDetailRecord | null>;
  updateQuoteAndItems(
    workspaceId: string,
    quoteId: string,
    quotePatch: Partial<QuoteWriteInput>,
    nextItems: QuoteItemWriteInput[] | undefined,
  ): Promise<QuoteDetailRecord | null>;
  transitionQuoteStatus(
    workspaceId: string,
    quoteId: string,
    from: QuoteStatus,
    to: QuoteStatus,
  ): Promise<{ count: number }>;
  deleteDraftQuote(workspaceId: string, quoteId: string): Promise<{ count: number }>;
  listTemplates(workspaceId: string): Promise<QuoteTemplateSummaryRecord[]>;
  findTemplateById(workspaceId: string, templateId: string): Promise<QuoteTemplateDetailRecord | null>;
  createTemplate(workspaceId: string, input: QuoteTemplateWriteInput): Promise<QuoteTemplateDetailRecord>;
  updateTemplate(
    workspaceId: string,
    templateId: string,
    patch: QuoteTemplatePatchInput,
    nextItems: QuoteTemplateItemWriteInput[] | undefined,
  ): Promise<QuoteTemplateDetailRecord | null>;
  deleteTemplate(workspaceId: string, templateId: string): Promise<{ count: number }>;
  getNotificationSettings(workspaceId: string): Promise<QuoteNotificationSettingsRecord | null>;
  upsertNotificationSettings(
    workspaceId: string,
    input: QuoteNotificationSettingsWriteInput,
  ): Promise<QuoteNotificationSettingsRecord>;
};

export const quotesRepository: QuotesRepository = {
  clientExists(workspaceId: string, clientId: string) {
    return prisma.client.findFirst({
      where: {
        workspaceId,
        id: clientId,
      },
      select: {
        id: true,
      },
    });
  },

  projectExists(workspaceId: string, projectId: string) {
    return prisma.project.findFirst({
      where: {
        workspaceId,
        id: projectId,
      },
      select: {
        id: true,
      },
    });
  },

  async listQuotes(workspaceId: string, filters: QuoteListFilters) {
    const where: Prisma.QuoteWhereInput = {
      workspaceId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.q
        ? {
            OR: [
              {
                id: {
                  contains: filters.q,
                  mode: 'insensitive',
                },
              },
              {
                client: {
                  name: {
                    contains: filters.q,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
      ...((filters.createdFrom || filters.createdTo)
        ? {
            createdAt: {
              ...(filters.createdFrom ? { gte: filters.createdFrom } : {}),
              ...(filters.createdTo ? { lte: filters.createdTo } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.quote.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        select: quoteSummarySelect,
      }),
      prisma.quote.count({ where }),
    ]);

    return {
      items,
      total,
    };
  },

  listClientsForLookup(workspaceId: string, filters: QuoteLookupFilters) {
    return prisma.client.findMany({
      where: {
        workspaceId,
        ...(filters.q
          ? {
              OR: [
                {
                  id: {
                    contains: filters.q,
                    mode: 'insensitive',
                  },
                },
                {
                  name: {
                    contains: filters.q,
                    mode: 'insensitive',
                  },
                },
                {
                  email: {
                    contains: filters.q,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
        ...((filters.createdFrom || filters.createdTo)
          ? {
              createdAt: {
                ...(filters.createdFrom ? { gte: filters.createdFrom } : {}),
                ...(filters.createdTo ? { lte: filters.createdTo } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: filters.limit,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    });
  },

  listProjectsForLookup(workspaceId: string, filters: QuoteLookupFilters) {
    return prisma.project.findMany({
      where: {
        workspaceId,
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
        ...(filters.q
          ? {
              OR: [
                {
                  id: {
                    contains: filters.q,
                    mode: 'insensitive',
                  },
                },
                {
                  name: {
                    contains: filters.q,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
        ...((filters.createdFrom || filters.createdTo)
          ? {
              createdAt: {
                ...(filters.createdFrom ? { gte: filters.createdFrom } : {}),
                ...(filters.createdTo ? { lte: filters.createdTo } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: filters.limit,
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });
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

  createQuote(workspaceId: string, quote: QuoteWriteInput, items: QuoteItemWriteInput[]) {
    return prisma.$transaction(async (tx) => {
      const created = await tx.quote.create({
        data: {
          workspaceId,
          clientId: quote.clientId,
          projectId: quote.projectId,
          templateId: quote.templateId,
          createdByUserId: quote.createdByUserId,
          status: quote.status,
          currency: quote.currency,
          subtotal: quote.subtotal,
          taxTotal: quote.taxTotal,
          total: quote.total,
          taxRate: quote.taxRate,
          issueDate: quote.issueDate,
          validUntil: quote.validUntil,
          notes: quote.notes,
          internalNotes: quote.internalNotes,
        },
        select: {
          id: true,
        },
      });

      if (items.length > 0) {
        await tx.quoteItem.createMany({
          data: items.map((item) => ({
            workspaceId,
            quoteId: created.id,
            position: item.position,
            title: item.title,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountType: item.discountType,
            discountValue: item.discountValue,
            lineTotal: item.lineTotal,
          })),
        });
      }

      return tx.quote.findFirst({
        where: {
          workspaceId,
          id: created.id,
        },
        select: quoteDetailSelect,
      });
    });
  },

  updateQuoteAndItems(
    workspaceId: string,
    quoteId: string,
    quotePatch: Partial<QuoteWriteInput>,
    nextItems: QuoteItemWriteInput[] | undefined,
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.quote.findFirst({
        where: {
          workspaceId,
          id: quoteId,
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
        return null;
      }

      if (Object.keys(quotePatch).length > 0) {
        await tx.quote.update({
          where: {
            id: existing.id,
          },
          data: quotePatch,
        });
      }

      if (nextItems !== undefined) {
        await tx.quoteItem.deleteMany({
          where: {
            workspaceId,
            quoteId: existing.id,
          },
        });

        if (nextItems.length > 0) {
          await tx.quoteItem.createMany({
            data: nextItems.map((item) => ({
              workspaceId,
              quoteId: existing.id,
              position: item.position,
              title: item.title,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountType: item.discountType,
              discountValue: item.discountValue,
              lineTotal: item.lineTotal,
            })),
          });
        }
      }

      return tx.quote.findFirst({
        where: {
          workspaceId,
          id: existing.id,
        },
        select: quoteDetailSelect,
      });
    });
  },

  transitionQuoteStatus(
    workspaceId: string,
    quoteId: string,
    from: QuoteStatus,
    to: QuoteStatus,
  ) {
    return prisma.quote.updateMany({
      where: {
        workspaceId,
        id: quoteId,
        status: from,
      },
      data: {
        status: to,
      },
    });
  },

  deleteDraftQuote(workspaceId: string, quoteId: string) {
    return prisma.quote.deleteMany({
      where: {
        workspaceId,
        id: quoteId,
        status: 'DRAFT',
      },
    });
  },

  listTemplates(workspaceId: string) {
    return prisma.quoteTemplate.findMany({
      where: {
        workspaceId,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      select: quoteTemplateSummarySelect,
    });
  },

  findTemplateById(workspaceId: string, templateId: string) {
    return prisma.quoteTemplate.findFirst({
      where: {
        workspaceId,
        id: templateId,
      },
      select: quoteTemplateDetailSelect,
    });
  },

  createTemplate(workspaceId: string, input: QuoteTemplateWriteInput) {
    return prisma.quoteTemplate.create({
      data: {
        workspaceId,
        name: input.name,
        description: input.description,
        defaultNotes: input.defaultNotes,
        ...(input.items.length > 0
          ? {
              items: {
                create: input.items.map((item) => ({
                  workspaceId,
                  position: item.position,
                  title: item.title,
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  discountType: item.discountType,
                  discountValue: item.discountValue,
                })),
              },
            }
          : {}),
      },
      select: quoteTemplateDetailSelect,
    });
  },

  updateTemplate(
    workspaceId: string,
    templateId: string,
    patch: QuoteTemplatePatchInput,
    nextItems: QuoteTemplateItemWriteInput[] | undefined,
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.quoteTemplate.findFirst({
        where: {
          workspaceId,
          id: templateId,
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
        return null;
      }

      if (Object.keys(patch).length > 0) {
        await tx.quoteTemplate.update({
          where: {
            id: existing.id,
          },
          data: patch,
        });
      }

      if (nextItems !== undefined) {
        await tx.quoteTemplateItem.deleteMany({
          where: {
            workspaceId,
            templateId: existing.id,
          },
        });

        if (nextItems.length > 0) {
          await tx.quoteTemplateItem.createMany({
            data: nextItems.map((item) => ({
              workspaceId,
              templateId: existing.id,
              position: item.position,
              title: item.title,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountType: item.discountType,
              discountValue: item.discountValue,
            })),
          });
        }
      }

      return tx.quoteTemplate.findFirst({
        where: {
          workspaceId,
          id: existing.id,
        },
        select: quoteTemplateDetailSelect,
      });
    });
  },

  deleteTemplate(workspaceId: string, templateId: string) {
    return prisma.quoteTemplate.deleteMany({
      where: {
        workspaceId,
        id: templateId,
      },
    });
  },

  getNotificationSettings(workspaceId: string) {
    return prisma.quoteNotificationSettings.findUnique({
      where: {
        workspaceId,
      },
      select: quoteNotificationSettingsSelect,
    });
  },

  upsertNotificationSettings(workspaceId: string, input: QuoteNotificationSettingsWriteInput) {
    return prisma.quoteNotificationSettings.upsert({
      where: {
        workspaceId,
      },
      update: input,
      create: {
        workspaceId,
        ...input,
      },
      select: quoteNotificationSettingsSelect,
    });
  },
};
