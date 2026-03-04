import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from '../../core/errors.js';
import { resetTeamRateLimitStoreForTests } from './rate-limit.js';
import { buildTeamInviteService } from './team-invite.service.js';

const FIXED_NOW = new Date('2026-03-04T10:00:00.000Z');
const TEST_TOKEN = 'f'.repeat(64);
const TEST_CLIENT_IP = '127.0.0.1';

const makeInvite = (overrides: Record<string, unknown> = {}) => ({
  id: 'invite-1',
  workspaceId: 'workspace-1',
  email: 'invitee@example.com',
  tokenHash: `hashed:${TEST_TOKEN}`,
  expiresAt: new Date('2026-03-11T10:00:00.000Z'),
  status: 'PENDING',
  rolePresetName: 'Viewer',
  invitedByUserId: 'user-admin',
  acceptedByUserId: null,
  acceptedAt: null,
  revokedAt: null,
  createdAt: new Date('2026-03-04T10:00:00.000Z'),
  updatedAt: new Date('2026-03-04T10:00:00.000Z'),
  workspace: {
    id: 'workspace-1',
    name: 'Workspace One',
    slug: 'workspace-one',
  },
  invitedByUser: {
    id: 'user-admin',
    name: 'Admin User',
    email: 'admin@example.com',
  },
  acceptedByUser: null,
  ...overrides,
});

const createService = (overrides: Record<string, unknown> = {}) => {
  const typedOverrides = overrides as {
    inviteRepository?: Record<string, unknown>;
    teamRepo?: Record<string, unknown>;
    userRepo?: Record<string, unknown>;
    prismaClient?: Record<string, unknown>;
    moduleRepo?: Record<string, unknown>;
    notifier?: Record<string, unknown>;
  };

  const baseDependencies = {
    inviteRepository: {
      expirePendingInvites: async () => ({ count: 0 }),
      expirePendingInviteById: async () => ({ count: 0 }),
      findPendingInviteByEmail: async () => null,
      createInvite: async (input: Record<string, unknown>) => makeInvite(input),
      refreshPendingInvite: async () => makeInvite(),
      listInvitesByWorkspace: async () => [makeInvite()],
      findInviteById: async () => makeInvite(),
      findInviteByTokenHash: async () => makeInvite(),
      revokePendingInvite: async () => ({ count: 1 }),
      deleteInviteById: async () => ({ count: 1 }),
      markInviteAccepted: async () => ({ count: 1 }),
    } as never,
    teamRepo: {
      findMembershipByUserId: async () => null,
    } as never,
    userRepo: {
      findByEmail: async () => null,
    } as never,
    prismaClient: {
      $transaction: async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
        callback({
          user: {
            findUnique: async () => null,
            upsert: async () => ({
              id: 'user-invitee',
              email: 'invitee@example.com',
              name: null,
              role: 'member',
            }),
          },
          membership: {
            upsert: async () => ({ id: 'membership-1' }),
          },
        }),
    } as never,
    moduleRepo: {
      isEnabled: async () => true,
    } as never,
    notifier: {
      sendInvite: async () => ({
        delivered: false,
        reason: 'SMTP_NOT_CONFIGURED',
      }),
    } as never,
    assignWorkspaceUserRoleFn: async () => ({
      previousRoleName: null,
      assignedRoleName: 'Viewer',
      assignedUserRole: 'viewer',
      assignedPermissionKeys: [],
      actorRoleName: null,
    }),
    signAccessTokenFn: async () => 'signed-access-token',
    generateTokenFn: () => TEST_TOKEN,
    hashTokenFn: (token: string) => `hashed:${token}`,
    nowFn: () => FIXED_NOW,
  };

  return buildTeamInviteService({
    ...baseDependencies,
    ...typedOverrides,
    inviteRepository: {
      ...baseDependencies.inviteRepository,
      ...(typedOverrides.inviteRepository ?? {}),
    },
    teamRepo: {
      ...baseDependencies.teamRepo,
      ...(typedOverrides.teamRepo ?? {}),
    },
    userRepo: {
      ...baseDependencies.userRepo,
      ...(typedOverrides.userRepo ?? {}),
    },
    prismaClient: {
      ...baseDependencies.prismaClient,
      ...(typedOverrides.prismaClient ?? {}),
    },
    moduleRepo: {
      ...baseDependencies.moduleRepo,
      ...(typedOverrides.moduleRepo ?? {}),
    },
    notifier: {
      ...baseDependencies.notifier,
      ...(typedOverrides.notifier ?? {}),
    },
  } as never);
};

