import { badRequest, forbidden, notFound } from '../../core/errors.js';
import { departmentRepository } from '../../repositories/department.repository.js';
import { rbacRepository } from '../../repositories/rbac.repository.js';
import { projectsRepository } from './projects.repository.js';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseIdArray = (body: unknown, field: string): string[] => {
  if (!isObject(body)) {
    throw badRequest('Body must be a JSON object');
  }
  const raw = body[field];
  if (!Array.isArray(raw)) {
    throw badRequest(`${field} must be an array`);
  }
  const ids = raw.map((value, index) => {
    if (typeof value !== 'string' || !value.trim()) {
      throw badRequest(`${field}[${index}] must be a non-empty string`);
    }
    return value.trim();
  });
  return Array.from(new Set(ids));
};

// Contesto di gestione: ruolo alto (projects.edit) vede/gestisce tutto; il capo
// reparto gestisce solo il proprio perimetro.
type ManageContext = {
  hasEdit: boolean;
  ledDepartmentIds: string[];
  isLead: boolean;
};

export const projectAccessService = {
  async resolveManageContext(workspaceId: string, userId: string): Promise<ManageContext> {
    const hasEdit = await rbacRepository.hasPermission(userId, workspaceId, 'projects.edit');
    const ledDepartmentIds = await departmentRepository.listLedDepartmentIds(workspaceId, userId);
    return { hasEdit, ledDepartmentIds, isLead: ledDepartmentIds.length > 0 };
  },

  // Chi può gestire reparti/accessi di un progetto: ruolo alto, oppure capo di un
  // reparto del progetto, oppure (progetto senza reparto) capo di almeno un reparto.
  async assertCanManage(
    workspaceId: string,
    projectId: string,
    ctx: ManageContext,
  ): Promise<void> {
    const exists = await projectsRepository.projectExists(workspaceId, projectId);
    if (!exists) {
      throw notFound('Project not found');
    }
    if (ctx.hasEdit) {
      return;
    }
    if (!ctx.isLead) {
      throw forbidden('Non hai i permessi per gestire questo progetto');
    }
    const projectDepartmentIds = await projectsRepository.listProjectDepartmentIds(
      workspaceId,
      projectId,
    );
    if (projectDepartmentIds.length === 0) {
      return; // progetto senza reparto: gestibile da qualsiasi capo reparto
    }
    const overlaps = projectDepartmentIds.some((id) => ctx.ledDepartmentIds.includes(id));
    if (!overlaps) {
      throw forbidden('Non guidi alcun reparto di questo progetto');
    }
  },

  async getProjectAccess(workspaceId: string, userId: string, projectId: string) {
    const ctx = await this.resolveManageContext(workspaceId, userId);
    await this.assertCanManage(workspaceId, projectId, ctx);
    const [departmentIds, userIds] = await Promise.all([
      projectsRepository.listProjectDepartmentIds(workspaceId, projectId),
      projectsRepository.listProjectAccessUserIds(workspaceId, projectId),
    ]);
    return { projectId, departmentIds, userIds };
  },

  async setProjectDepartments(
    workspaceId: string,
    userId: string,
    projectId: string,
    body: unknown,
  ) {
    const requested = parseIdArray(body, 'departmentIds');
    const ctx = await this.resolveManageContext(workspaceId, userId);
    await this.assertCanManage(workspaceId, projectId, ctx);

    if (requested.length > 0) {
      const existing = await departmentRepository.listExistingDepartmentIds(workspaceId, requested);
      const missing = requested.filter((id) => !existing.includes(id));
      if (missing.length > 0) {
        throw badRequest('Unknown department ids for this workspace', { missing: missing.sort() });
      }
    }

    let finalIds: string[];
    if (ctx.hasEdit) {
      finalIds = requested;
    } else {
      // Il capo può toccare solo i reparti che guida; gli altri restano invariati.
      const current = await projectsRepository.listProjectDepartmentIds(workspaceId, projectId);
      const preserved = current.filter((id) => !ctx.ledDepartmentIds.includes(id));
      const requestedLed = requested.filter((id) => ctx.ledDepartmentIds.includes(id));
      finalIds = Array.from(new Set([...preserved, ...requestedLed]));
    }

    await projectsRepository.setProjectDepartments(workspaceId, projectId, finalIds);
    return { projectId, departmentIds: finalIds.sort() };
  },

  async setProjectAccess(
    workspaceId: string,
    userId: string,
    projectId: string,
    body: unknown,
  ) {
    const requested = parseIdArray(body, 'userIds');
    const ctx = await this.resolveManageContext(workspaceId, userId);
    await this.assertCanManage(workspaceId, projectId, ctx);

    if (requested.length > 0) {
      const activeUserIds = new Set(
        await departmentRepository.listActiveWorkspaceMemberUserIds(workspaceId),
      );
      const invalid = requested.filter((id) => !activeUserIds.has(id));
      if (invalid.length > 0) {
        throw badRequest('Some users are not active members of the workspace', {
          invalidUserIds: invalid.sort(),
        });
      }
    }

    let finalIds: string[];
    if (ctx.hasEdit) {
      finalIds = requested;
    } else {
      // Il capo può assegnare solo i propri sottoposti (membri dei reparti guidati);
      // gli accessi di utenti fuori dal suo perimetro restano invariati.
      const subordinates = new Set(
        await departmentRepository.listMemberUserIdsForDepartments(workspaceId, ctx.ledDepartmentIds),
      );
      const current = await projectsRepository.listProjectAccessUserIds(workspaceId, projectId);
      const preserved = current.filter((id) => !subordinates.has(id));
      const requestedSub = requested.filter((id) => subordinates.has(id));
      finalIds = Array.from(new Set([...preserved, ...requestedSub]));
    }

    await projectsRepository.setProjectAccess(workspaceId, projectId, finalIds);
    return { projectId, userIds: finalIds.sort() };
  },
};
