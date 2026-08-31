// Test tabellare «questa rotta chiede quel permesso» sulle rotte della Produzione AI
// (compresa la Chat AI, che sta nello stesso file di rotte).
//
// Perche' esiste: decisioni-cliente-e-menu-2026-08-07.md §5, punto 2 — i Siti in
// gestione ce l'avevano gia', la Produzione AI no. E' l'area dove sbagliare permesso
// costa di piu': `ai_production.generate` e' l'unica azione che SPENDE il budget AI
// dell'agenzia, e finche' non e' scritta da qualche parte nessuno si accorge se una
// rotta che genera scivola su `.edit`.
//
// Perche' sta qui e non accanto alle rotte: legge il sorgente invece di far partire
// Fastify, quindi usa lo stesso lettore del controllo del catalogo
// (scripts/security/rbac-usage.mjs) — §7.3 ⑨ dice proprio che i due punti sono lo
// stesso problema visto da due lati e non vanno costruiti due volte. Come effetto
// secondario gira con `npm run test:scripts` senza dipendenze installate.
//
// ⚠️ Cosa prova e cosa no. Prova che il sorgente DICE quel permesso: prende una rotta
// aggiunta senza cancello, una a cui il permesso e' stato cambiato per sbaglio, e una
// tolta senza aggiornare la tabella. NON prova che il cancello funzioni a runtime —
// quello e' il mestiere di ensureAiProductionAccess, gia' coperto altrove.
//
// Quando si aggiunge una rotta all'area, si aggiunge una riga qui. E' il punto: la
// tabella e' una dichiarazione di intenti, e il rosso e' la domanda «con che permesso?».

import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  collectConstantObjects,
  extractCatalogPermissions,
  extractRoutePermissions,
  stripNonCode,
} from './rbac-usage.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const ROUTE_FILE = 'server/modules/agency-os/routes/workspace-agency.route.ts';
const CATALOG_FILE = 'server/auth/rbac-catalog.ts';

