import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { audit } from '../../../audit/audit.js';
import { forbidden, notFound, unauthorized } from '../../../core/errors.js';
import { requireAuthIdentity } from '../../../guards/requireAuth.js';
import { TEAM_PERMISSIONS, type TeamPermissionKey } from '../team.policies.js';
import { teamInviteService } from '../team-invite.service.js';
import { teamService } from '../team.service.js';
import { buildWorkspaceTeamRoute } from './workspace-team.route.js';

type EnsureTeamAccessFn = (
  request: FastifyRequest,
  permissionKey: TeamPermissionKey,
) => Promise<{
  user: { id: string };
  workspace: { id: string };
}>;

const buildMockTeamService = (
  overrides: Partial<typeof teamService> = {},
): typeof teamService => ({
  listMembers: async () => [],
  getMember: async () => ({
    memberId: 'member-1',
    userId: 'user-2',
    name: 'Team User',
    email: 'team@example.com',
    avatar: null,
    status: 'ACTIVE',
    roles: ['Viewer'],
    createdAt: new Date().toISOString(),
  }),
  createMember: async () => ({
    memberId: 'member-1',
    userId: 'user-2',
    name: 'Team User',
    email: 'team@example.com',
    avatar: null,
    status: 'ACTIVE',
    roles: ['Viewer'],
    createdAt: new Date().toISOString(),
  }),
  updateMember: async () => ({
    member: {
      memberId: 'member-1',
      userId: 'user-2',
      name: 'Team User',
      email: 'team@example.com',
      avatar: null,
      status: 'ACTIVE',
      roles: ['Viewer'],
      createdAt: new Date().toISOString(),
    },
    changes: [],
  }),
  setMemberActiveState: async () => ({
    memberId: 'member-1',
    userId: 'user-2',
    name: 'Team User',
    email: 'team@example.com',
    avatar: null,
    status: 'INACTIVE',
    roles: ['Viewer'],
    createdAt: new Date().toISOString(),
  }),
  assignMemberRoles: async () => ({
    member: {
      memberId: 'member-1',
      userId: 'user-2',
      name: 'Team User',
      email: 'team@example.com',
      avatar: null,
      status: 'ACTIVE',
      roles: ['Manager'],
      createdAt: new Date().toISOString(),
    },
    beforeRoleIds: ['role-1'],
    beforeRoleNames: ['Viewer'],
    afterRoleIds: ['role-2'],
    afterRoleNames: ['Manager'],
  }),
  removeMember: async () => ({
    member: {
      memberId: 'member-1',
      userId: 'user-2',
      name: 'Team User',
      email: 'team@example.com',
      avatar: null,
      status: 'INACTIVE',
      roles: ['Viewer'],
      createdAt: new Date().toISOString(),
    },
  }),
  ...overrides,
}) as typeof teamService;

const buildMockTeamInviteService = (
  overrides: Partial<typeof teamInviteService> = {},
): typeof teamInviteService => ({
  createInvite: async () => ({
    inviteId: 'cinvite000000000000000000001',
    email: 'invitee@example.com',
    expiresAt: new Date().toISOString(),
    status: 'PENDING',
    rolePreset: 'Viewer',
  }),
  listInvites: async () => [],
  revokeInvite: async () => ({
    inviteId: 'cinvite000000000000000000001',
    workspaceId: 'workspace-1',
    email: 'invitee@example.com',
    status: 'REVOKED',
    rolePreset: 'Viewer',
    expiresAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    acceptedAt: null,
    revokedAt: new Date().toISOString(),
    invitedBy: {
      userId: 'user-1',
      name: 'Admin',
      email: 'admin@example.com',
    },
    acceptedBy: null,
  }),
  deleteInvite: async () => ({
    inviteId: 'cinvite000000000000000000001',
    workspaceId: 'workspace-1',
    email: 'invitee@example.com',
    status: 'REVOKED',
    rolePreset: 'Viewer',
    expiresAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    acceptedAt: null,
    revokedAt: new Date().toISOString(),
    invitedBy: {
      userId: 'user-1',
      name: 'Admin',
      email: 'admin@example.com',
    },
    acceptedBy: null,
  }),
  acceptInvite: async () => ({
    inviteId: 'cinvite000000000000000000001',
    workspaceId: 'workspace-1',
    workspaceSlug: 'workspace-1',
    membershipId: 'cmembership0000000000000001',
    accessToken: 'test-token',
    user: {
      id: 'user-accept',
      email: 'invitee@example.com',
      role: 'viewer',
      name: null,
    },
  }),
  ...overrides,
}) as typeof teamInviteService;

const createTestApp = async (input: {
  ensureTeamAccessFn?: EnsureTeamAccessFn;
  requireAuthIdentityFn?: typeof requireAuthIdentity;
  teamServiceApi?: typeof teamService;
  teamInviteServiceApi?: typeof teamInviteService;
  auditLogFn?: typeof audit.log;
}) => {
  const app = Fastify({ logger: false });

  await app.register(
    buildWorkspaceTeamRoute({
      ensureTeamAccessFn: input.ensureTeamAccessFn
        ?? (async () => ({
          user: { id: 'user-1' },
          workspace: { id: 'workspace-1' },
        })),
      requireAuthIdentityFn: input.requireAuthIdentityFn ?? requireAuthIdentity,
      teamServiceApi: input.teamServiceApi ?? buildMockTeamService(),
      teamInviteServiceApi: input.teamInviteServiceApi ?? buildMockTeamInviteService(),
      auditLogFn: input.auditLogFn ?? (async () => undefined),
    }),
  );

  return app;
};

