import { describe, expect, it } from 'vitest';
import { createDefaultFormValues } from './clientFormValues';
import {
  EMAIL_ERROR_MESSAGE,
  PEC_ERROR_MESSAGE,
  PHONE_ERROR_MESSAGE,
  SDI_ERROR_MESSAGE,
  validateForm,
} from './clientFormValidation';

const valori = (extra = {}) => ({ ...createDefaultFormValues(), name: 'Trattoria Da Beppe', ...extra });
const telefonoValido = { isValid: true };

describe('validateForm', () => {
  it('il nome e obbligatorio', () => {
    expect(validateForm(valori({ name: '   ' }), telefonoValido)).toHaveProperty('name');
  });

  it('un cliente col solo nome passa', () => {
    expect(validateForm(valori(), telefonoValido)).toEqual({});
  });

  it('segnala una email malformata', () => {
    expect(validateForm(valori({ email: 'non-una-email' }), telefonoValido).email).toBe(EMAIL_ERROR_MESSAGE);
  });

  it('segnala una PEC malformata, con un messaggio suo', () => {
    const errori = validateForm(valori({ pecEmail: 'non-una-pec' }), telefonoValido);

    expect(errori.pecEmail).toBe(PEC_ERROR_MESSAGE);
    // Il messaggio deve dire QUALE dei due indirizzi non va.
    expect(errori.pecEmail).not.toBe(EMAIL_ERROR_MESSAGE);
    expect(errori.email).toBeUndefined();
  });

  it('una PEC valida non da errore', () => {
    expect(validateForm(valori({ pecEmail: 'beppe@pec.it' }), telefonoValido).pecEmail).toBeUndefined();
  });

  it('la PEC vuota e ammessa: non tutti i clienti ce l hanno', () => {
    expect(validateForm(valori({ pecEmail: '  ' }), telefonoValido)).toEqual({});
  });

  it('sito web e referente non hanno vincoli di forma', () => {
    const errori = validateForm(
      valori({ website: 'qualsiasi cosa', contactPerson: 'Giuseppe Rossi' }),
      telefonoValido,
    );

    expect(errori).toEqual({});
  });

  it('accetta il codice SDI da 7 caratteri delle aziende e quello da 6 della PA', () => {
    expect(validateForm(valori({ sdiCode: 'ABC1234' }), telefonoValido).sdiCode).toBeUndefined();
    expect(validateForm(valori({ sdiCode: 'UFY9MH' }), telefonoValido).sdiCode).toBeUndefined();
  });

  it('ferma un codice SDI troncato, che altrimenti si scoprirebbe a fattura scartata', () => {
    expect(validateForm(valori({ sdiCode: 'ABC' }), telefonoValido).sdiCode).toBe(SDI_ERROR_MESSAGE);
  });

  it('ferma un codice SDI con caratteri che non esistono nel formato', () => {
    expect(validateForm(valori({ sdiCode: 'ABC-123' }), telefonoValido).sdiCode).toBe(SDI_ERROR_MESSAGE);
  });

  it('il codice SDI minuscolo e ammesso: viene reso maiuscolo, non respinto', () => {
    expect(validateForm(valori({ sdiCode: 'abc1234' }), telefonoValido).sdiCode).toBeUndefined();
  });

  it('il codice SDI vuoto e ammesso: la PEC puo bastare da sola', () => {
    expect(validateForm(valori({ sdiCode: '  ' }), telefonoValido)).toEqual({});
  });

  it('segnala un telefono che il normalizzatore rifiuta', () => {
    expect(validateForm(valori({ phone: '123' }), { isValid: false }).phone).toBe(PHONE_ERROR_MESSAGE);
  });
});
