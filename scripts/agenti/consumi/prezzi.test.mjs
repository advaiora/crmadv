// Test di prezzi.mjs (node --test, lanciati da `npm run test:scripts`).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PREZZI, PREZZO_IGNOTO, prezzoDi } from './prezzi.mjs';

describe('prezzoDi', () => {
  it('trova il listino esatto', () => {
    assert.equal(prezzoDi('claude-sonnet-5'), PREZZI['claude-sonnet-5']);
  });

  it('un modello col suffisso della data finisce sul SUO listino, non su Opus (nota #39)', () => {
    // Il caso vero del 3/8: "claude-haiku-4-5-20251001" pesato come Opus, 5 volte il vero.
    assert.equal(prezzoDi('claude-haiku-4-5-20251001'), PREZZI['claude-haiku-4-5']);
  });

  it('a parita' + ' di prefisso vince la chiave piu' + ' lunga', () => {
    // Nel listino vero nessuna chiave e' prefisso di un'altra, quindi la regola
    // si prova con un listino finto dove il confronto di lunghezza DECIDE:
    // fermarsi alla prima chiave che combacia darebbe il prezzo generico.
    const listino = {
      'claude-opus': { in: 99, out: 99 },
      'claude-opus-4-6': { in: 5, out: 25 },
    };
    assert.equal(prezzoDi('claude-opus-4-6-20250101', listino), listino['claude-opus-4-6']);
    assert.equal(prezzoDi('claude-opus-9', listino), listino['claude-opus']);
  });

  it('modello sconosciuto o mancante: prezzo di ripiego (Opus)', () => {
    assert.equal(prezzoDi('gpt-9'), PREZZO_IGNOTO);
    assert.equal(prezzoDi(''), PREZZO_IGNOTO);
    assert.equal(prezzoDi(null), PREZZO_IGNOTO);
  });
});
