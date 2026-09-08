import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_COMPETITOR_SEARCH_MODEL,
  isOpenAiModelId,
  resolveCompetitorSearchModel,
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