const closeApp = async (app: FastifyInstance | null) => {
  if (app) {
    await app.close();
  }
};

test('team route returns 403 when module is disabled', async () => {
  let app: FastifyInstance | null = null;

  try {
    app = await createTestApp({
      ensureTeamAccessFn: async () => {
        throw forbidden('Module is disabled for this workspace');
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/team',
    });

    assert.equal(response.statusCode, 403);
  } finally {
    await closeApp(app);
  }
});

test('team route returns 403 when permission is missing', async () => {
  let app: FastifyInstance | null = null;

  try {
    app = await createTestApp({
      ensureTeamAccessFn: async (_request, permissionKey) => {
        if (permissionKey === TEAM_PERMISSIONS.view) {
          throw forbidden('Permission denied');
        }

        return {
          user: { id: 'user-1' },
          workspace: { id: 'workspace-1' },
        };
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/team',
    });

    assert.equal(response.statusCode, 403);
  } finally {
    await closeApp(app);
  }
});

test('team route returns 404 for member id outside current workspace scope', async () => {
  let app: FastifyInstance | null = null;

  try {
    app = await createTestApp({
      ensureTeamAccessFn: async () => ({
        user: { id: 'user-1' },
        workspace: { id: 'workspace-1' },
      }),
      teamServiceApi: buildMockTeamService({
        getMember: async (workspaceId, memberId) => {
          assert.equal(workspaceId, 'workspace-1');
          assert.equal(memberId, 'cmemberworkspace20000000000001');
          throw notFound('Team member not found', {
            workspaceId,
            memberId,
          });
        },
      }),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/team/cmemberworkspace20000000000001',
    });

    assert.equal(response.statusCode, 404);
  } finally {
    await closeApp(app);
  }
});

test('team invite route writes audit event team.invite_sent', async () => {
  let app: FastifyInstance | null = null;
  const events: string[] = [];

  try {
    app = await createTestApp({
      auditLogFn: async (payload) => {
        events.push(payload.event);
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/team/invites',
      payload: {
        email: 'invitee@example.com',
      },
    });

    assert.equal(response.statusCode, 201);
    assert.ok(events.includes('team.invite_sent'));
  } finally {
    await closeApp(app);
  }
});

test('team invite delete route writes audit event team.invite_deleted', async () => {
  let app: FastifyInstance | null = null;
  const events: string[] = [];

  try {
    app = await createTestApp({
      auditLogFn: async (payload) => {
        events.push(payload.event);
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/team/invites/cinvite000000000000000000001/delete',
    });

    assert.equal(response.statusCode, 200);
    assert.ok(events.includes('team.invite_deleted'));
  } finally {
    await closeApp(app);
  }
});

test('team invite accept route writes audit event team.invite_accepted', async () => {
  let app: FastifyInstance | null = null;
  const events: string[] = [];

  try {
    app = await createTestApp({
      auditLogFn: async (payload) => {
        events.push(payload.event);
      },
      requireAuthIdentityFn: async () => {
        throw unauthorized('Missing token');
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/team/invites/accept',
      payload: {
        token: 'f'.repeat(64),
      },
    });

    assert.equal(response.statusCode, 200);
    assert.ok(events.includes('team.invite_accepted'));
  } finally {
    await closeApp(app);
  }
});

test('team deactivate route writes audit event team.member_deactivated', async () => {
  let app: FastifyInstance | null = null;
  const events: string[] = [];

  try {
    app = await createTestApp({
      auditLogFn: async (payload) => {
        events.push(payload.event);
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/team/cmember000000000000000000001/deactivate',
      payload: {
        active: false,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.ok(events.includes('team.member_deactivated'));
  } finally {
    await closeApp(app);
  }
});

test('team roles route writes audit event team.roles_changed', async () => {
  let app: FastifyInstance | null = null;
  const events: string[] = [];

  try {
    app = await createTestApp({
      auditLogFn: async (payload) => {
        events.push(payload.event);
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/team/cmember000000000000000000001/roles',
      payload: {
        roleNames: ['Manager'],
      },
    });

    assert.equal(response.statusCode, 200);
    assert.ok(events.includes('team.roles_changed'));
  } finally {
    await closeApp(app);
  }
});

test('team delete route writes audit event team.member_deleted', async () => {
  let app: FastifyInstance | null = null;
  const events: string[] = [];

  try {
    app = await createTestApp({
      auditLogFn: async (payload) => {
        events.push(payload.event);
      },
    });

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/team/cmember000000000000000000001',
    });

    assert.equal(response.statusCode, 200);
    assert.ok(events.includes('team.member_deleted'));
  } finally {
    await closeApp(app);
  }
});

test('team remove alias route writes audit event team.member_deleted', async () => {
  let app: FastifyInstance | null = null;
  const events: string[] = [];

  try {
    app = await createTestApp({
      auditLogFn: async (payload) => {
        events.push(payload.event);
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/team/cmember000000000000000000001/remove',
    });

    assert.equal(response.statusCode, 200);
    assert.ok(events.includes('team.member_deleted'));
  } finally {
    await closeApp(app);
  }
});