// metodo, percorso, permesso richiesto.
const TABELLA_ATTESA = [
  ["GET", "/agency/projects", "ai_production.view"],
  ["POST", "/agency/projects", "ai_production.edit"],
  ["GET", "/agency/chat/projects", "chat.view"],
  ["GET", "/agency/chat/models", "chat.view"],
  ["GET", "/agency/projects/:projectId", "ai_production.view"],
  ["GET", "/agency/projects/:projectId/overview", "ai_production.view"],
  ["GET", "/agency/projects/:projectId/brain", "ai_production.view"],
  ["GET", "/agency/projects/:projectId/working-context", "ai_production.view"],
  ["GET", "/agency/projects/:projectId/discovery", "ai_production.view"],
  ["POST", "/agency/projects/:projectId/discovery/regenerate-from-sources", "ai_production.generate"],
  ["POST", "/agency/projects/:projectId/discovery/generate-from-sources", "ai_production.generate"],
  ["POST", "/agency/projects/:projectId/discovery/regenerate-section", "ai_production.generate"],
  ["POST", "/agency/projects/:projectId/discovery/generate-section", "ai_production.generate"],
  ["GET", "/agency/projects/:projectId/sources", "ai_production.view"],
  ["PUT", "/agency/projects/:projectId/sources", "ai_production.edit"],
  ["POST", "/agency/projects/:projectId/sources/files", "ai_production.edit"],
  ["GET", "/agency/projects/:projectId/sources/files/:fileId", "ai_production.view"],
  ["DELETE", "/agency/projects/:projectId/sources/files/:fileId", "ai_production.edit"],
  ["POST", "/agency/projects/:projectId/sources/competitors/search", "ai_production.generate"],
  ["GET", "/agency/settings/provider-status", "ai_production.view"],
  ["GET", "/agency/ai/status", "ai_production.view"],
  ["GET", "/agency/settings/runtime", "ai_production.view"],
  ["PUT", "/agency/settings/runtime", "ai_production.manage_settings"],
  ["GET", "/agency/settings/ai-usage", "ai_production.manage_budget"],
  ["GET", "/agency/projects/:projectId/chat", "chat.view"],
  ["POST", "/agency/projects/:projectId/chat", "chat.use"],
  ["DELETE", "/agency/projects/:projectId/chat", "chat.use"],
  ["GET", "/agency/projects/:projectId/chat/participants", "chat.view"],
  ["POST", "/agency/projects/:projectId/chat/participants", "chat.use"],
  ["DELETE", "/agency/projects/:projectId/chat/participants/:memberId", "chat.use"],
  ["GET", "/agency/chat/client/:clientId", "chat.view"],
  ["POST", "/agency/chat/client/:clientId", "chat.use"],
  ["DELETE", "/agency/chat/client/:clientId", "chat.use"],
  ["GET", "/agency/chat/client/:clientId/participants", "chat.view"],
  ["POST", "/agency/chat/client/:clientId/participants", "chat.use"],
  ["DELETE", "/agency/chat/client/:clientId/participants/:memberId", "chat.use"],
  ["GET", "/agency/chat/general", "chat.view"],
  ["POST", "/agency/chat/general", "chat.use"],
  ["DELETE", "/agency/chat/general", "chat.use"],
  ["GET", "/agency/chat/general/participants", "chat.view"],
  ["POST", "/agency/chat/general/participants", "chat.use"],
  ["DELETE", "/agency/chat/general/participants/:memberId", "chat.use"],
  ["GET", "/agency/chat/sessions", "chat.view"],
  ["POST", "/agency/chat/sessions", "chat.use"],
  ["PATCH", "/agency/chat/sessions/:conversationId", "chat.use"],
  ["POST", "/agency/chat/sessions/:conversationId/disband", "chat.use"],
  ["POST", "/agency/chat/sessions/:conversationId/resume", "chat.use"],
  ["GET", "/agency/chat/attachments", "chat.view"],
  ["POST", "/agency/chat/attachments/file", "chat.use"],
  ["POST", "/agency/chat/attachments/entity", "chat.use"],
  ["DELETE", "/agency/chat/attachments/:attachmentId", "chat.use"],
  ["GET", "/agency/chat/attachments/:attachmentId/file", "chat.view"],
  ["GET", "/agency/ai/estimates", "ai_production.view"],
  ["GET", "/agency/settings/ai-budgets", "ai_production.manage_budget"],
  ["PUT", "/agency/settings/ai-budgets", "ai_production.manage_budget"],
  ["GET", "/agency/projects/:projectId/web", "ai_production.view"],
  ["PUT", "/agency/projects/:projectId/web", "ai_production.edit"],
  ["POST", "/agency/projects/:projectId/web-projects/:webProjectId/generate-ai", "ai_production.generate"],
  ["POST", "/agency/projects/:projectId/web-projects/:webProjectId/generate-block-ai", "ai_production.generate"],
  ["GET", "/agency/projects/:projectId/ads", "ai_production.view"],
  ["PUT", "/agency/projects/:projectId/ads", "ai_production.edit"],
  ["POST", "/agency/projects/:projectId/ads/generate-asset-ai", "ai_production.generate"],
  ["GET", "/agency/projects/:projectId/reports/input", "ai_production.view"],
  ["GET", "/agency/projects/:projectId/reports/client/input", "ai_production.view"],
  ["GET", "/agency/projects/:projectId/reports/client", "ai_production.view"],
  ["PUT", "/agency/projects/:projectId/reports/client", "ai_production.edit"],
  ["GET", "/agency/projects/:projectId/reports/client/pdf", "ai_production.view"],
  ["GET", "/agency/projects/:projectId/diagnosis/input", "ai_production.view"],
  ["GET", "/agency/projects/:projectId/diagnosis", "ai_production.view"],
  ["PUT", "/agency/projects/:projectId/diagnosis", "ai_production.edit"],
  ["GET", "/agency/projects/:projectId/reports", "ai_production.view"],
  ["PUT", "/agency/projects/:projectId/reports", "ai_production.edit"],
  ["GET", "/agency/reports", "ai_production.view"],
  ["PUT", "/agency/projects/:projectId/discovery", "ai_production.edit"],
  ["GET", "/agency/projects/:projectId/alerts", "ai_production.view"],
  ["POST", "/agency/projects/:projectId/alerts/sync", "ai_production.edit"],
  ["GET", "/agency/alerts", "ai_production.view"],
  ["GET", "/agency/projects/:projectId/opportunities/input", "ai_production.view"],
  ["GET", "/agency/projects/:projectId/opportunities", "ai_production.view"],
  ["POST", "/agency/projects/:projectId/opportunities/sync", "ai_production.edit"],
  ["GET", "/agency/opportunities", "ai_production.view"],
  ["GET", "/agency/projects/:projectId/tasks", "ai_production.view"],
  ["POST", "/agency/projects/:projectId/tasks/sync", "ai_production.edit"],
  ["GET", "/agency/projects/:projectId/performance/snapshots", "ai_production.view"],
  ["POST", "/agency/projects/:projectId/performance/snapshots", "ai_production.edit"],
  ["POST", "/agency/projects/:projectId/performance/refresh", "ai_production.edit"],
  ["DELETE", "/agency/projects/:projectId/performance/snapshots/:snapshotId", "ai_production.edit"],
  ["GET", "/agency/performance/connectors", "ai_production.view"],
  ["GET", "/agency/performance/metric-sets", "ai_production.view"],
  ["POST", "/agency/performance/metric-sets", "ai_production.edit"],
  ["PATCH", "/agency/performance/metric-sets/:metricSetId", "ai_production.edit"],
  ["DELETE", "/agency/performance/metric-sets/:metricSetId", "ai_production.edit"],
  ["POST", "/agency/projects/:projectId/performance/excel/preview", "ai_production.generate"],
  ["POST", "/agency/projects/:projectId/performance/excel/commit", "ai_production.edit"],
];

