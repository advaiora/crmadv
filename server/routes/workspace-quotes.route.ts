import type { QuoteEmailLogType } from '@prisma/client';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { audit } from '../audit/audit.js';
import { conflict, internalServerError, isHttpError } from '../core/errors.js';
import { ok } from '../core/response.js';
import { requireAuth } from '../guards/requireAuth.js';
import { requireModuleEnabled } from '../guards/requireModule.js';
import { requirePermission } from '../guards/requirePermission.js';
import { requireWorkspace } from '../guards/requireWorkspace.js';
import { maskEmail, sanitizeEmailError } from '../modules/quotes/email/email.utils.js';
import { renderQuotePdf } from '../modules/quotes/pdf/quotePdf.js';
import { brandingRepository } from '../repositories/branding.repository.js';
import { createTransport, sendMail } from '../../src/core/email/mailer.js';
import { buildQuoteEmail } from '../../src/modules/quotes/email/quoteEmailTemplate.js';
import { quoteEmailLogRepository } from '../repositories/quote-email-log.repository.js';
import {
  workspaceQuotesService,
  type QuoteSendEmailPayload,
} from '../services/workspace-quotes.service.js';

type QuoteParams = {
  id: string;
};

type QuoteLineParams = QuoteParams & {
  lineId: string;
};

type QuotesListQuery = {
  status?: string;
  q?: string;
  limit?: string;
  cursor?: string;
  sort?: string;
};

type QuotePdfQuery = {
  download?: string;
};

type QuoteEmailPreviewQuery = {
  to?: string;
  subject?: string;
  message?: string;
};

const QUOTES_MODULE = 'quotes';
const PDF_DOWNLOAD_FLAG = '1';
const EMAIL_PROVIDER = 'smtp';

const ensureQuotesAccess = async (request: Parameters<typeof requireAuth>[0], permissionKey: string) => {
  const user = await requireAuth(request);
  const workspace = await requireWorkspace(request, user.id);
  await requireModuleEnabled(workspace.id, QUOTES_MODULE);
  await requirePermission(user.id, workspace.id, permissionKey);

  return { user, workspace };
};

const resolveDownloadName = (requestedName: string | null, quoteId: string) => {
  const baseName = requestedName ?? `quote_${quoteId}.pdf`;
  return baseName.toLowerCase().endsWith('.pdf') ? baseName : `${baseName}.pdf`;
};

type DispatchQuoteEmailInput = {
  mode: QuoteEmailLogType;
  request: FastifyRequest;
  actorUserId: string;
  workspace: {
    id: string;
    name: string;
  };
  quoteId: string;
  payload: QuoteSendEmailPayload;
};

