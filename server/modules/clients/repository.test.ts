import assert from 'node:assert/strict';
import test from 'node:test';
import type { Client } from '@prisma/client';
import { markTrashed } from '../../core/soft-delete.js';
import { buildCreateData, buildTrashClientWhere, clientSelect } from './repository.js';

/**
 * Un cliente completo. Il tipo `Client` viene generato da `schema.prisma`, e
 * quindi lega questa riga alle colonne vere del modello invece che a un elenco
 * scritto a mano (e' il vantaggio rispetto al modello imitato,
 * `server/modules/mail/mail.repository.test.ts`).
 *
 * ⚠️ Ma il legame lo fa il TIPO, non l'esecuzione: `npm run test:unit` gira con
 * `tsx`, che i tipi li toglie senza controllarli. Chi aggiunge una colonna a
 * `Client` e non la mette qui vede l'errore nell'editor o con
 * `npx tsc --noEmit`, NON in un test rosso — questi cinque restano verdi.
 * Quindi: quando si tocca `schema.prisma`, si apre anche questo file.
 */
const CLIENTE_COMPLETO: Client = {
  id: 'cli-1',
  workspaceId: 'ws-1',
  type: 'company',
  name: 'Studio Rossi S.r.l.',
  email: 'amministrazione@studiorossi.it',
  phone: '+390212345678',
  vatNumber: '12345678901',
  taxCode: 'RSSMRA80A01F205X',
  pecEmail: 'studiorossi@pec.it',
  sdiCode: 'M5UXCR1',
  website: 'https://www.studiorossi.it',
  contactPerson: 'Maria Rossi',
  street: 'Via Roma 1',
  city: 'Milano',
  zip: '20100',
  province: 'MI',
  country: 'IT',
  notes: null,
  tags: ['fatturazione'],
  customFields: {},
  createdAt: new Date('2026-09-09T09:00:00.000Z'),
  updatedAt: new Date('2026-09-09T09:00:00.000Z'),
  deletedAt: null,
  deletedByUserId: null,
};

/**
 * Le colonne che le riscrive il database da solo, e che quindi nessuno passa
 * quando crea un cliente.
 */
const COLONNE_AUTOMATICHE = new Set(['id', 'createdAt', 'updatedAt']);

/**
 * Le due colonne del Cestino (CRMA-29). Stanno nel modello — e quindi nel
 * cliente completo qui sopra, altrimenti il legame col tipo `Client` si
 * spezzerebbe proprio sulle colonne che questo ramo aggiunge — ma sono fuori
 * dai due elenchi del giro ordinario, e per due ragioni diverse:
 *
 * - **non si scrivono alla creazione**: un cliente non nasce nel cestino. Le
 *   scrive solo il gesto «cestina» (`markTrashed`, provato in fondo a questo
 *   file), mai `buildCreateData`. E' una regola che non deve cambiare, quindi
 *   sotto c'e' un test che la fissa invece di lasciarla a questa eccezione.
 * - **non si rileggono in `clientSelect`**: le letture ordinarie dei clienti
 *   escludono i cestinati (CRMA-127), quindi li' `deletedAt` sarebbe `null` per
 *   tutti e non direbbe niente a nessuno. Chi ha bisogno di sapere *quando* e
 *   *da chi* e' la pagina Cestino, che legge con `onlyDeleted` e con un elenco
 *   di colonne suo (CRMA-135). Se un giorno servissero anche qui, si tolgono da
 *   questa eccezione: e' una decisione da prendere, non una svista da sanare.
 */
const COLONNE_DEL_CESTINO = new Set(['deletedAt', 'deletedByUserId']);

