import { type Prisma, type QuoteStatus } from '@prisma/client';
import { badRequest, conflict, notFound } from '../core/errors.js';
import { quoteRepository, type QuotesSort } from '../repositories/quote.repository.js';
import { computeLineTotal, computeQuoteTotal, parseMoneyDecimal } from './quotes.calc.js';

const QUOTE_STATUSES: QuoteStatus[] = ['draft', 'sent', 'accepted'];
const NOTES_MAX_LENGTH = 4000;
const TITLE_MAX_LENGTH = 200;
const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;
const MAX_SEARCH_LENGTH = 120;
const DEFAULT_CLIENT_NAME = 'Unknown client';
const MAX_EMAIL_LENGTH = 320;
const MAX_EMAIL_SUBJECT_LENGTH = 140;
const MAX_EMAIL_MESSAGE_LENGTH = 5000;
const MAX_EMAIL_RECIPIENTS = 10;
const MAX_DOWNLOAD_NAME_LENGTH = 200;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type QuoteListFilters = {
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

type QuoteCreatePayload = {
  clientId: string | null;
  notes: string | null;
  lines: QuoteLineWriteInput[];
  total: Prisma.Decimal;
};

type QuoteUpdatePayload = {
  clientId?: string | null;
  notes?: string | null;
};

type QuoteLinePatchPayload = {
  title?: string;
  qty?: number;
  unitPrice?: Prisma.Decimal;
  order?: number | null;
};

type QuoteDetailRecord = NonNullable<Awaited<ReturnType<typeof quoteRepository.findQuoteById>>>;
type QuoteLineRecord = NonNullable<Awaited<ReturnType<typeof quoteRepository.findLineById>>>;

export type QuotePdfData = {
  id: string;
  status: QuoteStatus;
  total: Prisma.Decimal;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  client: {
    id: string | null;
    name: string;
    email: string | null;
    phone: string | null;
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

export type QuoteSendEmailPayload = {
  to: string;
  subject: string | null;
  message: string | null;
  downloadName: string | null;
  cc: string[];
  bcc: string[];
};

export type QuoteEmailPreviewInput = {
  to: string;
  subject: string | null;
  message: string | null;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeOptionalString = (
  value: unknown,
  fieldName: string,
  options?: { maxLength?: number },
): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw badRequest(`${fieldName} must be a string`);
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (options?.maxLength && normalized.length > options.maxLength) {
    throw badRequest(`${fieldName} is too long`, {
      maxLength: options.maxLength,
    });
  }

  return normalized;
};

const parsePositiveInt = (value: unknown, fieldName: string, fallback?: number) => {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || (resolved as number) <= 0) {
    throw badRequest(`${fieldName} must be an integer >= 1`);
  }
  return resolved as number;
};

const parseNonNegativeIntOrNull = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw badRequest(`${fieldName} must be an integer >= 0`);
  }
  return value as number;
};

const sortLinesNullLast = <T extends { id: string; order: number | null }>(lines: T[]) =>
  [...lines].sort((left, right) => {
    if (left.order === null && right.order === null) {
      return left.id.localeCompare(right.id);
    }
    if (left.order === null) {
      return 1;
    }
    if (right.order === null) {
      return -1;
    }
    if (left.order !== right.order) {
      return left.order - right.order;
    }
    return left.id.localeCompare(right.id);
  });

const sanitizeFields = (fields: string[]) => Array.from(new Set(fields)).sort();

const parseEmailAddress = (value: unknown, fieldName: string) => {
  if (typeof value !== 'string') {
    throw badRequest(`${fieldName} must be a string`);
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    throw badRequest(`${fieldName} is required`);
  }
  if (normalized.length > MAX_EMAIL_LENGTH) {
    throw badRequest(`${fieldName} is too long`, {
      maxLength: MAX_EMAIL_LENGTH,
    });
  }
  if (!EMAIL_REGEX.test(normalized)) {
    throw badRequest(`${fieldName} must be a valid email`);
  }

  return normalized;
};

