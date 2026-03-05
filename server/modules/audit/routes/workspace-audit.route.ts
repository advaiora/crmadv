import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { badRequest } from '../../../core/errors.js';
import { ok } from '../../../core/response.js';
import { auditRepository } from '../../../repositories/audit.repository.js';
import { AUDIT_PERMISSIONS, ensureAuditAccess } from '../policies.js';

const isoDateSchema = z.string().trim().datetime({ offset: true });

const querySchema = z.object({
  from: z.union([isoDateSchema, z.string().trim().date()]).optional(),
  to: z.union([isoDateSchema, z.string().trim().date()]).optional(),
  action: z.string().trim().min(1).max(120).optional(),
  actionPrefix: z.string().trim().min(1).max(120).optional(),
  actor: z.string().trim().min(1).max(120).optional(),
  targetType: z.string().trim().min(1).max(120).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(200),
}).strict();

const parseDate = (value: string | undefined, field: 'from' | 'to') => {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest(`${field} must be a valid date`);
  }

  return parsed;
};

const workspaceAuditRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: unknown }>('/audit', async (request, reply) => {
    const access = await ensureAuditAccess(request, AUDIT_PERMISSIONS.view);
    const parsed = querySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      throw badRequest('Invalid audit query params', {
        issues: parsed.error.flatten(),
      });
    }

    const from = parseDate(parsed.data.from, 'from');
    const to = parseDate(parsed.data.to, 'to');

    const items = await auditRepository.listByWorkspaceWithFilters({
      workspaceId: access.workspaceId,
      from,
      to,
      action: parsed.data.action,
      actionPrefix: parsed.data.actionPrefix,
      actor: parsed.data.actor,
      targetType: parsed.data.targetType,
      q: parsed.data.q,
      limit: parsed.data.limit,
    });

    return ok(reply, {
      items: items.map((item) => ({
        id: item.id,
        action: item.action,
        targetType: item.entityType,
        targetId: item.entityId,
        metadata: item.metadata,
        timestamp: item.createdAt.toISOString(),
        actor: item.actorUser
          ? {
              id: item.actorUser.id,
              name: item.actorUser.name,
              email: item.actorUser.email,
            }
          : null,
      })),
    });
  });
};

export default workspaceAuditRoute;
