import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { badRequest, internalServerError } from '../../../core/errors.js';
import { ok } from '../../../core/response.js';
import { audit } from '../../../audit/audit.js';
import { renderQuotePdf } from '../pdf/quotePdf.js';
import {
  QUOTES_PERMISSIONS,
  ensureQuotesAccess,
} from '../policies.js';
import { quotesService } from '../service.js';
import { brandingRepository } from '../../../repositories/branding.repository.js';
import { quotesMetrics, type QuoteOperationName } from '../metrics.js';
import { quoteNotificationsMetrics } from '../notifications.js';

const MAX_ITEMS_COUNT = 200;
const MAX_LIST_PAGE_SIZE = 100;
const MAX_LOOKUP_LIMIT = 50;
const DATE_INPUT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const idSchema = z.string().trim().min(1);

const decimalNumberSchema = z.coerce.number().finite();

const optionalNullableTrimmedStringSchema = z.union([
  z.string().trim(),
  z.null(),
]).optional();

const quoteItemSchema = z.object({
  position: z.coerce.number().int().positive().optional(),
  title: z.string().trim().min(1),
  description: optionalNullableTrimmedStringSchema,
  quantity: decimalNumberSchema.gt(0),
  unitPrice: decimalNumberSchema.gte(0),
  discountType: z.enum(['PERCENT', 'FIXED']).optional().nullable(),
  discountValue: decimalNumberSchema.gte(0).optional().nullable(),
}).strict();

const quoteStatusSchema = z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']);

const listQuotesQuerySchema = z.object({
  status: quoteStatusSchema.optional(),
  clientId: idSchema.optional(),
  projectId: idSchema.optional(),
  q: z.string().trim().max(120).optional(),
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(MAX_LIST_PAGE_SIZE).optional(),
}).strict();

const quoteParamsSchema = z.object({
  id: idSchema,
}).strict();

const quotesLookupQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  clientId: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LOOKUP_LIMIT).optional(),
  createdFrom: z.string().trim().regex(DATE_INPUT_REGEX).optional(),
  createdTo: z.string().trim().regex(DATE_INPUT_REGEX).optional(),
}).strict();

const pdfQuerySchema = z.object({
  includeItems: z.coerce.boolean().optional(),
  includeCompanyFooter: z.coerce.boolean().optional(),
  headerTitle: z.string().trim().max(120).optional(),
  footerNote: z.string().trim().max(400).optional(),
  signatureUrl: z.string().trim().url().optional(),
  companyName: z.string().trim().max(160).optional(),
  supportEmail: z.string().trim().email().optional(),
  supportPhone: z.string().trim().max(60).optional(),
  supportAddress: z.string().trim().max(240).optional(),
}).strict();

const updateNotificationTemplatesBodySchema = z.object({
  enabled: z.boolean().optional(),
  sentSubject: optionalNullableTrimmedStringSchema,
  sentBody: optionalNullableTrimmedStringSchema,
  acceptedSubject: optionalNullableTrimmedStringSchema,
  acceptedBody: optionalNullableTrimmedStringSchema,
  rejectedSubject: optionalNullableTrimmedStringSchema,
  rejectedBody: optionalNullableTrimmedStringSchema,
}).strict().superRefine((value, context) => {
  if (Object.keys(value).length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one field is required',
    });
  }
});

const createQuoteBodySchema = z.object({
  clientId: idSchema,
  projectId: idSchema.nullable().optional(),
  templateId: idSchema.nullable().optional(),
  currency: z.string().trim().length(3).optional(),
  taxRate: decimalNumberSchema.gte(0).lte(100).nullable().optional(),
  issueDate: z.string().datetime().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
  notes: optionalNullableTrimmedStringSchema,
  internalNotes: optionalNullableTrimmedStringSchema,
  items: z.array(quoteItemSchema).max(MAX_ITEMS_COUNT).optional(),
}).strict();

const updateQuoteBodySchema = z.object({
  clientId: idSchema.optional(),
  projectId: idSchema.nullable().optional(),
  templateId: idSchema.nullable().optional(),
  currency: z.string().trim().length(3).optional(),
  taxRate: decimalNumberSchema.gte(0).lte(100).nullable().optional(),
  issueDate: z.string().datetime().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
  notes: optionalNullableTrimmedStringSchema,
  internalNotes: optionalNullableTrimmedStringSchema,
  items: z.array(quoteItemSchema).max(MAX_ITEMS_COUNT).optional(),
}).strict().superRefine((value, context) => {
  if (Object.keys(value).length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one field is required',
    });
  }
});

