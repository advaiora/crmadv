import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkText } from './sources.rag.js';

test('chunkText: testo vuoto o solo spazi → nessun blocco', () => {
  assert.deepEqual(chunkText(''), []);
  assert.deepEqual(chunkText('   \n  '), []);
});

test('chunkText: testo corto → un solo blocco (trim applicato)', () => {
  assert.deepEqual(chunkText('  ciao mondo  '), ['ciao mondo']);
});

test('chunkText: testo lungo → più blocchi entro maxChars', () => {
  const parola = 'lorem ';
  const testo = parola.repeat(400); // ~2400 caratteri
  const chunks = chunkText(testo, { maxChars: 500, overlap: 50 });
  assert.ok(chunks.length > 1, 'deve produrre più di un blocco');
  for (const c of chunks) {
    assert.ok(c.length <= 500, `blocco troppo lungo: ${c.length}`);
    assert.equal(c, c.trim(), 'blocco non deve avere spazi ai bordi');
  }
});

test('chunkText: la sovrapposizione mantiene continuità tra blocchi', () => {
  // Parole distinte così da verificare che la coda di un blocco ricompaia nel successivo.
  const parole = Array.from({ length: 200 }, (_, i) => `w${i}`).join(' ');
  const chunks = chunkText(parole, { maxChars: 300, overlap: 60 });
  assert.ok(chunks.length >= 2);
  const codaPrimo = chunks[0].split(' ').slice(-3);
  // almeno una delle ultime parole del primo blocco deve comparire nel secondo
  assert.ok(
    codaPrimo.some((w) => chunks[1].includes(w)),
    'la sovrapposizione dovrebbe riportare parte della coda del blocco precedente',
  );
});

test('chunkText: taglia preferendo gli spazi (nessuna parola spezzata a metà)', () => {
  const parole = Array.from({ length: 100 }, () => 'parola').join(' ');
  const chunks = chunkText(parole, { maxChars: 250, overlap: 20 });
  for (const c of chunks) {
    // ogni token deve essere la parola intera, mai un frammento
    for (const token of c.split(' ')) {
      assert.equal(token, 'parola', `token spezzato: "${token}"`);
    }
  }
});
