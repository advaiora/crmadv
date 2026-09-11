// Il permesso degli allegati ai messaggi (A1 punto 8a, CRMA-30) dentro la catena RBAC.
//
// Perche' un test e non solo una lettura del catalogo: la regola ① del progetto dice che
// una funzione nuova nasce con la sua voce a catalogo e con i cinque ruoli di sistema
// rivisti UNO PER UNO. E' una cosa che si dimentica in silenzio — una voce mancante non
// da' errore, produce solo una funzione che nessun ruolo puo' governare, e non si vede
// finche' qualcuno non ne ha bisogno. Qui il silenzio diventa un rosso.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SYSTEM_PERMISSION_CATALOG,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLE_NAME,
} from '../../auth/rbac-catalog.js';
import { MESSAGING_MODULE_KEY, MESSAGING_PERMISSIONS } from './policies.js';

const roleByName = (name: string) => {
  const role = SYSTEM_ROLE_DEFINITIONS.find((item) => item.name === name);
  assert.ok(role, `ruolo di sistema "${name}" assente dal catalogo`);
  return role;
};

// I ruoli che elencano i permessi uno per uno. Superadmin e Admin non usano un elenco
// ma 'all' / 'all_except', quindi si controllano in modo diverso (vedi sotto).
const listedPermissions = (name: string): readonly string[] => {
  const selection = roleByName(name).permissions;
  assert.ok(Array.isArray(selection), `il ruolo "${name}" non elenca i permessi`);
  return selection as readonly string[];
};

test('messages.attach e’ a catalogo, sotto il modulo dei messaggi', () => {
  const entry = SYSTEM_PERMISSION_CATALOG.find(
    (item) => item.key === MESSAGING_PERMISSIONS.attach,
  );

  assert.ok(entry, 'messages.attach manca dal catalogo dei permessi');
  assert.equal(entry.moduleKey, MESSAGING_MODULE_KEY);
  // Non si ripiega sul permesso di un altro modulo: e' una chiave sua.
  assert.notEqual(MESSAGING_PERMISSIONS.attach, MESSAGING_PERMISSIONS.send);
});

test('Manager e Operativo possono allegare: chi scrive un messaggio puo’ attaccarci un file', () => {
  for (const name of [SYSTEM_ROLE_NAME.manager, SYSTEM_ROLE_NAME.operativo]) {
    const permissions = listedPermissions(name);

    assert.ok(
      permissions.includes(MESSAGING_PERMISSIONS.attach),
      `il ruolo "${name}" dovrebbe poter allegare`,
    );
    // Coerenza: allegare senza poter scrivere non avrebbe senso, perche' l'allegato si
    // attacca a un messaggio gia' inviato da te.
    assert.ok(
      permissions.includes(MESSAGING_PERMISSIONS.send),
      `il ruolo "${name}" allega ma non scrive: incoerente`,
    );
  }
});

test('il Viewer legge e scarica ma NON allega', () => {
  const permissions = listedPermissions(SYSTEM_ROLE_NAME.viewer);

  assert.equal(
    permissions.includes(MESSAGING_PERMISSIONS.attach),
    false,
    'il Viewer e’ in sola lettura: non deve poter caricare file',
  );
  assert.equal(permissions.includes(MESSAGING_PERMISSIONS.send), false);
  // Scaricare e' leggere, e non ha una chiave sua: al Viewer basta messages.view.
  assert.ok(permissions.includes(MESSAGING_PERMISSIONS.view));
});

test('Superadmin e Admin ricevono messages.attach senza doverlo elencare', () => {
  for (const name of [SYSTEM_ROLE_NAME.superadmin, SYSTEM_ROLE_NAME.admin]) {
    const selection = roleByName(name).permissions;

    if (selection === 'all') {
      continue;
    }

    // Forma 'all_except': basta che messages.attach non sia fra le esclusioni.
    assert.ok(
      typeof selection === 'object' && !Array.isArray(selection),
      `il ruolo "${name}" ha una forma di permessi inattesa`,
    );
    assert.equal(
      (selection as { exclude: readonly string[] }).exclude.includes(
        MESSAGING_PERMISSIONS.attach,
      ),
      false,
      `il ruolo "${name}" si vedrebbe escluso messages.attach`,
    );
  }
});
