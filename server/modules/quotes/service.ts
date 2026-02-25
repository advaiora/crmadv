import { Prisma, type QuoteDiscountType, type QuoteStatus } from '@prisma/client';
import { badRequest, conflict, notFound } from '../../core/errors.js';
import {
  quotesRepository,
  type QuoteDetailRecord,
  type QuoteItemWriteInput,
  type QuoteTemplateItemWriteInput,
  type QuoteTemplatePatchInput,
  type QuoteTemplateWriteInput,
  type QuoteWriteInput,
  type QuotesRepository,
} from './repository.js';
import { quoteNotificationsService, type QuoteNotificationEvent } from './notifications.js';

const DECIMAL_REGEX = /^\d+(\.\d{1,2})?$/;
const MAX_ITEMS_COUNT = 200;
const MAX_POSITION = 100_000;
const DEFAULT_LIST_PAGE = 1;
const DEFAULT_LIST_PAGE_SIZE = 20;
const MAX_LIST_PAGE_SIZE = 100;
const MAX_LOOKUP_LIMIT = 50;
const MAX_NOTIFICATION_TEMPLATE_LENGTH = 5000;
const MAX_SEARCH_LENGTH = 120;

export type QuoteItemPayload = {
  position?: number;
  title: string;
  description?: string | null;
  quantity: number | string;
  unitPrice: number | string;
  discountType?: QuoteDiscountType | null;
  discountValue?: number | string | null;
};

export type CreateQuotePayload = {
  clientId: string;
  projectId?: string | null;
  templateId?: string | null;
  currency?: string;
  taxRate?: number | string | null;
  issueDate?: string | Date | null;
  validUntil?: string | Date | null;
  notes?: string | null;
  internalNotes?: string | null;
  items?: QuoteItemPayload[];
};

export type UpdateQuotePayload = {
  clientId?: string;
  projectId?: string | null;
  templateId?: string | null;
  currency?: string;
  taxRate?: number | string | null;
  issueDate?: string | Date | null;
  validUntil?: string | Date | null;
  notes?: string | null;
  internalNotes?: string | null;
  items?: QuoteItemPayload[];
};

export type QuoteTemplateItemPayload = {
  position?: number;
  title: string;
  description?: string | null;
  quantity: number | string;
  unitPrice: number | string;
  discountType?: QuoteDiscountType | null;
  discountValue?: number | string | null;
};

export type CreateQuoteTemplatePayload = {
  name: string;
  description?: string | null;
  defaultNotes?: string | null;
  items?: QuoteTemplateItemPayload[];
};

export type UpdateQuoteTemplatePayload = {
  name?: string;
  description?: string | null;
  defaultNotes?: string | null;
  items?: QuoteTemplateItemPayload[];
};

export type QuoteListPayload = {
  status?: QuoteStatus;
  clientId?: string;
  projectId?: string;
  q?: string;
  createdFrom?: string | Date;
  createdTo?: string | Date;
  page?: number;
  pageSize?: number;
};

export type QuoteLookupPayload = {
  q?: string;
  clientId?: string;
  limit?: number;
  createdFrom?: string | Date;
  createdTo?: string | Date;
};

export type QuoteNotificationTemplatePayload = {
  enabled?: boolean;
  sentSubject?: string | null;
  sentBody?: string | null;
  acceptedSubject?: string | null;
  acceptedBody?: string | null;
  rejectedSubject?: string | null;
  rejectedBody?: string | null;
};

export type QuotePdfData = {
  id: string;
  status: QuoteStatus;
  currency: string;
  subtotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  total: Prisma.Decimal;
  issueDate: Date | null;
  validUntil: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  client: {
    id: string | null;
    name: string;
    email: string | null;
    phone: string | null;
    street: string | null;
    city: string | null;
    zip: string | null;
    province: string | null;
    country: string | null;
  };
  lines: Array<{
    id: string;
    title: string;
    qty: number;
    unitPrice: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
    order: number | null;
  }>;
};

type RecalculatedTotals = {
  subtotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  total: Prisma.Decimal;
};

