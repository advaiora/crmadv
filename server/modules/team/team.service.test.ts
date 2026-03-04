import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from '../../core/errors.js';
import { teamRepository, type TeamMemberRecord } from './team.repository.js';
import { teamService } from './team.service.js';

const createMemberRecord = (overrides: Partial<TeamMemberRecord> = {}): TeamMemberRecord => ({
  memberId: 'cmember000000000000000000001',
  userId: 'cuser000000000000000000001',
  name: 'Team User',
  email: 'team@example.com',
  status: 'ACTIVE',
  createdAt: new Date('2026-03-04T10:00:00.000Z'),
  roles: [
    {
      roleId: 'crole000000000000000000001',
      roleName: 'Viewer',
      isSuperadmin: false,
    },
  ],
  ...overrides,
});

test('setMemberActiveState blocks deactivation of last active Superadmin', async () => {
  const originalFindMemberById = teamRepository.findMemberById;
  const originalCountActiveSuperadmins = teamRepository.countActiveSuperadmins;

  try {
    teamRepository.findMemberById = async () =>
      createMemberRecord({
        roles: [
          {
            roleId: 'crole000000000000000000010',
            roleName: 'Superadmin',
            isSuperadmin: true,
          },
        ],
      });
    teamRepository.countActiveSuperadmins = async () => 1;

    await assert.rejects(
      async () =>
        teamService.setMemberActiveState({
          workspaceId: 'cworkspace000000000000000001',
          actorUserId: 'cuser000000000000000000999',
          memberId: 'cmember000000000000000000001',
          payload: { active: false },
        }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 403,
    );
  } finally {
    teamRepository.findMemberById = originalFindMemberById;
    teamRepository.countActiveSuperadmins = originalCountActiveSuperadmins;
  }
});

test('assignMemberRoles enforces Superadmin-only policy', async () => {
  const originalFindMemberById = teamRepository.findMemberById;
  const originalIsSuperadmin = teamRepository.isSuperadmin;

  try {
    teamRepository.findMemberById = async () => createMemberRecord();
    teamRepository.isSuperadmin = async () => false;

    await assert.rejects(
      async () =>
        teamService.assignMemberRoles({
          workspaceId: 'cworkspace000000000000000001',
          actorUserId: 'cuser000000000000000000999',
          memberId: 'cmember000000000000000000001',
          payload: { roleNames: ['Manager'] },
        }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 403,
    );
  } finally {
    teamRepository.findMemberById = originalFindMemberById;
    teamRepository.isSuperadmin = originalIsSuperadmin;
  }
});

test('assignMemberRoles blocks removing Superadmin from last active Superadmin', async () => {
  const originalFindMemberById = teamRepository.findMemberById;
  const originalIsSuperadmin = teamRepository.isSuperadmin;
  const originalCountActiveSuperadmins = teamRepository.countActiveSuperadmins;

  try {
    teamRepository.findMemberById = async () =>
      createMemberRecord({
        roles: [
          {
            roleId: 'crole000000000000000000010',
            roleName: 'Superadmin',
            isSuperadmin: true,
          },
        ],
      });
    teamRepository.isSuperadmin = async () => true;
    teamRepository.countActiveSuperadmins = async () => 1;

    await assert.rejects(
      async () =>
        teamService.assignMemberRoles({
          workspaceId: 'cworkspace000000000000000001',
          actorUserId: 'cuser000000000000000000999',
          memberId: 'cmember000000000000000000001',
          payload: { roleNames: ['Viewer'] },
        }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 403,
    );
  } finally {
    teamRepository.findMemberById = originalFindMemberById;
    teamRepository.isSuperadmin = originalIsSuperadmin;
    teamRepository.countActiveSuperadmins = originalCountActiveSuperadmins;
  }
});

test('assignMemberRoles blocks self downgrade from Superadmin', async () => {
  const originalFindMemberById = teamRepository.findMemberById;
  const originalIsSuperadmin = teamRepository.isSuperadmin;
  const originalCountActiveSuperadmins = teamRepository.countActiveSuperadmins;

  try {
    teamRepository.findMemberById = async () =>
      createMemberRecord({
        userId: 'cuser000000000000000000001',
        roles: [
          {
            roleId: 'crole000000000000000000010',
            roleName: 'Superadmin',
            isSuperadmin: true,
          },
        ],
      });
    teamRepository.isSuperadmin = async () => true;
    teamRepository.countActiveSuperadmins = async () => 2;

    await assert.rejects(
      async () =>
        teamService.assignMemberRoles({
          workspaceId: 'cworkspace000000000000000001',
          actorUserId: 'cuser000000000000000000001',
          memberId: 'cmember000000000000000000001',
          payload: { roleNames: ['Admin'] },
        }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 403,
    );
  } finally {
    teamRepository.findMemberById = originalFindMemberById;
    teamRepository.isSuperadmin = originalIsSuperadmin;
    teamRepository.countActiveSuperadmins = originalCountActiveSuperadmins;
  }
});

test('removeMember enforces Superadmin-only policy', async () => {
  const originalFindMemberById = teamRepository.findMemberById;
  const originalIsSuperadmin = teamRepository.isSuperadmin;

  try {
    teamRepository.findMemberById = async () => createMemberRecord();
    teamRepository.isSuperadmin = async () => false;

    await assert.rejects(
      async () =>
        teamService.removeMember({
          workspaceId: 'cworkspace000000000000000001',
          actorUserId: 'cuser000000000000000000999',
          memberId: 'cmember000000000000000000001',
        }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 403,
    );
  } finally {
    teamRepository.findMemberById = originalFindMemberById;
    teamRepository.isSuperadmin = originalIsSuperadmin;
  }
});

test('removeMember blocks deleting the last active Superadmin', async () => {
  const originalFindMemberById = teamRepository.findMemberById;
  const originalIsSuperadmin = teamRepository.isSuperadmin;
  const originalCountActiveSuperadmins = teamRepository.countActiveSuperadmins;

  try {
    teamRepository.findMemberById = async () =>
      createMemberRecord({
        roles: [
          {
            roleId: 'crole000000000000000000010',
            roleName: 'Superadmin',
            isSuperadmin: true,
          },
        ],
      });
    teamRepository.isSuperadmin = async () => true;
    teamRepository.countActiveSuperadmins = async () => 1;

    await assert.rejects(
      async () =>
        teamService.removeMember({
          workspaceId: 'cworkspace000000000000000001',
          actorUserId: 'cuser000000000000000000999',
          memberId: 'cmember000000000000000000001',
        }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 403,
    );
  } finally {
    teamRepository.findMemberById = originalFindMemberById;
    teamRepository.isSuperadmin = originalIsSuperadmin;
    teamRepository.countActiveSuperadmins = originalCountActiveSuperadmins;
  }
});

test('removeMember blocks self-removal', async () => {
  const originalFindMemberById = teamRepository.findMemberById;
  const originalIsSuperadmin = teamRepository.isSuperadmin;

  try {
    teamRepository.findMemberById = async () =>
      createMemberRecord({
        userId: 'cuser000000000000000000001',
        roles: [
          {
            roleId: 'crole000000000000000000010',
            roleName: 'Superadmin',
            isSuperadmin: true,
          },
        ],
      });
    teamRepository.isSuperadmin = async () => true;

    await assert.rejects(
      async () =>
        teamService.removeMember({
          workspaceId: 'cworkspace000000000000000001',
          actorUserId: 'cuser000000000000000000001',
          memberId: 'cmember000000000000000000001',
        }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 403,
    );
  } finally {
    teamRepository.findMemberById = originalFindMemberById;
    teamRepository.isSuperadmin = originalIsSuperadmin;
  }
});
