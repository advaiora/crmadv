import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { renderQuotePdf } from './quotePdf.js';
import type { QuotePdfData } from '../service.js';

const sampleQuote: QuotePdfData = {
  id: 'q-1234567890',
  status: 'SENT',
  currency: 'EUR',
  subtotal: new Prisma.Decimal(100),
  taxTotal: new Prisma.Decimal(22),
  total: new Prisma.Decimal(122),
  issueDate: new Date('2026-02-20T00:00:00.000Z'),
  validUntil: new Date('2026-03-20T00:00:00.000Z'),
  notes: 'Questa e una nota di test.',
  createdAt: new Date('2026-02-20T00:00:00.000Z'),
  updatedAt: new Date('2026-02-24T00:00:00.000Z'),
  client: {
    id: 'client-1',
    name: 'Cliente Test',
    email: 'cliente@example.com',
    phone: '+39 333 1234567',
    street: 'Via Roma 1',
    city: 'Milano',
    zip: '20100',
    province: 'MI',
    country: 'IT',
  },
  lines: [
    {
      id: 'line-1',
      title: 'Servizio consulenza',
      qty: 2,
      unitPrice: new Prisma.Decimal(50),
      lineTotal: new Prisma.Decimal(100),
      order: 1,
    },
  ],
};

const sampleWorkspace = {
  name: 'Workspace Test',
  supportEmail: 'support@example.com',
  supportPhone: '+39 02 123456',
  supportAddress: 'Via Agency 10, Milano',
  logoUrl: null,
  primaryColor: '#0d6efd',
  secondaryColor: '#111827',
};

const tinyPngSignature =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6f4ZQAAAAASUVORK5CYII=';

test('renderQuotePdf builds branded PDF with signature and footer without errors', async () => {
  const buffer = await renderQuotePdf(sampleQuote, sampleWorkspace, {
    includeItems: true,
    includeCompanyFooter: true,
    signatureUrl: tinyPngSignature,
    headerTitle: 'Offerta personalizzata',
  });

  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.byteLength > 500);
  assert.equal(buffer.subarray(0, 4).toString('utf8'), '%PDF');
});

test('renderQuotePdf supports export without item table', async () => {
  const withItems = await renderQuotePdf(sampleQuote, sampleWorkspace, {
    includeItems: true,
    includeCompanyFooter: true,
  });
  const withoutItems = await renderQuotePdf(sampleQuote, sampleWorkspace, {
    includeItems: false,
    includeCompanyFooter: false,
    footerNote: 'Nota footer custom',
  });

  assert.ok(withItems.byteLength > 500);
  assert.ok(withoutItems.byteLength > 500);
  assert.equal(withoutItems.subarray(0, 4).toString('utf8'), '%PDF');
  assert.notEqual(withItems.byteLength, withoutItems.byteLength);
});
