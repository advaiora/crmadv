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

test('sito web: il testo libero passa, come nel form', () => {
  // Il server non puo' essere piu' severo del browser: `clientFormValidation.js`
  // non mette nessun vincolo di forma sul sito, e una scheda dichiarata valida a
  // schermo deve potersi salvare.
  assert.equal(normalizeWebsiteValue('da definire', 'website'), 'da definire');
  assert.equal(normalizeWebsiteValue('in costruzione', 'website'), 'in costruzione');
});

test('sito web: gli schemi che non sono siti restano fuori', () => {
  for (const valore of [
    'javascript:alert(1)',
    'javascript:alert(document.domain)',
    // La cifra subito dopo i due punti e' il travestimento da porta: senza
    // guardare cosa viene DOPO le cifre, questo passerebbe.
    'javascript:1;alert(document.domain)',
    'JavaScript:1;alert(document.cookie)',
    'vbscript:1;msgbox(1)',
    'data:1;text/html,x',
    'mailto:info@advaiora.com',
  ]) {
    assert.throws(
      () => normalizeWebsiteValue(valore, 'website'),
      { statusCode: 400 },
      `"${valore}" doveva essere respinto`,
    );
  }
});

test('sito web: la porta non e\' uno schema estraneo', () => {
  assert.equal(normalizeWebsiteValue('advaiora.com:8080', 'website'), 'advaiora.com:8080');
  assert.equal(
    normalizeWebsiteValue('advaiora.com:8080/contatti', 'website'),
    'advaiora.com:8080/contatti',
  );
  assert.equal(
    normalizeWebsiteValue('https://www.advaiora.com/contatti?utm=x', 'website'),
    'https://www.advaiora.com/contatti?utm=x',
  );
});
