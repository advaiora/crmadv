import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NOT_DELETED,
  ONLY_DELETED,
  TRASHABLE_ENTITIES,
  isTrashed,
  markRestored,
  markTrashed,
  notDeleted,
  onlyDeleted,
  optionalParentNotDeleted,
  parentNotDeleted,
} from './soft-delete.js';

test('notDeleted aggiunge il filtro senza perdere per strada il resto del where', () => {
  const where = notDeleted({ workspaceId: 'w1', name: { contains: 'rossi' } });

  assert.deepEqual(where, {
    workspaceId: 'w1',
    name: { contains: 'rossi' },
    deletedAt: null,
  });
});

test('notDeleted non lascia sopravvivere un deletedAt gia scritto a mano', () => {
  // Se qualcuno passa un deletedAt suo, vince il filtro: e' l'unico
  // comportamento che rende sicuro spargere questa funzione ovunque.
  const where = notDeleted({ workspaceId: 'w1', deletedAt: { not: null } });

  assert.equal(where.deletedAt, null);
});

test('onlyDeleted guarda dalla parte opposta', () => {
  assert.deepEqual(onlyDeleted({ workspaceId: 'w1' }), {
    workspaceId: 'w1',
    deletedAt: { not: null },
  });
});

test('i due filtri sono davvero complementari', () => {
  assert.equal(NOT_DELETED.deletedAt, null);
  assert.deepEqual(ONLY_DELETED.deletedAt, { not: null });
});

test('markTrashed segna chi e quando', () => {
  const istante = new Date('2026-09-10T12:00:00.000Z');

  assert.deepEqual(markTrashed('u1', istante), {
    deletedAt: istante,
    deletedByUserId: 'u1',
  });
});

test('cestinando piu righe insieme lo stesso istante le tiene raggruppate', () => {
  const istante = new Date('2026-09-10T12:00:00.000Z');
  const primo = markTrashed('u1', istante);
  const secondo = markTrashed('u1', istante);

  assert.equal(primo.deletedAt.getTime(), secondo.deletedAt.getTime());
});

test('markRestored ripulisce tutti e due i campi, non solo la data', () => {
  // Lasciare deletedByUserId valorizzato farebbe comparire "cancellato da X"
  // su una riga che e' tornata viva.
  assert.deepEqual(markRestored(), {
    deletedAt: null,
    deletedByUserId: null,
  });
});

test('isTrashed regge il null e il record mai letto', () => {
  assert.equal(isTrashed({ deletedAt: new Date() }), true);
  assert.equal(isTrashed({ deletedAt: null }), false);
  assert.equal(isTrashed(null), false);
  assert.equal(isTrashed(undefined), false);
});

test('il perimetro acceso e quello deciso il 17/8/2026, non uno piu largo', () => {
  assert.deepEqual(Object.values(TRASHABLE_ENTITIES).sort(), [
    'Client',
    'Membership',
    'Role',
    'WorkspaceMessage',
  ]);
});

test('parentNotDeleted guarda il padre, e nomina la relazione che gli si passa', () => {
  // La regola 2 del Cestino in codice: il figlio si nasconde guardando il
  // padre. Serve su un legame OBBLIGATORIO (Quote.client, ProjectClient.client).
  assert.deepEqual(parentNotDeleted('client'), {
    client: { deletedAt: null },
  });
});

test('optionalParentNotDeleted tiene dentro le righe che un padre non ce l hanno', () => {
  // E' la differenza che conta: su una relazione che ammette il nulla, il solo
  // `{ client: { deletedAt: null } }` butterebbe fuori anche i progetti interni
  // e gli asset non assegnati, che col Cestino non c'entrano niente.
  const filtro = optionalParentNotDeleted('client', 'clientId');

  assert.deepEqual(filtro, {
    AND: [
      {
        OR: [
          { clientId: null },
          { client: { deletedAt: null } },
        ],
      },
    ],
  });
});

test('optionalParentNotDeleted esce sotto AND, cosi non si scontra con la ricerca', () => {
  // Quasi tutte le liste del CRM usano gia' un `OR` per la ricerca testuale.
  // Due `OR` sulla stessa `where` si sovrascrivono a vicenda in silenzio: un
  // filtro che sparisce senza dare errore. Uscire sotto `AND` lo impedisce.
  const filtro = optionalParentNotDeleted('client', 'clientId');

  assert.ok(!('OR' in filtro), 'il filtro non deve occupare l OR di primo livello');
  assert.ok('AND' in filtro);

  const where = { workspaceId: 'ws-1', OR: [{ name: { contains: 'rossi' } }], ...filtro };
  assert.equal(where.OR.length, 1, 'la ricerca per testo deve sopravvivere al filtro');
  assert.equal(where.AND.length, 1);
});
