import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AI_PRODUCTION_MODULE_KEY,
  AI_PRODUCTION_PERMISSIONS,
  CHAT_PERMISSIONS,
  DASHBOARD_MODULE_KEY,
  DASHBOARD_PERMISSIONS,
  SYSTEM_MODULE_CATALOG,
  SYSTEM_PERMISSION_CATALOG,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLE_NAME,
  TEAM_MODULE_KEY,
  TEAM_PERMISSIONS,
} from './rbac-catalog.js';

test('RBAC catalog includes team module in registry', () => {
  const moduleKeys = new Set(SYSTEM_MODULE_CATALOG.map((moduleEntry) => moduleEntry.key));
  assert.equal(moduleKeys.has(TEAM_MODULE_KEY), true);
});

test('RBAC catalog includes dashboard module in registry', () => {
  const moduleKeys = new Set(SYSTEM_MODULE_CATALOG.map((moduleEntry) => moduleEntry.key));
  assert.equal(moduleKeys.has(DASHBOARD_MODULE_KEY), true);
});

test('RBAC catalog includes required TEAM permissions', () => {
  const permissionKeys = new Set(
    SYSTEM_PERMISSION_CATALOG
      .filter((permissionEntry) => permissionEntry.moduleKey === TEAM_MODULE_KEY)
      .map((permissionEntry) => permissionEntry.key),
  );

  assert.equal(permissionKeys.has(TEAM_PERMISSIONS.view), true);
  assert.equal(permissionKeys.has(TEAM_PERMISSIONS.invite), true);
  assert.equal(permissionKeys.has(TEAM_PERMISSIONS.edit), true);
  assert.equal(permissionKeys.has(TEAM_PERMISSIONS.deactivate), true);
  assert.equal(permissionKeys.has(TEAM_PERMISSIONS.rolesAssign), true);
});

test('RBAC catalog includes required dashboard permission', () => {
  const permissionKeys = new Set(
    SYSTEM_PERMISSION_CATALOG
      .filter((permissionEntry) => permissionEntry.moduleKey === DASHBOARD_MODULE_KEY)
      .map((permissionEntry) => permissionEntry.key),
  );

  assert.equal(permissionKeys.has(DASHBOARD_PERMISSIONS.view), true);
});

// I test che seguono presidiano la fase A2 (7/8/2026): l'area Produzione AI ha un
// modulo suo, e i suoi permessi non devono tornare a essere prestiti da 'projects'.

test('RBAC catalog: la Produzione AI e i suoi cinque permessi stanno sotto il modulo proprio', () => {
  const moduleKeys = new Set(SYSTEM_MODULE_CATALOG.map((moduleEntry) => moduleEntry.key));
  assert.equal(moduleKeys.has(AI_PRODUCTION_MODULE_KEY), true);

  const permissionKeys = new Set(
    SYSTEM_PERMISSION_CATALOG
      .filter((permissionEntry) => permissionEntry.moduleKey === AI_PRODUCTION_MODULE_KEY)
      .map((permissionEntry) => permissionEntry.key),
  );

  for (const key of Object.values(AI_PRODUCTION_PERMISSIONS)) {
    assert.equal(permissionKeys.has(key), true, `manca ${key} sotto ${AI_PRODUCTION_MODULE_KEY}`);
  }

  // La chat e' parte dell'area: stava sotto 'projects' solo perche' un modulo suo
  // non esisteva, e il commento nel codice lo dichiarava come ripiego.
  for (const key of Object.values(CHAT_PERMISSIONS)) {
    assert.equal(permissionKeys.has(key), true, `manca ${key} sotto ${AI_PRODUCTION_MODULE_KEY}`);
  }
});

test('RBAC catalog: impostazioni AI e budget restano fuori dall Admin, solo Superadmin', () => {
  const admin = SYSTEM_ROLE_DEFINITIONS.find((role) => role.name === SYSTEM_ROLE_NAME.admin);
  assert.ok(admin, 'ruolo Admin assente dal catalogo');

  const selection = admin.permissions;
  assert.equal(typeof selection === 'object' && !Array.isArray(selection), true);

  const excluded = new Set(
    (selection as { mode: 'all_except'; exclude: readonly string[] }).exclude,
  );

  // Prima del 7/8/2026 quelle due azioni erano protette da un controllo sul nome del
  // ruolo: solo il Superadmin. Diventando permessi veri, l'Admin le erediterebbe da
  // 'all_except' — questo test e' il guardiano di quell'esclusione voluta.
  assert.equal(excluded.has(AI_PRODUCTION_PERMISSIONS.manageSettings), true);
  assert.equal(excluded.has(AI_PRODUCTION_PERMISSIONS.manageBudget), true);
});

