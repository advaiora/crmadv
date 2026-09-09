import assert from 'node:assert/strict';
import test from 'node:test';
import { RESET_PURGE_RETENTION_MS, purgeStaleResetTokens } from './password-reset.purge.js';
import { RESET_IP_DB_WINDOW_MS } from './password-reset.service.js';

// Le prove della purga presa da sola. Che venga davvero chiamata a ogni
// richiesta — e per tutti e due i rami, quello con l'utente e quello senza — e'
// provato in `password-reset.service.test.ts`: sono due cose diverse e servono
// tutte e due.

const ADESSO = new Date('2026-09-09T10:00:00.000Z');

// ⚠️ La prova che tiene separate le due cose che vivono sulla stessa tabella:
// il tetto per indirizzo IP CONTA le righe recenti, la purga le CANCELLA. Se il
// taglio della purga entrasse nella finestra del tetto, la pulizia azzererebbe
// il contatore proprio a chi sta abusando della rotta pubblica — cioe' la
// manutenzione smonterebbe la difesa, in silenzio.
test('il taglio della purga sta oltre la finestra del tetto per indirizzo IP', () => {
  assert.equal(RESET_PURGE_RETENTION_MS > RESET_IP_DB_WINDOW_MS, true);
});

test('la purga cancella tutto cio che e scaduto da piu di 24 ore', async () => {
  const chiamate: Array<{ expiredBefore: Date }> = [];

  await purgeStaleResetTokens({
    repository: {
      purgeExpired: async (input) => {
        chiamate.push(input);
        return 3;
      },
    },
    now: ADESSO,
  });

  assert.equal(chiamate.length, 1);
  assert.equal(
    ADESSO.getTime() - chiamate[0].expiredBefore.getTime(),
    RESET_PURGE_RETENTION_MS,
  );
});

test('un errore del database non esce dalla purga, ma finisce nel log', async () => {
  const avvisi: string[] = [];

  await purgeStaleResetTokens({
    repository: {
      purgeExpired: async () => {
        throw new Error('database non raggiungibile');
      },
    },
    now: ADESSO,
    // Solo `log.warn` viene usato: il resto di `FastifyRequest` qui non serve.
    request: { log: { warn: (_dati: unknown, messaggio: string) => avvisi.push(messaggio) } } as never,
  });

  // Se l'errore uscisse, questa riga non verrebbe mai raggiunta: e' la prova
  // che una pulizia andata storta non fa fallire il recupero password.
  assert.equal(avvisi.length, 1);
  assert.match(avvisi[0], /Purga dei token di recupero password non riuscita/);
});
