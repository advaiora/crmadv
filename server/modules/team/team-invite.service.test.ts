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
        reason: 'MAIL_NOT_CONFIGURED',
      }),
    } as never,
    // Chi invita, salvo diversa indicazione del singolo test, e' un Superadmin:
    // cosi' i test che non parlano di gerarchia non ne sono influenzati.
    getActorSystemRoleFn: async () => 'Superadmin',
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
  // L'invito e' stato creato ma l'email non e' partita: la risposta deve dirlo.
  assert.equal(result.delivery.emailSent, false);
  assert.equal(result.delivery.reason, 'MAIL_NOT_CONFIGURED');
});

test('createInvite reports a delivered email instead of always claiming success', async () => {
  const service = createService({
    notifier: {
      sendInvite: async () => ({
        delivered: true,
        providerMessageId: 'provider-1',
      }),
    } as never,
  });

  const result = await service.createInvite({
    workspaceId: 'workspace-1',
    invitedByUserId: 'user-admin',
    invitedByDisplayName: 'Admin User',
    payload: {
      email: 'invitee@example.com',
    },
  });

  assert.equal(result.delivery.emailSent, true);
  assert.equal(result.delivery.reason, undefined);
  // Se l'email e' partita il link non serve a chi invita: non va esposto.
  assert.equal(result.inviteLink, undefined);
});

test('createInvite reads the actor role for the right user and workspace', async () => {
  const lookups: Array<{ workspaceId: string; userId: string }> = [];
  const service = createService({
    getActorSystemRoleFn: async (input: { workspaceId: string; userId: string }) => {
      lookups.push(input);
      return 'Superadmin';
    },
  });

  await service.createInvite({
    workspaceId: 'workspace-1',
    invitedByUserId: 'user-admin',
    invitedByDisplayName: 'Admin User',
    payload: { email: 'invitee@example.com', rolePreset: 'Viewer' },
  });

  // Il ruolo va letto per CHI INVITA, non per il destinatario, e nel workspace
  // dell'invito: se il cablaggio cambia, la guardia diventa decorativa.
  assert.deepEqual(lookups[0], { workspaceId: 'workspace-1', userId: 'user-admin' });
});

test('createInvite refuses the Superadmin preset even to a Superadmin', async () => {
  const service = createService({
    getActorSystemRoleFn: async () => 'Superadmin',
  });

  await assert.rejects(
    service.createInvite({
      workspaceId: 'workspace-1',
      invitedByUserId: 'user-super',
      invitedByDisplayName: 'Super User',
      payload: { email: 'invitee@example.com', rolePreset: 'Superadmin' },
    }),
    (error: unknown) => error instanceof HttpError && error.statusCode === 400,
    'un invito e una stringa al portatore: il ruolo massimo non ci passa',
  );
});

test('createInvite refuses to overwrite a pending invite of a higher role', async () => {
  const service = createService({
    getActorSystemRoleFn: async () => 'Manager',
    inviteRepository: {
      findPendingInviteByEmail: async () => makeInvite({ rolePresetName: 'Admin' }),
    },
  });

  await assert.rejects(
    service.createInvite({
      workspaceId: 'workspace-1',
      invitedByUserId: 'user-manager',
      invitedByDisplayName: 'Manager User',
      payload: { email: 'invitee@example.com', rolePreset: 'Viewer' },
    }),
    (error: unknown) => error instanceof HttpError && error.statusCode === 403,
    'invitare di nuovo sovrascrive: non si calpesta l invito di chi sta piu in alto',
  );
});

test('createInvite refuses a role higher than the inviter own', async () => {
  const service = createService({
    getActorSystemRoleFn: async () => 'Manager',
  });

  await assert.rejects(
    service.createInvite({
      workspaceId: 'workspace-1',
      invitedByUserId: 'user-manager',
      invitedByDisplayName: 'Manager User',
      payload: { email: 'invitee@example.com', rolePreset: 'Admin' },
    }),
    (error: unknown) => error instanceof HttpError && error.statusCode === 403,
    'il Manager non deve poter invitare un Admin',
  );
});

test('createInvite allows the inviter own role and every role below it', async () => {
  const service = createService({
    getActorSystemRoleFn: async () => 'Manager',
  });

  for (const rolePreset of ['Manager', 'Operativo', 'Viewer']) {
    const result = await service.createInvite({
      workspaceId: 'workspace-1',
      invitedByUserId: 'user-manager',
      invitedByDisplayName: 'Manager User',
      payload: { email: 'invitee@example.com', rolePreset },
    });

    assert.ok(result.inviteId, `il Manager deve poter invitare un ${rolePreset}`);
  }
});

test('createInvite refuses an actor without a system role in the workspace', async () => {
  const service = createService({
    getActorSystemRoleFn: async () => null,
  });

  await assert.rejects(
    service.createInvite({
      workspaceId: 'workspace-1',
      invitedByUserId: 'user-ghost',
      invitedByDisplayName: 'Ghost',
      payload: { email: 'invitee@example.com', rolePreset: 'Viewer' },
    }),
    (error: unknown) => error instanceof HttpError && error.statusCode === 403,
  );
});

test('regenerateInviteLink refuses to release a link above the actor own role', async () => {
  const service = createService({
    getActorSystemRoleFn: async () => 'Manager',
    inviteRepository: {
      findInviteById: async () => makeInvite({ rolePresetName: 'Admin' }),
    },
  });

  await assert.rejects(
    service.regenerateInviteLink({
      workspaceId: 'workspace-1',
      inviteId: 'invite-1',
      actorUserId: 'user-manager',
    }),
    (error: unknown) => error instanceof HttpError && error.statusCode === 403,
  );
});

test('regenerateInviteLink issues a fresh link without moving the expiry', async () => {
  let refreshPayload: Record<string, unknown> | null = null;

  const service = createService({
    inviteRepository: {
      findInviteById: async () => makeInvite(),
      refreshPendingInvite: async (input: Record<string, unknown>) => {
        refreshPayload = input;
        return makeInvite();
      },
    },
  });

  const result = await service.regenerateInviteLink({
    workspaceId: 'workspace-1',
    inviteId: 'invite-1',
    actorUserId: 'user-admin',
  });

  assert.ok(result.inviteLink.includes(`token=${TEST_TOKEN}`));
  assert.ok(refreshPayload);
  // Il token cambia (il precedente smette di valere)...
  assert.equal((refreshPayload as Record<string, unknown>).tokenHash, `hashed:${TEST_TOKEN}`);
  // ...ma la scadenza resta quella dell'invito: chiedere il link non deve
  // allungare di nascosto la vita dell'invito.
  assert.deepEqual(
    (refreshPayload as Record<string, unknown>).expiresAt,
    new Date('2026-03-11T10:00:00.000Z'),
  );
});

test('regenerateInviteLink refuses invites that are no longer pending', async () => {
  const service = createService({
    inviteRepository: {
      findInviteById: async () => makeInvite({ status: 'REVOKED' }),
    },
  });

  await assert.rejects(
    service.regenerateInviteLink({
      workspaceId: 'workspace-1',
      inviteId: 'invite-1',
      actorUserId: 'user-admin',
    }),
    (error: unknown) => error instanceof HttpError && error.statusCode === 400,
  );
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
