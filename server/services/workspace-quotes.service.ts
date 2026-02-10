import { Prisma, QuoteStatus } from '@prisma/client';
import { badRequest, conflict, notFound } from '../core/errors.js';
import { quoteRepository } from '../repositories/quote.repository.js';

const QUOTE_STATUSES: QuoteStatus[] = ['draft', 'sent', 'accepted'];
const DEFAULT_CLIENT_NAME = 'Unknown client';

type QuoteLineInput = {
  title: string;
  qty: number;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  order: number | null;
};

type QuoteWritePayload = {
  notes: string | null;
  lines: QuoteLineInput[];
  total: Prisma.Decimal;
};

type QuoteListFilters = {
  status?: QuoteStatus;
  q?: string;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parsePriceDecimal = (value: unknown, fieldName: string): Prisma.Decimal => {
  let rawValue: string;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw badRequest(`${fieldName} must be a finite number`);
    }

    rawValue = value.toString();
  } else if (typeof value === 'string' && value.trim()) {
    rawValue = value.trim();
  } else {
    throw badRequest(`${fieldName} must be a number`);
  }

  if (!/^\d+(\.\d{1,2})?$/.test(rawValue)) {
    throw badRequest(`${fieldName} must have at most 2 decimal places`);
  }

  const decimalValue = new Prisma.Decimal(rawValue);
  if (decimalValue.isNegative()) {
    throw badRequest(`${fieldName} must be >= 0`);
  }

  return decimalValue;
};

const normalizeNotes = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw badRequest('notes must be a string');
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
};

const toMoneyNumber = (value: Prisma.Decimal | null) => (value ? value.toNumber() : null);

