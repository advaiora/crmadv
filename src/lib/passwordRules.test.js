import { describe, it, expect } from 'vitest';
import {
  MIN_PASSWORD_LENGTH,
  NEUTRAL_RESET_REQUEST_MESSAGE,
  resolvePasswordErrorMessage,
  validateNewPassword,
  validateResetEmail,
} from './passwordRules';

describe('validateNewPassword', () => {
  it('non segnala niente quando la password e\' lunga a sufficienza e le due coincidono', () => {
    expect(validateNewPassword('passwordnuova', 'passwordnuova')).toEqual({});
  });

  it('chiede una password quando il campo e\' vuoto', () => {
    expect(validateNewPassword('', '').newPassword).toBe('Scegli una password nuova');
  });

  it('rifiuta sotto il minimo, citando il numero di caratteri', () => {
    const errors = validateNewPassword('corta', 'corta');
    expect(errors.newPassword).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it('segnala che le due password non coincidono', () => {
    const errors = validateNewPassword('passwordnuova', 'passwordnuov');
    expect(errors.newPassword).toBeUndefined();
    expect(errors.confirmPassword).toBe('Le due password non coincidono');
  });

  it('chiede la ripetizione quando manca, senza dire che non coincidono', () => {
    const errors = validateNewPassword('passwordnuova', '');
    expect(errors.confirmPassword).toBe('Ripeti la password nuova');
  });
});

describe('validateResetEmail', () => {
  it('accetta un indirizzo valido, anche con spazi intorno', () => {
    expect(validateResetEmail('  info@advaiora.com ')).toBe('');
  });

  it('chiede l\'indirizzo quando manca', () => {
    expect(validateResetEmail('   ')).toBe('Inserisci il tuo indirizzo email');
  });

  it('rifiuta un indirizzo senza dominio', () => {
    expect(validateResetEmail('info@advaiora')).toBe('Email non valida');
  });
});

describe('resolvePasswordErrorMessage', () => {
  it('traduce i tre codici del cambio password', () => {
    expect(resolvePasswordErrorMessage({ code: 'INVALID_CURRENT_PASSWORD' }, 'ripiego'))
      .toBe('La password attuale non è corretta.');
    expect(resolvePasswordErrorMessage({ code: 'PASSWORD_UNCHANGED' }, 'ripiego'))
      .toContain('diversa da quella attuale');
    expect(resolvePasswordErrorMessage({ code: 'PASSWORD_NOT_SET' }, 'ripiego'))
      .toContain('Google');
  });

  it('traduce il token di recupero non valido', () => {
    expect(resolvePasswordErrorMessage({ code: 'INVALID_RESET_TOKEN' }, 'ripiego'))
      .toContain('non è più valido');
  });

  it('usa il messaggio del server quando il codice e\' sconosciuto', () => {
    expect(resolvePasswordErrorMessage({ code: 'BOH', message: 'Troppe richieste' }, 'ripiego'))
      .toBe('Troppe richieste');
  });

  it('cade sul ripiego quando non c\'e\' ne\' codice ne\' messaggio', () => {
    expect(resolvePasswordErrorMessage({}, 'ripiego')).toBe('ripiego');
    expect(resolvePasswordErrorMessage(null, 'ripiego')).toBe('ripiego');
  });
});

describe('NEUTRAL_RESET_REQUEST_MESSAGE', () => {
  // ⚠️ Questo test difende una scelta di sicurezza, non una formulazione: il
  // messaggio non deve mai affermare che l'email e' partita, perche' lo direbbe
  // anche per un indirizzo inesistente e rivelerebbe chi ha un account.
  it('non promette che l\'email sia stata mandata', () => {
    expect(NEUTRAL_RESET_REQUEST_MESSAGE).toContain('Se l\'indirizzo è registrato');
    expect(NEUTRAL_RESET_REQUEST_MESSAGE).not.toMatch(/ti abbiamo mandato|abbiamo inviato/i);
  });
});