const toDecimal = (value: number | string, fieldName: string) => {
  const raw = typeof value === 'string' ? value.trim() : value;

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) {
      throw badRequest(`${fieldName} must be a finite number`);
    }

    const normalized = raw.toString();
    if (!DECIMAL_REGEX.test(normalized)) {
      throw badRequest(`${fieldName} must have at most 2 decimal places`);
    }

    return new Prisma.Decimal(normalized);
  }

  if (typeof raw !== 'string' || !raw) {
    throw badRequest(`${fieldName} must be a number`);
  }

  if (!DECIMAL_REGEX.test(raw)) {
    throw badRequest(`${fieldName} must have at most 2 decimal places`);
  }

  return new Prisma.Decimal(raw);
};

const toNonNegativeDecimal = (value: number | string, fieldName: string) => {
  const decimal = toDecimal(value, fieldName);
  if (decimal.isNegative()) {
    throw badRequest(`${fieldName} must be >= 0`);
  }

  return decimal;
};

const toPositiveDecimal = (value: number | string, fieldName: string) => {
  const decimal = toNonNegativeDecimal(value, fieldName);
  if (decimal.lessThanOrEqualTo(new Prisma.Decimal(0))) {
    throw badRequest(`${fieldName} must be > 0`);
  }

  return decimal;
};

const parseDateOrNull = (
  value: string | Date | null | undefined,
  fieldName: string,
): Date | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw badRequest(`${fieldName} must be a valid date`);
    }
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest(`${fieldName} must be a valid date`);
  }

  return parsed;
};

const parseDateRange = (
  from: string | Date | undefined,
  to: string | Date | undefined,
  fieldPrefix: string,
) => {
  const parsedFrom = parseDateOrNull(from, `${fieldPrefix}From`);
  const parsedTo = parseDateOrNull(to, `${fieldPrefix}To`);

  if (parsedFrom && parsedTo && parsedFrom > parsedTo) {
    throw badRequest(`${fieldPrefix}From must be <= ${fieldPrefix}To`);
  }

  return {
    from: parsedFrom ?? undefined,
    to: parsedTo ?? undefined,
  };
};

const parseTaxRate = (
  value: number | string | null | undefined,
  fieldName = 'taxRate',
): Prisma.Decimal | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }

  const decimal = toNonNegativeDecimal(value, fieldName);
  if (decimal.greaterThan(new Prisma.Decimal(100))) {
    throw badRequest(`${fieldName} must be <= 100`);
  }

  return decimal;
};

const normalizeOptionalString = (
  value: string | null | undefined,
  fieldName: string,
): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    throw badRequest(`${fieldName} cannot be empty`);
  }

  return normalized;
};

const normalizeNotificationTemplateText = (
  value: string | null | undefined,
  fieldName: string,
) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length > MAX_NOTIFICATION_TEMPLATE_LENGTH) {
    throw badRequest(`${fieldName} is too long`, {
      maxLength: MAX_NOTIFICATION_TEMPLATE_LENGTH,
    });
  }

  return normalized;
};

const normalizeCurrency = (value: string | undefined): string => {
  const normalized = (value ?? 'EUR').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw badRequest('currency must be a 3-letter ISO code');
  }

  return normalized;
};

const normalizeOptionalSearch = (value: string | undefined) => {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length > MAX_SEARCH_LENGTH) {
    throw badRequest('search query is too long', {
      maxLength: MAX_SEARCH_LENGTH,
    });
  }
  return normalized.length > 0 ? normalized : undefined;
};

const normalizePositiveInt = (
  value: number | undefined,
  fieldName: string,
  fallback: number,
  max: number,
) => {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isInteger(value) || value <= 0) {
    throw badRequest(`${fieldName} must be an integer greater than 0`);
  }
  if (value > max) {
    throw badRequest(`${fieldName} must be <= ${max}`);
  }

  return value;
};

const canonicalizePositions = <T extends { position?: number }>(items: T[]) =>
  [...items]
    .map((item, index) => ({
      ...item,
      position: item.position ?? index + 1,
      _index: index,
    }))
    .sort((left, right) => {
      const leftPosition = left.position ?? 0;
      const rightPosition = right.position ?? 0;
      if (leftPosition !== rightPosition) {
        return leftPosition - rightPosition;
      }
      return left._index - right._index;
    })
    .map((item, index) => {
      const { _index, ...rest } = item;
      return {
        ...rest,
        position: index + 1,
      };
    }) as Array<T & { position: number }>;