// Le query del repository chiedono al database un elenco ESPLICITO di colonne.
// Una colonna che sta nello schema ma non nell'elenco non arriva mai a chi
// legge: si salva e non si rilegge, senza nessun errore e senza nessun test
// rosso — a meno di questo. E' il buco in cui potevano cadere `pecEmail`,
// `sdiCode`, `website` e `contactPerson` il 9/9/2026 (CRMA-24), le prime
// colonne aggiunte a `Client` da quando l'elenco esiste.
test('ogni colonna del modello Client e\' chiesta al database', () => {
  for (const colonna of Object.keys(CLIENTE_COMPLETO)) {
    if (COLONNE_DEL_CESTINO.has(colonna)) {
      continue;
    }

    assert.equal(
      (clientSelect as Record<string, true>)[colonna],
      true,
      `la colonna "${colonna}" non e' nell'elenco di quelle lette`,
    );
  }
});

test('l\'elenco delle colonne lette non chiede niente che il modello non abbia', () => {
  for (const colonna of Object.keys(clientSelect)) {
    assert.ok(
      colonna in CLIENTE_COMPLETO,
      `"${colonna}" e' chiesto al database ma non e' una colonna di Client`,
    );
  }
});

// L'altra meta' dello stesso guasto: una colonna dimenticata nella SCRITTURA si
// compila a schermo, non arriva al database, e ricaricando la maschera e'
// vuota. Sintomo identico al precedente, causa opposta.
test('la creazione di un cliente scrive tutte le colonne non automatiche', () => {
  const dati = buildCreateData('ws-1', {
    type: CLIENTE_COMPLETO.type,
    name: CLIENTE_COMPLETO.name,
    email: CLIENTE_COMPLETO.email,
    phone: CLIENTE_COMPLETO.phone,
    vatNumber: CLIENTE_COMPLETO.vatNumber,
    taxCode: CLIENTE_COMPLETO.taxCode,
    pecEmail: CLIENTE_COMPLETO.pecEmail,
    sdiCode: CLIENTE_COMPLETO.sdiCode,
    website: CLIENTE_COMPLETO.website,
    contactPerson: CLIENTE_COMPLETO.contactPerson,
    street: CLIENTE_COMPLETO.street,
    city: CLIENTE_COMPLETO.city,
    zip: CLIENTE_COMPLETO.zip,
    province: CLIENTE_COMPLETO.province,
    country: CLIENTE_COMPLETO.country,
    notes: CLIENTE_COMPLETO.notes,
    tags: CLIENTE_COMPLETO.tags,
  });

  for (const colonna of Object.keys(CLIENTE_COMPLETO)) {
    if (COLONNE_AUTOMATICHE.has(colonna) || COLONNE_DEL_CESTINO.has(colonna)) {
      continue;
    }

    assert.ok(
      colonna in dati,
      `la colonna "${colonna}" non viene scritta quando si crea un cliente`,
    );
  }
});

// L'altra meta' dell'eccezione qui sopra: saltare le colonne del Cestino nel
// test precedente dice «non e' un guasto se mancano», e da solo lascerebbe
// passare anche il contrario — un cliente che nasce gia' cestinato, invisibile
// dal momento in cui viene creato e senza niente che lo spieghi. Quindi la
// regola si prova, invece di restare affidata a un `continue`.
test('un cliente non nasce nel cestino', () => {
  const dati = buildCreateData('ws-1', {
    type: 'person',
    name: 'Mario Bianchi',
    email: null,
    phone: null,
    vatNumber: null,
    taxCode: null,
    street: null,
    city: null,
    zip: null,
    province: null,
    country: null,
    notes: null,
    tags: [],
  });

  for (const colonna of COLONNE_DEL_CESTINO) {
    assert.ok(
      !(colonna in dati),
      `"${colonna}" non deve essere scritta alla creazione: la scrive solo il gesto «cestina»`,
    );
  }
});