const parseWithSchema = <TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown,
  errorMessage: string,
) => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw badRequest(errorMessage, {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const nowMs = () => Number(process.hrtime.bigint() / BigInt(1_000_000));

const trackQuoteOperation = async <T>(
  request: FastifyRequest,
  workspaceId: string,
  operation: QuoteOperationName,
  execute: () => Promise<T>,
) => {
  const startedAt = nowMs();

  try {
    const result = await execute();
    const durationMs = nowMs() - startedAt;
    quotesMetrics.recordOperation(workspaceId, operation, durationMs, true);
    request.log.info(
      {
        workspaceId,
        operation,
        durationMs,
      },
      'Quotes operation completed',
    );
    return result;
  } catch (error) {
    const durationMs = nowMs() - startedAt;
    quotesMetrics.recordOperation(workspaceId, operation, durationMs, false);
    request.log.warn(
      {
        workspaceId,
        operation,
        durationMs,
        err: error,
      },
      'Quotes operation failed',
    );
    throw error;
  }
};

const workspaceQuotesRoute: FastifyPluginAsync = async (app) => {
  app.get('/quotes/metrics', async (request, reply) => {
    const { workspace } = await ensureQuotesAccess(request, QUOTES_PERMISSIONS.manageTemplates);

    return ok(reply, {
      operations: quotesMetrics.getWorkspaceSnapshot(workspace.id),
      notifications: quoteNotificationsMetrics.getWorkspaceSnapshot(workspace.id),
    });
  });

  app.get('/quotes', async (request, reply) => {
    const { workspace } = await ensureQuotesAccess(request, QUOTES_PERMISSIONS.view);
    const query = parseWithSchema(
      listQuotesQuerySchema,
      request.query ?? {},
      'Invalid quotes query params',
    );

    const result = await quotesService.listQuotes(workspace.id, query);
    return ok(reply, result);
  });

  app.get('/quotes/lookups/clients', async (request, reply) => {
    const { workspace } = await ensureQuotesAccess(request, QUOTES_PERMISSIONS.view);
    const query = parseWithSchema(
      quotesLookupQuerySchema,
      request.query ?? {},
      'Invalid clients lookup params',
    );

    const items = await quotesService.listClientsForPicker(workspace.id, query);
    return ok(reply, { items });
  });

  app.get('/quotes/lookups/projects', async (request, reply) => {
    const { workspace } = await ensureQuotesAccess(request, QUOTES_PERMISSIONS.view);
    const query = parseWithSchema(
      quotesLookupQuerySchema,
      request.query ?? {},
      'Invalid projects lookup params',
    );

    const items = await quotesService.listProjectsForPicker(workspace.id, query);
    return ok(reply, { items });
  });

  app.post<{ Body: unknown }>('/quotes', async (request, reply) => {
    const { user, workspace } = await ensureQuotesAccess(request, QUOTES_PERMISSIONS.create);
    const body = parseWithSchema(
      createQuoteBodySchema,
      request.body,
      'Invalid quote payload',
    );

    const quote = await trackQuoteOperation(request, workspace.id, 'create', async () =>
      quotesService.createQuote({
        workspaceId: workspace.id,
        actorUserId: user.id,
        payload: body,
      }),
    );

    await audit.log({
      event: 'quotes.create',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'quote',
      entityId: quote.id,
      metadata: {
        status: quote.status,
        clientId: quote.clientId,
        projectId: quote.projectId,
      },
      request,
    });

    return ok(reply, { quote }, 201);
  });

  app.get<{ Params: unknown }>('/quotes/:id', async (request, reply) => {
    const { workspace } = await ensureQuotesAccess(request, QUOTES_PERMISSIONS.view);
    const params = parseWithSchema(
      quoteParamsSchema,
      request.params,
      'Invalid quote id',
    );

    const quote = await quotesService.getQuoteById(workspace.id, params.id);
    return ok(reply, { quote });
  });

  app.get<{ Params: unknown; Querystring: unknown }>('/quotes/:id/pdf', async (request, reply) => {
    const { user, workspace } = await ensureQuotesAccess(request, QUOTES_PERMISSIONS.view);
    const params = parseWithSchema(
      quoteParamsSchema,
      request.params,
      'Invalid quote id',
    );
    const query = parseWithSchema(
      pdfQuerySchema,
      request.query ?? {},
      'Invalid quote PDF params',
    );

    const quote = await quotesService.getQuoteForPdf(workspace.id, params.id);
    const branding = await brandingRepository.findByWorkspaceId(workspace.id);
    const workspaceLabel = branding?.workspaceName?.trim() || workspace.name;

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await trackQuoteOperation(request, workspace.id, 'exportPdf', async () =>
        renderQuotePdf(quote, {
          name: query.companyName || workspaceLabel,
          supportEmail: query.supportEmail || branding?.supportEmail || null,
          logoUrl: branding?.logoUrl ?? null,
          primaryColor: branding?.primaryColor ?? null,
          secondaryColor: branding?.secondaryColor ?? null,
          supportPhone: query.supportPhone || branding?.supportPhone || null,
          supportAddress: query.supportAddress || branding?.supportAddress || null,
        }, {
          includeItems: query.includeItems ?? true,
          includeCompanyFooter: query.includeCompanyFooter ?? true,
          headerTitle: query.headerTitle,
          footerNote: query.footerNote,
          signatureUrl: query.signatureUrl || branding?.pdfSignatureUrl || null,
        }),
      );
    } catch (error) {
      request.log.error(
        {
          err: error,
          quoteId: params.id,
          workspaceId: workspace.id,
        },
        'Failed to render quote pdf',
      );
      throw internalServerError('Failed to render quote PDF');
    }

    await audit.log({
      event: 'quotes.export_pdf',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'quote',
      entityId: params.id,
      metadata: {
        includeItems: query.includeItems ?? true,
        includeCompanyFooter: query.includeCompanyFooter ?? true,
      },
      request,
    });

    const fileName = `quote_${quote.id.slice(0, 8)}.pdf`;
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Length', String(pdfBuffer.byteLength));
    reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
    return reply.send(pdfBuffer);
  });

  app.patch<{ Params: unknown; Body: unknown }>('/quotes/:id', async (request, reply) => {
    const { user, workspace } = await ensureQuotesAccess(request, QUOTES_PERMISSIONS.edit);
    const params = parseWithSchema(
      quoteParamsSchema,
      request.params,
      'Invalid quote id',
    );
    const body = parseWithSchema(
      updateQuoteBodySchema,
      request.body,
      'Invalid quote update payload',
    );

    const quote = await trackQuoteOperation(request, workspace.id, 'update', async () =>
      quotesService.updateQuote({
        workspaceId: workspace.id,
        quoteId: params.id,
        payload: body,
      }),
    );

    await audit.log({
      event: 'quotes.update',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'quote',
      entityId: quote.id,
      metadata: {
        status: quote.status,
      },
      request,
    });

    return ok(reply, { quote });
  });

  app.put<{ Params: unknown; Body: unknown }>('/quotes/:id', async (request, reply) => {
    const { user, workspace } = await ensureQuotesAccess(request, QUOTES_PERMISSIONS.edit);
    const params = parseWithSchema(
      quoteParamsSchema,
      request.params,
      'Invalid quote id',
    );
    const body = parseWithSchema(
      updateQuoteBodySchema,
      request.body,
      'Invalid quote update payload',
    );

    const quote = await trackQuoteOperation(request, workspace.id, 'update', async () =>
      quotesService.updateQuote({
        workspaceId: workspace.id,
        quoteId: params.id,
        payload: body,
      }),
    );

    await audit.log({
      event: 'quotes.update',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'quote',
      entityId: quote.id,
      metadata: {
        status: quote.status,
      },
      request,
    });

    return ok(reply, { quote });
  });

  app.delete<{ Params: unknown }>('/quotes/:id', async (request, reply) => {
    const { user, workspace } = await ensureQuotesAccess(request, QUOTES_PERMISSIONS.delete);
    const params = parseWithSchema(
      quoteParamsSchema,
      request.params,
      'Invalid quote id',
    );

    await trackQuoteOperation(request, workspace.id, 'delete', async () => {
      await quotesService.deleteQuote(workspace.id, params.id);
      return true;
    });
    await audit.log({
      event: 'quotes.delete',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'quote',
      entityId: params.id,
      request,
    });
    reply.code(204);
    return reply.send();
  });

  app.post<{ Params: unknown }>('/quotes/:id/send', async (request, reply) => {
    const { user, workspace } = await ensureQuotesAccess(request, QUOTES_PERMISSIONS.send);
    const params = parseWithSchema(
      quoteParamsSchema,
      request.params,
      'Invalid quote id',
    );

    const quote = await trackQuoteOperation(request, workspace.id, 'send', async () =>
      quotesService.changeStatusToSent(workspace.id, params.id),
    );
    await audit.log({
      event: 'quotes.send',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'quote',
      entityId: quote.id,
      metadata: {
        status: quote.status,
      },
      request,
    });
    return ok(reply, { quote });
  });

  app.post<{ Params: unknown }>('/quotes/:id/accept', async (request, reply) => {
    const { user, workspace } = await ensureQuotesAccess(request, QUOTES_PERMISSIONS.accept);
    const params = parseWithSchema(
      quoteParamsSchema,
      request.params,
      'Invalid quote id',
    );

    const quote = await trackQuoteOperation(request, workspace.id, 'accept', async () =>
      quotesService.acceptQuote(workspace.id, params.id),
    );
    await audit.log({
      event: 'quotes.accept',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'quote',
      entityId: quote.id,
      metadata: {
        status: quote.status,
      },
      request,
    });
    return ok(reply, { quote });
  });

  app.post<{ Params: unknown }>('/quotes/:id/reject', async (request, reply) => {
    const { user, workspace } = await ensureQuotesAccess(request, QUOTES_PERMISSIONS.accept);
    const params = parseWithSchema(
      quoteParamsSchema,
      request.params,
      'Invalid quote id',
    );

    const quote = await trackQuoteOperation(request, workspace.id, 'reject', async () =>
      quotesService.rejectQuote(workspace.id, params.id),
    );
    await audit.log({
      event: 'quotes.reject',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'quote',
      entityId: quote.id,
      metadata: {
        status: quote.status,
      },
      request,
    });
    return ok(reply, { quote });
  });

  app.post<{ Params: unknown }>('/quotes/:id/cancel-send', async (request, reply) => {
    const { user, workspace } = await ensureQuotesAccess(request, QUOTES_PERMISSIONS.send);
    const params = parseWithSchema(
      quoteParamsSchema,
      request.params,
      'Invalid quote id',
    );

    const quote = await trackQuoteOperation(request, workspace.id, 'cancelSend', async () =>
      quotesService.cancelSentQuote(workspace.id, params.id),
    );
    await audit.log({
      event: 'quotes.cancel_send',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'quote',
      entityId: quote.id,
      metadata: {
        status: quote.status,
      },
      request,
    });
    return ok(reply, { quote });
  });

  app.post<{ Params: unknown }>('/quotes/:id/resend', async (request, reply) => {
    const { user, workspace } = await ensureQuotesAccess(request, QUOTES_PERMISSIONS.send);
    const params = parseWithSchema(
      quoteParamsSchema,
      request.params,
      'Invalid quote id',
    );

    const quote = await trackQuoteOperation(request, workspace.id, 'resend', async () =>
      quotesService.resendQuote(workspace.id, params.id),
    );
    await audit.log({
      event: 'quotes.resend',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'quote',
      entityId: quote.id,
      metadata: {
        status: quote.status,
      },
      request,
    });
    return ok(reply, { quote });
  });

  app.get('/notifications/quotes', async (request, reply) => {
    const { workspace } = await ensureQuotesAccess(request, QUOTES_PERMISSIONS.manageTemplates);
    const templates = await quotesService.getNotificationSettings(workspace.id);

    return ok(reply, { templates });
  });

  app.put<{ Body: unknown }>('/notifications/quotes', async (request, reply) => {
    const { user, workspace } = await ensureQuotesAccess(request, QUOTES_PERMISSIONS.manageTemplates);
    const body = parseWithSchema(
      updateNotificationTemplatesBodySchema,
      request.body,
      'Invalid quote notification template payload',
    );

    const templates = await trackQuoteOperation(
      request,
      workspace.id,
      'updateNotificationTemplates',
      async () => quotesService.updateNotificationSettings(workspace.id, body),
    );
    await audit.log({
      event: 'quotes.notifications.update_templates',
      actorUserId: user.id,
      workspaceId: workspace.id,
      metadata: {
        enabled: templates.enabled,
      },
      request,
    });
    return ok(reply, { templates });
  });
};

export default workspaceQuotesRoute;
