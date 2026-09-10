// Appartenenze a workspace e costruzione della sessione restituita al client.
// E' il punto in cui, dopo un accesso riuscito, utente e workspace sono entrambi
// noti: per questo il tracciamento dell'accesso si aggancia qui accanto e non
// dentro le singole rotte.

import type { Prisma } from '@prisma/client';
import { signAccessToken } from '../../auth/jwt.js';
import { prisma } from '../../prisma.js';
import { workspaceBrandingService } from '../../services/workspace-branding.service.js';
import { getUniqueTargetFields, isUniqueConstraintError, workspaceSelect } from './auth.shared.js';

export type MembershipRecord = {
  workspaceId: string;
  status: string;
  createdAt: Date;
  workspace: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
};

export const listMemberships = (client: Prisma.TransactionClient | typeof prisma, userId: string) =>
  client.membership.findMany({
    where: {
      userId,
      status: 'ACTIVE',
    },
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      workspaceId: true,
      status: true,
      createdAt: true,
      workspace: {
        select: workspaceSelect,
      },
    },
  }) as Promise<MembershipRecord[]>;

export const pickActiveMembership = (
  memberships: MembershipRecord[],
  preferredWorkspaceId?: string,
) => {
  if (preferredWorkspaceId) {
    const preferredMembership = memberships.find(
      (membership) => membership.workspaceId === preferredWorkspaceId,
    );
    if (preferredMembership) {
      return preferredMembership;
    }
  }

  return memberships[0] ?? null;
};

export const createSessionPayload = async ({
  user,
  workspace,
  onboardingRequired,
  isNewUser,
  isNewWorkspace,
}: {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    isPlatformAdmin?: boolean;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  onboardingRequired?: boolean;
  isNewUser?: boolean;
  isNewWorkspace?: boolean;
}) => {
  const [accessToken, branding] = await Promise.all([
    signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
    }),
    workspaceBrandingService.getWorkspaceBranding(workspace),
  ]);

  return {
    token: accessToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isPlatformAdmin: Boolean(user.isPlatformAdmin),
    },
    workspace,
    branding,
    ...(typeof onboardingRequired === 'boolean' ? { onboardingRequired } : {}),
    ...(typeof isNewUser === 'boolean' ? { isNewUser } : {}),
    ...(typeof isNewWorkspace === 'boolean' ? { isNewWorkspace } : {}),
  };
};

export const resolveWorkspaceForRegistration = async ({
  tx,
  workspaceName,
  workspaceSlug,
}: {
  tx: Prisma.TransactionClient;
  workspaceName: string;
  workspaceSlug: string;
}): Promise<{
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  isNewWorkspace: boolean;
}> => {
  const existingWorkspace = await tx.workspace.findUnique({
    where: {
      slug: workspaceSlug,
    },
    select: workspaceSelect,
  });

  if (existingWorkspace) {
    return {
      workspace: existingWorkspace,
      isNewWorkspace: false,
    };
  }

  try {
    const createdWorkspace = await tx.workspace.create({
      data: {
        name: workspaceName,
        slug: workspaceSlug,
      },
      select: workspaceSelect,
    });

    return {
      workspace: createdWorkspace,
      isNewWorkspace: true,
    };
  } catch (error) {
    if (isUniqueConstraintError(error) && getUniqueTargetFields(error).includes('slug')) {
      const racedWorkspace = await tx.workspace.findUnique({
        where: {
          slug: workspaceSlug,
        },
        select: workspaceSelect,
      });

      if (racedWorkspace) {
        return {
          workspace: racedWorkspace,
          isNewWorkspace: false,
        };
      }
    }

    throw error;
  }
};
