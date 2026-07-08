import type { FastifyPluginAsync } from 'fastify';
import { audit } from '../audit/audit.js';
import { ok } from '../core/response.js';
import { requireAuth } from '../guards/requireAuth.js';
import { requirePermission } from '../guards/requirePermission.js';
import { requireWorkspaceFromParams } from '../guards/requireWorkspace.js';
import { workspaceDepartmentsService } from '../services/workspace-departments.service.js';

type WorkspaceParams = {
  workspaceId: string;
};

type WorkspaceDepartmentParams = WorkspaceParams & {
  departmentId: string;
};

const VIEW_PERMISSION = 'departments.view';
const MANAGE_PERMISSION = 'departments.manage';
const ASSIGN_PERMISSION = 'departments.assign';

const workspaceDepartmentsRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Params: WorkspaceParams }>(
    '/workspaces/:workspaceId/departments',
    async (request, reply) => {
      const user = await requireAuth(request);
      const workspace = await requireWorkspaceFromParams(
        request,
        user.id,
        request.params.workspaceId,
      );

      await requirePermission(user.id, workspace.id, VIEW_PERMISSION);
      const departments = await workspaceDepartmentsService.listDepartments(workspace.id);

      return ok(reply, { departments });
    },
  );

  app.get<{ Params: WorkspaceDepartmentParams }>(
    '/workspaces/:workspaceId/departments/:departmentId/members',
    async (request, reply) => {
      const user = await requireAuth(request);
      const workspace = await requireWorkspaceFromParams(
        request,
        user.id,
        request.params.workspaceId,
      );

      await requirePermission(user.id, workspace.id, VIEW_PERMISSION);
      const result = await workspaceDepartmentsService.getDepartmentMembers(
        workspace.id,
        request.params.departmentId,
      );

      return ok(reply, result);
    },
  );

  app.post<{ Params: WorkspaceParams; Body: unknown }>(
    '/workspaces/:workspaceId/departments',
    async (request, reply) => {
      const user = await requireAuth(request);
      const workspace = await requireWorkspaceFromParams(
        request,
        user.id,
        request.params.workspaceId,
      );

      await requirePermission(user.id, workspace.id, MANAGE_PERMISSION);
      const { department } = await workspaceDepartmentsService.createDepartment(
        workspace.id,
        request.body,
      );

      await audit.log({
        event: 'department.create',
        actorUserId: user.id,
        workspaceId: workspace.id,
        metadata: { departmentId: department?.id, name: department?.name },
        request,
      });

      return ok(reply, { department });
    },
  );

  app.put<{ Params: WorkspaceDepartmentParams; Body: unknown }>(
    '/workspaces/:workspaceId/departments/:departmentId',
    async (request, reply) => {
      const user = await requireAuth(request);
      const workspace = await requireWorkspaceFromParams(
        request,
        user.id,
        request.params.workspaceId,
      );

      await requirePermission(user.id, workspace.id, MANAGE_PERMISSION);
      const { department } = await workspaceDepartmentsService.updateDepartment(
        workspace.id,
        request.params.departmentId,
        request.body,
      );

      await audit.log({
        event: 'department.update',
        actorUserId: user.id,
        workspaceId: workspace.id,
        metadata: { departmentId: department?.id, name: department?.name },
        request,
      });

      return ok(reply, { department });
    },
  );

  app.delete<{ Params: WorkspaceDepartmentParams }>(
    '/workspaces/:workspaceId/departments/:departmentId',
    async (request, reply) => {
      const user = await requireAuth(request);
      const workspace = await requireWorkspaceFromParams(
        request,
        user.id,
        request.params.workspaceId,
      );

      await requirePermission(user.id, workspace.id, MANAGE_PERMISSION);
      const { department } = await workspaceDepartmentsService.deleteDepartment(
        workspace.id,
        request.params.departmentId,
      );

      await audit.log({
        event: 'department.delete',
        actorUserId: user.id,
        workspaceId: workspace.id,
        metadata: { departmentId: department.id, name: department.name },
        request,
      });

      return ok(reply, { department });
    },
  );

  app.put<{ Params: WorkspaceDepartmentParams; Body: unknown }>(
    '/workspaces/:workspaceId/departments/:departmentId/members',
    async (request, reply) => {
      const user = await requireAuth(request);
      const workspace = await requireWorkspaceFromParams(
        request,
        user.id,
        request.params.workspaceId,
      );

      await requirePermission(user.id, workspace.id, ASSIGN_PERMISSION);
      const result = await workspaceDepartmentsService.assignMembers(
        workspace.id,
        request.params.departmentId,
        request.body,
      );

      await audit.log({
        event: 'department.members_assign',
        actorUserId: user.id,
        workspaceId: workspace.id,
        metadata: { departmentId: result.departmentId, changes: result.changes },
        request,
      });

      return ok(reply, { departmentId: result.departmentId, members: result.members });
    },
  );
};

export default workspaceDepartmentsRoute;