const computeLineTotal = (
  quantity: Prisma.Decimal,
  unitPrice: Prisma.Decimal,
  discountType: QuoteDiscountType | null,
  discountValue: Prisma.Decimal | null,
) => {
  const baseAmount = quantity.mul(unitPrice);
  if (!discountType || !discountValue || discountValue.isZero()) {
    return baseAmount;
  }

  const rawDiscount =
    discountType === 'PERCENT'
      ? baseAmount.mul(discountValue).div(100)
      : discountValue;

  const boundedDiscount = rawDiscount.greaterThan(baseAmount) ? baseAmount : rawDiscount;
  return baseAmount.sub(boundedDiscount);
};

const normalizeQuoteItems = (items: QuoteItemPayload[] | undefined): QuoteItemWriteInput[] => {
  if (!items) {
    return [];
  }

  if (items.length > MAX_ITEMS_COUNT) {
    throw badRequest(`items cannot contain more than ${MAX_ITEMS_COUNT} rows`);
  }

  return canonicalizePositions(items).map((item, index) => {
    const position = item.position;
    if (!Number.isInteger(position) || position <= 0 || position > MAX_POSITION) {
      throw badRequest(`items[${index}].position must be an integer between 1 and ${MAX_POSITION}`);
    }

    const title = item.title.trim();
    if (!title) {
      throw badRequest(`items[${index}].title is required`);
    }

    const quantity = toPositiveDecimal(item.quantity, `items[${index}].quantity`);
    const unitPrice = toNonNegativeDecimal(item.unitPrice, `items[${index}].unitPrice`);
    const discountType = item.discountType ?? null;
    const discountValue = item.discountValue === undefined || item.discountValue === null
      ? null
      : toNonNegativeDecimal(item.discountValue, `items[${index}].discountValue`);
    const lineTotal = computeLineTotal(quantity, unitPrice, discountType, discountValue);

    return {
      position,
      title,
      description: item.description?.trim() || null,
      quantity,
      unitPrice,
      discountType,
      discountValue,
      lineTotal,
    };
  });
};

const normalizeQuoteTemplateItems = (
  items: QuoteTemplateItemPayload[] | undefined,
): QuoteTemplateItemWriteInput[] => {
  if (!items) {
    return [];
  }

  if (items.length > MAX_ITEMS_COUNT) {
    throw badRequest(`items cannot contain more than ${MAX_ITEMS_COUNT} rows`);
  }

  return canonicalizePositions(items).map((item, index) => {
    const position = item.position;
    if (!Number.isInteger(position) || position <= 0 || position > MAX_POSITION) {
      throw badRequest(`items[${index}].position must be an integer between 1 and ${MAX_POSITION}`);
    }

    const title = item.title.trim();
    if (!title) {
      throw badRequest(`items[${index}].title is required`);
    }

    return {
      position,
      title,
      description: item.description?.trim() || null,
      quantity: toPositiveDecimal(item.quantity, `items[${index}].quantity`),
      unitPrice: toNonNegativeDecimal(item.unitPrice, `items[${index}].unitPrice`),
      discountType: item.discountType ?? null,
      discountValue:
        item.discountValue === undefined || item.discountValue === null
          ? null
          : toNonNegativeDecimal(item.discountValue, `items[${index}].discountValue`),
    };
  });
};

const mapTemplateItemsToQuoteItems = (
  templateItems: Array<{
    position: number;
    title: string;
    description: string | null;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    discountType: QuoteDiscountType | null;
    discountValue: Prisma.Decimal | null;
  }>,
): QuoteItemWriteInput[] =>
  templateItems.map((item, index) => ({
    position: item.position || index + 1,
    title: item.title,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discountType: item.discountType,
    discountValue: item.discountValue,
    lineTotal: computeLineTotal(
      item.quantity,
      item.unitPrice,
      item.discountType,
      item.discountValue,
    ),
  }));

export const recalculateTotals = (
  items: QuoteItemWriteInput[],
  taxRate: Prisma.Decimal | null,
): RecalculatedTotals => {
  const subtotal = items.reduce(
    (accumulator, item) => accumulator.add(item.lineTotal),
    new Prisma.Decimal(0),
  );
  const taxTotal = taxRate
    ? subtotal.mul(taxRate).div(100).toDecimalPlaces(2)
    : new Prisma.Decimal(0);
  const total = subtotal.add(taxTotal).toDecimalPlaces(2);

  return {
    subtotal: subtotal.toDecimalPlaces(2),
    taxTotal,
    total,
  };
};