test.beforeEach(() => {
  resetTeamRateLimitStoreForTests();
});

test('createInvite stores token hash only and not plain token', async () => {
  let createPayload: Record<string, unknown> | null = null;
  const service = createService({
    inviteRepository: {
      expirePendingInvites: async () => ({ count: 0 }),
      findPendingInviteByEmail: async () => null,
      createInvite: async (input: Record<string, unknown>) => {
        createPayload = input;
        return makeInvite(input);
      },
    },
  });

  const result = await service.createInvite({
    workspaceId: 'workspace-1',
    invitedByUserId: 'user-admin',
    invitedByDisplayName: 'Admin User',
    payload: {
      email: 'invitee@example.com',
    },
  });

  assert.ok(createPayload);
  assert.equal(createPayload?.tokenHash, `hashed:${TEST_TOKEN}`);
  assert.equal('token' in (createPayload as Record<string, unknown>), false);
  assert.ok(typeof result.inviteLink === 'string' && result.inviteLink.includes(`token=${TEST_TOKEN}`));
});

test('deleteInvite removes invite record in workspace scope', async () => {
  let deletedInviteId = '';
  let deletedWorkspaceId = '';

  const service = createService({
    inviteRepository: {
      findInviteById: async () => makeInvite(),
      deleteInviteById: async (workspaceId: string, inviteId: string) => {
        deletedWorkspaceId = workspaceId;
        deletedInviteId = inviteId;
        return { count: 1 };
      },
    },
  });

  const result = await service.deleteInvite({
    workspaceId: 'workspace-1',
    inviteId: 'invite-1',
  });

  assert.equal(deletedWorkspaceId, 'workspace-1');
  assert.equal(deletedInviteId, 'invite-1');
  assert.equal(result.inviteId, 'invite-1');
});

test('acceptInvite with valid token creates membership and marks invite accepted', async () => {
  const inviteState = makeInvite();
  let inviteMarkedAccepted = false;

  const service = createService({
    inviteRepository: {
      findInviteByTokenHash: async () => inviteState,
      markInviteAccepted: async (_inviteId: string, acceptedByUserId: string, acceptedAt: Date) => {
        inviteState.status = 'ACCEPTED';
        inviteState.acceptedByUserId = acceptedByUserId;
        inviteState.acceptedAt = acceptedAt;
        inviteMarkedAccepted = true;
        return { count: 1 };
      },
    },
    prismaClient: {
      $transaction: async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
        callback({
          user: {
            findUnique: async () => ({
              id: 'user-invitee',
              email: 'invitee@example.com',
              name: null,
              role: 'member',
            }),
            upsert: async () => ({
              id: 'user-invitee',
              email: 'invitee@example.com',
              name: null,
              role: 'member',
            }),
          },
          membership: {
            upsert: async () => ({ id: 'membership-1' }),
          },
        }),
    },
  });

  const result = await service.acceptInvite({
    payload: {
      token: TEST_TOKEN,
    },
    authenticatedUserId: null,
    clientIp: TEST_CLIENT_IP,
  });

  assert.equal(inviteMarkedAccepted, true);
  assert.equal(inviteState.status, 'ACCEPTED');
  assert.equal(result.inviteId, 'invite-1');
  assert.equal(result.workspaceId, 'workspace-1');
  assert.equal(result.membershipId, 'membership-1');
});

test('acceptInvite returns 410 when token is expired', async () => {
  const expiredInvite = makeInvite({
    expiresAt: new Date('2026-03-01T10:00:00.000Z'),
  });
  let expiredMarked = false;

  const service = createService({
    inviteRepository: {
      findInviteByTokenHash: async () => expiredInvite,
      expirePendingInviteById: async () => {
        expiredMarked = true;
        return { count: 1 };
      },
    },
    prismaClient: {
      $transaction: async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
        callback({
          user: {
            findUnique: async () => ({
              id: 'user-invitee',
              email: 'invitee@example.com',
              name: null,
              role: 'member',
            }),
            upsert: async () => ({
              id: 'user-invitee',
              email: 'invitee@example.com',
              name: null,
              role: 'member',
            }),
          },
          membership: {
            upsert: async () => ({ id: 'membership-1' }),
          },
        }),
    },
  });

  await assert.rejects(
    async () =>
      service.acceptInvite({
        payload: { token: TEST_TOKEN },
        authenticatedUserId: null,
        clientIp: TEST_CLIENT_IP,
      }),
    (error: unknown) => error instanceof HttpError && error.statusCode === 410,
  );
  assert.equal(expiredMarked, true);
});

