import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTeamInviteNotifier } from './team-invite.notifier.js';

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
    resolveTransportFn: async () => ({ esito: 'illeggibile' }),
  });

  const esito = await notifier.sendInvite(INVITO);

  assert.equal(esito.delivered, false);
  assert.equal(esito.reason, 'MAIL_CONFIG_UNREADABLE');
});

test('nessuna configurazione: MAIL_NOT_CONFIGURED', async () => {
  const notifier = buildTeamInviteNotifier({
    resolveTransportFn: async () => ({ esito: 'assente' }),
  });

  const esito = await notifier.sendInvite(INVITO);

  assert.equal(esito.delivered, false);
  assert.equal(esito.reason, 'MAIL_NOT_CONFIGURED');
});

test('il server rifiuta il messaggio: SEND_FAILED', async () => {
  const notifier = buildTeamInviteNotifier({
    resolveTransportFn: async () => ({
      esito: 'ok',
      from: 'noreply@esempio.it',
      source: 'database',
      transport: {
        sendMail: async () => {
          throw new Error('550 mailbox unavailable');
        },
      } as never,
    }),
  });

  const esito = await notifier.sendInvite(INVITO);

  assert.equal(esito.delivered, false);
  assert.equal(esito.reason, 'SEND_FAILED');
});

test('il workspace arriva al canale: senza, si spedirebbe sempre dal server sbagliato', async () => {
  const workspaceRicevuti: string[] = [];
  const notifier = buildTeamInviteNotifier({
    resolveTransportFn: async (workspaceId) => {
      workspaceRicevuti.push(workspaceId);
      return {
        esito: 'ok',
        from: 'noreply@esempio.it',
        source: 'database',
        transport: { sendMail: async () => ({ messageId: 'id-1' }) } as never,
      };
    },
  });

  const esito = await notifier.sendInvite(INVITO);

  assert.deepEqual(workspaceRicevuti, ['ws-1']);
  assert.equal(esito.delivered, true);
  assert.equal(esito.providerMessageId, 'id-1');
});