export const workspaceQuotesService = {
  parseListFilters(query: unknown): QuoteListFilters {
    if (query === undefined) {
      return {};
    }

    if (!isObject(query)) {
      throw badRequest('Querystring is invalid');
    }

    const filters: QuoteListFilters = {};

    if (query.status !== undefined) {
      if (typeof query.status !== 'string' || !QUOTE_STATUSES.includes(query.status as QuoteStatus)) {
        throw badRequest('status filter is invalid', {
          accepted: QUOTE_STATUSES,
        });
      }

      filters.status = query.status as QuoteStatus;
    }

    if (query.q !== undefined) {
      if (typeof query.q !== 'string') {
        throw badRequest('q filter must be a string');
      }

      const normalizedQ = query.q.trim();
      if (normalizedQ) {
        filters.q = normalizedQ;
      }
    }

    return filters;
  },

  parseWritePayload(body: unknown): QuoteWritePayload {
    if (!isObject(body)) {
      throw badRequest('Body must be a JSON object');
    }

    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      throw badRequest('lines must be a non-empty array');
    }

    const lines: QuoteLineInput[] = body.lines.map((line: unknown, index: number) => {
      if (!isObject(line)) {
        throw badRequest(`lines[${index}] must be an object`);
      }

      if (typeof line.title !== 'string' || !line.title.trim()) {
        throw badRequest(`lines[${index}].title is required`);
      }

      const qtyValue = line.qty ?? 1;
      if (!Number.isInteger(qtyValue) || (qtyValue as number) <= 0) {
        throw badRequest(`lines[${index}].qty must be an integer > 0`);
      }

      const unitPrice = parsePriceDecimal(line.unitPrice, `lines[${index}].unitPrice`);
      const lineTotal = unitPrice.mul(new Prisma.Decimal(qtyValue as number));

      let order: number | null = null;
      if (line.order !== undefined && line.order !== null) {
        if (!Number.isInteger(line.order) || (line.order as number) < 0) {
          throw badRequest(`lines[${index}].order must be an integer >= 0`);
        }

        order = line.order as number;
      }

      return {
        title: line.title.trim(),
        qty: qtyValue as number,
        unitPrice,
        lineTotal,
        order,
      };
    });

    const total = lines.reduce(
      (acc, line) => acc.add(line.lineTotal),
      new Prisma.Decimal(0),
    );

    return {
      notes: normalizeNotes(body.notes),
      lines,
      total,
    };
  },

  mapQuote(quote: NonNullable<Awaited<ReturnType<typeof quoteRepository.findById>>>) {
    return {
      id: quote.id,
      workspaceId: quote.workspaceId,
      clientId: quote.clientId,
      clientName: quote.clientName,
      clientEmail: quote.clientEmail,
      clientPhone: quote.clientPhone,
      status: quote.status,
      total: quote.total.toNumber(),
      notes: quote.notes,
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
      lines: quote.lines.map((line) => ({
        id: line.id,
        quoteId: line.quoteId,
        title: line.title,
        qty: line.qty,
        unitPrice: line.unitPrice.toNumber(),
        lineTotal: toMoneyNumber(line.lineTotal),
        order: line.order,
      })),
    };
  },

  async listQuotes(workspaceId: string, query: unknown) {
    const filters = this.parseListFilters(query);
    const quotes = await quoteRepository.list(workspaceId, filters);
    return quotes.map((quote) => this.mapQuote(quote));
  },

  async createQuote(workspaceId: string, body: unknown) {
    const payload = this.parseWritePayload(body);
    const quote = await quoteRepository.createWithLines(workspaceId, {
      notes: payload.notes,
      total: payload.total,
      lines: payload.lines,
      clientName: DEFAULT_CLIENT_NAME,
    });

    if (!quote) {
      throw notFound('Quote was not created');
    }

    return {
      quote: this.mapQuote(quote),
      changes: {
        status: quote.status,
        total: quote.total.toNumber(),
        linesCount: quote.lines.length,
      },
    };
  },

  async getQuote(workspaceId: string, quoteId: string) {
    const quote = await quoteRepository.findById(workspaceId, quoteId);
    if (!quote) {
      throw notFound('Quote not found');
    }

    return this.mapQuote(quote);
  },

  async updateQuote(workspaceId: string, quoteId: string, body: unknown) {
    const existingQuote = await quoteRepository.findById(workspaceId, quoteId);
    if (!existingQuote) {
      throw notFound('Quote not found');
    }

    if (existingQuote.status === 'accepted') {
      throw conflict('Accepted quotes cannot be modified', {
        quoteId: existingQuote.id,
        status: existingQuote.status,
      });
    }

    const payload = this.parseWritePayload(body);
    const updatedQuote = await quoteRepository.updateWithLines(workspaceId, quoteId, payload);
    if (!updatedQuote) {
      throw notFound('Quote not found');
    }

    return {
      quote: this.mapQuote(updatedQuote),
      changes: {
        ...(existingQuote.notes !== updatedQuote.notes
          ? { notes: { from: existingQuote.notes, to: updatedQuote.notes } }
          : {}),
        ...(existingQuote.total.equals(updatedQuote.total)
          ? {}
          : {
              total: {
                from: existingQuote.total.toNumber(),
                to: updatedQuote.total.toNumber(),
              },
            }),
        ...(existingQuote.lines.length !== updatedQuote.lines.length
          ? {
              linesCount: {
                from: existingQuote.lines.length,
                to: updatedQuote.lines.length,
              },
            }
          : {}),
      },
    };
  },

  async deleteQuote(workspaceId: string, quoteId: string) {
    const quote = await quoteRepository.findById(workspaceId, quoteId);
    if (!quote) {
      throw notFound('Quote not found');
    }

    if (quote.status !== 'draft') {
      throw conflict('Only draft quotes can be deleted', {
        quoteId: quote.id,
        status: quote.status,
      });
    }

    await quoteRepository.delete(workspaceId, quoteId);

    return {
      id: quote.id,
      status: quote.status,
    };
  },

  async sendQuote(workspaceId: string, quoteId: string) {
    const quote = await quoteRepository.findById(workspaceId, quoteId);
    if (!quote) {
      throw notFound('Quote not found');
    }

    if (quote.status !== 'draft') {
      throw conflict('Only draft quotes can be sent', {
        quoteId: quote.id,
        status: quote.status,
      });
    }

    await quoteRepository.updateStatus(workspaceId, quoteId, 'sent');
    const updatedQuote = await quoteRepository.findById(workspaceId, quoteId);
    if (!updatedQuote) {
      throw notFound('Quote not found');
    }

    return {
      quote: this.mapQuote(updatedQuote),
      changes: {
        status: {
          from: 'draft',
          to: 'sent',
        },
      },
    };
  },

  async acceptQuote(workspaceId: string, quoteId: string) {
    const quote = await quoteRepository.findById(workspaceId, quoteId);
    if (!quote) {
      throw notFound('Quote not found');
    }

    if (quote.status !== 'sent') {
      throw conflict('Only sent quotes can be accepted', {
        quoteId: quote.id,
        status: quote.status,
      });
    }

    await quoteRepository.updateStatus(workspaceId, quoteId, 'accepted');
    const updatedQuote = await quoteRepository.findById(workspaceId, quoteId);
    if (!updatedQuote) {
      throw notFound('Quote not found');
    }

    return {
      quote: this.mapQuote(updatedQuote),
      changes: {
        status: {
          from: 'sent',
          to: 'accepted',
        },
      },
    };
  },
};