test('acceptInvite rejects revoked invite token', async () => {
  const service = createService({
    inviteRepository: {
      findInviteByTokenHash: async () => makeInvite({
        status: 'REVOKED',
      }),
    },
  });

  await assert.rejects(
    async () =>
      service.acceptInvite({
        payload: { token: TEST_TOKEN },
        authenticatedUserId: null,
        clientIp: TEST_CLIENT_IP,
      }),
    (error: unknown) => error instanceof HttpError && error.statusCode === 410,
  );
});

test('acceptInvite returns 403 when team module is disabled for invite workspace', async () => {
  const service = createService({
    moduleRepo: {
      isEnabled: async () => false,
    },
  });

  await assert.rejects(
    async () =>
      service.acceptInvite({
        payload: { token: TEST_TOKEN },
        authenticatedUserId: null,
        clientIp: TEST_CLIENT_IP,
      }),
    (error: unknown) => error instanceof HttpError && error.statusCode === 403,
  );
});

test('acceptInvite uses workspace from token-linked invite record', async () => {
  const inviteWorkspaceId = 'workspace-2';
  let checkedWorkspaceId = '';
  let upsertWorkspaceId = '';

  const service = createService({
    inviteRepository: {
      findInviteByTokenHash: async () =>
        makeInvite({
          workspaceId: inviteWorkspaceId,
          workspace: {
            id: inviteWorkspaceId,
            name: 'Workspace Two',
            slug: 'workspace-two',
          },
        }),
    },
    moduleRepo: {
      isEnabled: async (workspaceId: string) => {
        checkedWorkspaceId = workspaceId;
        return true;
      },
    },
    prismaClient: {
      $transaction: async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
        callback({
          user: {
            findUnique: async () => null,
            upsert: async () => ({
              id: 'user-invitee',
              email: 'invitee@example.com',
              name: null,
              role: 'member',
            }),
          },
          membership: {
            upsert: async (input: {
              where: { workspaceId_userId: { workspaceId: string } };
            }) => {
              upsertWorkspaceId = input.where.workspaceId_userId.workspaceId;
              return { id: 'membership-2' };
            },
          },
        }),
    },
  });

  const result = await service.acceptInvite({
    payload: { token: TEST_TOKEN },
    authenticatedUserId: null,
    clientIp: TEST_CLIENT_IP,
  });

  assert.equal(checkedWorkspaceId, inviteWorkspaceId);
  assert.equal(upsertWorkspaceId, inviteWorkspaceId);
  assert.equal(result.workspaceId, inviteWorkspaceId);
});

test('acceptInvite is idempotent after first successful acceptance', async () => {
  const inviteState = makeInvite();
  let markAcceptedCalls = 0;

  const service = createService({
    inviteRepository: {
      findInviteByTokenHash: async () => inviteState,
      markInviteAccepted: async (_inviteId: string, acceptedByUserId: string, acceptedAt: Date) => {
        markAcceptedCalls += 1;
        inviteState.status = 'ACCEPTED';
        inviteState.acceptedByUserId = acceptedByUserId;
        inviteState.acceptedAt = acceptedAt;
        return { count: 1 };
      },
    },
    prismaClient: {
      $transaction: async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
        callback({
          user: {
            findUnique: async () => ({
              id: 'user-invitee',
              email: 'invitee@example.com',
              name: null,
              role: 'member',
            }),
            upsert: async () => ({
              id: 'user-invitee',
              email: 'invitee@example.com',
              name: null,
              role: 'member',
            }),
          },
          membership: {
            upsert: async () => ({ id: 'membership-1' }),
          },
        }),
    },
  });

  const first = await service.acceptInvite({
    payload: { token: TEST_TOKEN },
    authenticatedUserId: null,
    clientIp: TEST_CLIENT_IP,
  });

  const second = await service.acceptInvite({
    payload: { token: TEST_TOKEN },
    authenticatedUserId: 'user-invitee',
    clientIp: TEST_CLIENT_IP,
  });

  assert.equal(markAcceptedCalls, 1);
  assert.equal(first.membershipId, 'membership-1');
  assert.equal(second.membershipId, 'membership-1');
  assert.equal(first.workspaceId, second.workspaceId);
});
