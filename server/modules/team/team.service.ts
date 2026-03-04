import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { assignWorkspaceUserRole, normalizeWorkspaceSystemRoleName } from '../../auth/workspace-bootstrap.js';
import { SYSTEM_ROLE_NAME } from '../../auth/rbac-catalog.js';
import { badRequest, conflict, forbidden, notFound } from '../../core/errors.js';
import { prisma } from '../../prisma.js';
import { userRepository } from '../../repositories/user.repository.js';
import { teamRepository, type TeamMemberRecord } from './team.repository.js';

const createMemberSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().optional(),
    userId: z.string().trim().min(1).optional(),
    roleName: z.string().trim().min(1).optional(),
    createUserIfMissing: z.boolean().optional(),
    name: z.string().trim().min(1).max(120).optional(),
    password: z.string().min(8).max(128).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const hasEmail = Boolean(value.email);
    const hasUserId = Boolean(value.userId);

    if (hasEmail === hasUserId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: 'Provide exactly one between email or userId',
      });
    }

    if (!hasEmail && (value.createUserIfMissing || value.name || value.password)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: 'createUserIfMissing, name and password require email',
      });
    }

    if (hasEmail && value.createUserIfMissing) {
      if (!value.password) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['password'],
          message: 'password is required when createUserIfMissing is true',
        });
      }
    }
  });

const TEAM_MEMBER_CREATE_PASSWORD_SALT_ROUNDS = 10;

const updateMemberSchema = z.object({}).strict();

const deactivateMemberSchema = z.object({
  active: z.boolean(),
}).strict();

const assignRolesSchema = z.object({
  roleNames: z.array(z.string().trim().min(1)).min(1).max(1),
}).strict();

type TeamMemberDto = {
  memberId: string;
  userId: string;
  name: string | null;
  email: string;
  avatar: null;
  status: string;
  roles: string[];
  createdAt: string;
};

type AssignMemberRolesResult = {
  member: TeamMemberDto;
  beforeRoleIds: string[];
  beforeRoleNames: string[];
  afterRoleIds: string[];
  afterRoleNames: string[];
};

type RemoveMemberResult = {
  member: TeamMemberDto;
};

const mapMemberToDto = (member: TeamMemberRecord): TeamMemberDto => ({
  memberId: member.memberId,
  userId: member.userId,
  name: member.name,
  email: member.email,
  avatar: null,
  status: member.status,
  roles: member.roles.map((role) => role.roleName),
  createdAt: member.createdAt.toISOString(),
});