const mapQuote = (quote: QuoteDetailRecord) => ({
  id: quote.id,
  workspaceId: quote.workspaceId,
  clientId: quote.clientId,
  projectId: quote.projectId,
  templateId: quote.templateId,
  createdByUserId: quote.createdByUserId,
  status: quote.status,
  currency: quote.currency,
  subtotal: quote.subtotal.toNumber(),
  taxTotal: quote.taxTotal.toNumber(),
  total: quote.total.toNumber(),
  taxRate: quote.taxRate?.toNumber() ?? null,
  issueDate: quote.issueDate,
  validUntil: quote.validUntil,
  notes: quote.notes,
  internalNotes: quote.internalNotes,
  createdAt: quote.createdAt,
  updatedAt: quote.updatedAt,
  client: {
    id: quote.client.id,
    name: quote.client.name,
    email: quote.client.email,
    phone: quote.client.phone,
    street: quote.client.street,
    city: quote.client.city,
    zip: quote.client.zip,
    province: quote.client.province,
    country: quote.client.country,
  },
  project: quote.project
    ? {
        id: quote.project.id,
        name: quote.project.name,
      }
    : null,
  template: quote.template
    ? {
        id: quote.template.id,
        name: quote.template.name,
      }
    : null,
  items: quote.items.map((item) => ({
    id: item.id,
    position: item.position,
    title: item.title,
    description: item.description,
    quantity: item.quantity.toNumber(),
    unitPrice: item.unitPrice.toNumber(),
    discountType: item.discountType,
    discountValue: item.discountValue?.toNumber() ?? null,
    lineTotal: item.lineTotal.toNumber(),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  })),
});

type QuoteDto = ReturnType<typeof mapQuote>;

const mapQuoteSummary = (
  quote: Awaited<ReturnType<QuotesRepository['listQuotes']>>['items'][number],
) => ({
  id: quote.id,
  workspaceId: quote.workspaceId,
  clientId: quote.clientId,
  projectId: quote.projectId,
  templateId: quote.templateId,
  status: quote.status,
  currency: quote.currency,
  subtotal: quote.subtotal.toNumber(),
  taxTotal: quote.taxTotal.toNumber(),
  total: quote.total.toNumber(),
  taxRate: quote.taxRate?.toNumber() ?? null,
  issueDate: quote.issueDate,
  validUntil: quote.validUntil,
  notes: quote.notes,
  createdAt: quote.createdAt,
  updatedAt: quote.updatedAt,
  client: {
    id: quote.client.id,
    name: quote.client.name,
  },
  project: quote.project
    ? {
        id: quote.project.id,
        name: quote.project.name,
      }
    : null,
});

const mapQuoteTemplate = (
  template: NonNullable<Awaited<ReturnType<QuotesRepository['findTemplateById']>>>,
) => ({
  id: template.id,
  workspaceId: template.workspaceId,
  name: template.name,
  description: template.description,
  defaultNotes: template.defaultNotes,
  createdAt: template.createdAt,
  updatedAt: template.updatedAt,
  items: template.items.map((item) => ({
    id: item.id,
    workspaceId: item.workspaceId,
    templateId: item.templateId,
    position: item.position,
    title: item.title,
    description: item.description,
    quantity: item.quantity.toNumber(),
    unitPrice: item.unitPrice.toNumber(),
    discountType: item.discountType,
    discountValue: item.discountValue?.toNumber() ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  })),
});

const mapQuoteTemplateSummary = (
  template: Awaited<ReturnType<QuotesRepository['listTemplates']>>[number],
) => ({
  id: template.id,
  workspaceId: template.workspaceId,
  name: template.name,
  description: template.description,
  defaultNotes: template.defaultNotes,
  itemsCount: template._count.items,
  createdAt: template.createdAt,
  updatedAt: template.updatedAt,
});

const mapQuoteNotificationSettings = (
  settings: NonNullable<Awaited<ReturnType<QuotesRepository['getNotificationSettings']>>>,
) => ({
  enabled: settings.enabled,
  sentSubject: settings.sentSubject,
  sentBody: settings.sentBody,
  acceptedSubject: settings.acceptedSubject,
  acceptedBody: settings.acceptedBody,
  rejectedSubject: settings.rejectedSubject,
  rejectedBody: settings.rejectedBody,
  updatedAt: settings.updatedAt,
});

