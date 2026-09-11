import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { platformAdminService } from './platform-admin.service.js';
import { platformAdminRepository } from '../repositories/platform-admin.repository.js';

// CRMA-81 — quello che il Registro attività ha bisogno di sapere da questo
// servizio: se il flag è stato scritto davvero, e in quali workspace va annotato.

const USER = {
  id: 'user-1',
  email: 'tizio@example.com',
  name: 'Tizio',
  isPlatformAdmin: false,
  createdAt: new Date(),
};

test('promuovere chi non è ancora Super Admin scrive il flag e lo dichiara', async (t) => {
  t.mock.method(platformAdminRepository, 'findUserById', async () => USER);
  const setFlag = t.mock.method(
    platformAdminRepository,
    'setUserPlatformAdmin',
    async () => ({ ...USER, isPlatformAdmin: true }),
  );

  const result = await platformAdminService.promotePlatformAdmin(USER.id);

  assert.equal(result.changed, true);
  assert.equal(result.user.isPlatformAdmin, true);
  assert.equal(setFlag.mock.callCount(), 1);
});

test('promuovere chi è già Super Admin non scrive niente e non va a registro', async (t) => {
  // Il punto del flag `changed`: senza, la rotta annoterebbe un innalzamento di
  // privilegio che non è avvenuto.
  t.mock.method(platformAdminRepository, 'findUserById', async () => ({
    ...USER,
    isPlatformAdmin: true,
  }));
  const setFlag = t.mock.method(platformAdminRepository, 'setUserPlatformAdmin', async () => USER);

  const result = await platformAdminService.promotePlatformAdmin(USER.id);

  assert.equal(result.changed, false);
  assert.equal(setFlag.mock.callCount(), 0);
});

test('rimuovere un Super Admin dichiara la scrittura', async (t) => {
  t.mock.method(platformAdminRepository, 'findUserById', async () => ({
    ...USER,
    isPlatformAdmin: true,
  }));
  t.mock.method(platformAdminRepository, 'countPlatformAdmins', async () => 3);
  const setFlag = t.mock.method(
    platformAdminRepository,
    'setUserPlatformAdmin',
    async () => USER,
  );

  const result = await platformAdminService.demotePlatformAdmin(USER.id, 'altro-admin');

  assert.equal(result.changed, true);
  assert.equal(setFlag.mock.callCount(), 1);
});

test('rimuovere chi non è Super Admin non scrive niente', async (t) => {
  t.mock.method(platformAdminRepository, 'findUserById', async () => USER);
  const setFlag = t.mock.method(platformAdminRepository, 'setUserPlatformAdmin', async () => USER);

  const result = await platformAdminService.demotePlatformAdmin(USER.id, 'altro-admin');

  assert.equal(result.changed, false);
  assert.equal(setFlag.mock.callCount(), 0);
});

test('i workspace da annotare sono quelli di cui la persona è membro', async (t) => {
  t.mock.method(platformAdminRepository, 'listMemberWorkspaceIds', async () => [
    { workspaceId: 'ws-a' },
    { workspaceId: 'ws-b' },
  ]);

  assert.deepEqual(await platformAdminService.listMemberWorkspaceIds(USER.id), ['ws-a', 'ws-b']);
});

test('un workspace non compare due volte, così il fatto non si sdoppia nello stesso registro', async (t) => {
  t.mock.method(platformAdminRepository, 'listMemberWorkspaceIds', async () => [
    { workspaceId: 'ws-a' },
    { workspaceId: 'ws-a' },
    { workspaceId: 'ws-b' },
  ]);

  assert.deepEqual(await platformAdminService.listMemberWorkspaceIds(USER.id), ['ws-a', 'ws-b']);
});

test('chi non appartiene a nessun workspace non ha nessun registro in cui comparire', async (t) => {
  // Limite noto della strada scelta: la rotta lo segnala nel log applicativo.
  t.mock.method(platformAdminRepository, 'listMemberWorkspaceIds', async () => []);

  assert.deepEqual(await platformAdminService.listMemberWorkspaceIds(USER.id), []);
});

mock.reset();
