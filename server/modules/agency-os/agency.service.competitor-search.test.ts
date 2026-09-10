// Il fusibile di budget e la traccia in AiUsageLog della RICERCA COMPETITOR
// (CRMA-55), provati sul servizio vero e non sui moduli puri.
//
// Perche' un test di servizio e non solo i moduli puri: i due comportamenti che
// il perimetro chiedeva per nome — «il fusibile scatta a budget esaurito» e «la
// riga di log viene scritta con la chiave giusta» — non vivono in nessuno dei
// due moduli estratti. Vivono nell'ORDINE delle chiamate dentro
// `searchProjectCompetitors` e i due motori: `assertWithinAiBudget` prima della
// `fetch`, `logCompetitorSearchUsage` prima del `parse`. Un test sui moduli
// puri resta verde anche se domani qualcuno sposta l'una sotto l'altra, ed e'
// esattamente il guasto che questo compito esiste per chiudere.
//
// Il modello e' `checklists/checklists.service.gate.test.ts`: si montano i
// ganci sulle repository con `t.mock.method`, senza database. `agency.service`
// si importa senza connessione: le repository sono oggetti, e Prisma viene
// toccato solo dai metodi che qui non si chiamano.
import assert from 'node:assert/strict';
import test from 'node:test';
import { requestContext } from '../../core/request-context.js';
import { aiBudgetRepository } from '../../repositories/ai-budget.repository.js';
import { aiUsageRepository } from '../../repositories/ai-usage.repository.js';
import { agencyRepository } from './agency.repository.js';
import { agencyService } from './agency.service.js';
import { COMPETITOR_SEARCH_FUNCTION_NAME } from './competitor-search-usage.js';

const WORKSPACE_ID = 'workspace-1';
const PROJECT_ID = 'project-1';
const USER_ID = 'user-1';

// Progetto minimo: solo i campi che il percorso della ricerca competitor legge
// davvero (`buildCompetitorSearchContext` e `buildCompetitorSearchResult`).
const fakeProject = () => ({
  id: PROJECT_ID,
  name: 'Progetto di prova',
  clientName: 'Cliente di prova',
  goal: 'Acquisire contatti',
  projectType: { key: 'web', label: 'Sito web' },
  scopePurchased: {},
  sources: {
    websiteUrl: 'https://cliente-di-prova.it',
    primaryWebsiteUrl: 'https://cliente-di-prova.it',
    manualNotes: '',
    urls: [],
    competitors: [],
    competitorUrls: [],
    uploadedFiles: [],
  },
});

// Ambiente: ricerca competitor accesa su OpenAI, chiave presente. Passa tutto
// dalle variabili d'ambiente perche' con lo schema delle impostazioni non
// pronto `resolveAgencyRuntimeConfig` ripiega sui default d'ambiente e non
// tocca il database.
const withCompetitorSearchEnv = (t: import('node:test').TestContext) => {
  const previous = {
    enabled: process.env.AGENCY_COMPETITOR_SEARCH_ENABLED,
    provider: process.env.AGENCY_COMPETITOR_SEARCH_PROVIDER,
    model: process.env.AGENCY_COMPETITOR_SEARCH_MODEL,
    openAiKey: process.env.OPENAI_API_KEY,
  };
  process.env.AGENCY_COMPETITOR_SEARCH_ENABLED = 'true';
  process.env.AGENCY_COMPETITOR_SEARCH_PROVIDER = 'openai_web_search';
  process.env.AGENCY_COMPETITOR_SEARCH_MODEL = 'gpt-4o-mini';
  process.env.OPENAI_API_KEY = 'sk-test-chiave-finta';
  t.after(() => {
    process.env.AGENCY_COMPETITOR_SEARCH_ENABLED = previous.enabled;
    process.env.AGENCY_COMPETITOR_SEARCH_PROVIDER = previous.provider;
    process.env.AGENCY_COMPETITOR_SEARCH_MODEL = previous.model;
    process.env.OPENAI_API_KEY = previous.openAiKey;
  });
};

