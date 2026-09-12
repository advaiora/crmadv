import type { FastifyRequest } from 'fastify';
import { readHeaderValue } from '../auth/devAuth.js';
import { badRequest, forbidden, notFound, workspaceMembershipRequired } from '../core/errors.js';
import { membershipRepository } from '../repositories/membership.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { workspaceRepository, type WorkspaceRecord } from '../repositories/workspace.repository.js';

type Workspace = NonNullable<WorkspaceRecord>;

// Le due porte d'ingresso al workspace (header e parametro nel percorso) leggono
// dagli stessi tre archivi. Riceverli come dipendenze permette di provarle senza
// database, con lo stesso schema di `buildEnsureAccess` in server/auth/guards.ts.
// Le firme sono scritte con `Promise` normali e non come `typeof archivio.metodo`:
// i metodi di Prisma restituiscono un thenable suo, che un finto di prova non
// puo' imitare senza tirarsi dietro mezzo client.
export type RequireWorkspaceDependencies = {
  findWorkspaceById: (workspaceId: string) => Promise<WorkspaceRecord>;
  findWorkspaceBySlug: (slug: string) => Promise<WorkspaceRecord>;
  isMember: (userId: string, workspaceId: string) => Promise<boolean>;
  isPlatformAdmin: (userId: string) => Promise<boolean>;
};

const defaultRequireWorkspaceDependencies: RequireWorkspaceDependencies = {
  findWorkspaceById: workspaceRepository.findById,
  findWorkspaceBySlug: workspaceRepository.findBySlug,
  isMember: membershipRepository.isMember,
  isPlatformAdmin: userRepository.isPlatformAdmin,
};

// Blocca l'accesso ai membri di un workspace sospeso; i Super Admin di piattaforma
// restano esenti. La verifica del flag avviene solo se il workspace e' sospeso,
// per non appesantire il percorso comune.
//
// ⚠️ Questo 403 resta `FORBIDDEN` di proposito, e non deve prendere il codice
// dedicato alla membership: un workspace sospeso non e' una membership persa. Se
// lo prendesse, il frontend (src/lib/apiFetch.ts) chiuderebbe la sessione a
// chiunque lavori qui — comprese le persone che sono membri anche di altri
// workspace, che si ritroverebbero fuori da tutto. Vedi CRMA-160.
const assertWorkspaceNotSuspended = async (
  workspace: Workspace,
  userId: string,
  isPlatformAdmin: RequireWorkspaceDependencies['isPlatformAdmin'],
) => {
  if (workspace.status !== 'SUSPENDED') {
    return;
  }

  if (!(await isPlatformAdmin(userId))) {
    throw forbidden('Workspace sospeso', { workspaceId: workspace.id });
  }
};

export const buildRequireWorkspace = (
  dependencies: RequireWorkspaceDependencies = defaultRequireWorkspaceDependencies,
) =>
  async (request: FastifyRequest, userId: string) => {
    const workspaceId = readHeaderValue(request, 'x-workspace-id');
    const workspaceSlug = readHeaderValue(request, 'x-workspace-slug');

    if (!workspaceId && !workspaceSlug) {
      throw badRequest('Workspace header is required', {
        expected: ['x-workspace-id', 'x-workspace-slug'],
      });
    }

    const workspace = workspaceId
      ? await dependencies.findWorkspaceById(workspaceId)
      : await dependencies.findWorkspaceBySlug(workspaceSlug as string);

    if (!workspace) {
      throw notFound('Workspace not found');
    }

    const isMember = await dependencies.isMember(userId, workspace.id);
    if (!isMember) {
      throw workspaceMembershipRequired('User is not a member of the workspace', {
        workspaceId: workspace.id,
      });
    }

    await assertWorkspaceNotSuspended(workspace, userId, dependencies.isPlatformAdmin);

    return workspace;
  };

export const requireWorkspace = buildRequireWorkspace();

export const buildRequireWorkspaceFromParams = (
  dependencies: RequireWorkspaceDependencies = defaultRequireWorkspaceDependencies,
) =>
  async (request: FastifyRequest, userId: string, workspaceId: string) => {
    const normalizedWorkspaceId = workspaceId?.trim();
    if (!normalizedWorkspaceId) {
      throw badRequest('Workspace id in path is required');
    }

    const workspace = await dependencies.findWorkspaceById(normalizedWorkspaceId);
    if (!workspace) {
      throw notFound('Workspace not found');
    }

    const headerWorkspaceId = readHeaderValue(request, 'x-workspace-id');
    if (headerWorkspaceId && headerWorkspaceId !== workspace.id) {
      throw badRequest('Workspace header does not match path parameter', {
        workspaceId: workspace.id,
        headerWorkspaceId,
      });
    }

    const headerWorkspaceSlug = readHeaderValue(request, 'x-workspace-slug');
    if (headerWorkspaceSlug && headerWorkspaceSlug !== workspace.slug) {
      throw badRequest('Workspace header does not match path parameter', {
        workspaceSlug: workspace.slug,
        headerWorkspaceSlug,
      });
    }

    const isMember = await dependencies.isMember(userId, workspace.id);
    if (!isMember) {
      throw workspaceMembershipRequired('User is not a member of the workspace', {
        workspaceId: workspace.id,
      });
    }

    await assertWorkspaceNotSuspended(workspace, userId, dependencies.isPlatformAdmin);

    return workspace;
  };

export const requireWorkspaceFromParams = buildRequireWorkspaceFromParams();
