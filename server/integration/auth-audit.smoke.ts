// Prova a server acceso del tracciamento dell'autenticazione (CRMA-28).
//
// Prima di questo lavoro dell'accesso non restava nessuna traccia: non si sapeva
// chi fosse entrato, quando, né da dove. Queste prove percorrono le rotte vere —
// server avviato, richiesta HTTP, riga letta dal database — invece di provare le
// funzioni una per una: il punto è proprio che l'aggancio sia collegato.

import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../app.js';
import { bootstrapRuntime } from '../bootstrap/startup.js';
import { initializePrisma, prisma, resetPrismaForTests } from '../prisma.js';

const TEST_HOST = '127.0.0.1';
const PASSWORD = 'password-di-prova-123';

const startTestServer = async () => {
  const app = createApp({ logger: false });
  await app.listen({ host: TEST_HOST, port: 0 });
  const address = app.server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Unable to read test server address');
  }

  return { app, baseUrl: `http://${TEST_HOST}:${address.port}` };
};

const stopTestServer = async (app: FastifyInstance | null) => {
  if (app) {
    await app.close();
  }

  await resetPrismaForTests();
};

// Un utente completo di workspace e appartenenza attiva: senza appartenenza
// l'accesso viene rifiutato e non si arriverebbe mai al ramo da provare.
const seedUserWithWorkspace = async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `prova-registro-${suffix}@example.com`;

  const workspace = await prisma.workspace.create({
    data: {
      name: `Registro attività ${suffix}`,
      slug: `registro-attivita-${suffix}`,
    },
    select: { id: true, slug: true },
  });

  const user = await prisma.user.create({
    data: {
      email,
      name: 'Utente di prova',
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      role: 'member',
    },
    select: { id: true },
  });

  await prisma.membership.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      status: 'ACTIVE',
    },
  });

  return { workspace, user, email };
};

const login = (baseUrl: string, email: string, password: string) =>
  fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'prova-registro-attivita',
    },
    body: JSON.stringify({ email, password }),
  });

const findAuditRows = (workspaceId: string, action: string) =>
  prisma.auditLog.findMany({
    where: { workspaceId, action },
    select: {
      action: true,
      actorUserId: true,
      entityType: true,
      entityId: true,
      ipAddress: true,
      userAgent: true,
      metadata: true,
    },
  });

const isDatabaseReachable = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};

test("un accesso riuscito lascia chi, quando e da dove", async (t) => {
  let app: FastifyInstance | null = null;

  try {
    initializePrisma(bootstrapRuntime().databaseUrl);
    if (!(await isDatabaseReachable())) {
      t.skip('Database non raggiungibile');
      return;
    }

    const seeded = await seedUserWithWorkspace();
    const server = await startTestServer();
    app = server.app;

    const response = await login(server.baseUrl, seeded.email, PASSWORD);
    assert.equal(response.status, 200);

    const rows = await findAuditRows(seeded.workspace.id, 'auth.login');
    assert.equal(rows.length, 1, "l'accesso riuscito deve lasciare una riga sola");

    const row = rows[0];
    assert.equal(row?.actorUserId, seeded.user.id, 'chi');
    assert.equal(row?.entityType, 'user');
    assert.equal(row?.entityId, seeded.user.id);
    assert.equal(row?.userAgent, 'prova-registro-attivita', 'da dove: il programma usato');
    assert.ok(row?.ipAddress, 'da dove: l\'indirizzo di rete');
    assert.equal((row?.metadata as { method?: string } | null)?.method, 'password');
  } finally {
    await stopTestServer(app);
  }
});

test('una password sbagliata su un utente vero lascia traccia del tentativo', async (t) => {
  let app: FastifyInstance | null = null;

  try {
    initializePrisma(bootstrapRuntime().databaseUrl);
    if (!(await isDatabaseReachable())) {
      t.skip('Database non raggiungibile');
      return;
    }

    const seeded = await seedUserWithWorkspace();
    const server = await startTestServer();
    app = server.app;

    const response = await login(server.baseUrl, seeded.email, 'password-sbagliata');
    assert.equal(response.status, 401);

    const rows = await findAuditRows(seeded.workspace.id, 'auth.login.failed');
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.actorUserId, seeded.user.id);
    assert.equal((rows[0]?.metadata as { reason?: string } | null)?.reason, 'wrong_password');

    // E non deve esserci nessuna riga di accesso riuscito.
    assert.equal((await findAuditRows(seeded.workspace.id, 'auth.login')).length, 0);
  } finally {
    await stopTestServer(app);
  }
});