const parseEmailList = (value: unknown, fieldName: string) => {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw badRequest(`${fieldName} must be an array`);
  }
  if (value.length > MAX_EMAIL_RECIPIENTS) {
    throw badRequest(`${fieldName} must contain at most ${MAX_EMAIL_RECIPIENTS} recipients`, {
      maxRecipients: MAX_EMAIL_RECIPIENTS,
    });
  }

  const normalized = value.map((entry, index) => parseEmailAddress(entry, `${fieldName}[${index}]`));
  return Array.from(new Set(normalized));
};

const parseDownloadName = (value: unknown) => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw badRequest('downloadName must be a string');
  }

  const normalized = value.trim();
  if (!normalized) {
    throw badRequest('downloadName cannot be empty');
  }
  if (normalized.length > MAX_DOWNLOAD_NAME_LENGTH) {
    throw badRequest('downloadName is too long', {
      maxLength: MAX_DOWNLOAD_NAME_LENGTH,
    });
  }
  if (/[/\\\r\n]/.test(normalized)) {
    throw badRequest('downloadName contains invalid characters');
  }

  return normalized;
};

const parseOptionalEmailSubject = (value: unknown) => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw badRequest('subject must be a string');
  }

  const normalized = value.trim();
  if (!normalized) {
    throw badRequest('subject cannot be empty');
  }
  if (normalized.length > MAX_EMAIL_SUBJECT_LENGTH) {
    throw badRequest('subject is too long', {
      maxLength: MAX_EMAIL_SUBJECT_LENGTH,
    });
  }

  return normalized;
};

const parseOptionalEmailMessage = (value: unknown) => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw badRequest('message must be a string');
  }

  const normalized = value.trim();
  if (!normalized) {
    throw badRequest('message cannot be empty');
  }
  if (normalized.length > MAX_EMAIL_MESSAGE_LENGTH) {
    throw badRequest('message is too long', {
      maxLength: MAX_EMAIL_MESSAGE_LENGTH,
    });
  }

  return normalized;
};

