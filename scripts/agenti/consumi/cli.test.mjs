// Test di cli.mjs (node --test, lanciati da `npm run test:scripts`).
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { argomentiValidi, opzioneSenzaValore, oraIndicata, valoreDi } from './cli.mjs';

describe('valoreDi', () => {
  it('distingue "non chiesta" (null) da "chiesta senza valore" (undefined)', () => {
    assert.equal(valoreDi([], '--da'), null);
    assert.equal(valoreDi(['--da'], '--da'), undefined);
    assert.equal(valoreDi(['--da', '--a'], '--da'), undefined); // il valore non puo' essere un'altra opzione
    assert.equal(valoreDi(['--da', '10:30'], '--da'), '10:30');
  });
});

describe('opzioneSenzaValore', () => {
  it('trova la prima opzione usata ma rimasta senza valore', () => {
    assert.equal(opzioneSenzaValore(['--compito', 'x', '--da'], ['--compito', '--da']), '--da');
    assert.equal(opzioneSenzaValore(['--compito', 'x'], ['--compito', '--da']), null);
  });
});

describe('oraIndicata', () => {
  // Mezzogiorno locale di un giorno qualsiasi: cosi' i test non dipendono dal fuso.
  const adesso = new Date(2026, 7, 3, 12, 0, 0, 0).getTime();

  it('"14:30" vale oggi a quell\'ora del computer', () => {
    const atteso = new Date(2026, 7, 3, 14, 30, 0, 0).getTime();
    assert.equal(oraIndicata('14:30', adesso), atteso);
  });

  it('una data ISO intera passa da Date.parse', () => {
    assert.equal(oraIndicata('2026-07-31T09:50Z', adesso), Date.parse('2026-07-31T09:50Z'));
  });

  it('niente richiesta → null; testo incomprensibile o ora impossibile → undefined', () => {
    assert.equal(oraIndicata(null, adesso), null);
    assert.equal(oraIndicata('', adesso), null);
    assert.equal(oraIndicata('99:99', adesso), undefined);
    assert.equal(oraIndicata('non-e-una-data', adesso), undefined);
  });
});

describe('argomentiValidi', () => {
  // La funzione spiega l'errore su console.error: nei test la si mette a tacere
  // per non sporcare l'uscita, controllando solo il si'/no.
  let errorOriginale;
  beforeEach(() => {
    errorOriginale = console.error;
    console.error = () => {};
  });
  afterEach(() => {
    console.error = errorOriginale;
  });

  it('passa senza argomenti e con le combinazioni complete', () => {
    assert.equal(argomentiValidi([]), true);
    assert.equal(argomentiValidi(['--tecnico']), true);
    assert.equal(argomentiValidi(['--compito', 'x', '--da', '10:00', '--a', '11:00']), true);
  });

  it('si ferma su un\'opzione senza valore', () => {
    assert.equal(argomentiValidi(['--compito']), false);
    assert.equal(argomentiValidi(['--finestra-a']), false);
  });

  it('--da/--a da soli non vogliono dire niente', () => {
    assert.equal(argomentiValidi(['--da', '10:00']), false);
    assert.equal(argomentiValidi(['--a', '11:00']), false);
  });
});
