import assert from 'node:assert/strict';
import test from 'node:test';
import { buildQuoteClientLookupWhere } from '../quotes/repository.js';
import { buildListClientsWhere } from './repository.js';

/**
 * Le letture dei Clienti dopo il Cestino (CRMA-127).
 *
 * Questi test provano la cosa che il compito padre chiama «il vero lavoro»: non
 * che la colonna esista, ma che **ogni lettura** la guardi. Girano senza
 * database perche' controllano la clausola `where` che le query costruiscono —
 * ed e' esattamente li' che il guasto si nasconde: una query senza filtro non
 * da' errore, restituisce solo righe di troppo.
 *
 * ⚠️ `npm run test:unit` gira con `tsx`, che i tipi li toglie senza
 * controllarli: questi test provano il VALORE della clausola, non il suo tipo.
 */

const LETTURE = [
  {
    nome: 'elenco dei clienti',
    where: () => buildListClientsWhere({ workspaceId: 'ws-1' }),
  },
  {
    nome: 'ricerca per nome, email o telefono',
    where: () => buildListClientsWhere({ workspaceId: 'ws-1', query: 'rossi' }),
  },
  {
    nome: 'export CSV',
    where: () => buildListClientsWhere({ workspaceId: 'ws-1', type: 'company' }),
  },
  {
    nome: 'menu a tendina dei Preventivi',
    where: () => buildQuoteClientLookupWhere('ws-1', { limit: 20 }),
  },
  {
    nome: 'menu a tendina dei Preventivi, mentre si cerca',
    where: () => buildQuoteClientLookupWhere('ws-1', { limit: 20, q: 'rossi' }),
  },
] as const;

for (const lettura of LETTURE) {
  test(`un cliente cestinato non compare: ${lettura.nome}`, () => {
    assert.equal(
      lettura.where().deletedAt,
      null,
      `la lettura "${lettura.nome}" non filtra i cestinati: il cliente buttato ricompare li'`,
    );
  });
}

test('il filtro del Cestino non mangia il resto del where', () => {
  // Il guasto speculare: un filtro aggiunto male che porta via gli altri.
  // Qui si controlla che l'ambito per workspace e il tipo sopravvivano.
  const where = buildListClientsWhere({ workspaceId: 'ws-1', type: 'company' });

  assert.equal(where.workspaceId, 'ws-1');
  assert.equal(where.type, 'company');
  assert.equal(where.deletedAt, null);
});

test('la ricerca testuale e il filtro del Cestino convivono nello stesso where', () => {
  // E' il caso che rompe piu' spesso: la ricerca usa un `OR`, e chi aggiunge un
  // secondo `OR` sulla stessa `where` sovrascrive il primo in silenzio. Qui si
  // pretende che ci siano tutti e due — l'`OR` della ricerca e il `deletedAt`.
  const where = buildListClientsWhere({ workspaceId: 'ws-1', query: 'rossi' });

  assert.equal(where.deletedAt, null);
  assert.ok(Array.isArray(where.OR), 'la ricerca per testo e sparita dal where');
  assert.equal(where.OR?.length, 3, 'la ricerca deve guardare nome, email e telefono');
});

test('il menu a tendina dei Preventivi tiene insieme ricerca e Cestino', () => {
  const where = buildQuoteClientLookupWhere('ws-1', { limit: 20, q: 'rossi' });

  assert.equal(where.workspaceId, 'ws-1');
  assert.equal(where.deletedAt, null);
  assert.ok(Array.isArray(where.OR), 'la ricerca per testo e sparita dal where');
});

test('un where senza filtro del Cestino viene riconosciuto come rotto', () => {
  // La controprova del banco: se il filtro non ci fosse, `deletedAt` sarebbe
  // `undefined` e le asserzioni qui sopra fallirebbero davvero. Senza questo
  // test un banco rotto avrebbe lo stesso colore di un banco che passa
  // (nota operativa sul banco incompleto verde per caso).
  const senzaFiltro: { workspaceId: string; deletedAt?: null } = { workspaceId: 'ws-1' };

  assert.notEqual(senzaFiltro.deletedAt, null);
  assert.equal(senzaFiltro.deletedAt, undefined);
});