// I quattro campi nuovi sono opzionali nell'input finche' l'interfaccia non li
// collega (punto 5 della release). Chi non li passa non deve ottenere
// `undefined`, che per Prisma vuol dire «non toccare»: deve ottenere `null`.
test('i campi di fatturazione non passati diventano null, non undefined', () => {
  const dati = buildCreateData('ws-1', {
    type: 'person',
    name: 'Mario Bianchi',
    email: null,
    phone: null,
    vatNumber: null,
    taxCode: null,
    street: null,
    city: null,
    zip: null,
    province: null,
    country: null,
    notes: null,
    tags: [],
  });

  for (const colonna of ['pecEmail', 'sdiCode', 'website', 'contactPerson'] as const) {
    assert.equal(dati[colonna], null, `"${colonna}" doveva essere null`);
  }
});

// Il salvataggio e la rilettura sono lo stesso giro: cio' che si scrive alla
// creazione dev'essere fra cio' che si richiede in lettura, altrimenti il campo
// esiste nel database e non torna mai indietro.
test('tutto cio\' che si scrive alla creazione viene anche riletto', () => {
  const dati = buildCreateData('ws-1', {
    type: CLIENTE_COMPLETO.type,
    name: CLIENTE_COMPLETO.name,
    email: CLIENTE_COMPLETO.email,
    phone: CLIENTE_COMPLETO.phone,
    vatNumber: CLIENTE_COMPLETO.vatNumber,
    taxCode: CLIENTE_COMPLETO.taxCode,
    pecEmail: CLIENTE_COMPLETO.pecEmail,
    sdiCode: CLIENTE_COMPLETO.sdiCode,
    website: CLIENTE_COMPLETO.website,
    contactPerson: CLIENTE_COMPLETO.contactPerson,
    street: CLIENTE_COMPLETO.street,
    city: CLIENTE_COMPLETO.city,
    zip: CLIENTE_COMPLETO.zip,
    province: CLIENTE_COMPLETO.province,
    country: CLIENTE_COMPLETO.country,
    notes: CLIENTE_COMPLETO.notes,
    tags: CLIENTE_COMPLETO.tags,
  });

  for (const colonna of Object.keys(dati)) {
    assert.equal(
      (clientSelect as Record<string, true>)[colonna],
      true,
      `"${colonna}" si scrive ma non si rilegge`,
    );
  }
});

/**
 * Il gesto che cestina un cliente (CRMA-165).
 *
 * Prima di questo compito `clients.delete` faceva sparire la riga; adesso la
 * lascia dov'e' e le scrive sopra chi e quando. Quello che si prova qui e' la
 * clausola, perche' e' la parte che puo' sbagliarsi senza che nessuno se ne
 * accorga: una scrittura che esce dal workspace, o che ricestina una riga
 * gia' cestinata, non fa rumore.
 */
test('cestinare un cliente resta dentro il suo workspace', () => {
  const where = buildTrashClientWhere('ws-1', 'cli-1');

  assert.equal(where.workspaceId, 'ws-1');
  assert.equal(where.id, 'cli-1');
});

test('un cliente gia nel cestino non si ricestina: il secondo gesto non trova niente', () => {
  // Senza questo filtro la seconda cancellazione riscriverebbe `deletedAt` e
  // `deletedByUserId`, cioe' cancellerebbe la traccia di chi aveva buttato il
  // cliente per primo — ed e' proprio quella la traccia che serve a
  // ripristinarlo.
  assert.equal(buildTrashClientWhere('ws-1', 'cli-1').deletedAt, null);
});

test('cestinare scrive chi e quando, e non tocca nient altro', () => {
  const istante = new Date('2026-09-11T10:00:00.000Z');
  const dati = markTrashed('user-7', istante);

  assert.deepEqual(dati, {
    deletedAt: istante,
    deletedByUserId: 'user-7',
  });
  // La riga non perde niente: nessun campo del cliente compare fra quelli
  // scritti. E' la regola 1 del Cestino — cestinare non cancella.
  assert.deepEqual(Object.keys(dati).sort(), ['deletedAt', 'deletedByUserId']);
});
