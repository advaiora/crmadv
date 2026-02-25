import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma, type QuoteStatus } from '@prisma/client';
import { HttpError } from '../../core/errors.js';
import { buildQuotesService } from './service.js';
import type {
  QuoteDetailRecord,
  QuoteNotificationSettingsRecord,
  QuoteSummaryRecord,
  QuoteTemplateDetailRecord,
  QuoteTemplateSummaryRecord,
  QuotesRepository,
} from './repository.js';

const now = new Date('2026-02-24T00:00:00.000Z');

const createQuoteRecord = (
  workspaceId: string,
  quoteId: string,
  status: QuoteStatus,
  overrides: Partial<QuoteDetailRecord> = {},
): QuoteDetailRecord => {
  const quantity = new Prisma.Decimal(2);
  const unitPrice = new Prisma.Decimal(50);
  const lineTotal = quantity.mul(unitPrice);
  const defaultTaxRate = new Prisma.Decimal(22);
  const defaultTaxTotal = lineTotal.mul(defaultTaxRate).div(100).toDecimalPlaces(2);
  const defaultTotal = lineTotal.add(defaultTaxTotal).toDecimalPlaces(2);

  const base: QuoteDetailRecord = {
    id: quoteId,
    workspaceId,
    clientId: `client-${workspaceId}`,
    projectId: null,
    templateId: null,
    createdByUserId: null,
    status,
    currency: 'EUR',
    subtotal: lineTotal,
    taxTotal: defaultTaxTotal,
    total: defaultTotal,
    taxRate: defaultTaxRate,
    issueDate: null,
    validUntil: null,
    notes: null,
    internalNotes: null,
    createdAt: now,
    updatedAt: now,
    client: {
      id: `client-${workspaceId}`,
      name: `Client ${workspaceId}`,
      email: null,
      phone: null,
      street: null,
      city: null,
      zip: null,
      province: null,
      country: null,
    },
    project: null,
    template: null,
    items: [
      {
        id: `item-${quoteId}`,
        workspaceId,
        quoteId,
        position: 1,
        title: 'Servizio base',
        description: null,
        quantity,
        unitPrice,
        discountType: null,
        discountValue: null,
        lineTotal,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };

  return {
    ...base,
    ...overrides,
  };
};

const createInMemoryRepository = (quotes: QuoteDetailRecord[]): QuotesRepository => {
  const byWorkspace = new Map<string, Map<string, QuoteDetailRecord>>();
  let notificationSettings: QuoteNotificationSettingsRecord | null = null;

  for (const quote of quotes) {
    const workspaceQuotes = byWorkspace.get(quote.workspaceId) ?? new Map<string, QuoteDetailRecord>();
    workspaceQuotes.set(quote.id, quote);
    byWorkspace.set(quote.workspaceId, workspaceQuotes);
  }

  const findQuote = (workspaceId: string, quoteId: string) =>
    byWorkspace.get(workspaceId)?.get(quoteId) ?? null;

  const mapDetailToSummary = (quote: QuoteDetailRecord): QuoteSummaryRecord => ({
    id: quote.id,
    workspaceId: quote.workspaceId,
    clientId: quote.clientId,
    projectId: quote.projectId,
    templateId: quote.templateId,
    status: quote.status,
    currency: quote.currency,
    subtotal: quote.subtotal,
    taxTotal: quote.taxTotal,
    total: quote.total,
    taxRate: quote.taxRate,
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

  return {
    async clientExists(_workspaceId, clientId) {
      return { id: clientId };
    },
    async projectExists(_workspaceId, projectId) {
      return { id: projectId };
    },
    async listQuotes(workspaceId, filters) {
      const workspaceQuotes = Array.from(byWorkspace.get(workspaceId)?.values() ?? []);
      return {
        items: workspaceQuotes.map((quote) => mapDetailToSummary(quote)),
        total: workspaceQuotes.length,
      };
    },
    async listClientsForLookup() {
      return [];
    },
    async listProjectsForLookup() {
      return [];
    },
    async findQuoteById(workspaceId, quoteId) {
      return findQuote(workspaceId, quoteId);
    },
    async findQuoteStatus(workspaceId, quoteId) {
      const quote = findQuote(workspaceId, quoteId);
      if (!quote) {
        return null;
      }

      return {
        id: quote.id,
        status: quote.status,
      };
    },
    async createQuote() {
      throw new Error('Not implemented for this test');
    },
    async updateQuoteAndItems(workspaceId, quoteId, quotePatch, nextItems) {
      const quote = findQuote(workspaceId, quoteId);
      if (!quote) {
        return null;
      }

      Object.assign(quote, quotePatch);

      if (nextItems !== undefined) {
        quote.items = nextItems.map((item, index) => ({
          id: `${quote.id}-item-${index + 1}`,
          workspaceId,
          quoteId,
          position: item.position,
          title: item.title,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountType: item.discountType,
          discountValue: item.discountValue,
          lineTotal: item.lineTotal,
          createdAt: now,
          updatedAt: now,
        }));
      }

      quote.updatedAt = new Date(quote.updatedAt.getTime() + 1_000);
      return quote;
    },
    async transitionQuoteStatus(workspaceId, quoteId, from, to) {
      const quote = findQuote(workspaceId, quoteId);
      if (!quote || quote.status !== from) {
        return { count: 0 };
      }

      quote.status = to;
      return { count: 1 };
    },
    async deleteDraftQuote(workspaceId, quoteId) {
      const workspaceQuotes = byWorkspace.get(workspaceId);
      if (!workspaceQuotes) {
        return { count: 0 };
      }

      const quote = workspaceQuotes.get(quoteId);
      if (!quote || quote.status !== 'DRAFT') {
        return { count: 0 };
      }

      workspaceQuotes.delete(quoteId);
      return { count: 1 };
    },
    async listTemplates() {
      return [] as QuoteTemplateSummaryRecord[];
    },
    async findTemplateById() {
      return null as QuoteTemplateDetailRecord | null;
    },
    async createTemplate() {
      throw new Error('Not implemented for this test');
    },
    async updateTemplate() {
      throw new Error('Not implemented for this test');
    },
    async deleteTemplate() {
      return { count: 0 };
    },
    async getNotificationSettings() {
      return notificationSettings;
    },
    async upsertNotificationSettings(workspaceId, input) {
      notificationSettings = {
        id: 'notif-settings',
        workspaceId,
        enabled: input.enabled ?? true,
        sentSubject: input.sentSubject ?? null,
        sentBody: input.sentBody ?? null,
        acceptedSubject: input.acceptedSubject ?? null,
        acceptedBody: input.acceptedBody ?? null,
        rejectedSubject: input.rejectedSubject ?? null,
        rejectedBody: input.rejectedBody ?? null,
        createdAt: now,
        updatedAt: now,
      };

      return notificationSettings;
    },
  };
};

test('quotes service enforces workspace scope when reading quote detail', async () => {
  const repository = createInMemoryRepository([
    createQuoteRecord('workspace-a', 'quote-a', 'DRAFT'),
    createQuoteRecord('workspace-b', 'quote-b', 'DRAFT'),
  ]);

  const service = buildQuotesService(repository);

  await assert.rejects(
    async () => service.getQuoteById('workspace-a', 'quote-b'),
    (error: unknown) => error instanceof HttpError && error.statusCode === 404,
  );
});

test('quotes status transitions support happy path and reject invalid transitions', async () => {
  const repository = createInMemoryRepository([
    createQuoteRecord('workspace-1', 'quote-1', 'DRAFT'),
  ]);

  const service = buildQuotesService(repository);

  const sent = await service.changeStatusToSent('workspace-1', 'quote-1');
  assert.equal(sent.status, 'SENT');

  const accepted = await service.acceptQuote('workspace-1', 'quote-1');
  assert.equal(accepted.status, 'ACCEPTED');

  await assert.rejects(
    async () => service.rejectQuote('workspace-1', 'quote-1'),
    (error: unknown) => error instanceof HttpError && error.statusCode === 409,
  );
});

test('updateQuote allows SENT status and recalculates totals', async () => {
  const repository = createInMemoryRepository([
    createQuoteRecord('workspace-1', 'quote-sent', 'SENT'),
  ]);

  const service = buildQuotesService(repository);

  const updated = await service.updateQuote({
    workspaceId: 'workspace-1',
    quoteId: 'quote-sent',
    payload: {
      items: [
        {
          position: 1,
          title: 'Pacchetto premium',
          quantity: 3,
          unitPrice: 80,
        },
      ],
    },
  });

  assert.equal(updated.status, 'SENT');
  assert.equal(updated.subtotal, 240);
  assert.equal(updated.taxTotal, 52.8);
  assert.equal(updated.total, 292.8);
});

test('cancelSentQuote moves SENT back to DRAFT and blocks invalid status', async () => {
  const repository = createInMemoryRepository([
    createQuoteRecord('workspace-1', 'quote-cancel', 'SENT'),
  ]);

  const service = buildQuotesService(repository);
  const cancelled = await service.cancelSentQuote('workspace-1', 'quote-cancel');
  assert.equal(cancelled.status, 'DRAFT');

  await assert.rejects(
    async () => service.cancelSentQuote('workspace-1', 'quote-cancel'),
    (error: unknown) => error instanceof HttpError && error.statusCode === 409,
  );
});

test('deleteQuote removes only DRAFT quotes', async () => {
  const repository = createInMemoryRepository([
    createQuoteRecord('workspace-1', 'quote-draft', 'DRAFT'),
    createQuoteRecord('workspace-1', 'quote-sent', 'SENT'),
  ]);

  const service = buildQuotesService(repository);
  await service.deleteQuote('workspace-1', 'quote-draft');

  await assert.rejects(
    async () => service.getQuoteById('workspace-1', 'quote-draft'),
    (error: unknown) => error instanceof HttpError && error.statusCode === 404,
  );

  await assert.rejects(
    async () => service.deleteQuote('workspace-1', 'quote-sent'),
    (error: unknown) => error instanceof HttpError && error.statusCode === 409,
  );
});

test('resendQuote is allowed only for SENT status', async () => {
  const repository = createInMemoryRepository([
    createQuoteRecord('workspace-1', 'quote-draft', 'DRAFT'),
    createQuoteRecord('workspace-1', 'quote-sent', 'SENT'),
  ]);

  const service = buildQuotesService(repository);

  await assert.rejects(
    async () => service.resendQuote('workspace-1', 'quote-draft'),
    (error: unknown) => error instanceof HttpError && error.statusCode === 409,
  );

  const resent = await service.resendQuote('workspace-1', 'quote-sent');
  assert.equal(resent.status, 'SENT');
});

test('updateQuote validates items quantity and unit price', async () => {
  const repository = createInMemoryRepository([
    createQuoteRecord('workspace-1', 'quote-draft', 'DRAFT'),
  ]);

  const service = buildQuotesService(repository);

  await assert.rejects(
    async () =>
      service.updateQuote({
        workspaceId: 'workspace-1',
        quoteId: 'quote-draft',
        payload: {
          items: [
            {
              position: 1,
              title: 'Servizio',
              quantity: 0,
              unitPrice: 10,
            },
          ],
        },
      }),
    (error: unknown) => error instanceof HttpError && error.statusCode === 400,
  );
});