// Nomi e descrizioni del catalogo NON sono testo interno: la pagina "Ruoli e permessi"
// li stampa tali e quali. Dal 7/8/2026 dicono il nome che l'area ha nel menu.
test('RBAC catalog: nomi e descrizioni non usano il vocabolario vecchio', () => {
  // Parole che il re-naming ha sostituito: se ricompaiono qui, la pagina dei permessi
  // torna a chiamare le aree in un modo e il menu in un altro. Non sono nell'elenco i
  // termini tenuti apposta in inglese (SEO, Ads, Brief, Dashboard, Team, Branding).
  const vocabolarioVecchio = [
    'Vault',
    'Web Assets',
    'Agency',
    'Discovery',
    'Checklists',
    'Departments',
    'Quotes',
    'Messages',
    'Clients',
  ];

  // Le DESCRIZIONI dei ruoli sono state riscritte in italiano nello stesso giro, quindi
  // sono esposte allo stesso rischio e stanno qui dentro. I loro NOMI no, di proposito:
  // Superadmin/Admin/Manager/Operativo/Viewer restano come sono per decisione di Jacopo
  // (7/8/2026), quindi non sono soggetti al vocabolario del re-naming.
  const testi = [
    ...SYSTEM_MODULE_CATALOG.flatMap((entry) => [entry.name, entry.description]),
    ...SYSTEM_PERMISSION_CATALOG.map((entry) => entry.description),
    ...SYSTEM_ROLE_DEFINITIONS.map((entry) => entry.description),
  ];

  for (const testo of testi) {
    for (const parola of vocabolarioVecchio) {
      assert.equal(
        testo.includes(parola),
        false,
        `"${testo}" contiene "${parola}", che il re-naming ha sostituito`,
      );
    }
  }
});

test('RBAC catalog: ogni voce ha un nome e una descrizione da mostrare', () => {
  for (const entry of SYSTEM_MODULE_CATALOG) {
    assert.equal(entry.name.trim().length > 0, true, `modulo ${entry.key} senza nome`);
    assert.equal(entry.description.trim().length > 0, true, `modulo ${entry.key} senza descrizione`);
  }

  for (const entry of SYSTEM_PERMISSION_CATALOG) {
    assert.equal(
      entry.description.trim().length > 0,
      true,
      `permesso ${entry.key} senza descrizione: nella pagina si leggerebbe una riga vuota`,
    );
  }
});

test('RBAC catalog: ogni permesso punta a un modulo che esiste davvero', () => {
  const moduleKeys = new Set(SYSTEM_MODULE_CATALOG.map((moduleEntry) => moduleEntry.key));

  for (const permissionEntry of SYSTEM_PERMISSION_CATALOG) {
    assert.equal(
      moduleKeys.has(permissionEntry.moduleKey),
      true,
      `${permissionEntry.key} punta al modulo inesistente ${permissionEntry.moduleKey}`,
    );
  }
});

test('RBAC catalog: i ruoli di sistema assegnano solo permessi presenti nel catalogo', () => {
  const permissionKeys = new Set(SYSTEM_PERMISSION_CATALOG.map((entry) => entry.key));

  // 'team.manage' e' nominato apposta fra le esclusioni dell'Admin come difesa contro
  // un residuo di vecchi database, e non e' (ne' deve essere) nel catalogo.
  const knownAbsent = new Set(['team.manage']);

  for (const role of SYSTEM_ROLE_DEFINITIONS) {
    const selection = role.permissions;
    const assigned: readonly string[] = Array.isArray(selection)
      ? selection
      : selection === 'all'
        ? []
        : (selection as { mode: 'all_except'; exclude: readonly string[] }).exclude;

    for (const key of assigned) {
      if (knownAbsent.has(key)) {
        continue;
      }
      assert.equal(
        permissionKeys.has(key),
        true,
        `il ruolo ${role.name} cita ${key}, che non e' nel catalogo`,
      );
    }
  }
});
