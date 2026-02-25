import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { badRequest } from '../../../core/errors.js';
import { ok } from '../../../core/response.js';
import { audit } from '../../../audit/audit.js';
import {
  QUOTES_PERMISSIONS,
  ensureQuotesAccess,
} from '../policies.js';
import { quotesService } from '../service.js';

const MAX_ITEMS_COUNT = 200;

const idSchema = z.string().trim().min(1);

const decimalNumberSchema = z.coerce.number().finite();

const optionalNullableTrimmedStringSchema = z.union([
  z.string().trim(),
  z.null(),
]).optional();

const templateItemSchema = z.object({
  position: z.coerce.number().int().positive().optional(),
  title: z.string().trim().min(1),
  description: optionalNullableTrimmedStringSchema,
  quantity: decimalNumberSchema.gt(0),
  unitPrice: decimalNumberSchema.gte(0),
  discountType: z.enum(['PERCENT', 'FIXED']).optional().nullable(),
  discountValue: decimalNumberSchema.gte(0).optional().nullable(),
}).strict();

const createTemplateBodySchema = z.object({
  name: z.string().trim().min(1),
  description: optionalNullableTrimmedStringSchema,
  defaultNotes: optionalNullableTrimmedStringSchema,
  items: z.array(templateItemSchema).max(MAX_ITEMS_COUNT).optional(),
}).strict();

const updateTemplateBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: optionalNullableTrimmedStringSchema,
  defaultNotes: optionalNullableTrimmedStringSchema,
  items: z.array(templateItemSchema).max(MAX_ITEMS_COUNT).optional(),
}).strict().superRefine((value, context) => {
  if (Object.keys(value).length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one field is required',
    });
  }
});

const templateParamsSchema = z.object({
  id: idSchema,
}).strict();

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

const workspaceQuoteTemplatesRoute: FastifyPluginAsync = async (app) => {
  app.get('/quote-templates', async (request, reply) => {
    const { workspace } = await ensureQuotesAccess(request, QUOTES_PERMISSIONS.view);
    const items = await quotesService.listTemplates(workspace.id);

    return ok(reply, { items });
  });

  app.post<{ Body: unknown }>('/quote-templates', async (request, reply) => {
    const { user, workspace } = await ensureQuotesAccess(request, QUOTES_PERMISSIONS.manageTemplates);
    const body = parseWithSchema(
      createTemplateBodySchema,
      request.body,
      'Invalid quote template payload',
    );

    const template = await quotesService.createTemplate(workspace.id, body);
    await audit.log({
      event: 'quotes.templates.create',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'quote_template',
      entityId: template.id,
      request,
    });
    return ok(reply, { template }, 201);
  });

  app.get<{ Params: unknown }>('/quote-templates/:id', async (request, reply) => {
    const { workspace } = await ensureQuotesAccess(request, QUOTES_PERMISSIONS.view);
    const params = parseWithSchema(
      templateParamsSchema,
      request.params,
      'Invalid quote template id',
    );

    const template = await quotesService.getTemplateById(workspace.id, params.id);
    return ok(reply, { template });
  });

  app.patch<{ Params: unknown; Body: unknown }>('/quote-templates/:id', async (request, reply) => {
    const { user, workspace } = await ensureQuotesAccess(request, QUOTES_PERMISSIONS.manageTemplates);
    const params = parseWithSchema(
      templateParamsSchema,
      request.params,
      'Invalid quote template id',
    );
    const body = parseWithSchema(
      updateTemplateBodySchema,
      request.body,
      'Invalid quote template update payload',
    );

    const template = await quotesService.updateTemplate(workspace.id, params.id, body);
    await audit.log({
      event: 'quotes.templates.update',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'quote_template',
      entityId: template.id,
      request,
    });
    return ok(reply, { template });
  });

  app.delete<{ Params: unknown }>('/quote-templates/:id', async (request, reply) => {
    const { user, workspace } = await ensureQuotesAccess(request, QUOTES_PERMISSIONS.manageTemplates);
    const params = parseWithSchema(
      templateParamsSchema,
      request.params,
      'Invalid quote template id',
    );

    await quotesService.deleteTemplate(workspace.id, params.id);
    await audit.log({
      event: 'quotes.templates.delete',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'quote_template',
      entityId: params.id,
      request,
    });
    reply.code(204);
    return reply.send();
  });
};

export default workspaceQuoteTemplatesRoute;
