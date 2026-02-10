import type { FastifyRequest } from 'fastify';
import { readHeaderValue } from '../auth/devAuth.js';
import { badRequest, forbidden, notFound } from '../core/errors.js';
import { membershipRepository } from '../repositories/membership.repository.js';
import { workspaceRepository } from '../repositories/workspace.repository.js';

export const requireWorkspace = async (request: FastifyRequest, userId: string) => {
  const workspaceId = readHeaderValue(request, 'x-workspace-id');
  const workspaceSlug = readHeaderValue(request, 'x-workspace-slug');

  if (!workspaceId && !workspaceSlug) {
    throw badRequest('Workspace header is required', {
      expected: ['x-workspace-id', 'x-workspace-slug'],
    });
  }

  const workspace = workspaceId
    ? await workspaceRepository.findById(workspaceId)
    : await workspaceRepository.findBySlug(workspaceSlug as string);

  if (!workspace) {
    throw notFound('Workspace not found');
  }

  const isMember = await membershipRepository.isMember(userId, workspace.id);
  if (!isMember) {
    throw forbidden('User is not a member of the workspace', {
      workspaceId: workspace.id,
    });
  }

  return workspace;
};

export const requireWorkspaceFromParams = async (
  request: FastifyRequest,
  userId: string,
  workspaceId: string,
) => {
  const normalizedWorkspaceId = workspaceId?.trim();
  if (!normalizedWorkspaceId) {
    throw badRequest('Workspace id in path is required');
  }

  const workspace = await workspaceRepository.findById(normalizedWorkspaceId);
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

  const isMember = await membershipRepository.isMember(userId, workspace.id);
  if (!isMember) {
    throw forbidden('User is not a member of the workspace', {
      workspaceId: workspace.id,
    });
  }

  return workspace;
};
