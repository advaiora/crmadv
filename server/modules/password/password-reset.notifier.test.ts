import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPasswordResetNotifier } from './password-reset.notifier.js';

// Le prove dello spedizioniere. Contano piu' di quanto sembri: quando l'email
// non arriva, il `reason` che questo file restituisce e' l'UNICA cosa che resta
// nel registro attivita' per capire perche'. Un ritorno sbagliato qui diventa
// una diagnosi sbagliata la sera in cui qualcuno non riesce a rientrare.

const SCADENZA = new Date(Date.now() + 30 * 60 * 1000);

const inputDiProva = {
  toEmail: 'utente@esempio.it',
  resetLink: 'https://crm.esempio.it/reset-password?token=abc',
  expiresAt: SCADENZA,
};

const canaleFinto = (input: {
  onSendMail?: (payload: Record<string, unknown>) => Promise<unknown>;
  source?: string;
} = {}) => {
  const inviate: Array<Record<string, unknown>> = [];

  return {
    inviate,
    resolveTransportFn: async () => ({
      esito: 'ok' as const,
      from: 'crm@esempio.it',
      source: input.source ?? 'smtp',
      transport: {
        sendMail: async (payload: Record<string, unknown>) => {
          inviate.push(payload);
          if (input.onSendMail) {
            return input.onSendMail(payload);
          }

          return { messageId: 'msg-1' };
        },
      },
    }),
  };
};

test('col canale configurato manda il messaggio e torna consegnato', async () => {
  const canale = canaleFinto();
  const notifier = buildPasswordResetNotifier({
    resolveTransportFn: canale.resolveTransportFn as never,
  });

  const esito = await notifier.sendResetLink(inputDiProva);

  assert.equal(esito.delivered, true);
  assert.equal(esito.providerMessageId, 'msg-1');
  assert.equal(canale.inviate.length, 1);
  assert.equal(canale.inviate[0].to, 'utente@esempio.it');
});

test('il link finisce nel corpo del messaggio, altrimenti non serve a niente', async () => {
  const canale = canaleFinto();
  const notifier = buildPasswordResetNotifier({
    resolveTransportFn: canale.resolveTransportFn as never,
  });

  await notifier.sendResetLink(inputDiProva);

  assert.equal(String(canale.inviate[0].text).includes(inputDiProva.resetLink), true);
});

test('il messaggio dice per quanto vale il link, in minuti', async () => {
  const canale = canaleFinto();
  const notifier = buildPasswordResetNotifier({
    resolveTransportFn: canale.resolveTransportFn as never,
  });

  await notifier.sendResetLink(inputDiProva);

  // 30 minuti di scadenza: il testo deve dirlo, perche' e' l'unica cosa che
  // spiega a chi legge perche' il link fra un'ora non funzionera' piu'.
  assert.equal(String(canale.inviate[0].text).includes('30 minuti'), true);
});

test('il messaggio dice che ignorarlo non cambia la password', async () => {
  const canale = canaleFinto();
  const notifier = buildPasswordResetNotifier({
    resolveTransportFn: canale.resolveTransportFn as never,
  });

  await notifier.sendResetLink(inputDiProva);

  // Chi riceve un recupero che non ha chiesto deve poter capire subito che non
  // gli e' successo niente: e' l'unica difesa contro il panico.
  assert.equal(String(canale.inviate[0].text).includes('ignora questo messaggio'), true);
});

test('senza canale di posta configurato non lancia: dice perche', async () => {
  const notifier = buildPasswordResetNotifier({
    resolveTransportFn: (async () => ({ esito: 'assente' })) as never,
  });

  const esito = await notifier.sendResetLink(inputDiProva);

  assert.deepEqual(esito, { delivered: false, reason: 'MAIL_NOT_CONFIGURED' });
});

test('con la configurazione di posta illeggibile lo distingue da assente', async () => {
  const notifier = buildPasswordResetNotifier({
    resolveTransportFn: (async () => ({ esito: 'illeggibile' })) as never,
  });

  const esito = await notifier.sendResetLink(inputDiProva);

  // Due guasti diversi: «non l'hanno mai configurata» e «c'e' ma non si legge»
  // si risolvono in due modi diversi, e il registro deve poterli distinguere.
  assert.deepEqual(esito, { delivered: false, reason: 'MAIL_CONFIG_UNREADABLE' });
});

test('se la spedizione fallisce lo dice, invece di lasciar salire l errore', async () => {
  const canale = canaleFinto({
    onSendMail: async () => {
      throw new Error('il server di posta ha chiuso la porta in faccia');
    },
  });
  const notifier = buildPasswordResetNotifier({
    resolveTransportFn: canale.resolveTransportFn as never,
  });

  const esito = await notifier.sendResetLink(inputDiProva);

  // ⚠️ Non deve MAI lanciare: un errore che sale farebbe rispondere alla rotta
  // in modo diverso a seconda che l'indirizzo esista, cioe' rimetterebbe in
  // piedi proprio l'oracolo che il servizio si preoccupa di chiudere.
  assert.deepEqual(esito, { delivered: false, reason: 'SEND_FAILED' });
});

test('un messageId vuoto diventa null invece di una stringa vuota', async () => {
  const canale = canaleFinto({ onSendMail: async () => ({ messageId: '   ' }) });
  const notifier = buildPasswordResetNotifier({
    resolveTransportFn: canale.resolveTransportFn as never,
  });

  const esito = await notifier.sendResetLink(inputDiProva);

  assert.equal(esito.delivered, true);
  assert.equal(esito.providerMessageId, null);
});

test('l indirizzo dell anteprima esce solo con la casella finta di sviluppo', async () => {
  const conSmtp = buildPasswordResetNotifier({
    resolveTransportFn: canaleFinto({ source: 'smtp' }).resolveTransportFn as never,
  });
  const conEthereal = buildPasswordResetNotifier({
    resolveTransportFn: canaleFinto({ source: 'ethereal' }).resolveTransportFn as never,
  });

  // Con un server di posta vero il campo non deve proprio esserci: e' un
  // indirizzo pubblico che mostrerebbe il contenuto del messaggio.
  assert.equal('previewUrl' in (await conSmtp.sendResetLink(inputDiProva)), false);
  assert.equal('previewUrl' in (await conEthereal.sendResetLink(inputDiProva)), true);
});
