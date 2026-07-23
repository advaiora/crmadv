import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANTHROPIC_JSON_TOOL_NAME,
  buildAnthropicJsonTool,
  extractAnthropicToolInput,
  isEmptyStructuredPayload,
} from './anthropic-json.js';

const SCHEMA = {
  type: 'object',
  properties: { sections: { type: 'object' } },
  required: ['sections'],
};

test('buildAnthropicJsonTool usa lo schema del chiamante', () => {
  const tool = buildAnthropicJsonTool(SCHEMA);
  assert.equal(tool.name, ANTHROPIC_JSON_TOOL_NAME);
  assert.deepEqual(tool.input_schema, SCHEMA);
});

test('estrae il JSON dal blocco tool_use (caso normale)', () => {
  const payload = {
    content: [
      { type: 'tool_use', name: ANTHROPIC_JSON_TOOL_NAME, input: { target: 'coppie', sezioni: ['a', 'b'] } },
    ],
  };

  assert.deepEqual(extractAnthropicToolInput(payload), { target: 'coppie', sezioni: ['a', 'b'] });
});

test('estrae il blocco tool_use anche se preceduto da un blocco di testo', () => {
  const payload = {
    content: [
      { type: 'text', text: 'Ecco il risultato:' },
      { type: 'tool_use', name: ANTHROPIC_JSON_TOOL_NAME, input: { ok: true } },
    ],
  };

  assert.deepEqual(extractAnthropicToolInput(payload), { ok: true });
});

test('il JSON estratto resta valido anche con virgolette e apostrofi (il caso che rompeva il parse)', () => {
  // Prima, con il JSON ri-parsato dal testo, contenuti come questi producevano
  // "Expected ',' or '}'". Qui il valore arriva gia' come oggetto: nessun parse di mezzo.
  const insidioso = `L'"offerta" è fatta così: {non, valido}`;
  const payload = {
    content: [{ type: 'tool_use', name: ANTHROPIC_JSON_TOOL_NAME, input: { nota: insidioso } }],
  };

  assert.deepEqual(extractAnthropicToolInput(payload), { nota: insidioso });
});

test('ritorna null se non c e alcun blocco tool_use (il chiamante ripiega sul testo)', () => {
  const payload = { content: [{ type: 'text', text: '{"a":1}' }] };
  assert.equal(extractAnthropicToolInput(payload), null);
});

test('ritorna null se il blocco tool_use ha un altro nome', () => {
  const payload = {
    content: [{ type: 'tool_use', name: 'altro_strumento', input: { a: 1 } }],
  };
  assert.equal(extractAnthropicToolInput(payload), null);
});

test('ritorna null su risposte malformate o vuote', () => {
  assert.equal(extractAnthropicToolInput(null), null);
  assert.equal(extractAnthropicToolInput('testo'), null);
  assert.equal(extractAnthropicToolInput({}), null);
  assert.equal(extractAnthropicToolInput({ content: [] }), null);
  assert.equal(extractAnthropicToolInput({ content: [{ type: 'tool_use', name: ANTHROPIC_JSON_TOOL_NAME }] }), null);
});

test('isEmptyStructuredPayload riconosce il segnaposto _dummy (caso visto dal vivo con schema generico)', () => {
  // Con un input_schema senza proprieta' Claude rispose {"_dummy": …}: JSON valido ma
  // vuoto. Va trattato come fallimento, non come generazione AI riuscita.
  assert.equal(isEmptyStructuredPayload({ _dummy: 'x' }), true);
  assert.equal(isEmptyStructuredPayload({}), true);
  assert.equal(isEmptyStructuredPayload(null), true);
});

test('isEmptyStructuredPayload accetta un payload con contenuto vero', () => {
  assert.equal(isEmptyStructuredPayload({ sections: { target: 'coppie' } }), false);
});