test("un indirizzo sconosciuto non fa trapelare l'esistenza dell'utente", async (t) => {
  let app: FastifyInstance | null = null;

  try {
    initializePrisma(bootstrapRuntime().databaseUrl);
    if (!(await isDatabaseReachable())) {
      t.skip('Database non raggiungibile');
      return;
    }

    const seeded = await seedUserWithWorkspace();
    const server = await startTestServer();
    app = server.app;

    const conosciuto = await login(server.baseUrl, seeded.email, 'password-sbagliata');
    const sconosciuto = await login(server.baseUrl, `mai-visto-${randomUUID()}@example.com`, 'password-sbagliata');

    // Stessa risposta nei due casi: chi prova le password non deve poter capire
    // dalla risposta quali indirizzi esistono.
    assert.equal(conosciuto.status, sconosciuto.status);
    assert.deepEqual(await conosciuto.json(), await sconosciuto.json());
  } finally {
    await stopTestServer(app);
  }
});

test("l'intercettore scrive da sé, senza codice di annotazione, a richiesta finita", async (t) => {
  let app: FastifyInstance | null = null;

  try {
    initializePrisma(bootstrapRuntime().databaseUrl);
    if (!(await isDatabaseReachable())) {
      t.skip('Database non raggiungibile');
      return;
    }

    const seeded = await seedUserWithWorkspace();
    const server = await startTestServer();
    app = server.app;

    // L'accesso ripara da sé i ruoli del workspace: sono scritture che nessuno
    // ha mai annotato a mano. Se compaiono nel registro, la catena completa
    // funziona — estensione Prisma, coda nel contesto, hook onResponse.
    assert.equal((await login(server.baseUrl, seeded.email, PASSWORD)).status, 200);

    // L'hook onResponse gira dopo che la risposta è partita: si concede un
    // momento prima di leggere, altrimenti si misura una corsa, non un difetto.
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });

    const automatiche = await prisma.auditLog.findMany({
      where: {
        workspaceId: seeded.workspace.id,
        metadata: {
          path: ['origin'],
          equals: 'auto',
        },
      },
      select: { action: true, entityType: true, actorUserId: true, metadata: true },
    });

    assert.ok(
      automatiche.length > 0,
      'nessuna registrazione automatica: la catena intercettore → coda → onResponse non è collegata',
    );
    assert.ok(
      automatiche.every((row) => row.actorUserId === seeded.user.id),
      "le registrazioni automatiche devono essere attribuite a chi è entrato",
    );
    assert.ok(
      automatiche.some((row) => row.entityType === 'user_role' || row.entityType === 'role'),
      `attese scritture su ruoli, trovate: ${automatiche.map((row) => row.action).join(', ')}`,
    );
  } finally {
    await stopTestServer(app);
  }
});

test("l'uscita lascia la sua riga", async (t) => {
  let app: FastifyInstance | null = null;

  try {
    initializePrisma(bootstrapRuntime().databaseUrl);
    if (!(await isDatabaseReachable())) {
      t.skip('Database non raggiungibile');
      return;
    }

    const seeded = await seedUserWithWorkspace();
    const server = await startTestServer();
    app = server.app;

    const loginResponse = await login(server.baseUrl, seeded.email, PASSWORD);
    const { data } = (await loginResponse.json()) as { data: { token: string } };

    const logoutResponse = await fetch(`${server.baseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${data.token}`,
      },
    });
    assert.equal(logoutResponse.status, 200);

    const rows = await findAuditRows(seeded.workspace.id, 'auth.logout');
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.actorUserId, seeded.user.id);
  } finally {
    await stopTestServer(app);
  }
});
