import { Prisma, type Workspace } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import {
  initializeWorkspaceAuthDefaults,
  type WorkspaceSystemRoleName,
  type WorkspaceRegistrationRoleAssignment,
} from '../auth/workspace-bootstrap.js';
import { badRequest, conflict, unauthorized } from '../core/errors.js';

const googleClient = new OAuth2Client();
const workspaceSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const workspaceSelect = {
  id: true,
  name: true,
  slug: true,
} as const;

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  googleSub: true,
} as const;

const isUniqueConstraintError = (error: unknown): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const getUniqueTargetFields = (error: Prisma.PrismaClientKnownRequestError): string[] => {
  const target = (error.meta as Record<string, unknown> | undefined)?.target;
  return Array.isArray(target) ? target.filter((value): value is string => typeof value === 'string') : [];
};

const normalizeName = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const googleErrorDetails = (
  code: 'INVALID_TOKEN' | 'SLUG_TAKEN' | 'NO_WORKSPACE' | 'EMAIL_CONFLICT' | 'BAD_REQUEST',
) => ({
  googleErrorCode: code,
});

export type VerifiedGoogleIdentity = {
  email: string;
  sub: string;
  name: string | null;
  picture: string | null;
};

export type GoogleAuthMode = 'login' | 'signup';

export type GoogleWorkspaceInput = {
  workspaceName?: string;
  workspaceSlug?: string;
  roleName?: WorkspaceSystemRoleName | null;
};

export const verifyGoogleIdToken = async ({
  idToken,
  audience,
}: {
  idToken: string;
  audience: string;
}): Promise<VerifiedGoogleIdentity> => {
  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience,
    });
  } catch {
    throw unauthorized('Token Google non valido', googleErrorDetails('INVALID_TOKEN'));
  }

  const payload = ticket.getPayload();
  const email = payload?.email?.trim().toLowerCase();
  const googleSub = payload?.sub;
  const emailVerified = payload?.email_verified === true;
  const issuer = payload?.iss;
  const isValidIssuer = issuer === 'accounts.google.com' || issuer === 'https://accounts.google.com';

  if (!email || !emailVerified || !googleSub || !isValidIssuer) {
    throw unauthorized('Token Google non valido', googleErrorDetails('INVALID_TOKEN'));
  }

  return {
    email,
    sub: googleSub,
    name: normalizeName(payload.name),
    picture: typeof payload.picture === 'string' ? payload.picture : null,
  };
};

export const upsertGoogleUser = async (
  tx: Prisma.TransactionClient,
  identity: VerifiedGoogleIdentity,
) => {
  // Account linking policy (Option 1):
  // 1) match by googleSub
  // 2) otherwise match by email and attach googleSub when missing
  // 3) reject when email is linked to a different googleSub
  const userByGoogleSub = await tx.user.findUnique({
    where: {
      googleSub: identity.sub,
    },
    select: userSelect,
  });

  if (userByGoogleSub) {
    if (!userByGoogleSub.name && identity.name) {
      const updatedUser = await tx.user.update({
        where: {
          id: userByGoogleSub.id,
        },
        data: {
          name: identity.name,
        },
        select: userSelect,
      });

      return {
        user: updatedUser,
        isNewUser: false,
      };
    }

    return {
      user: userByGoogleSub,
      isNewUser: false,
    };
  }

  const userByEmail = await tx.user.findUnique({
    where: {
      email: identity.email,
    },
    select: userSelect,
  });

  if (userByEmail) {
    if (userByEmail.googleSub && userByEmail.googleSub !== identity.sub) {
      throw conflict('Account Google non disponibile', googleErrorDetails('EMAIL_CONFLICT'));
    }

    const linkedUser = await tx.user.update({
      where: {
        id: userByEmail.id,
      },
      data: {
        googleSub: identity.sub,
        ...(userByEmail.name ? {} : { name: identity.name }),
      },
      select: userSelect,
    });

    return {
      user: linkedUser,
      isNewUser: false,
    };
  }

  try {
    const createdUser = await tx.user.create({
      data: {
        email: identity.email,
        name: identity.name,
        passwordHash: null,
        role: 'member',
        googleSub: identity.sub,
      },
      select: userSelect,
    });

    return {
      user: createdUser,
      isNewUser: true,
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const uniqueFields = getUniqueTargetFields(error);
      if (uniqueFields.includes('googleSub')) {
        throw conflict('Account Google non disponibile', googleErrorDetails('EMAIL_CONFLICT'));
      }
      if (uniqueFields.includes('email')) {
        throw conflict('Email gia registrata', googleErrorDetails('EMAIL_CONFLICT'));
      }
    }

    throw error;
  }
};

type ResolveWorkspaceInput = {
  tx: Prisma.TransactionClient;
  mode: GoogleAuthMode;
  userId: string;
  workspaceInput?: GoogleWorkspaceInput;
};

type ResolveWorkspaceResult = {
  workspace: Pick<Workspace, 'id' | 'name' | 'slug'>;
  statusCode: number;
  isNewWorkspace: boolean;
  roleAssignment?: WorkspaceRegistrationRoleAssignment;
};

export const resolveOrCreateWorkspaceForGoogle = async ({
  tx,
  mode,
  userId,
  workspaceInput,
}: ResolveWorkspaceInput): Promise<ResolveWorkspaceResult> => {
  if (mode === 'login') {
    const membership = await tx.membership.findFirst({
      where: {
        userId,
        status: 'active',
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        workspace: {
          select: workspaceSelect,
        },
      },
    });

    if (!membership?.workspace) {
      throw conflict('Workspace non trovato. Completa la registrazione da Signup.', googleErrorDetails('NO_WORKSPACE'));
    }

    return {
      workspace: membership.workspace,
      statusCode: 200,
      isNewWorkspace: false,
    };
  }

  const workspaceName = workspaceInput?.workspaceName?.trim() ?? '';
  const workspaceSlug = workspaceInput?.workspaceSlug?.trim().toLowerCase() ?? '';

  if (!workspaceName || !workspaceSlug) {
    throw badRequest('workspaceName e workspaceSlug sono obbligatori', googleErrorDetails('BAD_REQUEST'));
  }

  if (!workspaceSlugPattern.test(workspaceSlug)) {
    throw badRequest('Workspace slug non valido', googleErrorDetails('BAD_REQUEST'));
  }

  try {
    const workspace = await tx.workspace.create({
      data: {
        name: workspaceName,
        slug: workspaceSlug,
      },
      select: workspaceSelect,
    });

    await tx.membership.create({
      data: {
        workspaceId: workspace.id,
        userId,
        status: 'active',
      },
    });

    const roleAssignment = await initializeWorkspaceAuthDefaults({
      tx,
      workspaceId: workspace.id,
      userId,
      actorUserId: userId,
      sourceAction: 'auth.google',
      requestedRoleName: workspaceInput?.roleName ?? null,
    });

    return {
      workspace,
      statusCode: 201,
      isNewWorkspace: true,
      roleAssignment,
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const uniqueFields = getUniqueTargetFields(error);
      if (uniqueFields.includes('slug')) {
        throw conflict('Workspace slug gia in uso', googleErrorDetails('SLUG_TAKEN'));
      }
    }

    throw error;
  }
};
