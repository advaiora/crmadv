// Prova con database vero dell'intercettore del Registro attività (CRMA-28).
//
// Risponde alla domanda che la mappa (CRMA-44) chiedeva di verificare «con una
// prova, non per assunzione»: un'estensione Prisma di tipo query scatta anche
// dentro le transazioni interattive? Nel progetto ce ne sono 51 in 18 file, e se
// la risposta fosse no metà delle scritture resterebbe fuori dal registro.
//
// Come le altre prove `.smoke.ts` gira solo con un database raggiungibile
// (`npm run test:integration`); senza DATABASE_URL si salta invece di fallire.

import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { initializePrisma, prisma, resetPrismaForTests } from '../prisma.js';
import { requestContext } from '../core/request-context.js';
import { audit } from './audit.js';
import { flushRequestAuditTrail } from './audit-flush.js';

const databaseUrl = process.env.DATABASE_URL;
const skip = databaseUrl ? false : 'DATABASE_URL non impostata: prova saltata';

const createWorkspace = async () => {
  const suffix = randomUUID().slice(0, 8);
  return prisma.workspace.create({
    data: {
      name: `Prova registro ${suffix}`,
      slug: `prova-registro-${suffix}`,
    },
    select: { id: true },
  });
};

const countAuditRows = (workspaceId: string, action?: string) =>
  prisma.auditLog.count({
    where: {
      workspaceId,
      ...(action ? { action } : {}),
    },
  });

// ⚠️ `requestContext.start()` va chiamato nel corpo della prova, non dentro un
// aiutante asincrono: `AsyncLocalStorage.enterWith` vale per l'esecuzione
// corrente e per le catene che nascono dopo, ma non risale al chiamante, la cui
// continuazione era già stata creata all'`await`. Nel prodotto il problema non
// si pone (lo store si apre nell'hook onRequest, e il gestore della rotta è un
// suo discendente), ma qui si vedrebbe come «l'intercettore non registra
// niente» — che è esattamente il modo sbagliato di leggere questo errore.

test("l'intercettore registra le scritture, anche dentro una transazione interattiva", { skip }, async (t) => {
  initializePrisma(databaseUrl as string);
  t.after(async () => {
    await resetPrismaForTests();
  });

  const workspace = await createWorkspace();
  const store = requestContext.start();
  requestContext.setWorkspaceId(workspace.id);

  // Una scrittura fuori transazione e una dentro: se l'estensione non scattasse
  // dentro $transaction, la seconda non comparirebbe in coda.
  await prisma.client.create({
    data: {
      workspaceId: workspace.id,
      name: 'Cliente creato fuori transazione',
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.client.create({
      data: {
        workspaceId: workspace.id,
        name: 'Cliente creato dentro una transazione interattiva',
      },
    });
  });

  const written = await flushRequestAuditTrail({ store, succeeded: true, route: '/prova' });

  assert.equal(written, 2, 'attese due registrazioni: una per il cliente fuori e una per quello dentro la transazione');
  assert.equal(await countAuditRows(workspace.id, 'client.create'), 2);
});

test('il registro non registra se stesso', { skip }, async (t) => {
  initializePrisma(databaseUrl as string);
  t.after(async () => {
    await resetPrismaForTests();
  });

  const workspace = await createWorkspace();
  const store = requestContext.start();
  requestContext.setWorkspaceId(workspace.id);

  await prisma.client.create({
    data: {
      workspaceId: workspace.id,
      name: 'Cliente che genera una registrazione',
    },
  });
  await flushRequestAuditTrail({ store, succeeded: true });
  const afterFirstFlush = await countAuditRows(workspace.id);

  // Se AuditLog non fosse escluso, scrivere quella registrazione ne avrebbe
  // generata un'altra, e questo secondo svuotamento la troverebbe.
  const secondStore = requestContext.start();
  requestContext.setWorkspaceId(workspace.id);
  await flushRequestAuditTrail({ store: secondStore, succeeded: true });

  assert.equal(afterFirstFlush, 1);
  assert.equal(await countAuditRows(workspace.id), afterFirstFlush);
});

test('una richiesta finita male non lascia registrazioni', { skip }, async (t) => {
  initializePrisma(databaseUrl as string);
  t.after(async () => {
    await resetPrismaForTests();
  });

  const workspace = await createWorkspace();
  const store = requestContext.start();
  requestContext.setWorkspaceId(workspace.id);

  await prisma.client.create({
    data: {
      workspaceId: workspace.id,
      name: 'Cliente di una richiesta finita male',
    },
  });

  const written = await flushRequestAuditTrail({ store, succeeded: false });

  assert.equal(written, 0);
  assert.equal(await countAuditRows(workspace.id), 0);
});

test('una transazione annullata non lascia registrazioni', { skip }, async (t) => {
  initializePrisma(databaseUrl as string);
  t.after(async () => {
    await resetPrismaForTests();
  });

  const workspace = await createWorkspace();
  const store = requestContext.start();
  requestContext.setWorkspaceId(workspace.id);

  await assert.rejects(
    prisma.$transaction(async (tx) => {
      await tx.client.create({
        data: {
          workspaceId: workspace.id,
          name: 'Cliente di una transazione annullata',
        },
      });

      throw new Error('annullamento voluto');
    }),
  );

  // La richiesta è fallita, quindi non si svuota: è proprio il motivo per cui le
  // registrazioni si accumulano invece di essere scritte subito.
  const written = await flushRequestAuditTrail({ store, succeeded: false });

  assert.equal(written, 0);
  assert.equal(await countAuditRows(workspace.id, 'client.create'), 0);
});

test("l'annotazione scritta a mano scarta il doppione automatico", { skip }, async (t) => {
  initializePrisma(databaseUrl as string);
  t.after(async () => {
    await resetPrismaForTests();
  });

  const workspace = await createWorkspace();
  const store = requestContext.start();
  requestContext.setWorkspaceId(workspace.id);

  const client = await prisma.client.create({
    data: {
      workspaceId: workspace.id,
      name: 'Cliente con annotazione a mano',
    },
    select: { id: true },
  });

  await audit.log({
    event: 'clients.create',
    workspaceId: workspace.id,
    entityType: 'client',
    entityId: client.id,
    metadata: { nota: 'significato che dalla sola riga cambiata non si ricava' },
  });

  await flushRequestAuditTrail({ store, succeeded: true });

  assert.equal(await countAuditRows(workspace.id, 'client.create'), 0, 'il doppione automatico va scartato');
  assert.equal(await countAuditRows(workspace.id, 'clients.create'), 1);
});
