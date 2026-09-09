import { describe, expect, it } from 'vitest';
import {
  buildClientPayload,
  createDefaultFormValues,
  mapClientToFormValues,
  normalizeOptional,
} from './clientFormValues';

describe('clientFormValues', () => {
  it('senza cliente parte da valori vuoti, compresi i quattro campi nuovi', () => {
    const valori = mapClientToFormValues(null);

    expect(valori).toEqual(createDefaultFormValues());
    expect(valori.pecEmail).toBe('');
    expect(valori.sdiCode).toBe('');
    expect(valori.website).toBe('');
    expect(valori.contactPerson).toBe('');
  });

  it('rilegge dal cliente i quattro campi nuovi', () => {
    const valori = mapClientToFormValues({
      name: 'Trattoria Da Beppe',
      pecEmail: 'beppe@pec.it',
      sdiCode: 'ABC1234',
      website: 'www.dabeppe.it',
      contactPerson: 'Giuseppe Rossi',
    });

    expect(valori).toMatchObject({
      pecEmail: 'beppe@pec.it',
      sdiCode: 'ABC1234',
      website: 'www.dabeppe.it',
      contactPerson: 'Giuseppe Rossi',
    });
  });

  it('un cliente che non ha i campi nuovi non produce undefined a schermo', () => {
    const valori = mapClientToFormValues({ name: 'Cliente vecchio' });

    expect(valori.pecEmail).toBe('');
    expect(valori.sdiCode).toBe('');
    expect(valori.website).toBe('');
    expect(valori.contactPerson).toBe('');
  });

  it('normalizeOptional taglia gli spazi e trasforma il vuoto in null', () => {
    expect(normalizeOptional('  ciao  ')).toBe('ciao');
    expect(normalizeOptional('   ')).toBeNull();
    expect(normalizeOptional(undefined)).toBeNull();
  });

  describe('buildClientPayload', () => {
    const valoriPieni = () => ({
      ...createDefaultFormValues(),
      name: '  Trattoria Da Beppe  ',
      pecEmail: '  Beppe@PEC.it ',
      sdiCode: ' abc1234 ',
      website: '  www.dabeppe.it ',
      contactPerson: '  Giuseppe Rossi ',
    });

    it('porta i quattro campi nuovi nel corpo della richiesta', () => {
      expect(buildClientPayload(valoriPieni())).toMatchObject({
        name: 'Trattoria Da Beppe',
        pecEmail: 'beppe@pec.it',
        sdiCode: 'ABC1234',
        website: 'www.dabeppe.it',
        contactPerson: 'Giuseppe Rossi',
      });
    });

    it('i campi nuovi lasciati vuoti partono come null, non come stringa vuota', () => {
      const payload = buildClientPayload(createDefaultFormValues());

      expect(payload.pecEmail).toBeNull();
      expect(payload.sdiCode).toBeNull();
      expect(payload.website).toBeNull();
      expect(payload.contactPerson).toBeNull();
    });

    // Rete contro il buco tipico di questi campi: aggiungerli allo schema e
    // dimenticarli in uno degli elenchi espliciti che stanno per strada.
    it('nomina tutti i campi che il form sa compilare', () => {
      const payload = buildClientPayload(createDefaultFormValues());
      const attesi = Object.keys(createDefaultFormValues());

      expect(Object.keys(payload).sort()).toEqual(attesi.sort());
    });
  });
});
