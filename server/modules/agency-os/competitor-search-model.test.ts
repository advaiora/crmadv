import assert from 'node:assert/strict';
import test from 'node:test';
import {
  anthropicWebSearchToolType,
  DEFAULT_ANTHROPIC_COMPETITOR_SEARCH_MODEL,
  DEFAULT_COMPETITOR_SEARCH_MODEL,
  isAnthropicModelId,
  isOpenAiModelId,
  resolveCompetitorSearchModel,
  resolveCompetitorSearchProvider,
} from './competitor-search-model.js';

// La chiamata vera a OpenAI si collauda con le chiavi; la SCELTA del modello e'
// deterministica e si testa qui. Il caso che ha originato il modulo e' l'ultimo.

test('il modello preferito OpenAI viene usato tale e quale', () => {
  assert.equal(
    resolveCompetitorSearchModel({ configuredModel: 'gpt-4o' }),
    'gpt-4o',
  );
});

test('AGENCY_COMPETITOR_SEARCH_MODEL vince sul modello preferito', () => {
  assert.equal(
    resolveCompetitorSearchModel({ envModel: 'gpt-4o', configuredModel: 'gpt-4o-mini' }),
    'gpt-4o',
  );
});

test('la scelta esplicita del server vale anche per un id che non riconosciamo', () => {
  // Un modello OpenAI uscito dopo questo codice non deve essere scartato da noi.
  assert.equal(
    resolveCompetitorSearchModel({ envModel: 'modello-futuro-1' }),
    'modello-futuro-1',
  );
});

test('senza niente di configurato si ricade sul default OpenAI', () => {
  assert.equal(resolveCompetitorSearchModel({}), DEFAULT_COMPETITOR_SEARCH_MODEL);
  assert.equal(
    resolveCompetitorSearchModel({ envModel: '   ', configuredModel: '' }),
    DEFAULT_COMPETITOR_SEARCH_MODEL,
  );
});

test('un modello Claude come preferito NON viene inoltrato a OpenAI', () => {
  // Il caso reale: Impostazioni AI -> Modello preferito = Claude, ricerca
  // competitor accesa. Prima di questo modulo l'id Claude finiva dritto a
  // api.openai.com e tornava un errore del provider.
  for (const claude of ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5-20251001']) {
    assert.equal(
      resolveCompetitorSearchModel({ configuredModel: claude }),
      DEFAULT_COMPETITOR_SEARCH_MODEL,
    );
  }
});

test('isOpenAiModelId riconosce le famiglie OpenAI e scarta le altre', () => {
  for (const ok of ['gpt-4o-mini', 'GPT-4o', 'o1-mini', 'o3', 'chatgpt-4o-latest']) {
    assert.ok(isOpenAiModelId(ok), `${ok} dovrebbe essere OpenAI`);
  }
  for (const no of ['claude-sonnet-5', 'opus', '', '   ', null, undefined]) {
    assert.ok(!isOpenAiModelId(no), `${String(no)} non dovrebbe essere OpenAI`);
  }
});

test('isAnthropicModelId riconosce i modelli Claude e scarta gli altri', () => {
  for (const ok of ['claude-sonnet-5', 'Claude-Opus-4-8', 'claude-haiku-4-5-20251001']) {
    assert.ok(isAnthropicModelId(ok), `${ok} dovrebbe essere Anthropic`);
  }
  for (const no of ['gpt-4o', 'o3', '', '   ', null, undefined]) {
    assert.ok(!isAnthropicModelId(no), `${String(no)} non dovrebbe essere Anthropic`);
  }
});

// --- Provider Anthropic: il verso opposto dello stesso problema. ---

test('col provider Anthropic un modello OpenAI preferito NON viene inoltrato a Claude', () => {
  assert.equal(
    resolveCompetitorSearchModel({
      provider: 'anthropic_web_search',
      configuredModel: 'gpt-4o-mini',
    }),
    DEFAULT_ANTHROPIC_COMPETITOR_SEARCH_MODEL,
  );
});

