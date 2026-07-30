// Test di brandingColors.js — conversioni colore pure (hex/rgb -> rgba/numero amCharts).
// readBrandingColor (che legge dal DOM) non si testa qui: dipende dai CSS reali.
import { describe, it, expect } from 'vitest';
import { colorToRgbaString, colorToAm5Number } from './brandingColors';

describe('colorToRgbaString', () => {
  it('converte un hex a 6 cifre', () => {
    expect(colorToRgbaString('#0b5ed7', 0.5)).toBe('rgba(11, 94, 215, 0.5)');
  });

  it('espande gli hex a 3 cifre', () => {
    expect(colorToRgbaString('#fff', 1)).toBe('rgba(255, 255, 255, 1)');
  });

  it('accetta stringhe rgb()/rgba() e scarta il canale alpha in ingresso', () => {
    expect(colorToRgbaString('rgb(10, 20, 30)', 0.2)).toBe('rgba(10, 20, 30, 0.2)');
    expect(colorToRgbaString('rgba(10, 20, 30, 0.9)', 0.4)).toBe('rgba(10, 20, 30, 0.4)');
  });

  it('blocca i canali rgb fuori scala dentro 0-255', () => {
    expect(colorToRgbaString('rgb(300, -5, 128)', 1)).toBe('rgba(255, 0, 128, 1)');
  });

  it('blocca l\'alpha dentro 0-1', () => {
    expect(colorToRgbaString('#000000', 5)).toBe('rgba(0, 0, 0, 1)');
    expect(colorToRgbaString('#000000', -3)).toBe('rgba(0, 0, 0, 0)');
  });

  it('per colori non validi usa il fallback (default Bootstrap o esplicito)', () => {
    expect(colorToRgbaString('boh', 1)).toBe('rgba(13, 110, 253, 1)'); // #0d6efd
    expect(colorToRgbaString(null, 1, '#ff0000')).toBe('rgba(255, 0, 0, 1)');
    // Anche il fallback esplicito, se non valido, ripiega sul default.
    expect(colorToRgbaString('boh', 1, 'pure-boh')).toBe('rgba(13, 110, 253, 1)');
  });
});

describe('colorToAm5Number', () => {
  it('converte un hex nel numero intero che amCharts si aspetta', () => {
    expect(colorToAm5Number('#ffffff')).toBe(0xffffff);
    expect(colorToAm5Number('#0b5ed7')).toBe(0x0b5ed7);
    expect(colorToAm5Number('#000')).toBe(0);
  });

  it('per colori non validi usa il fallback', () => {
    expect(colorToAm5Number('boh')).toBe(0x0d6efd);
    expect(colorToAm5Number(undefined, '#00ff00')).toBe(0x00ff00);
  });
});
