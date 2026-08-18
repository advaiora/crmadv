import assert from 'node:assert/strict';
import test from 'node:test';
import type { Transporter } from 'nodemailer';
import { Prisma } from '@prisma/client';
import {
  buildQuoteNotificationsService,
  renderQuoteNotificationTemplate,
} from './notifications.js';

const createTransportStub = (calls: Array<Record<string, unknown>>) =>
  ({
    sendMail: async (payload: Record<string, unknown>) => {
      calls.push(payload);
      return {
        messageId: 'provider-message-id',
      };
    },
  }) as unknown as Transporter;

test('renderQuoteNotificationTemplate replaces all placeholders', () => {
  const rendered = renderQuoteNotificationTemplate(
    'Ciao {cliente}, preventivo {numero} su {workspace} ({stato}) totale {totale}',
    {
      clientName: 'Mario Rossi',
      quoteNumber: 'ABCD1234',
      workspaceName: 'Agency OS',
      status: 'SENT',
      total: 'EUR 122,00',
    },
  );

  assert.equal(
    rendered,
    'Ciao Mario Rossi, preventivo ABCD1234 su Agency OS (SENT) totale EUR 122,00',
  );
});

test('notifyQuoteEvent skips delivery when client email is missing', async () => {
  const sentEmails: Array<Record<string, unknown>> = [];
  const service = buildQuoteNotificationsService({
    getNotificationSettings: async () => null,
    upsertNotificationSettings: async (_workspaceId, payload) => ({
      id: 'settings-1',
      workspaceId: 'workspace-1',
      enabled: payload.enabled ?? true,
      sentSubject: payload.sentSubject ?? null,
      sentBody: payload.sentBody ?? null,
      acceptedSubject: payload.acceptedSubject ?? null,
      acceptedBody: payload.acceptedBody ?? null,
      rejectedSubject: payload.rejectedSubject ?? null,
      rejectedBody: payload.rejectedBody ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    findBrandingByWorkspaceId: async () => null,
    renderQuotePdfFn: async () => Buffer.from('pdf'),
    resolveTransport: async () => ({
      esito: 'ok' as const,
      transport: createTransportStub(sentEmails),
      from: 'no-reply@test.local',
      source: 'env' as const,
    }),
  });

  const result = await service.notifyQuoteEvent({
    workspaceId: 'workspace-1',
    event: 'SENT',
    quote: {
      id: 'quote-1',
      status: 'SENT',
      currency: 'EUR',
      total: 100,
      client: {
        name: 'Cliente senza email',
        email: null,
      },
    },
  });

  assert.equal(result.delivered, false);
  assert.equal(result.skippedReason, 'CLIENT_EMAIL_MISSING');
  assert.equal(sentEmails.length, 0);
});

test('notifyQuoteEvent sends templated email and PDF attachment for SENT', async () => {
  const sentEmails: Array<Record<string, unknown>> = [];
  const service = buildQuoteNotificationsService({
    getNotificationSettings: async () => ({
      id: 'settings-1',
      workspaceId: 'workspace-1',
      enabled: true,
      sentSubject: 'Invio quote {numero}',
      sentBody: 'Ciao {cliente}, totale {totale}',
      acceptedSubject: null,
      acceptedBody: null,
      rejectedSubject: null,
      rejectedBody: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    upsertNotificationSettings: async (_workspaceId, payload) => ({
      id: 'settings-1',
      workspaceId: 'workspace-1',
      enabled: payload.enabled ?? true,
      sentSubject: payload.sentSubject ?? null,
      sentBody: payload.sentBody ?? null,
      acceptedSubject: payload.acceptedSubject ?? null,
      acceptedBody: payload.acceptedBody ?? null,
      rejectedSubject: payload.rejectedSubject ?? null,
      rejectedBody: payload.rejectedBody ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    findBrandingByWorkspaceId: async () => ({
      workspaceId: 'workspace-1',
      workspaceName: 'Agency Workspace',
      supportEmail: 'support@example.com',
      logoUrl: null,
      primaryColor: '#0d6efd',
      secondaryColor: '#111827',
      supportPhone: null,
      supportAddress: null,
      pdfSignatureUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    renderQuotePdfFn: async () => Buffer.from('%PDF-1.4 test-pdf'),
    resolveTransport: async () => ({
      esito: 'ok' as const,
      transport: createTransportStub(sentEmails),
      from: 'no-reply@test.local',
      source: 'env' as const,
    }),
  });

  const result = await service.notifyQuoteEvent({
    workspaceId: 'workspace-1',
    event: 'SENT',
    quote: {
      id: 'quote-abcdef01',
      status: 'SENT',
      currency: 'EUR',
      total: 122,
      client: {
        name: 'Mario Rossi',
        email: 'mario@example.com',
      },
    },
    quotePdfData: {
      id: 'quote-abcdef01',
      status: 'SENT',
      currency: 'EUR',
      subtotal: new Prisma.Decimal(100),
      taxTotal: new Prisma.Decimal(22),
      total: new Prisma.Decimal(122),
      issueDate: new Date('2026-02-25T00:00:00.000Z'),
      validUntil: null,
      notes: null,
      createdAt: new Date('2026-02-25T00:00:00.000Z'),
      updatedAt: new Date('2026-02-25T00:00:00.000Z'),
      client: {
        id: 'client-1',
        name: 'Mario Rossi',
        email: 'mario@example.com',
        phone: null,
        street: null,
        city: null,
        zip: null,
        province: null,
        country: null,
      },
      lines: [],
    },
  });

  assert.equal(result.delivered, true);
  assert.equal(result.providerMessageId, 'provider-message-id');
  assert.equal(sentEmails.length, 1);
  assert.match(String(sentEmails[0].subject), /INVIO QUOTE/i);
  assert.match(String(sentEmails[0].text), /Mario Rossi/);
  assert.ok(Array.isArray(sentEmails[0].attachments));
  assert.equal((sentEmails[0].attachments as Array<unknown>).length, 1);
});

test('notifiche preventivi: configurazione illeggibile non si confonde con "non configurato"', async () => {
  const service = buildQuoteNotificationsService({
    getNotificationSettings: async () => ({
      workspaceId: 'ws-1',
      enabled: true,
      sentSubject: null,
      sentBody: null,
      acceptedSubject: null,
      acceptedBody: null,
      rejectedSubject: null,
      rejectedBody: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as never,
    findBrandingByWorkspaceId: (async () => null) as never,
    renderQuotePdfFn: async () => Buffer.from('pdf'),
    resolveTransport: async () => ({ esito: 'illeggibile' as const }),
  });

  const result = await service.notifyQuoteEvent({
    workspaceId: 'ws-1',
    event: 'SENT',
    quote: {
      id: 'quote-1',
      status: 'SENT',
      currency: 'EUR',
      total: 100,
      client: {
        name: 'Mario Rossi',
        email: 'mario@example.com',
      },
    },
  });

  // Non "MAIL_NOT_CONFIGURED": chi guarda i contatori deve poter distinguere
  // "va configurato" da "la password non si legge piu'", che portano a due
  // rimedi diversi.
  assert.equal(result.delivered, false);
  assert.equal(result.skippedReason, 'MAIL_CONFIG_UNREADABLE');
});