const leggiRotte = async () => {
  const catalogo = await fs.readFile(path.join(ROOT, CATALOG_FILE), 'utf8');
  const costanti = collectConstantObjects(stripNonCode(catalogo));
  const sorgente = await fs.readFile(path.join(ROOT, ROUTE_FILE), 'utf8');

  return {
    rotte: extractRoutePermissions(sorgente, costanti),
    catalogo: extractCatalogPermissions(catalogo),
  };
};

test('ogni rotta della Produzione AI chiede il permesso scritto in tabella', async () => {
  const { rotte } = await leggiRotte();

  assert.deepEqual(
    rotte.map((rotta) => [rotta.method, rotta.path, rotta.permission]),
    TABELLA_ATTESA,
    `${ROUTE_FILE} non combacia piu' con la tabella: una rotta e' stata aggiunta, tolta, `
    + 'o ha cambiato permesso. Se il cambiamento e\' voluto, aggiornare la tabella dicendo '
    + 'con che permesso; se la rotta e\' nuova, la voce va decisa prima di scriverla.',
  );
});

test('i permessi chiesti dalle rotte esistono tutti nel catalogo', async () => {
  const { rotte, catalogo } = await leggiRotte();

  const sconosciuti = rotte
    .filter((rotta) => !catalogo.has(rotta.permission))
    .map((rotta) => `${rotta.method} ${rotta.path} -> ${rotta.permission}`);

  assert.deepEqual(sconosciuti, [], `permessi non presenti in ${CATALOG_FILE}`);
});

test('le rotte che fanno generare l AI chiedono il permesso che spende', async () => {
  // 'ai_production.generate' e' separato dagli altri quattro proprio perche' e' l'unico
  // che consuma il budget dell'agenzia. Una rotta che genera chiedendo '.edit' lascia
  // spendere chi era stato messo in condizione di sola modifica, e non si vede.
  const { rotte } = await leggiRotte();

  const sbagliate = rotte
    .filter((rotta) => /\bgenerate\b|generate-/.test(rotta.path ?? ''))
    .filter((rotta) => rotta.permission !== 'ai_production.generate')
    .map((rotta) => `${rotta.method} ${rotta.path} -> ${rotta.permission}`);

  assert.deepEqual(sbagliate, [], 'rotte che generano senza chiedere ai_production.generate');
});

test('le impostazioni e il budget dell AI restano su permessi propri', async () => {
  // Prima del 7/8/2026 erano protetti da un controllo scritto a mano sul NOME del ruolo,
  // fuori dal catalogo: nessun ruolo personalizzato poteva riceverli. Ora sono permessi
  // veri, e questa e' la riga che impedisce di riportarli sotto '.view' o '.edit'.
  const { rotte } = await leggiRotte();
  const trova = (method, percorso) =>
    rotte.find((rotta) => rotta.method === method && rotta.path === percorso)?.permission;

  assert.equal(trova('PUT', '/agency/settings/runtime'), 'ai_production.manage_settings');
  assert.equal(trova('GET', '/agency/settings/ai-budgets'), 'ai_production.manage_budget');
  assert.equal(trova('PUT', '/agency/settings/ai-budgets'), 'ai_production.manage_budget');
  assert.equal(trova('GET', '/agency/settings/ai-usage'), 'ai_production.manage_budget');
});
