import type { FastifyPluginAsync } from 'fastify';
import { audit } from '../../../audit/audit.js';
import { ok } from '../../../core/response.js';
import { moduleRepository } from '../../../repositories/module.repository.js';
import { rbacRepository } from '../../../repositories/rbac.repository.js';
import { PROJECTS_MODULE_KEY, PROJECTS_PERMISSIONS } from '../../projects/projects.policies.js';
import { QUOTES_MODULE_KEY, QUOTES_PERMISSIONS } from '../../quotes/policies.js';
import {
  CALENDAR_PERMISSIONS,
  ensureCalendarAccess,
} from '../policies.js';
import { calendarService } from '../service.js';

type EventParams = {
  id: string;
};

const workspaceCalendarRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: unknown }>('/calendar/events', async (request, reply) => {
    const { user, workspace } = await ensureCalendarAccess(request, CALENDAR_PERMISSIONS.view);
    const [isProjectsModuleEnabled, isQuotesModuleEnabled, canViewProjects, canViewQuotes] = await Promise.all([
      moduleRepository.isEnabled(workspace.id, PROJECTS_MODULE_KEY),
      moduleRepository.isEnabled(workspace.id, QUOTES_MODULE_KEY),
      rbacRepository.hasPermission(user.id, workspace.id, PROJECTS_PERMISSIONS.view),
      rbacRepository.hasPermission(user.id, workspace.id, QUOTES_PERMISSIONS.view),
    ]);

    const result = await calendarService.listEvents(workspace.id, request.query, {
      includeProjectDue: isProjectsModuleEnabled && canViewProjects,
      includeQuoteDates: isQuotesModuleEnabled && canViewQuotes,
    });

    await audit.log({
      event: 'calendar.events.list',
      actorUserId: user.id,
      workspaceId: workspace.id,
      metadata: {
        count: result.items.length,
        includeDerived: result.meta.includeDerived,
      },
      request,
    });

    return ok(reply, result);
  });

  app.post<{ Body: unknown }>('/calendar/events', async (request, reply) => {
    const { user, workspace } = await ensureCalendarAccess(request, CALENDAR_PERMISSIONS.create);

    const event = await calendarService.createEvent({
      workspaceId: workspace.id,
      actorUserId: user.id,
      payload: request.body,
    });

    await audit.log({
      event: 'calendar.events.create',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'calendar_event',
      entityId: event.id,
      metadata: {
        title: event.title,
        start: event.start,
        end: event.end,
      },
      request,
    });

    return ok(reply, { event }, 201);
  });

  app.patch<{ Params: EventParams; Body: unknown }>('/calendar/events/:id', async (request, reply) => {
    const { user, workspace } = await ensureCalendarAccess(request, CALENDAR_PERMISSIONS.edit);

    const event = await calendarService.updateEvent({
      workspaceId: workspace.id,
      actorUserId: user.id,
      eventId: request.params.id,
      payload: request.body,
    });

    await audit.log({
      event: 'calendar.events.update',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'calendar_event',
      entityId: event.id,
      metadata: {
        title: event.title,
        start: event.start,
        end: event.end,
      },
      request,
    });

    return ok(reply, { event });
  });

  app.delete<{ Params: EventParams }>('/calendar/events/:id', async (request, reply) => {
    const { user, workspace } = await ensureCalendarAccess(request, CALENDAR_PERMISSIONS.delete);

    const result = await calendarService.deleteEvent({
      workspaceId: workspace.id,
      eventId: request.params.id,
    });

    await audit.log({
      event: 'calendar.events.delete',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'calendar_event',
      entityId: result.id,
      request,
    });

    reply.code(204);
    return reply.send();
  });
};

export default workspaceCalendarRoute;