const dispatchQuoteEmail = async ({
  mode,
  request,
  actorUserId,
  workspace,
  quoteId,
  payload,
}: DispatchQuoteEmailInput) => {
  const quote = await workspaceQuotesService.getQuoteForPdf(workspace.id, quoteId);
  if (mode === 'send' && quote.status !== 'draft') {
    throw conflict('Only draft quotes can be sent', {
      quoteId: quote.id,
      status: quote.status,
    });
  }

  const branding = await brandingRepository.findByWorkspaceId(workspace.id);
  const workspaceLabel = branding?.workspaceName?.trim() || workspace.name;
  const downloadName = resolveDownloadName(payload.downloadName, quote.id);
  const hasCc = payload.cc.length > 0;
  const hasBcc = payload.bcc.length > 0;

  const emailContent = buildQuoteEmail({
    quote,
    workspace: {
      name: workspaceLabel,
    },
    to: payload.to,
    subject: payload.subject,
    message: payload.message,
  });

  let statusFrom: string = quote.status;
  let statusTo: string = quote.status;
  const successAuditEvent = mode === 'send' ? 'quotes.email.send' : 'quotes.email.resend';
  const failureAuditEvent = mode === 'send' ? 'quotes.email.fail' : 'quotes.email.resend.fail';
  const toMasked = maskEmail(payload.to);

  try {
    const pdfBuffer = await renderQuotePdf(quote, {
      name: workspaceLabel,
      supportEmail: branding?.supportEmail ?? null,
    });

    if (mode === 'send') {
      // Strategy: status moves draft -> sent atomically before SMTP send; on SMTP failure status stays sent.
      const transition = await workspaceQuotesService.sendQuote(workspace.id, quote.id);
      statusFrom = transition.metadata.statusFrom;
      statusTo = transition.metadata.statusTo;
    }

    const mailResult = await sendMail({
      transport: createTransport(),
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
      attachments: [
        {
          filename: downloadName,
          contentType: 'application/pdf',
          content: pdfBuffer,
        },
      ],
    });

    await quoteEmailLogRepository.create({
      workspaceId: workspace.id,
      quoteId: quote.id,
      type: mode,
      toMasked,
      ccCount: payload.cc.length,
      bccCount: payload.bcc.length,
      subject: emailContent.subject,
      downloadName,
      provider: mailResult.provider,
      providerMessageId: mailResult.providerMessageId,
      status: 'success',
      errorCode: null,
      errorMessage: null,
    });

    await audit.log({
      event: successAuditEvent,
      actorUserId,
      workspaceId: workspace.id,
      metadata: {
        quoteId: quote.id,
        type: mode,
        statusFrom,
        statusTo,
        downloadName,
        hasCc,
        hasBcc,
        provider: mailResult.provider,
      },
      request,
    });

    return {
      quoteId: quote.id,
      status: mode === 'send' ? 'sent' : quote.status,
    };
  } catch (error) {
    if (isHttpError(error) && error.code === 'CONFLICT') {
      throw error;
    }

    const sanitizedError = sanitizeEmailError(error);
    await quoteEmailLogRepository.create({
      workspaceId: workspace.id,
      quoteId: quote.id,
      type: mode,
      toMasked,
      ccCount: payload.cc.length,
      bccCount: payload.bcc.length,
      subject: emailContent.subject,
      downloadName,
      provider: EMAIL_PROVIDER,
      providerMessageId: null,
      status: 'fail',
      errorCode: sanitizedError.errorCode,
      errorMessage: sanitizedError.errorMessage,
    });

    await audit.log({
      event: failureAuditEvent,
      actorUserId,
      workspaceId: workspace.id,
      metadata: {
        quoteId: quote.id,
        type: mode,
        statusFrom,
        statusTo,
        downloadName,
        hasCc,
        hasBcc,
        provider: EMAIL_PROVIDER,
      },
      request,
    });

    if (isHttpError(error) && error.message === 'Email provider not configured') {
      throw error;
    }

    request.log.error(
      {
        err: error,
        quoteId: quote.id,
        workspaceId: workspace.id,
        mode,
      },
      'Failed to dispatch quote email',
    );
    throw internalServerError('Failed to send quote email');
  }
};

const workspaceQuotesRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: QuotesListQuery }>('/quotes', async (request, reply) => {
    const { user, workspace } = await ensureQuotesAccess(request, 'quotes.view');

    const result = await workspaceQuotesService.listQuotes(workspace.id, request.query);

    await audit.log({
      event: 'quotes.list',
      actorUserId: user.id,
      workspaceId: workspace.id,
      metadata: {
        filters: {
          status: result.filters.status ?? null,
          sort: result.filters.sort,
          limit: result.filters.limit,
          hasQuery: Boolean(result.filters.q),
          hasCursor: Boolean(result.filters.cursor),
        },
        count: result.items.length,
        hasMore: result.pageInfo.hasMore,
      },
      request,
    });

    return ok(reply, {
      items: result.items,
      pageInfo: result.pageInfo,
    });
  });

  app.get<{ Params: QuoteParams }>('/quotes/:id', async (request, reply) => {
    const { user, workspace } = await ensureQuotesAccess(request, 'quotes.view');

    const quote = await workspaceQuotesService.getQuote(workspace.id, request.params.id);

    await audit.log({
      event: 'quotes.view',
      actorUserId: user.id,
      workspaceId: workspace.id,
      metadata: {
        quoteId: quote.id,
        status: quote.status,
      },
      request,
    });

    return ok(reply, {
      quote,
    });
  });

  app.get<{ Params: QuoteParams; Querystring: QuotePdfQuery }>(
    '/quotes/:id/pdf',
    async (request, reply) => {
      const { user, workspace } = await ensureQuotesAccess(request, 'quotes.view');
      const quote = await workspaceQuotesService.getQuoteForPdf(workspace.id, request.params.id);
      const branding = await brandingRepository.findByWorkspaceId(workspace.id);

      const workspaceLabel = branding?.workspaceName?.trim() || workspace.name;
      const download = request.query.download === PDF_DOWNLOAD_FLAG;
      const fileName = `quote_${quote.id}.pdf`;
      const contentDisposition = download ? 'attachment' : 'inline';

      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await renderQuotePdf(quote, {
          name: workspaceLabel,
          supportEmail: branding?.supportEmail ?? null,
        });
      } catch (error) {
        request.log.error(
          {
            err: error,
            quoteId: quote.id,
            workspaceId: workspace.id,
          },
          'Failed to render quote pdf',
        );
        throw internalServerError('Failed to render quote PDF');
      }

      await audit.log({
        event: 'quotes.pdf',
        actorUserId: user.id,
        workspaceId: workspace.id,
        metadata: {
          quoteId: quote.id,
          status: quote.status,
          download,
        },
        request,
      });

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Length', String(pdfBuffer.byteLength));
      reply.header('Content-Disposition', `${contentDisposition}; filename="${fileName}"`);
      return reply.send(pdfBuffer);
    },
  );

  app.post<{ Body: unknown }>('/quotes', async (request, reply) => {
    const { user, workspace } = await ensureQuotesAccess(request, 'quotes.create');

    const result = await workspaceQuotesService.createQuote(workspace.id, request.body);

    await audit.log({
      event: 'quotes.create',
      actorUserId: user.id,
      workspaceId: workspace.id,
      metadata: result.metadata,
      request,
    });

    return ok(
      reply,
      {
        quote: result.quote,
      },
      201,
    );
  });

  app.get<{ Params: QuoteParams }>('/quotes/:id/emails', async (request, reply) => {
    const { workspace } = await ensureQuotesAccess(request, 'quotes.view');

    await workspaceQuotesService.getQuoteForPdf(workspace.id, request.params.id);
    const logs = await quoteEmailLogRepository.listByQuote(workspace.id, request.params.id);

    return ok(reply, {
      items: logs.map((log) => ({
        id: log.id,
        type: log.type,
        status: log.status,
        subject: log.subject,
        toMasked: log.toMasked,
        ccCount: log.ccCount,
        bccCount: log.bccCount,
        provider: log.provider,
        providerMessageId: log.providerMessageId,
        errorCode: log.errorCode,
        errorMessage: log.errorMessage,
        createdAt: log.createdAt,
      })),
    });
  });

  app.get<{ Params: QuoteParams; Querystring: QuoteEmailPreviewQuery }>(
    '/quotes/:id/email-preview',
    async (request, reply) => {
      const { user, workspace } = await ensureQuotesAccess(request, 'quotes.view');
      const previewInput = workspaceQuotesService.parseEmailPreviewQuery(request.query);
      const quote = await workspaceQuotesService.getQuoteForPdf(workspace.id, request.params.id);
      const branding = await brandingRepository.findByWorkspaceId(workspace.id);
      const workspaceLabel = branding?.workspaceName?.trim() || workspace.name;

      const preview = buildQuoteEmail({
        quote,
        workspace: {
          name: workspaceLabel,
        },
        to: previewInput.to,
        subject: previewInput.subject,
        message: previewInput.message,
      });

      await audit.log({
        event: 'quotes.email.preview',
        actorUserId: user.id,
        workspaceId: workspace.id,
        metadata: {
          quoteId: quote.id,
          type: 'preview',
          provider: EMAIL_PROVIDER,
        },
        request,
      });

      return ok(reply, preview);
    },
  );

  app.post<{ Params: QuoteParams; Body: unknown }>(
    '/quotes/:id/send-email',
    async (request, reply) => {
      const { user, workspace } = await ensureQuotesAccess(request, 'quotes.send');
      const payload = workspaceQuotesService.parseSendEmailPayload(request.body);

      const result = await dispatchQuoteEmail({
        mode: 'send',
        request,
        actorUserId: user.id,
        workspace: {
          id: workspace.id,
          name: workspace.name,
        },
        quoteId: request.params.id,
        payload,
      });

      return ok(reply, {
        ok: true,
        quoteId: result.quoteId,
        status: result.status,
      });
    },
  );

  app.post<{ Params: QuoteParams; Body: unknown }>(
    '/quotes/:id/resend-email',
    async (request, reply) => {
      const { user, workspace } = await ensureQuotesAccess(request, 'quotes.send');
      const payload = workspaceQuotesService.parseSendEmailPayload(request.body);

      const result = await dispatchQuoteEmail({
        mode: 'resend',
        request,
        actorUserId: user.id,
        workspace: {
          id: workspace.id,
          name: workspace.name,
        },
        quoteId: request.params.id,
        payload,
      });

      return ok(reply, {
        ok: true,
        quoteId: result.quoteId,
        status: result.status,
      });
    },
  );

  app.put<{ Params: QuoteParams; Body: unknown }>('/quotes/:id', async (request, reply) => {
    const { user, workspace } = await ensureQuotesAccess(request, 'quotes.edit');

    const result = await workspaceQuotesService.updateQuote(
      workspace.id,
      request.params.id,
      request.body,
    );

    await audit.log({
      event: 'quotes.update',
      actorUserId: user.id,
      workspaceId: workspace.id,
      metadata: result.metadata,
      request,
    });

    return ok(reply, {
      quote: result.quote,
    });
  });

  app.delete<{ Params: QuoteParams }>('/quotes/:id', async (request, reply) => {
    const { user, workspace } = await ensureQuotesAccess(request, 'quotes.delete');

    const result = await workspaceQuotesService.deleteQuote(workspace.id, request.params.id);

    await audit.log({
      event: 'quotes.delete',
      actorUserId: user.id,
      workspaceId: workspace.id,
      metadata: result.metadata,
      request,
    });

    return ok(reply, {
      ok: true,
    });
  });

  app.post<{ Params: QuoteParams; Body: unknown }>('/quotes/:id/lines', async (request, reply) => {
    const { user, workspace } = await ensureQuotesAccess(request, 'quotes.edit');

    const result = await workspaceQuotesService.addLine(
      workspace.id,
      request.params.id,
      request.body,
    );

    await audit.log({
      event: 'quotes.line.add',
      actorUserId: user.id,
      workspaceId: workspace.id,
      metadata: result.metadata,
      request,
    });

    return ok(reply, {
      quote: result.quote,
    });
  });

  app.put<{ Params: QuoteLineParams; Body: unknown }>(
    '/quotes/:id/lines/:lineId',
    async (request, reply) => {
      const { user, workspace } = await ensureQuotesAccess(request, 'quotes.edit');

      const result = await workspaceQuotesService.updateLine(
        workspace.id,
        request.params.id,
        request.params.lineId,
        request.body,
      );

      await audit.log({
        event: 'quotes.line.update',
        actorUserId: user.id,
        workspaceId: workspace.id,
        metadata: result.metadata,
        request,
      });

      return ok(reply, {
        quote: result.quote,
      });
    },
  );

  app.delete<{ Params: QuoteLineParams }>('/quotes/:id/lines/:lineId', async (request, reply) => {
    const { user, workspace } = await ensureQuotesAccess(request, 'quotes.edit');

    const result = await workspaceQuotesService.deleteLine(
      workspace.id,
      request.params.id,
      request.params.lineId,
    );

    await audit.log({
      event: 'quotes.line.delete',
      actorUserId: user.id,
      workspaceId: workspace.id,
      metadata: result.metadata,
      request,
    });

    return ok(reply, {
      quote: result.quote,
    });
  });

  app.post<{ Params: QuoteParams }>('/quotes/:id/send', async (request, reply) => {
    const { user, workspace } = await ensureQuotesAccess(request, 'quotes.send');

    const result = await workspaceQuotesService.sendQuote(workspace.id, request.params.id);

    await audit.log({
      event: 'quotes.send',
      actorUserId: user.id,
      workspaceId: workspace.id,
      metadata: result.metadata,
      request,
    });

    return ok(reply, {
      quote: result.quote,
    });
  });

  app.post<{ Params: QuoteParams }>('/quotes/:id/accept', async (request, reply) => {
    const { user, workspace } = await ensureQuotesAccess(request, 'quotes.accept');

    const result = await workspaceQuotesService.acceptQuote(workspace.id, request.params.id);

    await audit.log({
      event: 'quotes.accept',
      actorUserId: user.id,
      workspaceId: workspace.id,
      metadata: result.metadata,
      request,
    });

    return ok(reply, {
      quote: result.quote,
    });
  });
};

export default workspaceQuotesRoute;