const maybeNotifyQuoteEvent = async (
  workspaceId: string,
  event: QuoteNotificationEvent,
  quote: QuoteDto,
  quotePdfData?: QuotePdfData,
) => {
  try {
    await quoteNotificationsService.notifyQuoteEvent({
      workspaceId,
      event,
      quote,
      quotePdfData,
    });
  } catch {
    // Notifications are best-effort and should not block quote transitions.
  }
};

const transitionTo = async (
  repository: QuotesRepository,
  workspaceId: string,
  quoteId: string,
  from: QuoteStatus,
  to: QuoteStatus,
  errorMessage: string,
) => {
  const current = await repository.findQuoteStatus(workspaceId, quoteId);
  if (!current) {
    throw notFound('Quote not found');
  }

  if (current.status !== from) {
    throw conflict(errorMessage, {
      currentStatus: current.status,
      expectedStatus: from,
    });
  }

  const updated = await repository.transitionQuoteStatus(workspaceId, quoteId, from, to);
  if (updated.count === 0) {
    const latest = await repository.findQuoteStatus(workspaceId, quoteId);
    if (!latest) {
      throw notFound('Quote not found');
    }

    throw conflict(errorMessage, {
      currentStatus: latest.status,
      expectedStatus: from,
    });
  }
};

export const buildQuotesService = (repository: QuotesRepository) => {
  return {
    async listQuotes(workspaceId: string, payload: QuoteListPayload = {}) {
      const page = normalizePositiveInt(
        payload.page,
        'page',
        DEFAULT_LIST_PAGE,
        Number.MAX_SAFE_INTEGER,
      );
      const pageSize = normalizePositiveInt(
        payload.pageSize,
        'pageSize',
        DEFAULT_LIST_PAGE_SIZE,
        MAX_LIST_PAGE_SIZE,
      );

      const createdFrom = parseDateOrNull(payload.createdFrom, 'createdFrom');
      const createdTo = parseDateOrNull(payload.createdTo, 'createdTo');
      if (createdFrom && createdTo && createdFrom > createdTo) {
        throw badRequest('createdFrom must be <= createdTo');
      }

      const result = await repository.listQuotes(workspaceId, {
        status: payload.status,
        clientId: payload.clientId,
        projectId: payload.projectId,
        q: normalizeOptionalSearch(payload.q),
        createdFrom: createdFrom ?? undefined,
        createdTo: createdTo ?? undefined,
        page,
        pageSize,
      });

      const totalPages = result.total === 0 ? 0 : Math.ceil(result.total / pageSize);
      return {
        items: result.items.map((quote) => mapQuoteSummary(quote)),
        pageInfo: {
          page,
          pageSize,
          totalItems: result.total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1 && totalPages > 0,
        },
      };
    },

    async listClientsForPicker(workspaceId: string, input?: QuoteLookupPayload) {
      const limit = normalizePositiveInt(
        input?.limit,
        'limit',
        20,
        MAX_LOOKUP_LIMIT,
      );
      const dateRange = parseDateRange(
        input?.createdFrom,
        input?.createdTo,
        'created',
      );
      const items = await repository.listClientsForLookup(workspaceId, {
        q: normalizeOptionalSearch(input?.q),
        limit,
        createdFrom: dateRange.from,
        createdTo: dateRange.to,
      });

      return items.map((item) => ({
        id: item.id,
        name: item.name,
        email: item.email ?? null,
        phone: item.phone ?? null,
        createdAt: item.createdAt ?? null,
      }));
    },

    async listProjectsForPicker(workspaceId: string, input?: QuoteLookupPayload) {
      const limit = normalizePositiveInt(
        input?.limit,
        'limit',
        20,
        MAX_LOOKUP_LIMIT,
      );
      const dateRange = parseDateRange(
        input?.createdFrom,
        input?.createdTo,
        'created',
      );

      const clientId = input?.clientId?.trim();
      if (clientId) {
        const client = await repository.clientExists(workspaceId, clientId);
        if (!client) {
          throw notFound('Client not found');
        }
      }

      const items = await repository.listProjectsForLookup(workspaceId, {
        q: normalizeOptionalSearch(input?.q),
        clientId: clientId || undefined,
        limit,
        createdFrom: dateRange.from,
        createdTo: dateRange.to,
      });

      return items.map((item) => ({
        id: item.id,
        name: item.name,
        createdAt: item.createdAt ?? null,
      }));
    },

    async getQuoteById(workspaceId: string, quoteId: string) {
      const quote = await repository.findQuoteById(workspaceId, quoteId);
      if (!quote) {
        throw notFound('Quote not found');
      }

      return mapQuote(quote);
    },

    async getQuoteForPdf(workspaceId: string, quoteId: string): Promise<QuotePdfData> {
      const quote = await repository.findQuoteById(workspaceId, quoteId);
      if (!quote) {
        throw notFound('Quote not found');
      }

      return {
        id: quote.id,
        status: quote.status,
        currency: quote.currency,
        subtotal: quote.subtotal,
        taxTotal: quote.taxTotal,
        total: quote.total,
        issueDate: quote.issueDate,
        validUntil: quote.validUntil,
        notes: quote.notes,
        createdAt: quote.createdAt,
        updatedAt: quote.updatedAt,
        client: {
          id: quote.client.id,
          name: quote.client.name,
          email: quote.client.email,
          phone: quote.client.phone,
          street: quote.client.street,
          city: quote.client.city,
          zip: quote.client.zip,
          province: quote.client.province,
          country: quote.client.country,
        },
        lines: quote.items.map((item) => ({
          id: item.id,
          title: item.title,
          qty: Number(item.quantity.toFixed(2)),
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          order: item.position,
        })),
      };
    },

    async createQuote(input: {
      workspaceId: string;
      actorUserId: string;
      payload: CreateQuotePayload;
    }) {
      const clientExists = await repository.clientExists(input.workspaceId, input.payload.clientId);
      if (!clientExists) {
        throw notFound('Client not found');
      }

      const projectId = input.payload.projectId ?? null;
      if (projectId) {
        const projectExists = await repository.projectExists(input.workspaceId, projectId);
        if (!projectExists) {
          throw notFound('Project not found');
        }
      }

      const templateId = input.payload.templateId ?? null;
      const template = templateId
        ? await repository.findTemplateById(input.workspaceId, templateId)
        : null;
      if (templateId && !template) {
        throw notFound('Quote template not found');
      }

      const rawItems = input.payload.items;
      const normalizedItems =
        rawItems && rawItems.length > 0
          ? normalizeQuoteItems(rawItems)
          : template
            ? mapTemplateItemsToQuoteItems(template.items)
            : [];

      const taxRate = parseTaxRate(input.payload.taxRate ?? null) ?? null;
      const totals = recalculateTotals(normalizedItems, taxRate);

      const createInput: QuoteWriteInput = {
        clientId: input.payload.clientId,
        projectId,
        templateId,
        createdByUserId: input.actorUserId,
        status: 'DRAFT',
        currency: normalizeCurrency(input.payload.currency),
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        taxRate,
        issueDate: parseDateOrNull(input.payload.issueDate, 'issueDate') ?? null,
        validUntil: parseDateOrNull(input.payload.validUntil, 'validUntil') ?? null,
        notes: normalizeOptionalString(input.payload.notes, 'notes') ?? null,
        internalNotes: normalizeOptionalString(input.payload.internalNotes, 'internalNotes') ?? null,
      };

      const created = await repository.createQuote(input.workspaceId, createInput, normalizedItems);
      if (!created) {
        throw notFound('Quote not found');
      }

      return mapQuote(created);
    },

    async updateQuote(input: {
      workspaceId: string;
      quoteId: string;
      payload: UpdateQuotePayload;
    }) {
      const current = await repository.findQuoteById(input.workspaceId, input.quoteId);
      if (!current) {
        throw notFound('Quote not found');
      }
      if (current.status !== 'DRAFT' && current.status !== 'SENT') {
        throw conflict('Only DRAFT or SENT quotes can be updated', {
          currentStatus: current.status,
        });
      }

      const nextClientId = input.payload.clientId ?? current.clientId;
      const clientExists = await repository.clientExists(input.workspaceId, nextClientId);
      if (!clientExists) {
        throw notFound('Client not found');
      }

      const nextProjectId = input.payload.projectId === undefined
        ? current.projectId
        : input.payload.projectId;
      if (nextProjectId) {
        const projectExists = await repository.projectExists(input.workspaceId, nextProjectId);
        if (!projectExists) {
          throw notFound('Project not found');
        }
      }

      const nextTemplateId = input.payload.templateId === undefined
        ? current.templateId
        : input.payload.templateId;
      if (nextTemplateId) {
        const template = await repository.findTemplateById(input.workspaceId, nextTemplateId);
        if (!template) {
          throw notFound('Quote template not found');
        }
      }

      const nextItems = input.payload.items === undefined
        ? undefined
        : normalizeQuoteItems(input.payload.items);

      const itemsForTotals =
        nextItems ??
        current.items.map((item) => ({
          position: item.position,
          title: item.title,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountType: item.discountType,
          discountValue: item.discountValue,
          lineTotal: item.lineTotal,
        }));

      const nextTaxRate = input.payload.taxRate === undefined
        ? current.taxRate
        : parseTaxRate(input.payload.taxRate, 'taxRate') ?? null;

      const totals = recalculateTotals(itemsForTotals, nextTaxRate);

      const quotePatch: Partial<QuoteWriteInput> = {
        clientId: nextClientId,
        projectId: nextProjectId,
        templateId: nextTemplateId,
        currency: input.payload.currency ? normalizeCurrency(input.payload.currency) : current.currency,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        taxRate: nextTaxRate,
        issueDate:
          input.payload.issueDate === undefined
            ? current.issueDate
            : parseDateOrNull(input.payload.issueDate, 'issueDate') ?? null,
        validUntil:
          input.payload.validUntil === undefined
            ? current.validUntil
            : parseDateOrNull(input.payload.validUntil, 'validUntil') ?? null,
        notes:
          input.payload.notes === undefined
            ? current.notes
            : normalizeOptionalString(input.payload.notes, 'notes') ?? null,
        internalNotes:
          input.payload.internalNotes === undefined
            ? current.internalNotes
            : normalizeOptionalString(input.payload.internalNotes, 'internalNotes') ?? null,
      };

      const updated = await repository.updateQuoteAndItems(
        input.workspaceId,
        input.quoteId,
        quotePatch,
        nextItems,
      );
      if (!updated) {
        throw notFound('Quote not found');
      }

      return mapQuote(updated);
    },

    async changeStatusToSent(workspaceId: string, quoteId: string) {
      await transitionTo(
        repository,
        workspaceId,
        quoteId,
        'DRAFT',
        'SENT',
        'Only DRAFT quotes can be sent',
      );

      const quote = await this.getQuoteById(workspaceId, quoteId);
      const quotePdfData = await this.getQuoteForPdf(workspaceId, quoteId);
      await maybeNotifyQuoteEvent(workspaceId, 'SENT', quote, quotePdfData);
      return quote;
    },

    async acceptQuote(workspaceId: string, quoteId: string) {
      await transitionTo(
        repository,
        workspaceId,
        quoteId,
        'SENT',
        'ACCEPTED',
        'Only SENT quotes can be accepted',
      );

      const quote = await this.getQuoteById(workspaceId, quoteId);
      await maybeNotifyQuoteEvent(workspaceId, 'ACCEPTED', quote);
      return quote;
    },

    async rejectQuote(workspaceId: string, quoteId: string) {
      await transitionTo(
        repository,
        workspaceId,
        quoteId,
        'SENT',
        'REJECTED',
        'Only SENT quotes can be rejected',
      );

      const quote = await this.getQuoteById(workspaceId, quoteId);
      await maybeNotifyQuoteEvent(workspaceId, 'REJECTED', quote);
      return quote;
    },

    async cancelSentQuote(workspaceId: string, quoteId: string) {
      await transitionTo(
        repository,
        workspaceId,
        quoteId,
        'SENT',
        'DRAFT',
        'Only SENT quotes can be reverted to DRAFT',
      );

      return this.getQuoteById(workspaceId, quoteId);
    },

    async deleteQuote(workspaceId: string, quoteId: string) {
      const current = await repository.findQuoteStatus(workspaceId, quoteId);
      if (!current) {
        throw notFound('Quote not found');
      }
      if (current.status !== 'DRAFT') {
        throw conflict('Only DRAFT quotes can be deleted', {
          currentStatus: current.status,
        });
      }

      const deleted = await repository.deleteDraftQuote(workspaceId, quoteId);
      if (deleted.count === 0) {
        const latest = await repository.findQuoteStatus(workspaceId, quoteId);
        if (!latest) {
          throw notFound('Quote not found');
        }

        throw conflict('Only DRAFT quotes can be deleted', {
          currentStatus: latest.status,
        });
      }
    },

    async resendQuote(workspaceId: string, quoteId: string) {
      const current = await repository.findQuoteStatus(workspaceId, quoteId);
      if (!current) {
        throw notFound('Quote not found');
      }
      if (current.status !== 'SENT') {
        throw conflict('Only SENT quotes can be resent', {
          currentStatus: current.status,
        });
      }

      const quote = await this.getQuoteById(workspaceId, quoteId);
      const quotePdfData = await this.getQuoteForPdf(workspaceId, quoteId);
      await maybeNotifyQuoteEvent(workspaceId, 'SENT', quote, quotePdfData);
      return quote;
    },

    async getNotificationSettings(workspaceId: string) {
      return quoteNotificationsService.getTemplates(workspaceId);
    },

    async updateNotificationSettings(
      workspaceId: string,
      payload: QuoteNotificationTemplatePayload,
    ) {
      const patch = {
        ...(payload.enabled !== undefined ? { enabled: Boolean(payload.enabled) } : {}),
        ...(payload.sentSubject !== undefined
          ? { sentSubject: normalizeNotificationTemplateText(payload.sentSubject, 'sentSubject') }
          : {}),
        ...(payload.sentBody !== undefined
          ? { sentBody: normalizeNotificationTemplateText(payload.sentBody, 'sentBody') }
          : {}),
        ...(payload.acceptedSubject !== undefined
          ? {
              acceptedSubject: normalizeNotificationTemplateText(
                payload.acceptedSubject,
                'acceptedSubject',
              ),
            }
          : {}),
        ...(payload.acceptedBody !== undefined
          ? { acceptedBody: normalizeNotificationTemplateText(payload.acceptedBody, 'acceptedBody') }
          : {}),
        ...(payload.rejectedSubject !== undefined
          ? {
              rejectedSubject: normalizeNotificationTemplateText(
                payload.rejectedSubject,
                'rejectedSubject',
              ),
            }
          : {}),
        ...(payload.rejectedBody !== undefined
          ? { rejectedBody: normalizeNotificationTemplateText(payload.rejectedBody, 'rejectedBody') }
          : {}),
      };

      if (Object.keys(patch).length === 0) {
        throw badRequest('At least one template field is required');
      }

      return quoteNotificationsService.updateTemplates(workspaceId, patch);
    },

    async listTemplates(workspaceId: string) {
      const templates = await repository.listTemplates(workspaceId);
      return templates.map((template) => mapQuoteTemplateSummary(template));
    },

    async getTemplateById(workspaceId: string, templateId: string) {
      const template = await repository.findTemplateById(workspaceId, templateId);
      if (!template) {
        throw notFound('Quote template not found');
      }

      return mapQuoteTemplate(template);
    },

    async createTemplate(workspaceId: string, payload: CreateQuoteTemplatePayload) {
      const items = normalizeQuoteTemplateItems(payload.items);
      const createInput: QuoteTemplateWriteInput = {
        name: payload.name.trim(),
        description: payload.description?.trim() || null,
        defaultNotes: payload.defaultNotes?.trim() || null,
        items,
      };

      if (!createInput.name) {
        throw badRequest('name is required');
      }

      const template = await repository.createTemplate(workspaceId, createInput);
      return mapQuoteTemplate(template);
    },

    async updateTemplate(
      workspaceId: string,
      templateId: string,
      payload: UpdateQuoteTemplatePayload,
    ) {
      const patch: QuoteTemplatePatchInput = {};
      if (payload.name !== undefined) {
        const name = payload.name.trim();
        if (!name) {
          throw badRequest('name cannot be empty');
        }
        patch.name = name;
      }
      if (payload.description !== undefined) {
        patch.description = payload.description?.trim() || null;
      }
      if (payload.defaultNotes !== undefined) {
        patch.defaultNotes = payload.defaultNotes?.trim() || null;
      }

      const nextItems = payload.items === undefined
        ? undefined
        : normalizeQuoteTemplateItems(payload.items);

      const updated = await repository.updateTemplate(workspaceId, templateId, patch, nextItems);
      if (!updated) {
        throw notFound('Quote template not found');
      }

      return mapQuoteTemplate(updated);
    },

    async deleteTemplate(workspaceId: string, templateId: string) {
      const deleted = await repository.deleteTemplate(workspaceId, templateId);
      if (deleted.count === 0) {
        throw notFound('Quote template not found');
      }
    },
  };
};

export const quotesService = buildQuotesService(quotesRepository);
