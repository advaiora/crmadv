import assert from 'node:assert/strict';
import test from 'node:test';
import type { FastifyRequest } from 'fastify';
import {
  WORKSPACE_MEMBERSHIP_REQUIRED_CODE,
  forbidden,
  isHttpError,
} from '../core/errors.js';
import {
  buildRequireWorkspace,
  buildRequireWorkspaceFromParams,
  type RequireWorkspaceDependencies,
} from './requireWorkspace.js';

const ACTIVE_WORKSPACE = {
  id: 'workspace-1',
  name: 'Advaiora',
  slug: 'advaiora',
  status: 'ACTIVE' as const,
};

const SUSPENDED_WORKSPACE = { ...ACTIVE_WORKSPACE, status: 'SUSPENDED' as const };

// Archivi finti: nessuna di queste prove tocca il database. `isMember` e
// `isPlatformAdmin` sono i due interruttori che i test muovono.
const buildDependencies = (
  overrides: Partial<RequireWorkspaceDependencies> = {},
): RequireWorkspaceDependencies => ({
  findWorkspaceById: async () => ACTIVE_WORKSPACE,
  findWorkspaceBySlug: async () => ACTIVE_WORKSPACE,
  isMember: async () => true,
  isPlatformAdmin: async () => false,
  ...overrides,
});

const requestWithHeaders = (headers: Record<string, string>) =>
  ({ headers } as unknown as FastifyRequest);

const readHttpError = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (error) {
    assert.ok(isHttpError(error), `atteso un HttpError, ricevuto: ${String(error)}`);
    return error;
  }

  assert.fail('la chiamata doveva fallire, invece e\' andata a buon fine');
};

// --- Controllo positivo: il banco di prova sa anche dire "si'" ---------------
// Senza questo, un banco rotto che fallisse per un motivo qualsiasi farebbe
// passare i test sul 403 senza provare niente.

test('requireWorkspace restituisce il workspace quando la persona ne e\' membro', async () => {
  const requireWorkspace = buildRequireWorkspace(buildDependencies());

  const workspace = await requireWorkspace(
    requestWithHeaders({ 'x-workspace-id': 'workspace-1' }),
    'user-1',
  );

  assert.equal(workspace.id, 'workspace-1');
});

test('requireWorkspaceFromParams restituisce il workspace quando la persona ne e\' membro', async () => {
  const requireWorkspaceFromParams = buildRequireWorkspaceFromParams(buildDependencies());

  const workspace = await requireWorkspaceFromParams(
    requestWithHeaders({}),
    'user-1',
    'workspace-1',
  );

  assert.equal(workspace.id, 'workspace-1');
});

// --- Il caso "non sei membro": codice dedicato, su entrambe le porte ---------

test('requireWorkspace segna il 403 di membership con WORKSPACE_MEMBERSHIP_REQUIRED', async () => {
  const requireWorkspace = buildRequireWorkspace(
    buildDependencies({ isMember: async () => false }),
  );

  const error = await readHttpError(() =>
    requireWorkspace(requestWithHeaders({ 'x-workspace-id': 'workspace-1' }), 'user-1'),
  );

  assert.equal(error.statusCode, 403);
  assert.equal(error.code, 'WORKSPACE_MEMBERSHIP_REQUIRED');
  assert.equal(error.message, 'User is not a member of the workspace');
  assert.deepEqual(error.details, { workspaceId: 'workspace-1' });
});

test('requireWorkspaceFromParams segna il 403 di membership con WORKSPACE_MEMBERSHIP_REQUIRED', async () => {
  const requireWorkspaceFromParams = buildRequireWorkspaceFromParams(
    buildDependencies({ isMember: async () => false }),
  );

  const error = await readHttpError(() =>
    requireWorkspaceFromParams(requestWithHeaders({}), 'user-1', 'workspace-1'),
  );

  assert.equal(error.statusCode, 403);
  assert.equal(error.code, 'WORKSPACE_MEMBERSHIP_REQUIRED');
  assert.equal(error.message, 'User is not a member of the workspace');
  assert.deepEqual(error.details, { workspaceId: 'workspace-1' });
});

test('il codice della membership arriva anche per slug, non solo per id', async () => {
  const requireWorkspace = buildRequireWorkspace(
    buildDependencies({ isMember: async () => false }),
  );

  const error = await readHttpError(() =>
    requireWorkspace(requestWithHeaders({ 'x-workspace-slug': 'advaiora' }), 'user-1'),
  );

  assert.equal(error.code, 'WORKSPACE_MEMBERSHIP_REQUIRED');
});

// --- Il workspace sospeso resta FORBIDDEN: e' la condizione del Guardiano ----
// Se questo diventasse WORKSPACE_MEMBERSHIP_REQUIRED, il frontend butterebbe
// fuori da TUTTI i workspace chiunque lavori in quello sospeso (CRMA-160).

test('requireWorkspace lascia FORBIDDEN il 403 del workspace sospeso', async () => {
  const requireWorkspace = buildRequireWorkspace(
    buildDependencies({
      findWorkspaceById: async () => SUSPENDED_WORKSPACE,
      isMember: async () => true,
      isPlatformAdmin: async () => false,
    }),
  );

  const error = await readHttpError(() =>
    requireWorkspace(requestWithHeaders({ 'x-workspace-id': 'workspace-1' }), 'user-1'),
  );

  assert.equal(error.statusCode, 403);
  assert.equal(error.code, 'FORBIDDEN');
  assert.equal(error.message, 'Workspace sospeso');
  assert.notEqual(error.code, WORKSPACE_MEMBERSHIP_REQUIRED_CODE);
});

test('requireWorkspaceFromParams lascia FORBIDDEN il 403 del workspace sospeso', async () => {
  const requireWorkspaceFromParams = buildRequireWorkspaceFromParams(
    buildDependencies({
      findWorkspaceById: async () => SUSPENDED_WORKSPACE,
      isMember: async () => true,
      isPlatformAdmin: async () => false,
    }),
  );

  const error = await readHttpError(() =>
    requireWorkspaceFromParams(requestWithHeaders({}), 'user-1', 'workspace-1'),
  );

  assert.equal(error.statusCode, 403);
  assert.equal(error.code, 'FORBIDDEN');
  assert.equal(error.message, 'Workspace sospeso');
});

test('un Super Admin di piattaforma entra anche in un workspace sospeso', async () => {
  const requireWorkspace = buildRequireWorkspace(
    buildDependencies({
      findWorkspaceById: async () => SUSPENDED_WORKSPACE,
      isPlatformAdmin: async () => true,
    }),
  );

  const workspace = await requireWorkspace(
    requestWithHeaders({ 'x-workspace-id': 'workspace-1' }),
    'user-1',
  );

  assert.equal(workspace.status, 'SUSPENDED');
});

// --- L'helper condiviso non e' stato toccato ---------------------------------
// `requirePermission` costruisce il suo 403 con `forbidden()`: se qualcuno gli
// cambiasse il codice, chi non ha un permesso verrebbe buttato fuori dal CRM.

test('forbidden() continua a produrre il codice generico FORBIDDEN', () => {
  const error = forbidden('Permission denied', { permissionKey: 'clients.view' });

  assert.equal(error.statusCode, 403);
  assert.equal(error.code, 'FORBIDDEN');
});