test('col provider Anthropic un modello Claude preferito viene usato tale e quale', () => {
  assert.equal(
    resolveCompetitorSearchModel({
      provider: 'anthropic_web_search',
      configuredModel: 'claude-opus-4-8',
    }),
    'claude-opus-4-8',
  );
});

test('il modello scelto per la ricerca vince sul modello preferito del workspace', () => {
  assert.equal(
    resolveCompetitorSearchModel({
      provider: 'anthropic_web_search',
      searchModel: 'claude-haiku-4-5-20251001',
      configuredModel: 'claude-opus-4-8',
    }),
    'claude-haiku-4-5-20251001',
  );
  // ...ma solo se e' del provider giusto: altrimenti si ignora e si scende.
  assert.equal(
    resolveCompetitorSearchModel({
      provider: 'anthropic_web_search',
      searchModel: 'gpt-4o',
      configuredModel: 'claude-opus-4-8',
    }),
    'claude-opus-4-8',
  );
});

test('la variabile d ambiente non forza un modello dell altro provider', () => {
  // AGENCY_COMPETITOR_SEARCH_MODEL vince, ma non fino a mandare un id OpenAI
  // a Claude: quello e' esattamente l'errore che il modulo esiste per evitare.
  assert.equal(
    resolveCompetitorSearchModel({
      provider: 'anthropic_web_search',
      envModel: 'gpt-4o',
      configuredModel: 'claude-opus-4-8',
    }),
    'claude-opus-4-8',
  );
  assert.equal(
    resolveCompetitorSearchModel({
      provider: 'openai_web_search',
      envModel: 'claude-opus-4-8',
      configuredModel: 'gpt-4o',
    }),
    'gpt-4o',
  );
});

test('lo strumento di ricerca web Anthropic segue il modello', () => {
  assert.equal(anthropicWebSearchToolType('claude-sonnet-5'), 'web_search_20260209');
  assert.equal(anthropicWebSearchToolType('claude-opus-4-8'), 'web_search_20260209');
  // Haiku 4.5 non ha la variante recente: si usa quella base, che c'e' ovunque.
  assert.equal(anthropicWebSearchToolType('claude-haiku-4-5-20251001'), 'web_search_20250305');
  assert.equal(anthropicWebSearchToolType(''), 'web_search_20250305');
});

// --- Quale provider e' davvero utilizzabile. ---

const providerCase = (over = {}) => resolveCompetitorSearchProvider({
  enabled: true,
  provider: 'openai_web_search',
  openAiKeyConfigured: true,
  anthropicKeyConfigured: false,
  ...over,
});

test('serve la chiave DEL provider scelto, non sempre quella di OpenAI', () => {
  // Il difetto storico: con la sola chiave Anthropic e il provider Anthropic
  // selezionato, la ricerca risultava comunque "non configurata".
  assert.deepEqual(
    providerCase({
      provider: 'anthropic_web_search',
      openAiKeyConfigured: false,
      anthropicKeyConfigured: true,
    }),
    { provider: 'anthropic_web_search', reason: 'ready' },
  );
  assert.deepEqual(
    providerCase({ provider: 'anthropic_web_search', anthropicKeyConfigured: false }),
    { provider: null, reason: 'missing_key' },
  );
  assert.deepEqual(
    providerCase({ openAiKeyConfigured: false }),
    { provider: null, reason: 'missing_key' },
  );
});

test('spenta, senza provider e provider senza motore sono tre motivi distinti', () => {
  assert.deepEqual(providerCase({ enabled: false }), { provider: null, reason: 'disabled' });
  assert.deepEqual(providerCase({ provider: 'none' }), { provider: null, reason: 'no_provider' });
  assert.deepEqual(providerCase({ provider: '' }), { provider: null, reason: 'no_provider' });
  for (const senzaMotore of ['serpapi', 'custom']) {
    assert.deepEqual(
      providerCase({ provider: senzaMotore }),
      { provider: null, reason: 'unsupported_provider' },
    );
  }
});
