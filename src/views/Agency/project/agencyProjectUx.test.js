import { describe, expect, it } from 'vitest';
import {
  EMPTY_FIELD_LABEL,
  formatDateTime,
  getInputQualityTone,
  hasReadableValue,
  isAiUnavailable,
  readableValue,
} from './agencyProjectUx';

describe('formatDateTime', () => {
  it('scrive data e ora in italiano', () => {
    expect(formatDateTime('2026-08-06T09:30:00.000Z')).toMatch(/06\/08\/2026/);
  });

  it('senza valore usa "Da completare"', () => {
    expect(formatDateTime(null)).toBe(EMPTY_FIELD_LABEL);
    expect(formatDateTime('')).toBe(EMPTY_FIELD_LABEL);
  });

  it('accetta un ripiego su misura', () => {
    // Il report che legge il cliente dice "Non disponibile", non "Da completare":
    // e' testo che finisce sotto gli occhi di chi non lavora al progetto.
    expect(formatDateTime(null, 'Non disponibile')).toBe('Non disponibile');
  });

  it('il ripiego non cambia il comportamento quando la data c\'e\'', () => {
    const conRipiego = formatDateTime('2026-08-06T09:30:00.000Z', 'Non disponibile');
    expect(conRipiego).toBe(formatDateTime('2026-08-06T09:30:00.000Z'));
  });

  it('se non e\' una data restituisce il valore grezzo, non il ripiego', () => {
    // Meglio mostrare quello che e' arrivato che nasconderlo dietro un'etichetta.
    expect(formatDateTime('domani', 'Non disponibile')).toBe('domani');
  });
});

describe('readableValue', () => {
  it('unisce le liste e scarta i vuoti', () => {
    expect(readableValue(['Web', '', 'Ads'])).toBe('Web | Ads');
  });

  it('ripiega su "Da completare" per vuoti, spazi e "n/a"', () => {
    expect(readableValue(null)).toBe(EMPTY_FIELD_LABEL);
    expect(readableValue('   ')).toBe(EMPTY_FIELD_LABEL);
    expect(readableValue('N/A')).toBe(EMPTY_FIELD_LABEL);
    expect(readableValue([])).toBe(EMPTY_FIELD_LABEL);
  });

  it('accetta un ripiego su misura', () => {
    expect(readableValue(null, 'Nessuno')).toBe('Nessuno');
  });
});

describe('hasReadableValue', () => {
  it('distingue un valore vero da uno vuoto', () => {
    expect(hasReadableValue('Milano')).toBe(true);
    expect(hasReadableValue('n/a')).toBe(false);
    expect(hasReadableValue([])).toBe(false);
  });
});

describe('isAiUnavailable', () => {
  it('blocca solo quando il server lo dichiara', () => {
    expect(isAiUnavailable({ configured: false })).toBe(true);
    expect(isAiUnavailable({ status: 'not_configured' })).toBe(true);
  });

  it('con lo stato non ancora arrivato non blocca niente', () => {
    // Si prova comunque: semmai fallisce la chiamata vera.
    expect(isAiUnavailable(null)).toBe(false);
    expect(isAiUnavailable(undefined)).toBe(false);
    expect(isAiUnavailable({ configured: true })).toBe(false);
  });
});

describe('getInputQualityTone', () => {
  it('cambia tono al crescere delle cose mancanti', () => {
    expect(getInputQualityTone(0).variant).toBe('success');
    expect(getInputQualityTone(2).variant).toBe('warning');
    expect(getInputQualityTone(3).variant).toBe('danger');
  });
});
