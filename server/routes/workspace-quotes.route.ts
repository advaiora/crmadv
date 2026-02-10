import type { FastifyPluginAsync } from 'fastify';
import { audit } from '../audit/audit.js';
import { ok } from '../core/response.js';
import { requireAuth } from '../guards/requireAuth.js';
import { requireModuleEnabled } from '../guards/requireModule.js';
import { requirePermission } from '../guards/requirePermission.js';
import { requireWorkspaceFromParams } from '../guards/requireWorkspace.js';
import { workspaceQuotesService } from '../services/workspace-quotes.service.js';

type WorkspaceParams = {
  workspaceId: string;
};

type WorkspaceQuoteParams = WorkspaceParams & {
  quoteId: string;
};

type QuotesListQuery = {
  status?: string;
  q?: string;
};

const QUOTES_MODULE = 'quotes';
const VIEW_QUOTE_PERMISSION = 'quotes.view';
const CREATE_QUOTE_PERMISSION = 'quotes.create';
const EDIT_QUOTE_PERMISSION = 'quotes.edit';
const DELETE_QUOTE_PERMISSION = 'quotes.delete';
const SEND_QUOTE_PERMISSION = 'quotes.send';
const ACCEPT_QUOTE_PERMISSION = 'quotes.accept';

const workspaceQuotesRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Params: WorkspaceParams; Querystring: QuotesListQuery }>(
    '/workspaces/:workspaceId/quotes',
    async (request, reply) => {
      const user = await requireAuth(request);
      const workspace = await requireWorkspaceFromParams(
        request,
        user.id,
        request.params.workspaceId,
      );

      await requireModuleEnabled(workspace.id, QUOTES_MODULE);
      await requirePermission(user.id, workspace.id, VIEW_QUOTE_PERMISSION);

      const quotes = await workspaceQuotesService.listQuotes(workspace.id, request.query);

      return ok(reply, {
        quotes,
      });
    },
  );

  app.post<{ Params: WorkspaceParams; Body: unknown }>(
    '/workspaces/:workspaceId/quotes',
    async (request, reply) => {
      const user = await requireAuth(request);
      const workspace = await requireWorkspaceFromParams(
        request,
        user.id,
        request.params.workspaceId,
      );

      await requireModuleEnabled(workspace.id, QUOTES_MODULE);
      await requirePermission(user.id, workspace.id, CREATE_QUOTE_PERMISSION);

      const { quote, changes } = await workspaceQuotesService.createQuote(workspace.id, request.body);

      await audit.log({
        event: 'quote.create',
        actorUserId: user.id,
        workspaceId: workspace.id,
        metadata: {
          quoteId: quote.id,
          changes,
        },
        request,
      });

      return ok(reply, {
        quote,
      });
    },
  );

  app.get<{ Params: WorkspaceQuoteParams }>(
    '/workspaces/:workspaceId/quotes/:quoteId',
    async (request, reply) => {
      const user = await requireAuth(request);
      const workspace = await requireWorkspaceFromParams(
        request,
        user.id,
        request.params.workspaceId,
      );

      await requireModuleEnabled(workspace.id, QUOTES_MODULE);
      await requirePermission(user.id, workspace.id, VIEW_QUOTE_PERMISSION);

      const quote = await workspaceQuotesService.getQuote(workspace.id, request.params.quoteId);

      return ok(reply, {
        quote,
      });
    },
  );

  app.put<{ Params: WorkspaceQuoteParams; Body: unknown }>(
    '/workspaces/:workspaceId/quotes/:quoteId',
    async (request, reply) => {
      const user = await requireAuth(request);
      const workspace = await requireWorkspaceFromParams(
        request,
        user.id,
        request.params.workspaceId,
      );

      await requireModuleEnabled(workspace.id, QUOTES_MODULE);
      await requirePermission(user.id, workspace.id, EDIT_QUOTE_PERMISSION);

      const { quote, changes } = await workspaceQuotesService.updateQuote(
        workspace.id,
        request.params.quoteId,
        request.body,
      );

      await audit.log({
        event: 'quote.update',
        actorUserId: user.id,
        workspaceId: workspace.id,
        metadata: {
          quoteId: quote.id,
          changes,
        },
        request,
      });

      return ok(reply, {
        quote,
      });
    },
  );

  app.delete<{ Params: WorkspaceQuoteParams }>(
    '/workspaces/:workspaceId/quotes/:quoteId',
    async (request, reply) => {
      const user = await requireAuth(request);
      const workspace = await requireWorkspaceFromParams(
        request,
        user.id,
        request.params.workspaceId,
      );

      await requireModuleEnabled(workspace.id, QUOTES_MODULE);
      await requirePermission(user.id, workspace.id, DELETE_QUOTE_PERMISSION);

      const quote = await workspaceQuotesService.deleteQuote(workspace.id, request.params.quoteId);

      await audit.log({
        event: 'quote.delete',
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
    },
  );

  app.post<{ Params: WorkspaceQuoteParams }>(
    '/workspaces/:workspaceId/quotes/:quoteId/send',
    async (request, reply) => {
      const user = await requireAuth(request);
      const workspace = await requireWorkspaceFromParams(
        request,
        user.id,
        request.params.workspaceId,
      );

      await requireModuleEnabled(workspace.id, QUOTES_MODULE);
      await requirePermission(user.id, workspace.id, SEND_QUOTE_PERMISSION);

      const { quote, changes } = await workspaceQuotesService.sendQuote(
        workspace.id,
        request.params.quoteId,
      );

      await audit.log({
        event: 'quote.send',
        actorUserId: user.id,
        workspaceId: workspace.id,
        metadata: {
          quoteId: quote.id,
          changes,
        },
        request,
      });

      return ok(reply, {
        quote,
      });
    },
  );

  app.post<{ Params: WorkspaceQuoteParams }>(
    '/workspaces/:workspaceId/quotes/:quoteId/accept',
    async (request, reply) => {
      const user = await requireAuth(request);
      const workspace = await requireWorkspaceFromParams(
        request,
        user.id,
        request.params.workspaceId,
      );

      await requireModuleEnabled(workspace.id, QUOTES_MODULE);
      await requirePermission(user.id, workspace.id, ACCEPT_QUOTE_PERMISSION);

      const { quote, changes } = await workspaceQuotesService.acceptQuote(
        workspace.id,
        request.params.quoteId,
      );

      await audit.log({
        event: 'quote.accept',
        actorUserId: user.id,
        workspaceId: workspace.id,
        metadata: {
          quoteId: quote.id,
          changes,
        },
        request,
      });

      return ok(reply, {
        quote,
      });
    },
  );
};

export default workspaceQuotesRoute;
