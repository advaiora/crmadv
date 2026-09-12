import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEffectiveUserRoleWhere, buildGrantingUserRoleWhere } from './rbac.repository.js';

/**
 * Le assegnazioni di chi va nel cestino (CRMA-132).
 *
 * Si prova il `where` e non la query, per la stessa ragione di
 * `core/membership-access.test.ts` (CRMA-157) e `messaging/repository.test.ts`
 * (CRMA-133): `server/prisma.ts` esporta un Proxy che spara se il client non e'
 * inizializzato, montare un database per verificare un filtro sarebbe
 * sproporzionato, e il filtro e' esattamente la cosa che puo' sfuggire restando
 * verde. Runner: `node --test`, non Vitest (nota #76).
 */

const USER_ID = 'user-1';
const WORKSPACE_ID = 'workspace-1';

test('le assegnazioni valgono solo dentro il workspace e per la persona chiesta', () => {
  const where = buildEffectiveUserRoleWhere(USER_ID, WORKSPACE_ID);

  assert.equal(where.userId, USER_ID);
  assert.equal(where.workspaceId, WORKSPACE_ID);
});

test('un ruolo nel cestino non da piu niente a nessuno', () => {
  // La meta' silenziosa delle due: il ruolo cestinato non si vede piu' nella
  // pagina Ruoli e permessi, quindi se continuasse a dare permessi nessuno
  // andrebbe a cercarne la causa li'.
  assert.equal(buildEffectiveUserRoleWhere(USER_ID, WORKSPACE_ID).role.deletedAt, null);
});

test('una persona cestinata nel workspace non esercita piu i suoi permessi', () => {
  const where = buildEffectiveUserRoleWhere(USER_ID, WORKSPACE_ID);

  // Il filtro guarda la MEMBERSHIP, non `User`: `User` non ha `deletedAt` e non
  // deve averlo, perche' chi e' cestinato qui resta intero negli altri workspace.
  assert.deepEqual(where.user, {
    memberships: {
      some: {
        workspaceId: WORKSPACE_ID,
        status: 'ACTIVE',
        deletedAt: null,
      },
    },
  });
});

test('la membership che conta e quella di QUESTO workspace, e basta una', () => {
  // `some` e non `every`: con `every`, chi e' nel cestino di un altro workspace
  // perderebbe i permessi anche qui. E il `workspaceId` dentro `some` e' cio'
  // che impedisce a una membership sana altrove di salvare quella cestinata qui.
  const where = buildEffectiveUserRoleWhere(USER_ID, WORKSPACE_ID);

  assert.ok('some' in where.user.memberships);
  assert.equal(where.user.memberships.some.workspaceId, WORKSPACE_ID);
});

test('il filtro sul ruolo si aggiunge alle condizioni di chi chiama, non le sostituisce', () => {
  const where = buildEffectiveUserRoleWhere(USER_ID, WORKSPACE_ID, {
    isSuperadmin: true,
  });

  assert.equal(where.role.isSuperadmin, true);
  assert.equal(where.role.deletedAt, null);
});

test('chi chiama non puo togliere il filtro del cestino, nemmeno passandolo', () => {
  // `NOT_DELETED` sta in fondo allo spread proprio per questo: un `roleWhere`
  // che provasse a riaprire i cestinati viene sovrascritto.
  //
  // Il tipo si allarga a mano perche' l'intersezione dei due `deletedAt` in
  // conflitto, per TypeScript, e' `never`: leggere la proprieta' direttamente
  // sarebbe un errore di tipo su un codice che a runtime e' giusto.
  const where: { role: Record<string, unknown> } = buildEffectiveUserRoleWhere(
    USER_ID,
    WORKSPACE_ID,
    { deletedAt: { not: null } },
  );

  assert.equal(where.role.deletedAt, null);
});

test('la condizione composta di hasPermission sopravvive al filtro', () => {
  const where = buildEffectiveUserRoleWhere(USER_ID, WORKSPACE_ID, {
    rolePermissions: {
      some: {
        permission: {
          key: 'clients.view',
        },
      },
    },
  });

  assert.equal(where.role.rolePermissions.some.permission.key, 'clients.view');
  assert.equal(where.role.deletedAt, null);
});

/**
 * Il conteggio dell'auto-riparazione (rilievo del Guardiano su CRMA-131).
 *
 * Chi conta le assegnazioni per decidere se ripararne l'assenza deve contare le
 * stesse che il resto del codice considera valide, altrimenti i due si
 * contraddicono: zero permessi in lettura, «ne ha gia' uno» in scrittura.
 */

test('il conteggio non conta le assegnazioni verso un ruolo cestinato', () => {
  // Senza questo, chi ha come unica assegnazione un ruolo cestinato resta con
  // zero permessi e nessuna riparazione: il conteggio vede 1.
  const where = buildGrantingUserRoleWhere(USER_ID, WORKSPACE_ID);

  assert.equal(where.userId, USER_ID);
  assert.equal(where.workspaceId, WORKSPACE_ID);
  assert.equal(where.role.deletedAt, null);
});

test('il conteggio NON filtra la membership, e non e una dimenticanza', () => {
  // Differenza voluta rispetto a `buildEffectiveUserRoleWhere`, fissata qui
  // perche' e' controintuitiva e il prossimo che «uniforma i filtri» la trovi.
  //
  // Su conteggio zero il chiamante SCRIVE: assegna un ruolo di ripiego, che in un
  // workspace con un solo membro attivo e' Superadmin. Con il filtro sulla
  // membership dentro, una persona cestinata arriverebbe a zero e ne uscirebbe
  // cestinata e Superadmin insieme. Che sia ancora dentro il workspace lo decide
  // `listMemberships`, prima e altrove (CRMA-157).
  assert.ok(!('user' in buildGrantingUserRoleWhere(USER_ID, WORKSPACE_ID)));
});
