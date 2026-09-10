// Rotte del profilo: PATCH /auth/me e GET /auth/me. Registrate come plugin da
// auth.route.ts.

import type { Prisma } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';
import { audit } from '../../audit/audit.js';
import { signAccessToken } from '../../auth/jwt.js';
import { badRequest, conflict, forbidden, unauthorized } from '../../core/errors.js';
import { ok } from '../../core/response.js';
import { requireAuthIdentity } from '../../guards/requireAuth.js';
import { prisma } from '../../prisma.js';
import { auditRepository } from '../../repositories/audit.repository.js';
import { moduleRepository } from '../../repositories/module.repository.js';
import { rbacRepository } from '../../repositories/rbac.repository.js';
import { workspaceBrandingService } from '../../services/workspace-branding.service.js';
import { updateMeSchema } from './auth.schemas.js';
import { listMemberships, pickActiveMembership } from './auth.session.js';
import { getUniqueTargetFields, isUniqueConstraintError } from './auth.shared.js';
import { ensureWorkspaceAccessDefaults } from './auth.workspace-defaults.js';

const meRoute: FastifyPluginAsync = async (app) => {
  app.patch<{ Body: unknown }>('/auth/me', async (request, reply) => {
    const { user, tokenClaims } = await requireAuthIdentity(request);

    const parsed = updateMeSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest('Invalid profile update payload', {
        issues: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;
    const patch: Prisma.UserUpdateInput = {};
    const changedFields: string[] = [];

    if (payload.name !== undefined && payload.name !== user.name) {
      patch.name = payload.name;
      changedFields.push('name');
    }

    if (payload.email !== undefined && payload.email !== user.email) {
      patch.email = payload.email;
      changedFields.push('email');
    }

    if (payload.themePreference !== undefined && payload.themePreference !== user.themePreference) {
      patch.themePreference = payload.themePreference;
      changedFields.push('themePreference');
    }

    if (payload.avatarUrl !== undefined && payload.avatarUrl !== user.avatarUrl) {
      patch.avatarUrl = payload.avatarUrl;
      changedFields.push('avatarUrl');
    }

    if (changedFields.length === 0) {
      return ok(reply, {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          themePreference: user.themePreference ?? null,
          avatarUrl: user.avatarUrl ?? null,
        },
        changedFields: [],
      });
    }

    const memberships = await listMemberships(prisma, user.id);
    const activeMembership = pickActiveMembership(memberships, tokenClaims.workspaceId);
    if (!activeMembership) {
      throw unauthorized('Sessione non valida');
    }

    try {
      const updatedUser = await prisma.user.update({
        where: {
          id: user.id,
        },
        data: patch,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          themePreference: true,
          avatarUrl: true,
        },
      });

      const shouldRefreshToken = updatedUser.email !== user.email;
      const refreshedToken = shouldRefreshToken
        ? await signAccessToken({
            sub: updatedUser.id,
            email: updatedUser.email,
            role: updatedUser.role,
            workspaceId: activeMembership.workspace.id,
            workspaceSlug: activeMembership.workspace.slug,
          })
        : null;

      await audit.log({
        event: 'me.update',
        actorUserId: updatedUser.id,
        workspaceId: activeMembership.workspace.id,
        entityType: 'user',
        entityId: updatedUser.id,
        metadata: {
          route: '/auth/me',
          changedFields,
        },
        request,
      });

      return ok(reply, {
        ...(refreshedToken ? { token: refreshedToken } : {}),
        user: updatedUser,
        changedFields,
      });
    } catch (error) {
      if (isUniqueConstraintError(error) && getUniqueTargetFields(error).includes('email')) {
        throw conflict('Email gia in uso');
      }

      throw error;
    }
  });

  app.get('/auth/me', async (request, reply) => {
    const { user, tokenClaims } = await requireAuthIdentity(request);

    const memberships = await listMemberships(prisma, user.id);
    const activeMembership = pickActiveMembership(memberships, tokenClaims.workspaceId);
    if (!activeMembership) {
      throw unauthorized('Sessione non valida');
    }

    if (activeMembership.workspace.status === 'SUSPENDED' && !user.isPlatformAdmin) {
      throw forbidden('Questo workspace è stato sospeso. Contatta un amministratore di piattaforma.');
    }

    const repairedRole = await prisma.$transaction((tx) =>
      ensureWorkspaceAccessDefaults({
        tx,
        workspaceId: activeMembership.workspace.id,
        userId: user.id,
        fallbackUserRole: user.role,
        sourceAction: 'auth.me.self_heal',
      }),
    );
    const effectiveUserRole = repairedRole?.assignedUserRole ?? user.role;

    const [enabledModules, permissions, roles, recentActivity, branding] = await Promise.all([
      moduleRepository.listEnabledModules(activeMembership.workspace.id),
      rbacRepository.listUserPermissions(user.id, activeMembership.workspace.id),
      rbacRepository.listUserRoles(user.id, activeMembership.workspace.id),
      auditRepository.listRecentBusinessByWorkspace(activeMembership.workspace.id, 8),
      workspaceBrandingService.getWorkspaceBranding(activeMembership.workspace),
    ]);

    await audit.log({
      event: 'me.view',
      entityType: 'user',
      entityId: user.id,
      actorUserId: user.id,
      workspaceId: activeMembership.workspace.id,
      metadata: {
        route: '/auth/me',
      },
      request,
    });

    const shouldRefreshToken =
      tokenClaims.workspaceId !== activeMembership.workspace.id ||
      tokenClaims.workspaceSlug !== activeMembership.workspace.slug ||
      tokenClaims.role !== effectiveUserRole;

    const refreshedToken = shouldRefreshToken
      ? await signAccessToken({
          sub: user.id,
          email: user.email,
          role: effectiveUserRole,
          workspaceId: activeMembership.workspace.id,
          workspaceSlug: activeMembership.workspace.slug,
        })
      : null;

    return ok(reply, {
      ...(refreshedToken ? { token: refreshedToken } : {}),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: effectiveUserRole,
        isPlatformAdmin: Boolean(user.isPlatformAdmin),
        themePreference: user.themePreference ?? null,
        avatarUrl: user.avatarUrl ?? null,
      },
      workspace: activeMembership.workspace,
      branding,
      memberships: memberships.map((membership) => ({
        workspaceId: membership.workspaceId,
        status: membership.status,
        createdAt: membership.createdAt.toISOString(),
        workspace: membership.workspace,
      })),
      enabledModules,
      permissions,
      roles,
      recentActivity: recentActivity.map((item) => ({
        id: item.id,
        action: item.action,
        entityType: item.entityType,
        entityId: item.entityId,
        metadata: item.metadata,
        createdAt: item.createdAt.toISOString(),
        actor: item.actorUser
          ? {
              id: item.actorUser.id,
              email: item.actorUser.email,
              ...(item.actorUser.name ? { name: item.actorUser.name } : {}),
            }
          : null,
      })),
    });
  });
};

export default meRoute;
