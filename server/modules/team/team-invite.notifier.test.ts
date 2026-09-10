import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTeamInviteNotifier } from './team-invite.notifier.js';
import type { InvioDiPosta } from '../../core/send-mail.js';

// I tre esiti della posta devono restare TRE fino a schermo. E' la parte che si
// perde per prima: basta rimettere un `if (!canale)` al posto del confronto
// sull'esito e i guasti tornano a collassare tutti su "server non configurato",
// mandando chi amministra a riconfigurare una posta che era gia' giusta.

const INVITO = {
  toEmail: 'nuova.persona@esempio.it',
  workspaceId: 'ws-1',
  workspaceName: 'Studio',
  invitedByName: 'Giulia',
  inviteLink: 'https://crm.esempio.it/accept-invite?token=abc',
  expiresAt: new Date('2026-09-01T00:00:00.000Z'),
};

test('configurazione illeggibile: causa sua, non "non configurato"', async () => {
  const notifier = buildTeamInviteNotifier({
    sendMailFn: async () => ({ esito: 'illeggibile' }),
  });

  const esito = await notifier.sendInvite(INVITO);

  assert.equal(esito.delivered, false);
  assert.equal(esito.reason, 'MAIL_CONFIG_UNREADABLE');
});

test('nessuna configurazione: MAIL_NOT_CONFIGURED', async () => {
  const notifier = buildTeamInviteNotifier({
    sendMailFn: async () => ({ esito: 'non-configurata' }),
  });

  const esito = await notifier.sendInvite(INVITO);

  assert.equal(esito.delivered, false);
  assert.equal(esito.reason, 'MAIL_NOT_CONFIGURED');
});

test('il server rifiuta il messaggio: SEND_FAILED', async () => {
  const notifier = buildTeamInviteNotifier({
    sendMailFn: async () => ({
      esito: 'rifiutata',
      errore: new Error('550 mailbox unavailable'),
    }),
  });

  const esito = await notifier.sendInvite(INVITO);

  assert.equal(esito.delivered, false);
  assert.equal(esito.reason, 'SEND_FAILED');
});

test('il workspace arriva al canale: senza, si spedirebbe sempre dal server sbagliato', async () => {
  const workspaceRicevuti: Array<string | null | undefined> = [];
  const notifier = buildTeamInviteNotifier({
    sendMailFn: async (input) => {
      workspaceRicevuti.push(input.workspaceId);
      return {
        esito: 'inviata',
        source: 'database',
        recapitata: true,
        providerMessageId: 'id-1',
        previewUrl: null,
      };
    },
  });

  const esito = await notifier.sendInvite(INVITO);

  assert.deepEqual(workspaceRicevuti, ['ws-1']);
  assert.equal(esito.delivered, true);
  assert.equal(esito.providerMessageId, 'id-1');
});

// La prova che si puo' eseguire oggi, senza credenziali SMTP: col trasporto
// finto si controlla che il messaggio dell'invito sia proprio quello che
// dovrebbe essere. Il giorno in cui arriveranno le credenziali, questo test
// dice gia' che cosa uscira' dalla casella.
test('invito al Team: destinatario, oggetto e corpo del messaggio', async () => {
  const spediti: InvioDiPosta[] = [];
  const notifier = buildTeamInviteNotifier({
    sendMailFn: async (input) => {
      spediti.push(input);
      return {
        esito: 'inviata',
        source: 'env',
        recapitata: true,
        providerMessageId: 'id-1',
        previewUrl: null,
      };
    },
  });

  await notifier.sendInvite(INVITO);

  assert.equal(spediti.length, 1);
  const { messaggio } = spediti[0];
  assert.equal(messaggio.to, 'nuova.persona@esempio.it');
  assert.equal(messaggio.subject, 'Invito al workspace Studio');
  assert.equal(
    messaggio.text,
    [
      'Ciao,',
      '',
      'Giulia ti ha invitato al workspace "Studio".',
      "Accetta l'invito: https://crm.esempio.it/accept-invite?token=abc",
      'Scadenza invito: 2026-09-01',
    ].join('\n'),
  );
  // Posta di servizio: in sviluppo, senza server, deve poter ripiegare sul
  // trasporto finto invece di bloccare chi sta collaudando.
  assert.equal(spediti[0].ripiegoDiSviluppo, true);
});

test('casella finta di sviluppo (Ethereal): "inviata" con il link per leggerla', async () => {
  const notifier = buildTeamInviteNotifier({
    sendMailFn: async () => ({
      esito: 'inviata',
      source: 'ethereal',
      recapitata: false,
      providerMessageId: 'id-1',
      previewUrl: 'https://ethereal.email/message/abc',
    }),
  });

  const esito = await notifier.sendInvite(INVITO);

  assert.equal(esito.delivered, true);
  assert.equal(esito.previewUrl, 'https://ethereal.email/message/abc');
});

test('trasporto dei log: NON si annuncia "email inviata" a chi ha invitato', async () => {
  const notifier = buildTeamInviteNotifier({
    sendMailFn: async () => ({
      esito: 'inviata',
      source: 'log',
      recapitata: false,
      providerMessageId: 'id-1',
      previewUrl: null,
    }),
  });

  const esito = await notifier.sendInvite(INVITO);

  // Il messaggio esiste solo nei log del server: chi ha invitato non ha niente
  // da aprire. Dirgli "inviata" sarebbe la bugia che il modulo previene — e con
  // `delivered: false` il servizio gli restituisce il link d'invito, con cui
  // fa entrare la persona lo stesso.
  assert.equal(esito.delivered, false);
  assert.equal(esito.reason, 'MAIL_NOT_CONFIGURED');
});
