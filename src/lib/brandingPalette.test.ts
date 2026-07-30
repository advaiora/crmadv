// Test di brandingPalette.ts — pura logica input->output, nessun DOM.
// Primo test frontend del progetto: fa anche da esempio per i prossimi.
import { describe, it, expect } from 'vitest';
import {
  BRANDING_PALETTE,
  DEFAULT_PRESET_ID,
  getDefaultPreset,
  findPresetByLightColor,
  getSelectedPresetId,
  getPresetAccents,
  suggestPresetFromColor,
} from './brandingPalette';

describe('getDefaultPreset', () => {
  it('ritorna il preset di default (blu)', () => {
    const preset = getDefaultPreset();
    expect(preset.id).toBe(DEFAULT_PRESET_ID);
    expect(preset.light).toBe('#0b5ed7');
  });
});

describe('findPresetByLightColor', () => {
  it('trova il preset dal suo colore chiaro esatto', () => {
    expect(findPresetByLightColor('#0b5ed7')?.id).toBe('blue');
    expect(findPresetByLightColor('#15803d')?.id).toBe('green');
  });

  it('normalizza maiuscole e spazi prima del confronto', () => {
    expect(findPresetByLightColor('#0B5ED7')?.id).toBe('blue');
    expect(findPresetByLightColor('  #0b5ed7  ')?.id).toBe('blue');
  });

  it('ritorna null per colori non in palette o input non validi', () => {
    expect(findPresetByLightColor('#123456')).toBeNull();
    expect(findPresetByLightColor('blu')).toBeNull();
    expect(findPresetByLightColor('#12345')).toBeNull(); // hex a 5 cifre: non valido
    expect(findPresetByLightColor(null)).toBeNull();
    expect(findPresetByLightColor(42)).toBeNull();
  });
});

describe('getSelectedPresetId', () => {
  it('ritorna l\'id del preset se il colore salvato e\' un preset, altrimenti null', () => {
    expect(getSelectedPresetId('#4f46e5')).toBe('indigo');
    expect(getSelectedPresetId('#000000')).toBeNull();
    expect(getSelectedPresetId(undefined)).toBeNull();
  });
});

describe('getPresetAccents', () => {
  it('per un colore preset ritorna la coppia curata chiaro/scuro', () => {
    expect(getPresetAccents('#0b5ed7')).toEqual({ light: '#0b5ed7', dark: '#6ea8fe' });
  });

  it('per un colore libero (workspace legacy) usa lo stesso valore nei due temi', () => {
    expect(getPresetAccents('#123456')).toEqual({ light: '#123456', dark: '#123456' });
  });

  it('espande gli hex a 3 cifre', () => {
    expect(getPresetAccents('#abc')).toEqual({ light: '#aabbcc', dark: '#aabbcc' });
  });

  it('per input non valido ripiega sul colore chiaro di default per entrambi i temi', () => {
    // Comportamento attuale documentato: il fallback NON usa la coppia curata del
    // preset di default, ma il suo solo colore chiaro per entrambi i temi.
    expect(getPresetAccents(null)).toEqual({ light: '#0b5ed7', dark: '#0b5ed7' });
  });
});

describe('suggestPresetFromColor', () => {
  it('suggerisce il preset con la tinta piu\' vicina', () => {
    expect(suggestPresetFromColor('#ff0000').id).toBe('red');
    expect(suggestPresetFromColor('#00ff00').id).toBe('green');
  });

  it('suggerisce Grafite per colori quasi acromatici (grigi)', () => {
    expect(suggestPresetFromColor('#808080').id).toBe('graphite');
    expect(suggestPresetFromColor('#111111').id).toBe('graphite');
  });

  it('ripiega sul default per input non validi', () => {
    expect(suggestPresetFromColor(null).id).toBe(DEFAULT_PRESET_ID);
    expect(suggestPresetFromColor('non-un-colore').id).toBe(DEFAULT_PRESET_ID);
  });

  it('ritorna sempre un preset della palette', () => {
    const ids = BRANDING_PALETTE.map((p) => p.id);
    expect(ids).toContain(suggestPresetFromColor('#fa8072').id); // salmon
    expect(ids).toContain(suggestPresetFromColor('#40e0d0').id); // turchese
  });
});
