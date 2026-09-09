import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEmailValue,
  normalizeSdiCodeValue,
  normalizeWebsiteValue,
} from './field-rules.js';

// Le regole di forma dei campi cliente, provate senza database e senza richiesta.
// Il caso che conta davvero e' l'import massivo: quello NON passa dal form del
// browser, quindi qui c'e' l'unico controllo che un CSV incontra.

test('email: abbassa le maiuscole e accetta una forma valida', () => {
  assert.equal(normalizeEmailValue('Info@Advaiora.IT', 'email'), 'info@advaiora.it');
});

test('email: il vuoto resta vuoto (il campo e\' facoltativo)', () => {
  assert.equal(normalizeEmailValue(null, 'email'), null);
});

test('email: il messaggio nomina il campo, perche\' i campi email sono due', () => {
  assert.throws(() => normalizeEmailValue('non-una-email', 'pecEmail'), {
    message: 'pecEmail must be a valid email',
    statusCode: 400,
  });
});

test('codice SDI: sette caratteri, conservati in maiuscolo', () => {
  assert.equal(normalizeSdiCodeValue('m5uxcr1', 'sdiCode'), 'M5UXCR1');
});

test('codice SDI: sei caratteri per la Pubblica Amministrazione', () => {
  assert.equal(normalizeSdiCodeValue('UF1234', 'sdiCode'), 'UF1234');
});

test('codice SDI: un codice troncato viene respinto, non salvato a meta\'', () => {
  assert.throws(() => normalizeSdiCodeValue('M5U', 'sdiCode'), { statusCode: 400 });
});

test('codice SDI: piu\' di sette caratteri viene respinto', () => {
  assert.throws(() => normalizeSdiCodeValue('M5UXCR12', 'sdiCode'), { statusCode: 400 });
});

test('codice SDI: niente punteggiatura', () => {
  assert.throws(() => normalizeSdiCodeValue('M5UXCR-', 'sdiCode'), { statusCode: 400 });
});

test('sito web: accetta sia il dominio nudo sia l\'indirizzo completo, senza riscriverli', () => {
  assert.equal(normalizeWebsiteValue('advaiora.com', 'website'), 'advaiora.com');
  assert.equal(
    normalizeWebsiteValue('https://www.advaiora.com/contatti', 'website'),
    'https://www.advaiora.com/contatti',
  );
});

test('sito web: il testo libero non e\' un indirizzo', () => {
  assert.throws(() => normalizeWebsiteValue('chiedere a Maria', 'website'), {
    message: 'website must be a valid web address',
    statusCode: 400,
  });
});

test('sito web: gli schemi che non sono siti restano fuori', () => {
  assert.throws(() => normalizeWebsiteValue('javascript:alert(1)', 'website'), {
    statusCode: 400,
  });
  // Con un punto dentro passerebbe il solo controllo di forma: serve quello
  // sullo schema, altrimenti finirebbe dentro un collegamento.
  assert.throws(() => normalizeWebsiteValue('javascript:alert(document.domain)', 'website'), {
    statusCode: 400,
  });
  assert.throws(() => normalizeWebsiteValue('mailto:info@advaiora.com', 'website'), {
    statusCode: 400,
  });
});

test('sito web: la porta non e\' uno schema estraneo', () => {
  assert.equal(normalizeWebsiteValue('advaiora.com:8080', 'website'), 'advaiora.com:8080');
});
