// Test di aggregazioni.mjs (node --test, lanciati da `npm run test:scripts`).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FINESTRA_MS } from './config.mjs';
import { accumula, mediana, perSessione, piccoFinestra, sommaVuota } from './aggregazioni.mjs';

const chiamata = (t, peso, extra = {}) => ({
  t,
  peso,
  entrata: 10,
  uscita: 5,
  cacheScritta: 2,
  cacheLetta: 100,
  sessione: 's1',
  subagent: false,
  ...extra,
});

describe('accumula/sommaVuota', () => {
  it('somma le voci e conta le chiamate', () => {
    const acc = [chiamata(1, 1.5), chiamata(2, 2.5)].reduce(accumula, sommaVuota());
    assert.equal(acc.peso, 4);
    assert.equal(acc.entrata, 20);
    assert.equal(acc.chiamate, 2);
  });
});

describe('mediana', () => {
  it('vuoto vale 0; con valori prende quello centrale (superiore se pari)', () => {
    assert.equal(mediana([]), 0);
    assert.equal(mediana([3, 1, 2]), 2);
    assert.equal(mediana([1, 2, 3, 4]), 3);
  });

  it('non muta l\'array di partenza', () => {
    const v = [3, 1, 2];
    mediana(v);
    assert.deepEqual(v, [3, 1, 2]);
  });
});

describe('piccoFinestra', () => {
  it('trova la finestra di 5 ore piu' + ' carica, non il totale', () => {
    const ORA = 60 * 60 * 1000;
    const chiamate = [
      chiamata(0, 10),
      chiamata(1 * ORA, 10),
      // buco di piu' di 5 ore: la finestra riparte
      chiamata(10 * ORA, 30),
      chiamata(11 * ORA, 5),
    ];
    const picco = piccoFinestra(chiamate);
    assert.equal(picco.peso, 35);
    assert.equal(picco.quando, 11 * ORA);
  });

  it('una chiamata piu' + ' vecchia di 5 ore esce dal conto', () => {
    const dentro = [chiamata(0, 10), chiamata(FINESTRA_MS + 1, 8)];
    assert.equal(piccoFinestra(dentro).peso, 10);
  });
});

describe('perSessione', () => {
  it('raggruppa, somma i subagent a parte e ordina per fine', () => {
    const sessioni = perSessione([
      chiamata(5, 1, { sessione: 'b' }),
      chiamata(1, 2, { sessione: 'a' }),
      chiamata(2, 3, { sessione: 'b', subagent: true }),
      chiamata(9, 4, { sessione: 'a' }),
    ]);
    assert.deepEqual(sessioni.map((s) => s.id), ['b', 'a']);
    const b = sessioni[0];
    assert.equal(b.peso, 4);
    assert.equal(b.subagent, 3);
    assert.equal(b.inizio, 2);
    assert.equal(b.fine, 5);
  });
});