// Ganci comuni: progetto, schema impostazioni non pronto, utente nel contesto.
// Torna il contatore delle chiamate al provider e le righe di AiUsageLog
// catturate, che sono le due cose che ogni test qui sotto guarda.
const mountCompetitorSearch = (t: import('node:test').TestContext, options: {
  dailyLimitUsd: number;
  spentTodayUsd: number;
  providerResponse?: () => unknown;
}) => {
  withCompetitorSearchEnv(t);

  t.mock.method(agencyService, 'getProject', async () => fakeProject() as never);
  t.mock.method(agencyRepository, 'isAgencyRuntimeSettingsSchemaReady', async () => false);
  t.mock.method(requestContext, 'getUserId', () => USER_ID);

  t.mock.method(aiBudgetRepository, 'resolveLimitForUser', async () => ({
    dailyLimitUsd: options.dailyLimitUsd,
  } as never));
  t.mock.method(aiUsageRepository, 'sumCostForUser', async () => options.spentTodayUsd);

  const loggedRows: Record<string, unknown>[] = [];
  t.mock.method(aiUsageRepository, 'create', async (data: Record<string, unknown>) => {
    loggedRows.push(data);
    return data as never;
  });

  const providerCalls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: unknown) => {
    providerCalls.push(String(url));
    return {
      ok: true,
      status: 200,
      json: async () => (options.providerResponse ? options.providerResponse() : {}),
    };
  }) as typeof globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  return { providerCalls, loggedRows };
};

// Risposta OpenAI ben formata, con `usage` valorizzato: e' la forma su cui si
// misura sia la riga di log sia i token veri.
const openAiSearchResponse = () => ({
  output_text: JSON.stringify({
    competitors: [
      { name: 'Concorrente Uno', url: 'https://concorrente-uno.it', reason: 'Stesso mercato' },
    ],
    usedQueries: ['agenzia web milano'],
    notes: '',
  }),
  usage: { input_tokens: 3200, output_tokens: 640 },
});

test('a budget esaurito la ricerca competitor non chiama il provider e risponde 200 con budgetExceeded', async (t) => {
  const { providerCalls, loggedRows } = mountCompetitorSearch(t, {
    dailyLimitUsd: 5,
    spentTodayUsd: 7.5,
    providerResponse: openAiSearchResponse,
  });

  const result = await agencyService.searchProjectCompetitors({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
  }) as Record<string, unknown>;

  // Il cuore del rilievo: il fusibile sta PRIMA della chiamata, non dopo. Se
  // domani qualcuno lo sposta dentro i due motori o sotto la `fetch`, qui si
  // vede una chiamata al provider e il test diventa rosso.
  assert.deepEqual(providerCalls, [], 'il provider non deve essere chiamato a budget esaurito');
  assert.deepEqual(loggedRows, [], 'nessuna spesa, nessuna riga di consumo');

  // La forma su cui si aggancia il compito frontend gemello: 200 con un flag
  // nel corpo, non un 4xx e non il `configured_error` del catch generico.
  assert.equal(result.providerStatus, 'budget_exceeded');
  assert.equal(result.budgetExceeded, true);
  assert.equal(result.realSearch, false);
  assert.deepEqual(result.suggestions, []);
  assert.equal(typeof result.budgetMessage, 'string');
  assert.ok((result.budgetMessage as string).length > 0);
});

