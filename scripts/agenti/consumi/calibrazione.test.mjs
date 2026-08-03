// Test di calibrazione.mjs (node --test, lanciati da `npm run test:scripts`).
// Si prova solo stimaPercentuale, che e' pura; leggiCalibrazione legge il file
// vero del progetto e si verifica a mano col quadro.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stimaPercentuale } from './calibrazione.mjs';

describe('stimaPercentuale', () => {
  it('sotto i due campioni non si sbilancia', () => {
    assert.equal(stimaPercentuale([], 100), null);
    assert.equal(stimaPercentuale([{ peso: 80, percentuale: 10 }], 100), null);
  });

  it('k e' + ' la media dei rapporti percentuale/peso', () => {
    const stima = stimaPercentuale(
      [
        { peso: 100, percentuale: 10 }, // rapporto 0,10
        { peso: 100, percentuale: 20 }, // rapporto 0,20
      ],
      200,
    );
    assert.ok(Math.abs(stima.k - 0.15) < 1e-9);
    assert.ok(Math.abs(stima.percentuale - 30) < 1e-9);
    assert.equal(stima.campioni, 2);
  });

  it('lo scarto medio dice quanto i campioni si discostano dalla retta', () => {
    const stima = stimaPercentuale(
      [
        { peso: 100, percentuale: 10 },
        { peso: 100, percentuale: 20 },
      ],
      0,
    );
    // k = 0,15: ogni campione dista 5 punti dalla retta.
    assert.ok(Math.abs(stima.scartoMedio - 5) < 1e-9);
  });
});
