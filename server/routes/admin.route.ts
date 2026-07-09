import type { FastifyPluginAsync } from 'fastify';
import { audit } from '../audit/audit.js';
import { ok } from '../core/response.js';
import { requirePlatformAdmin } from '../guards/requirePlatformAdmin.js';
import { platformAdminService } from '../services/platform-admin.service.js';

type WorkspaceParams = {
  workspaceId: string;
};

type UserParams = {
  userId: string;
};

type SearchQuery = {
  q?: string;
};

// Console Super Admin di piattaforma: rotte cross-workspace, protette dal guard
// requirePlatformAdmin (nessun header workspace, nessuna membership richiesta).
const adminRoute: FastifyPluginAsync = async (app) => {
  app.get('/admin/workspaces', async (request, reply) => {
    await requirePlatformAdmin(request);
    const workspaces = await platformAdminService.listWorkspaces();
    return ok(reply, { workspaces });
  });

  app.post<{ Body: unknown }>('/admin/workspaces', async (request, reply) => {
    const admin = await requirePlatformAdmin(request);
    const workspace = await platformAdminService.createWorkspace(request.body, admin.id);

    if (workspace) {
      await audit.log({
        event: 'admin.workspace.create',
        actorUserId: admin.id,
        workspaceId: workspace.id,
        metadata: { name: workspace.name, slug: workspace.slug },
        request,
      });
    }

    return ok(reply, { workspace }, 201);
  });

  app.patch<{ Params: WorkspaceParams; Body: unknown }>(
    '/admin/workspaces/:workspaceId',
    async (request, reply) => {
      const admin = await requirePlatformAdmin(request);
      const workspace = await platformAdminService.updateWorkspace(
        request.params.workspaceId,
        request.body,
      );

      await audit.log({
        event: 'admin.workspace.update',
        actorUserId: admin.id,
        workspaceId: workspace.id,
        metadata: { name: workspace.name, slug: workspace.slug },
        request,
      });

      return ok(reply, { workspace });
    },
  );

  app.post<{ Params: WorkspaceParams }>(
    '/admin/workspaces/:workspaceId/suspend',
    async (request, reply) => {
      const admin = await requirePlatformAdmin(request);
      const workspace = await platformAdminService.setWorkspaceSuspended(
        request.params.workspaceId,
        true,
      );

      await audit.log({
        event: 'admin.workspace.suspend',
        actorUserId: admin.id,
        workspaceId: workspace.id,
        metadata: { slug: workspace.slug },
        request,
      });

      return ok(reply, { workspace });
    },
  );

  app.post<{ Params: WorkspaceParams }>(
    '/admin/workspaces/:workspaceId/activate',
    async (request, reply) => {
      const admin = await requirePlatformAdmin(request);
      const workspace = await platformAdminService.setWorkspaceSuspended(
        request.params.workspaceId,
        false,
      );

      await audit.log({
        event: 'admin.workspace.activate',
        actorUserId: admin.id,
        workspaceId: workspace.id,
        metadata: { slug: workspace.slug },
        request,
      });

      return ok(reply, { workspace });
    },
  );

  app.get<{
    Querystring: { days?: string; userId?: string; model?: string; functionName?: string };
  }>('/admin/ai-usage', async (request, reply) => {
    await requirePlatformAdmin(request);
    const usage = await platformAdminService.getAiUsage({
      windowDays: platformAdminService.parseWindowDays(request.query?.days),
      userId: platformAdminService.parseUsageStringFilter(request.query?.userId),
      model: platformAdminService.parseUsageStringFilter(request.query?.model),
      functionName: platformAdminService.parseUsageStringFilter(request.query?.functionName),
    });
    return ok(reply, usage);
  });

  app.get('/admin/ai-config', async (request, reply) => {
    await requirePlatformAdmin(request);
    const workspaces = await platformAdminService.getAiConfig();
    return ok(reply, { workspaces });
  });

  app.get('/admin/platform-admins', async (request, reply) => {
    await requirePlatformAdmin(request);
    const admins = await platformAdminService.listPlatformAdmins();
    return ok(reply, { admins });
  });

  app.get<{ Querystring: SearchQuery }>('/admin/users', async (request, reply) => {
    await requirePlatformAdmin(request);
    const query = platformAdminService.parseSearchQuery(request.query?.q);
    const users = await platformAdminService.searchUsers(query);
    return ok(reply, { users });
  });

  app.post<{ Body: unknown }>('/admin/platform-admins', async (request, reply) => {
    const admin = await requirePlatformAdmin(request);
    const userId = platformAdminService.parseUserId(request.body);
    const user = await platformAdminService.promotePlatformAdmin(userId);

    app.log.info(
      { actorUserId: admin.id, targetUserId: user.id },
      'Platform admin promoted from console',
    );

    return ok(reply, { user });
  });

  app.delete<{ Params: UserParams }>(
    '/admin/platform-admins/:userId',
    async (request, reply) => {
      const admin = await requirePlatformAdmin(request);
      const user = await platformAdminService.demotePlatformAdmin(
        request.params.userId,
        admin.id,
      );

      app.log.info(
        { actorUserId: admin.id, targetUserId: user.id },
        'Platform admin demoted from console',
      );

      return ok(reply, { user });
    },
  );
};

export default adminRoute;