test('una ricerca riuscita scrive in AiUsageLog la riga con functionName competitors.search, utente e token veri', async (t) => {
  const { providerCalls, loggedRows } = mountCompetitorSearch(t, {
    dailyLimitUsd: 5,
    spentTodayUsd: 0.1,
    providerResponse: openAiSearchResponse,
  });

  const result = await agencyService.searchProjectCompetitors({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
  }) as Record<string, unknown>;

  assert.equal(providerCalls.length, 1, 'con budget disponibile la ricerca deve arrivare al provider');
  assert.equal(result.realSearch, true);
  assert.equal(result.budgetExceeded, undefined);

  assert.equal(loggedRows.length, 1, 'una ricerca, una riga di consumo');
  const row = loggedRows[0];
  // La chiave scritta nella riga, non la sola costante: e' quella che il
  // rendiconto «Consumi & costi AI» legge per filtrare e sommare.
  assert.equal(row.functionName, COMPETITOR_SEARCH_FUNCTION_NAME);
  assert.equal(row.functionName, 'competitors.search');
  assert.equal(row.workspaceId, WORKSPACE_ID);
  assert.equal(row.projectId, PROJECT_ID);
  assert.equal(row.userId, USER_ID, 'senza utente la riga non entra nei totali per utente');
  assert.equal(row.model, 'gpt-4o-mini');
  // Token VERI letti da `usage`, non stimati dai caratteri.
  assert.equal(row.inputTokens, 3200);
  assert.equal(row.outputTokens, 640);
  assert.equal(row.status, 'success');
  assert.ok(typeof row.costUsd === 'number' && row.costUsd > 0, 'il costo deve essere valorizzato');
});

test('una risposta pagata ma non interpretabile finisce comunque in AiUsageLog', async (t) => {
  // Il caso del rilievo 1: `web_search` risponde a parole invece che in JSON.
  // Il provider e' gia' stato pagato, quindi la spesa deve entrare nel log —
  // altrimenti non entra nemmeno nel budget (`assertWithinAiBudget` somma
  // AiUsageLog) e una sequenza di risposte cosi' scavalcherebbe il fusibile
  // senza mai toccarlo.
  const { providerCalls, loggedRows } = mountCompetitorSearch(t, {
    dailyLimitUsd: 5,
    spentTodayUsd: 0.1,
    providerResponse: () => ({
      output_text: 'Ho cercato online ma non sono riuscito a trovare concorrenti affidabili.',
      usage: { input_tokens: 4100, output_tokens: 220 },
    }),
  });

  const result = await agencyService.searchProjectCompetitors({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
  }) as Record<string, unknown>;

  assert.equal(providerCalls.length, 1);
  assert.equal(result.providerStatus, 'configured_error', 'la ricerca fallisce, ed e\' giusto');
  assert.equal(loggedRows.length, 1, 'ma la spesa gia\' fatta deve essere registrata lo stesso');
  assert.equal(loggedRows[0].functionName, 'competitors.search');
  assert.equal(loggedRows[0].inputTokens, 4100);
  assert.equal(loggedRows[0].outputTokens, 220);
});

test('il dry-run non consuma budget e non scrive nessuna riga di consumo', async (t) => {
  const { providerCalls, loggedRows } = mountCompetitorSearch(t, {
    dailyLimitUsd: 5,
    // Budget gia' sforato: se il dry-run passasse dal fusibile, risponderebbe
    // budget_exceeded invece di 'configured'.
    spentTodayUsd: 99,
    providerResponse: openAiSearchResponse,
  });

  const result = await agencyService.searchProjectCompetitors({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    dryRun: true,
  }) as Record<string, unknown>;

  assert.equal(result.providerStatus, 'configured');
  assert.equal(result.realSearch, false);
  assert.equal(result.budgetExceeded, undefined);
  assert.deepEqual(providerCalls, []);
  assert.deepEqual(loggedRows, []);
});

test('la ricerca competitor non tocca il budget quando non c\'e\' un utente nel contesto', async (t) => {
  // Job di sistema: nessun utente, quindi nessun limite personale da far
  // scattare. La ricerca deve funzionare come prima, non essere bloccata.
  const { providerCalls, loggedRows } = mountCompetitorSearch(t, {
    dailyLimitUsd: 5,
    spentTodayUsd: 99,
    providerResponse: openAiSearchResponse,
  });
  t.mock.method(requestContext, 'getUserId', () => null);

  const result = await agencyService.searchProjectCompetitors({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
  }) as Record<string, unknown>;

  assert.equal(result.budgetExceeded, undefined);
  assert.equal(providerCalls.length, 1);
  assert.equal(loggedRows.length, 1);
  assert.equal(loggedRows[0].userId, null);
});