export const workspaceQuotesService = {
  parseListFilters(query: unknown): QuoteListFilters {
    if (query === undefined) {
      return {
        limit: DEFAULT_PAGE_LIMIT,
        sort: 'createdAt_desc',
      };
    }

    if (!isObject(query)) {
      throw badRequest('Querystring is invalid');
    }

    const limitRaw = query.limit;
    let limit = DEFAULT_PAGE_LIMIT;
    if (limitRaw !== undefined) {
      let parsedLimit: number;
      if (typeof limitRaw === 'string') {
        if (!/^\d+$/.test(limitRaw.trim())) {
          throw badRequest('limit must be an integer between 1 and 100');
        }
        parsedLimit = Number(limitRaw);
      } else {
        parsedLimit = limitRaw as number;
      }

      if (!Number.isInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > MAX_PAGE_LIMIT) {
        throw badRequest('limit must be an integer between 1 and 100');
      }
      limit = parsedLimit;
    }

    let sort: QuotesSort = 'createdAt_desc';
    if (query.sort !== undefined) {
      if (query.sort !== 'createdAt_desc' && query.sort !== 'createdAt_asc') {
        throw badRequest('sort must be createdAt_desc or createdAt_asc');
      }
      sort = query.sort;
    }

    let status: QuoteStatus | undefined;
    if (query.status !== undefined) {
      if (typeof query.status !== 'string' || !QUOTE_STATUSES.includes(query.status as QuoteStatus)) {
        throw badRequest('status filter is invalid', {
          accepted: QUOTE_STATUSES,
        });
      }
      status = query.status as QuoteStatus;
    }

    let q: string | undefined;
    if (query.q !== undefined) {
      if (typeof query.q !== 'string') {
        throw badRequest('q filter must be a string');
      }
      const normalizedQ = query.q.trim();
      if (normalizedQ) {
        if (normalizedQ.length > MAX_SEARCH_LENGTH) {
          throw badRequest('q filter is too long', {
            maxLength: MAX_SEARCH_LENGTH,
          });
        }
        q = normalizedQ;
      }
    }

    let cursor: string | undefined;
    if (query.cursor !== undefined) {
      if (typeof query.cursor !== 'string' || !query.cursor.trim()) {
        throw badRequest('cursor must be a non-empty string');
      }
      cursor = query.cursor.trim();
    }

    return {
      status,
      q,
      limit,
      cursor,
      sort,
    };
  },

  parseCreatePayload(body: unknown): QuoteCreatePayload {
    if (!isObject(body)) {
      throw badRequest('Body must be a JSON object');
    }

    let clientId: string | null = null;
    if (body.clientId !== undefined) {
      if (body.clientId === null) {
        clientId = null;
      } else if (typeof body.clientId === 'string' && body.clientId.trim()) {
        clientId = body.clientId.trim();
      } else {
        throw badRequest('clientId must be a non-empty string or null');
      }
    }

    const notes = normalizeOptionalString(body.notes, 'notes', {
      maxLength: NOTES_MAX_LENGTH,
    });

    if (body.lines !== undefined && !Array.isArray(body.lines)) {
      throw badRequest('lines must be an array');
    }

    const lineValues = Array.isArray(body.lines) ? body.lines : [];
    const lines = lineValues.map((lineValue, index) => {
      if (!isObject(lineValue)) {
        throw badRequest(`lines[${index}] must be an object`);
      }

      const title = normalizeOptionalString(lineValue.title, `lines[${index}].title`, {
        maxLength: TITLE_MAX_LENGTH,
      });
      if (!title) {
        throw badRequest(`lines[${index}].title is required`);
      }

      const qty = parsePositiveInt(lineValue.qty, `lines[${index}].qty`, 1);
      const unitPrice = parseMoneyDecimal(lineValue.unitPrice, `lines[${index}].unitPrice`);
      const lineTotal = computeLineTotal(qty, unitPrice);
      const order = parseNonNegativeIntOrNull(lineValue.order, `lines[${index}].order`);

      return {
        title,
        qty,
        unitPrice,
        lineTotal,
        order,
      };
    });

    return {
      clientId,
      notes,
      lines,
      total: computeQuoteTotal(lines.map((line) => line.lineTotal)),
    };
  },

  parseUpdatePayload(body: unknown): QuoteUpdatePayload {
    if (!isObject(body)) {
      throw badRequest('Body must be a JSON object');
    }

    const payload: QuoteUpdatePayload = {};

    if ('clientId' in body) {
      if (body.clientId === null) {
        payload.clientId = null;
      } else if (typeof body.clientId === 'string' && body.clientId.trim()) {
        payload.clientId = body.clientId.trim();
      } else {
        throw badRequest('clientId must be a non-empty string or null');
      }
    }

    if ('notes' in body) {
      payload.notes = normalizeOptionalString(body.notes, 'notes', {
        maxLength: NOTES_MAX_LENGTH,
      });
    }

    if (Object.keys(payload).length === 0) {
      throw badRequest('At least one field is required');
    }

    return payload;
  },

  parseCreateLinePayload(body: unknown): QuoteLineWriteInput {
    if (!isObject(body)) {
      throw badRequest('Body must be a JSON object');
    }

    const title = normalizeOptionalString(body.title, 'title', {
      maxLength: TITLE_MAX_LENGTH,
    });
    if (!title) {
      throw badRequest('title is required');
    }

    const qty = parsePositiveInt(body.qty, 'qty', 1);
    const unitPrice = parseMoneyDecimal(body.unitPrice, 'unitPrice');
    const lineTotal = computeLineTotal(qty, unitPrice);
    const order = parseNonNegativeIntOrNull(body.order, 'order');

    return {
      title,
      qty,
      unitPrice,
      lineTotal,
      order,
    };
  },

  parseUpdateLinePayload(body: unknown): QuoteLinePatchPayload {
    if (!isObject(body)) {
      throw badRequest('Body must be a JSON object');
    }

    const payload: QuoteLinePatchPayload = {};

    if ('title' in body) {
      const title = normalizeOptionalString(body.title, 'title', {
        maxLength: TITLE_MAX_LENGTH,
      });
      if (!title) {
        throw badRequest('title must be a non-empty string');
      }
      payload.title = title;
    }

    if ('qty' in body) {
      payload.qty = parsePositiveInt(body.qty, 'qty');
    }

    if ('unitPrice' in body) {
      payload.unitPrice = parseMoneyDecimal(body.unitPrice, 'unitPrice');
    }

    if ('order' in body) {
      payload.order = parseNonNegativeIntOrNull(body.order, 'order');
    }

    if (Object.keys(payload).length === 0) {
      throw badRequest('At least one line field is required');
    }

    return payload;
  },

  parseSendEmailPayload(body: unknown): QuoteSendEmailPayload {
    if (!isObject(body)) {
      throw badRequest('Body must be a JSON object');
    }

    const to = parseEmailAddress(body.to, 'to');
    const cc = parseEmailList(body.cc, 'cc');
    const bcc = parseEmailList(body.bcc, 'bcc');

    return {
      to,
      cc,
      bcc,
      subject: parseOptionalEmailSubject(body.subject),
      message: parseOptionalEmailMessage(body.message),
      downloadName: parseDownloadName(body.downloadName),
    };
  },

  parseEmailPreviewQuery(query: unknown): QuoteEmailPreviewInput {
    if (!isObject(query)) {
      throw badRequest('Querystring is invalid');
    }

    return {
      to: parseEmailAddress(query.to, 'to'),
      subject: parseOptionalEmailSubject(query.subject),
      message: parseOptionalEmailMessage(query.message),
    };
  },

  mapQuoteListItem(item: Awaited<ReturnType<typeof quoteRepository.listQuotes>>['items'][number]) {
    return {
      id: item.id,
      status: item.status,
      total: item.total.toNumber(),
      notes: item.notes,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      client: item.client
        ? { id: item.client.id, name: item.client.name }
        : { id: item.clientId, name: item.clientName },
      lineCount: item._count.lines,
    };
  },

  mapQuoteDetail(quote: QuoteDetailRecord) {
    return {
      id: quote.id,
      workspaceId: quote.workspaceId,
      clientId: quote.clientId,
      status: quote.status,
      total: quote.total.toNumber(),
      notes: quote.notes,
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
      client: quote.client
        ? {
            id: quote.client.id,
            name: quote.client.name,
            email: quote.client.email,
            phone: quote.client.phone,
          }
        : {
            id: quote.clientId,
            name: quote.clientName,
            email: quote.clientEmail,
            phone: quote.clientPhone,
          },
      lines: sortLinesNullLast(quote.lines).map((line) => ({
        id: line.id,
        quoteId: line.quoteId,
        title: line.title,
        qty: line.qty,
        unitPrice: line.unitPrice.toNumber(),
        lineTotal: line.lineTotal ? line.lineTotal.toNumber() : null,
        order: line.order,
      })),
    };
  },

  async resolveClientSnapshot(
    workspaceId: string,
    clientId: string | null | undefined,
    fallback: { name: string; email: string | null; phone: string | null },
  ) {
    if (clientId === undefined) {
      return {
        clientId: undefined,
        clientName: fallback.name,
        clientEmail: fallback.email,
        clientPhone: fallback.phone,
      };
    }

    if (clientId === null) {
      return {
        clientId: null,
        clientName: fallback.name,
        clientEmail: fallback.email,
        clientPhone: fallback.phone,
      };
    }

    const client = await quoteRepository.findClientById(workspaceId, clientId);
    if (!client) {
      throw notFound('Client not found in workspace', { clientId });
    }

    return {
      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone,
    };
  },

  async requireQuote(workspaceId: string, quoteId: string) {
    const quote = await quoteRepository.findQuoteById(workspaceId, quoteId);
    if (!quote) {
      throw notFound('Quote not found');
    }
    return quote;
  },

  async listQuotes(workspaceId: string, query: unknown) {
    const filters = this.parseListFilters(query);
    const result = await quoteRepository.listQuotes({
      workspaceId,
      status: filters.status,
      q: filters.q,
      limit: filters.limit,
      cursor: filters.cursor,
      sort: filters.sort,
    });

    if (result.invalidCursor) {
      throw badRequest('cursor is invalid for current workspace');
    }

    return {
      items: result.items.map((item) => this.mapQuoteListItem(item)),
      pageInfo: {
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
      filters,
    };
  },

  async getQuote(workspaceId: string, quoteId: string) {
    const quote = await this.requireQuote(workspaceId, quoteId);
    return this.mapQuoteDetail(quote);
  },

  async getQuoteForPdf(workspaceId: string, quoteId: string): Promise<QuotePdfData> {
    const quote = await this.requireQuote(workspaceId, quoteId);

    return {
      id: quote.id,
      status: quote.status,
      total: quote.total,
      notes: quote.notes,
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
      client: quote.client
        ? {
            id: quote.client.id,
            name: quote.client.name,
            email: quote.client.email,
            phone: quote.client.phone,
          }
        : {
            id: quote.clientId,
            name: quote.clientName,
            email: quote.clientEmail,
            phone: quote.clientPhone,
          },
      lines: sortLinesNullLast(quote.lines).map((line) => ({
        id: line.id,
        title: line.title,
        qty: line.qty,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal ?? computeLineTotal(line.qty, line.unitPrice),
        order: line.order,
      })),
    };
  },

  async createQuote(workspaceId: string, body: unknown) {
    const payload = this.parseCreatePayload(body);
    const clientSnapshot = await this.resolveClientSnapshot(workspaceId, payload.clientId, {
      name: DEFAULT_CLIENT_NAME,
      email: null,
      phone: null,
    });

    const quote = await quoteRepository.createQuoteWithLines(workspaceId, {
      clientId: clientSnapshot.clientId ?? null,
      clientName: clientSnapshot.clientName,
      clientEmail: clientSnapshot.clientEmail,
      clientPhone: clientSnapshot.clientPhone,
      notes: payload.notes,
      total: payload.total,
      lines: payload.lines,
    });

    if (!quote) {
      throw notFound('Quote was not created');
    }

    return {
      quote: this.mapQuoteDetail(quote),
      metadata: {
        quoteId: quote.id,
        statusFrom: null,
        statusTo: quote.status,
        fieldsUpdated: ['clientId', 'notes', 'lines', 'total'],
      },
    };
  },

  async updateQuote(workspaceId: string, quoteId: string, body: unknown) {
    const currentQuote = await this.requireQuote(workspaceId, quoteId);
    if (currentQuote.status !== 'draft') {
      throw conflict('Only draft quotes are editable', {
        quoteId: currentQuote.id,
        status: currentQuote.status,
      });
    }

    const payload = this.parseUpdatePayload(body);
    const fieldsUpdated: string[] = [];

    const clientSnapshot = await this.resolveClientSnapshot(workspaceId, payload.clientId, {
      name: currentQuote.clientName,
      email: currentQuote.clientEmail,
      phone: currentQuote.clientPhone,
    });

    const updateData: {
      clientId?: string | null;
      clientName?: string;
      clientEmail?: string | null;
      clientPhone?: string | null;
      notes?: string | null;
    } = {};

    if (payload.clientId !== undefined) {
      updateData.clientId = clientSnapshot.clientId ?? null;
      updateData.clientName = clientSnapshot.clientName;
      updateData.clientEmail = clientSnapshot.clientEmail;
      updateData.clientPhone = clientSnapshot.clientPhone;
      fieldsUpdated.push('clientId');
    }

    if (payload.notes !== undefined) {
      updateData.notes = payload.notes;
      fieldsUpdated.push('notes');
    }

    const updatedCount = await quoteRepository.updateDraftQuote(workspaceId, quoteId, updateData);
    if (updatedCount === 0) {
      const latest = await quoteRepository.findQuoteStatus(workspaceId, quoteId);
      if (!latest) {
        throw notFound('Quote not found');
      }
      throw conflict('Only draft quotes are editable', {
        quoteId: latest.id,
        status: latest.status,
      });
    }

    const updated = await this.requireQuote(workspaceId, quoteId);

    return {
      quote: this.mapQuoteDetail(updated),
      metadata: {
        quoteId: updated.id,
        fieldsUpdated: sanitizeFields(fieldsUpdated),
      },
    };
  },

  async deleteQuote(workspaceId: string, quoteId: string) {
    const quote = await this.requireQuote(workspaceId, quoteId);
    if (quote.status !== 'draft') {
      throw conflict('Only draft quotes can be deleted', {
        quoteId: quote.id,
        status: quote.status,
      });
    }

    const deletedCount = await quoteRepository.deleteDraftQuote(workspaceId, quoteId);
    if (deletedCount === 0) {
      const latest = await quoteRepository.findQuoteStatus(workspaceId, quoteId);
      if (!latest) {
        throw notFound('Quote not found');
      }
      throw conflict('Only draft quotes can be deleted', {
        quoteId: latest.id,
        status: latest.status,
      });
    }

    return {
      ok: true,
      metadata: {
        quoteId,
        statusFrom: 'draft',
        statusTo: 'deleted',
        fieldsUpdated: ['deleted'],
      },
    };
  },

  async addLine(workspaceId: string, quoteId: string, body: unknown) {
    const quote = await this.requireQuote(workspaceId, quoteId);
    if (quote.status !== 'draft') {
      throw conflict('Only draft quotes are editable', {
        quoteId: quote.id,
        status: quote.status,
      });
    }

    const line = this.parseCreateLinePayload(body);
    const result = await quoteRepository.addLineToDraftQuote(workspaceId, quoteId, line);
    if (!result || !result.quote) {
      const latest = await quoteRepository.findQuoteStatus(workspaceId, quoteId);
      if (!latest) {
        throw notFound('Quote not found');
      }
      throw conflict('Only draft quotes are editable', {
        quoteId: latest.id,
        status: latest.status,
      });
    }

    return {
      quote: this.mapQuoteDetail(result.quote),
      metadata: {
        quoteId: result.quote.id,
        lineId: result.lineId,
        fieldsUpdated: ['lines', 'total'],
      },
    };
  },

  async updateLine(workspaceId: string, quoteId: string, lineId: string, body: unknown) {
    const quote = await this.requireQuote(workspaceId, quoteId);
    if (quote.status !== 'draft') {
      throw conflict('Only draft quotes are editable', {
        quoteId: quote.id,
        status: quote.status,
      });
    }

    const existingLine = await quoteRepository.findLineById(workspaceId, quoteId, lineId);
    if (!existingLine) {
      throw notFound('Quote line not found');
    }

    const patch = this.parseUpdateLinePayload(body);
    const nextQty = patch.qty ?? existingLine.qty;
    const nextUnitPrice = patch.unitPrice ?? existingLine.unitPrice;
    const nextLineTotal = computeLineTotal(nextQty, nextUnitPrice);

    const result = await quoteRepository.updateLineOnDraftQuote(workspaceId, quoteId, lineId, {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.qty !== undefined ? { qty: patch.qty } : {}),
      ...(patch.unitPrice !== undefined ? { unitPrice: patch.unitPrice } : {}),
      ...(patch.order !== undefined ? { order: patch.order } : {}),
      lineTotal: nextLineTotal,
    });

    if (!result) {
      const latest = await quoteRepository.findQuoteStatus(workspaceId, quoteId);
      if (!latest) {
        throw notFound('Quote not found');
      }
      throw conflict('Only draft quotes are editable', {
        quoteId: latest.id,
        status: latest.status,
      });
    }

    if (!result.lineUpdated || !result.quote) {
      throw notFound('Quote line not found');
    }

    return {
      quote: this.mapQuoteDetail(result.quote),
      metadata: {
        quoteId: result.quote.id,
        lineId,
        fieldsUpdated: sanitizeFields(Object.keys(patch).concat('lineTotal', 'total')),
      },
    };
  },

  async deleteLine(workspaceId: string, quoteId: string, lineId: string) {
    const quote = await this.requireQuote(workspaceId, quoteId);
    if (quote.status !== 'draft') {
      throw conflict('Only draft quotes are editable', {
        quoteId: quote.id,
        status: quote.status,
      });
    }

    const line = await quoteRepository.findLineById(workspaceId, quoteId, lineId);
    if (!line) {
      throw notFound('Quote line not found');
    }

    const result = await quoteRepository.deleteLineFromDraftQuote(workspaceId, quoteId, lineId);
    if (!result) {
      const latest = await quoteRepository.findQuoteStatus(workspaceId, quoteId);
      if (!latest) {
        throw notFound('Quote not found');
      }
      throw conflict('Only draft quotes are editable', {
        quoteId: latest.id,
        status: latest.status,
      });
    }

    if (!result.lineDeleted || !result.quote) {
      throw notFound('Quote line not found');
    }

    return {
      quote: this.mapQuoteDetail(result.quote),
      metadata: {
        quoteId: result.quote.id,
        lineId: line.id,
        fieldsUpdated: ['lines', 'total'],
      },
    };
  },

  async sendQuote(workspaceId: string, quoteId: string) {
    const quote = await this.requireQuote(workspaceId, quoteId);
    const updatedCount = await quoteRepository.transitionQuoteStatus(
      workspaceId,
      quoteId,
      'draft',
      'sent',
    );

    if (updatedCount === 0) {
      const latest = await quoteRepository.findQuoteStatus(workspaceId, quoteId);
      if (!latest) {
        throw notFound('Quote not found');
      }
      throw conflict('Only draft quotes can be sent', {
        quoteId: latest.id,
        status: latest.status,
      });
    }

    const updated = await this.requireQuote(workspaceId, quoteId);

    return {
      quote: this.mapQuoteDetail(updated),
      metadata: {
        quoteId: updated.id,
        statusFrom: quote.status,
        statusTo: 'sent',
        fieldsUpdated: ['status'],
      },
    };
  },

  async acceptQuote(workspaceId: string, quoteId: string) {
    const quote = await this.requireQuote(workspaceId, quoteId);
    const updatedCount = await quoteRepository.transitionQuoteStatus(
      workspaceId,
      quoteId,
      'sent',
      'accepted',
    );

    if (updatedCount === 0) {
      const latest = await quoteRepository.findQuoteStatus(workspaceId, quoteId);
      if (!latest) {
        throw notFound('Quote not found');
      }
      throw conflict('Only sent quotes can be accepted', {
        quoteId: latest.id,
        status: latest.status,
      });
    }

    const updated = await this.requireQuote(workspaceId, quoteId);

    return {
      quote: this.mapQuoteDetail(updated),
      metadata: {
        quoteId: updated.id,
        statusFrom: quote.status,
        statusTo: 'accepted',
        fieldsUpdated: ['status'],
      },
    };
  },
};
