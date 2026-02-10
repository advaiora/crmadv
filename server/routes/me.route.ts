import type { FastifyPluginAsync } from 'fastify';
import { audit } from '../audit/audit.js';
import { ok } from '../core/response.js';
import { requireAuth } from '../guards/requireAuth.js';
import { requireWorkspace } from '../guards/requireWorkspace.js';
import { moduleRepository } from '../repositories/module.repository.js';
import { rbacRepository } from '../repositories/rbac.repository.js';

const meRoute: FastifyPluginAsync = async (app) => {
  app.get('/me', async (request, reply) => {
    const user = await requireAuth(request);
    const workspace = await requireWorkspace(request, user.id);

    const [enabledModules, permissions, roles] = await Promise.all([
      moduleRepository.listEnabledModules(workspace.id),
      rbacRepository.listUserPermissions(user.id, workspace.id),
      rbacRepository.listUserRoles(user.id, workspace.id),
    ]);

    await audit.log({
      event: 'me.view',
      actorUserId: user.id,
      workspaceId: workspace.id,
      metadata: {
        route: '/me',
      },
      request,
    });

    return ok(reply, {
      user: {
        id: user.id,
        email: user.email,
        ...(user.name ? { name: user.name } : {}),
      },
      workspace,
      enabledModules,
      permissions,
      roles,
    });
  });
};

export default meRoute;
