import { describe, expect, it } from 'vitest';
import { describeInviteDelivery, INVITE_DELIVERY_TONE } from './inviteDelivery.js';

describe('describeInviteDelivery', () => {
  it('conferma senza allarmi quando l email e partita', () => {
    const result = describeInviteDelivery({ emailSent: true }, { hasLink: false });

    expect(result.tone).toBe(INVITE_DELIVERY_TONE.ok);
    expect(result.title).toContain('email inviata');
    expect(result.showLink).toBe(false);
  });

  it('non mostra il link quando l email e partita, anche se il link ci fosse', () => {
    const result = describeInviteDelivery({ emailSent: true }, { hasLink: true });

    expect(result.showLink).toBe(false);
  });

  it('avvisa e offre il link quando manca il server di posta', () => {
    const result = describeInviteDelivery(
      { emailSent: false, reason: 'MAIL_NOT_CONFIGURED' },
      { hasLink: true },
    );

    expect(result.tone).toBe(INVITE_DELIVERY_TONE.warning);
    expect(result.detail).toContain('non è ancora configurato');
    expect(result.showLink).toBe(true);
  });

  it('distingue il rifiuto del server dal server mancante', () => {
    const notConfigured = describeInviteDelivery({ emailSent: false, reason: 'MAIL_NOT_CONFIGURED' });
    const sendFailed = describeInviteDelivery({ emailSent: false, reason: 'SEND_FAILED' });

    expect(sendFailed.detail).not.toBe(notConfigured.detail);
    expect(sendFailed.detail).toContain('rifiutato');
  });

  it('dice che l invito non e utilizzabile quando manca l indirizzo pubblico', () => {
    const result = describeInviteDelivery(
      { emailSent: false, reason: 'INVITE_LINK_UNAVAILABLE' },
      { hasLink: false },
    );

    expect(result.tone).toBe(INVITE_DELIVERY_TONE.warning);
    expect(result.title).toContain('non è utilizzabile');
    expect(result.showLink).toBe(false);
  });

  it('resta prudente su una causa che non conosce', () => {
    const result = describeInviteDelivery(
      { emailSent: false, reason: 'QUALCOSA_DI_NUOVO' },
      { hasLink: true },
    );

    expect(result.tone).toBe(INVITE_DELIVERY_TONE.warning);
    expect(result.showLink).toBe(true);
  });

  it('non inventa un esito se la risposta non lo contiene', () => {
    const result = describeInviteDelivery(undefined, { hasLink: true });

    expect(result.tone).toBe(INVITE_DELIVERY_TONE.ok);
    expect(result.detail).toBe('');
  });
});

describe('describeInviteDelivery — configurazione illeggibile', () => {
  it('manda a reinserire la password, non a configurare il server da capo', () => {
    const result = describeInviteDelivery(
      { emailSent: false, reason: 'MAIL_CONFIG_UNREADABLE' },
      { hasLink: true },
    );

    expect(result.tone).toBe(INVITE_DELIVERY_TONE.warning);
    expect(result.detail).toContain('password');
    expect(result.showLink).toBe(true);
  });

  it('non dice la stessa cosa del server mancante', () => {
    const illeggibile = describeInviteDelivery(
      { emailSent: false, reason: 'MAIL_CONFIG_UNREADABLE' },
      { hasLink: true },
    );
    const mancante = describeInviteDelivery(
      { emailSent: false, reason: 'MAIL_NOT_CONFIGURED' },
      { hasLink: true },
    );

    // Se i due messaggi tornassero identici, la distinzione introdotta il
    // 18/8/2026 sarebbe stata riassorbita senza che nessuno se ne accorga.
    expect(illeggibile.detail).not.toBe(mancante.detail);
  });
});