const parseCreateMemberPayload = (value: unknown) => {
  const parsed = createMemberSchema.safeParse(value);
  if (!parsed.success) {
    throw badRequest('Invalid team create payload', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const parseUpdateMemberPayload = (value: unknown) => {
  const parsed = updateMemberSchema.safeParse(value ?? {});
  if (!parsed.success) {
    throw badRequest('Invalid team update payload', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const parseDeactivatePayload = (value: unknown) => {
  const parsed = deactivateMemberSchema.safeParse(value);
  if (!parsed.success) {
    throw badRequest('Invalid team deactivate payload', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const parseAssignRolesPayload = (value: unknown) => {
  const parsed = assignRolesSchema.safeParse(value);
  if (!parsed.success) {
    throw badRequest('Invalid team roles payload', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const requireWorkspaceMemberById = async (workspaceId: string, memberId: string) => {
  const member = await teamRepository.findMemberById(workspaceId, memberId);
  if (!member) {
    throw notFound('Team member not found', {
      workspaceId,
      memberId,
    });
  }

  return member;
};

const resolveRoleNameOrThrow = (roleName: string | undefined) => {
  if (!roleName) {
    return SYSTEM_ROLE_NAME.viewer;
  }

  const normalizedRoleName = normalizeWorkspaceSystemRoleName(roleName);
  if (!normalizedRoleName) {
    throw badRequest('Invalid roleName. Allowed values: Superadmin, Admin, Manager, Operativo, Viewer');
  }

  return normalizedRoleName;
};

export const teamService = {
  listMembers: async (workspaceId: string) => {
    const members = await teamRepository.listMembers(workspaceId);
    return members.map(mapMemberToDto);
  },

  getMember: async (workspaceId: string, memberId: string) => {
    const member = await requireWorkspaceMemberById(workspaceId, memberId);
    return mapMemberToDto(member);
  },

  createMember: async ({
    workspaceId,
    actorUserId,
    payload,
  }: {
    workspaceId: string;
    actorUserId: string;
    payload: unknown;
  }) => {
    const parsedPayload = parseCreateMemberPayload(payload);
    let targetUser = parsedPayload.userId
      ? await userRepository.findById(parsedPayload.userId)
      : await userRepository.findByEmail(parsedPayload.email as string);

    if (!targetUser && parsedPayload.email && parsedPayload.createUserIfMissing) {
      const passwordHash = await bcrypt.hash(
        parsedPayload.password as string,
        TEAM_MEMBER_CREATE_PASSWORD_SALT_ROUNDS,
      );

      try {
        targetUser = await prisma.user.create({
          data: {
            email: parsedPayload.email,
            name: parsedPayload.name ?? null,
            passwordHash,
            role: 'member',
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          targetUser = await userRepository.findByEmail(parsedPayload.email);
        } else {
          throw error;
        }
      }
    }

    if (!targetUser) {
      throw badRequest('User not found. Provide createUserIfMissing=true with password to create a new account');
    }

    const existingMembership = await teamRepository.findMembershipByUserId(workspaceId, targetUser.id);
    if (existingMembership) {
      throw conflict('User is already a member of this workspace', {
        workspaceId,
        userId: targetUser.id,
        memberId: existingMembership.id,
      });
    }

    const nextRoleName = resolveRoleNameOrThrow(parsedPayload.roleName);

    const createdMember = await prisma.$transaction(async (tx) => {
      const createdMembership = await teamRepository.createMembership(workspaceId, targetUser.id, tx);

      await assignWorkspaceUserRole({
        tx,
        workspaceId,
        targetUserId: targetUser.id,
        actorUserId,
        nextRoleName,
        sourceAction: 'team.member.create',
        auditAction: 'rbac.user.role.assigned',
      });

      const member = await teamRepository.findMemberById(workspaceId, createdMembership.id, tx);
      if (!member) {
        throw notFound('Team member not found after creation', {
          workspaceId,
          memberId: createdMembership.id,
        });
      }

      return member;
    });

    return mapMemberToDto(createdMember);
  },

  updateMember: async ({
    workspaceId,
    memberId,
    payload,
  }: {
    workspaceId: string;
    memberId: string;
    payload: unknown;
  }) => {
    parseUpdateMemberPayload(payload);
    const member = await requireWorkspaceMemberById(workspaceId, memberId);

    // Membership model currently has no workspace-scoped editable profile fields.
    // Phase 2 keeps PATCH operational as a validated no-op endpoint.
    return {
      member: mapMemberToDto(member),
      changes: [] as string[],
    };
  },

  setMemberActiveState: async ({
    workspaceId,
    actorUserId,
    memberId,
    payload,
  }: {
    workspaceId: string;
    actorUserId: string;
    memberId: string;
    payload: unknown;
  }) => {
    const parsedPayload = parseDeactivatePayload(payload);
    const member = await requireWorkspaceMemberById(workspaceId, memberId);

    if (!parsedPayload.active) {
      if (member.userId === actorUserId) {
        throw forbidden('You cannot deactivate your own membership');
      }

      const isTargetSuperadmin = member.roles.some((role) => role.isSuperadmin);
      if (isTargetSuperadmin && member.status === 'ACTIVE') {
        const activeSuperadminMembersCount = await teamRepository.countActiveSuperadmins(workspaceId);
        if (activeSuperadminMembersCount <= 1) {
          throw forbidden('Cannot deactivate the last active Superadmin in workspace', {
            workspaceId,
            memberId,
          });
        }
      }
    }

    const nextStatus = parsedPayload.active ? 'ACTIVE' : 'INACTIVE';
    const updated = await teamRepository.updateMembershipStatus(workspaceId, memberId, nextStatus);
    if (!updated) {
      throw notFound('Team member not found', {
        workspaceId,
        memberId,
      });
    }

    const refreshedMember = await requireWorkspaceMemberById(workspaceId, memberId);
    return mapMemberToDto(refreshedMember);
  },

  assignMemberRoles: async ({
    workspaceId,
    actorUserId,
    memberId,
    payload,
  }: {
    workspaceId: string;
    actorUserId: string;
    memberId: string;
    payload: unknown;
  }): Promise<AssignMemberRolesResult> => {
    const parsedPayload = parseAssignRolesPayload(payload);
    const member = await requireWorkspaceMemberById(workspaceId, memberId);
    const actorIsSuperadmin = await teamRepository.isSuperadmin(workspaceId, actorUserId);
    if (!actorIsSuperadmin) {
      throw forbidden('Only Superadmin can assign team roles');
    }

    const requestedRoleName = parsedPayload.roleNames[0];
    const normalizedRoleName = normalizeWorkspaceSystemRoleName(requestedRoleName);
    if (!normalizedRoleName) {
      throw badRequest('Invalid roleNames. Allowed values: Superadmin, Admin, Manager, Operativo, Viewer');
    }

    const beforeRoles = member.roles.map((role) => ({
      roleId: role.roleId,
      roleName: role.roleName,
      isSuperadmin: role.isSuperadmin,
    }));
    const targetIsSuperadmin = beforeRoles.some((role) => role.isSuperadmin);
    const targetIsActive = member.status === 'ACTIVE';
    const isDemotingSuperadmin = targetIsSuperadmin && normalizedRoleName !== SYSTEM_ROLE_NAME.superadmin;

    if (targetIsActive && isDemotingSuperadmin) {
      const activeSuperadminCount = await teamRepository.countActiveSuperadmins(workspaceId);
      if (activeSuperadminCount <= 1) {
        throw forbidden('Cannot remove Superadmin role from the last active Superadmin in workspace', {
          workspaceId,
          memberId,
        });
      }
    }

    if (member.userId === actorUserId && isDemotingSuperadmin) {
      throw forbidden('Self role downgrade is not allowed. Ask another Superadmin to perform this change', {
        workspaceId,
        memberId,
        actorUserId,
      });
    }

    await prisma.$transaction((tx) =>
      assignWorkspaceUserRole({
        tx,
        workspaceId,
        targetUserId: member.userId,
        actorUserId,
        nextRoleName: normalizedRoleName,
        sourceAction: 'team.member.roles.assign',
        auditAction: 'rbac.user.role.modified',
      }),
    );

    const refreshedMember = await requireWorkspaceMemberById(workspaceId, memberId);
    const afterRoles = refreshedMember.roles.map((role) => ({
      roleId: role.roleId,
      roleName: role.roleName,
    }));

    return {
      member: mapMemberToDto(refreshedMember),
      beforeRoleIds: beforeRoles.map((role) => role.roleId),
      beforeRoleNames: beforeRoles.map((role) => role.roleName),
      afterRoleIds: afterRoles.map((role) => role.roleId),
      afterRoleNames: afterRoles.map((role) => role.roleName),
    };
  },

  removeMember: async ({
    workspaceId,
    actorUserId,
    memberId,
  }: {
    workspaceId: string;
    actorUserId: string;
    memberId: string;
  }): Promise<RemoveMemberResult> => {
    const member = await requireWorkspaceMemberById(workspaceId, memberId);
    const actorIsSuperadmin = await teamRepository.isSuperadmin(workspaceId, actorUserId);
    if (!actorIsSuperadmin) {
      throw forbidden('Only Superadmin can remove team members');
    }

    if (member.userId === actorUserId) {
      throw forbidden('You cannot remove your own membership');
    }

    const targetIsActiveSuperadmin =
      member.status === 'ACTIVE'
      && member.roles.some((role) => role.isSuperadmin);

    if (targetIsActiveSuperadmin) {
      const activeSuperadminCount = await teamRepository.countActiveSuperadmins(workspaceId);
      if (activeSuperadminCount <= 1) {
        throw forbidden('Cannot remove the last active Superadmin in workspace', {
          workspaceId,
          memberId,
        });
      }
    }

    const deleted = await prisma.$transaction((tx) =>
      teamRepository.deleteMember(workspaceId, memberId, member.userId, tx),
    );

    if (!deleted) {
      throw notFound('Team member not found', {
        workspaceId,
        memberId,
      });
    }

    return {
      member: mapMemberToDto(member),
    };
  },
};
