import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addCompetitorSearchUsage,
  COMPETITOR_SEARCH_FUNCTION_NAME,
  EMPTY_COMPETITOR_SEARCH_USAGE,
  readCompetitorSearchUsage,
} from './competitor-search-usage.js';

// Il caso che ha originato il modulo e' l'ultimo: nel ramo Anthropic la
// variabile `payload` viene riassegnata a ogni continuazione, e chi legge i
// token solo dall'ultimo giro sottostima il consumo fino a quattro volte.

test('la chiave della funzione resta quella del catalogo', () => {
  assert.equal(COMPETITOR_SEARCH_FUNCTION_NAME, 'competitors.search');
});

test('legge i token dalla risposta OpenAI Responses', () => {
  assert.deepEqual(
    readCompetitorSearchUsage({ usage: { input_tokens: 5200, output_tokens: 830 } }),
    { inputTokens: 5200, outputTokens: 830 },
  );
});

test('legge i token dalla risposta Anthropic Messages', () => {
  assert.deepEqual(
    readCompetitorSearchUsage({
      stop_reason: 'tool_use',
      usage: { input_tokens: 1200, output_tokens: 400 },
    }),
    { inputTokens: 1200, outputTokens: 400 },
  );
});

test('accetta la forma vecchia prompt_tokens/completion_tokens come ripiego', () => {
  assert.deepEqual(
    readCompetitorSearchUsage({ usage: { prompt_tokens: 90, completion_tokens: 12 } }),
    { inputTokens: 90, outputTokens: 12 },
  );
});

// Una risposta senza `usage` non deve far fallire una ricerca gia' pagata:
// vale zero, non un errore.
test('una risposta senza usage vale zero token, non un errore', () => {
  for (const payload of [null, undefined, {}, { usage: null }, { usage: 'boh' }, 42, []]) {
    assert.deepEqual(readCompetitorSearchUsage(payload), { inputTokens: 0, outputTokens: 0 });
  }
});

test('i valori non numerici o negativi valgono zero', () => {
  assert.deepEqual(
    readCompetitorSearchUsage({ usage: { input_tokens: -5, output_tokens: 'molti' } }),
    { inputTokens: 0, outputTokens: 0 },
  );
});

// ⚠️ Il test che presidia il difetto descritto in CRMA-55: due giri di
// continuazione devono sommarsi, non sovrascriversi.
test('due giri di continuazione Anthropic SOMMANO i token, non li sovrascrivono', () => {
  const giri = [
    { stop_reason: 'pause_turn', usage: { input_tokens: 1500, output_tokens: 300 } },
    { stop_reason: 'tool_use', usage: { input_tokens: 2600, output_tokens: 450 } },
  ];

  let totale = { ...EMPTY_COMPETITOR_SEARCH_USAGE };
  for (const giro of giri) {
    totale = addCompetitorSearchUsage(totale, giro);
  }

  assert.deepEqual(totale, { inputTokens: 4100, outputTokens: 750 });
  // La prova che il difetto sarebbe stato preso: leggere solo l'ultimo giro
  // darebbe 2600/450, cioe' molto meno del consumo vero.
  assert.notDeepEqual(totale, readCompetitorSearchUsage(giri[giri.length - 1]));
});

test('quattro giri (il massimo) si sommano tutti', () => {
  const giri = Array.from({ length: 4 }, () => ({
    usage: { input_tokens: 1000, output_tokens: 200 },
  }));
  const totale = giri.reduce(
    (acc, giro) => addCompetitorSearchUsage(acc, giro),
    { ...EMPTY_COMPETITOR_SEARCH_USAGE },
  );
  assert.deepEqual(totale, { inputTokens: 4000, outputTokens: 800 });
});

test('un giro senza usage non azzera il totale gia accumulato', () => {
  const totale = addCompetitorSearchUsage({ inputTokens: 900, outputTokens: 100 }, { stop_reason: 'end_turn' });
  assert.deepEqual(totale, { inputTokens: 900, outputTokens: 100 });
});
