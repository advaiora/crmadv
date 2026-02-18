import type { FastifyPluginAsync } from 'fastify';
import { audit } from '../audit/audit.js';
import { ok } from '../core/response.js';
import { requireAuth } from '../guards/requireAuth.js';
import { requirePermission } from '../guards/requirePermission.js';
import { requireWorkspaceFromParams } from '../guards/requireWorkspace.js';
import { workspaceRolesService } from '../services/workspace-roles.service.js';

type WorkspaceParams = {
  workspaceId: string;
};

type WorkspaceRoleParams = WorkspaceParams & {
  roleId: string;
};

type WorkspaceUserParams = WorkspaceParams & {
  userId: string;
};

const VIEW_ROLES_PERMISSION = 'roles.view';
const MANAGE_ROLES_PERMISSION = 'roles.manage';
const ASSIGN_ROLES_PERMISSION = 'roles.assign';

const workspaceRolesRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Params: WorkspaceParams }>(
    '/workspaces/:workspaceId/roles',
    async (request, reply) => {
      const user = await requireAuth(request);
      const workspace = await requireWorkspaceFromParams(
        request,
        user.id,
        request.params.workspaceId,
      );

      await requirePermission(user.id, workspace.id, VIEW_ROLES_PERMISSION);
      const roles = await workspaceRolesService.listRoles(workspace.id);

      return ok(reply, {
        roles,
      });
    },
  );

  app.post<{ Params: WorkspaceParams; Body: unknown }>(
    '/workspaces/:workspaceId/roles',
    async (request, reply) => {
      const user = await requireAuth(request);
      const workspace = await requireWorkspaceFromParams(
        request,
        user.id,
        request.params.workspaceId,
      );

      await requirePermission(user.id, workspace.id, MANAGE_ROLES_PERMISSION);

      const { role, changes } = await workspaceRolesService.createRole(workspace.id, request.body);

      await audit.log({
        event: 'role.create',
        actorUserId: user.id,
        workspaceId: workspace.id,
        metadata: {
          roleId: role.id,
          changes,
        },
        request,
      });

      return ok(reply, {
        role,
      });
    },
  );

  app.put<{ Params: WorkspaceRoleParams; Body: unknown }>(
    '/workspaces/:workspaceId/roles/:roleId',
    async (request, reply) => {
      const user = await requireAuth(request);
      const workspace = await requireWorkspaceFromParams(
        request,
        user.id,
        request.params.workspaceId,
      );

      await requirePermission(user.id, workspace.id, MANAGE_ROLES_PERMISSION);

      const { role, changes } = await workspaceRolesService.updateRole(
        workspace.id,
        request.params.roleId,
        request.body,
      );

      await audit.log({
        event: 'role.update',
        actorUserId: user.id,
        workspaceId: workspace.id,
        metadata: {
          roleId: role.id,
          changes,
        },
        request,
      });

      return ok(reply, {
        role,
      });
    },
  );

  app.delete<{ Params: WorkspaceRoleParams }>(
    '/workspaces/:workspaceId/roles/:roleId',
    async (request, reply) => {
      const user = await requireAuth(request);
      const workspace = await requireWorkspaceFromParams(
        request,
        user.id,
        request.params.workspaceId,
      );

      await requirePermission(user.id, workspace.id, MANAGE_ROLES_PERMISSION);

      const { role } = await workspaceRolesService.deleteRole(workspace.id, request.params.roleId);

      await audit.log({
        event: 'role.delete',
        actorUserId: user.id,
        workspaceId: workspace.id,
        metadata: {
          roleId: role.id,
          roleName: role.name,
        },
        request,
      });

      return ok(reply, {
        role,
      });
    },
  );

  app.put<{ Params: WorkspaceUserParams; Body: unknown }>(
    '/workspaces/:workspaceId/users/:userId/roles',
    async (request, reply) => {
      const user = await requireAuth(request);
      const workspace = await requireWorkspaceFromParams(
        request,
        user.id,
        request.params.workspaceId,
      );

      await requirePermission(user.id, workspace.id, ASSIGN_ROLES_PERMISSION);

      const result = await workspaceRolesService.assignUserRoles(
        workspace.id,
        request.params.userId,
        request.body,
        user.id,
      );

      await audit.log({
        event: 'role.assign',
        actorUserId: user.id,
        workspaceId: workspace.id,
        metadata: {
          targetUserId: result.userId,
          changes: result.changes,
        },
        request,
      });

      return ok(reply, {
        userId: result.userId,
        roles: result.roles,
      });
    },
  );
};

export default workspaceRolesRoute;
