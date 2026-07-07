// Palette curata degli accenti di workspace.
//
// Ogni tinta ha DUE valori espliciti, decisi e pre-validati a mano:
// - `light`: usata in tema chiaro (abbastanza scura da superare il contrasto
//   WCAG AA >= 4.5:1 come testo/link su sfondo chiaro);
// - `dark`: stessa famiglia ma schiarita e desaturata per il tema scuro
//   (AA >= 4.5:1 su superficie `10 10 11` e senza "vibrare").
//
// I contrasti sono verificati: nessun calcolo a runtime puo' quindi produrre
// una tinta illeggibile. Il guardrail e' "per costruzione".
// Le neutre dell'interfaccia restano dai token del tema, non da qui.

export type BrandingPreset = {
  id: string;
  name: string;
  /** Accento per il tema chiaro (#RRGGBB). E' anche il valore salvato nel branding. */
  light: string;
  /** Accento per il tema scuro (#RRGGBB). */
  dark: string;
};

export const BRANDING_PALETTE: BrandingPreset[] = [
  { id: 'blue', name: 'Blu', light: '#0b5ed7', dark: '#6ea8fe' },
  { id: 'indigo', name: 'Indaco', light: '#4f46e5', dark: '#a5b4fc' },
  { id: 'violet', name: 'Viola', light: '#7c3aed', dark: '#c4b5fd' },
  { id: 'pink', name: 'Rosa', light: '#db2777', dark: '#f472b6' },
  { id: 'red', name: 'Rosso', light: '#dc2626', dark: '#f87171' },
  { id: 'orange', name: 'Arancio', light: '#c2410c', dark: '#fb923c' },
  { id: 'amber', name: 'Ambra', light: '#b45309', dark: '#fbbf24' },
  { id: 'green', name: 'Verde', light: '#15803d', dark: '#4ade80' },
  { id: 'emerald', name: 'Menta', light: '#047857', dark: '#34d399' },
  { id: 'teal', name: 'Teal', light: '#0f766e', dark: '#2dd4bf' },
  { id: 'cyan', name: 'Ciano', light: '#0e7490', dark: '#22d3ee' },
  { id: 'graphite', name: 'Grafite', light: '#4b5563', dark: '#9ca3af' },
  { id: 'brown', name: 'Marrone', light: '#9a5b3f', dark: '#c98a6b' },
];

export const DEFAULT_PRESET_ID = 'blue';

export const getDefaultPreset = (): BrandingPreset =>
  BRANDING_PALETTE.find((preset) => preset.id === DEFAULT_PRESET_ID) ?? BRANDING_PALETTE[0];

const HEX_COLOR_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const normalizeHex = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const color = value.trim().toLowerCase();
  if (!HEX_COLOR_REGEX.test(color)) {
    return null;
  }

  if (color.length === 4) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }

  return color;
};

const toRgb = (hex: string) => ({
  r: Number.parseInt(hex.slice(1, 3), 16),
  g: Number.parseInt(hex.slice(3, 5), 16),
  b: Number.parseInt(hex.slice(5, 7), 16),
});

type Hsl = { h: number; s: number; l: number };

const toHsl = (hex: string): Hsl => {
  const { r, g, b } = toRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;
  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === rn) {
      h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) * 60;
    } else if (max === gn) {
      h = ((bn - rn) / delta + 2) * 60;
    } else {
      h = ((rn - gn) / delta + 4) * 60;
    }
  }

  return { h, s, l };
};

const hueDistance = (a: number, b: number): number => {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
};

/** Ritorna il preset il cui accento chiaro combacia con l'hex indicato, se esiste. */
export const findPresetByLightColor = (primaryColor: unknown): BrandingPreset | null => {
  const normalized = normalizeHex(primaryColor);
  if (!normalized) {
    return null;
  }

  return BRANDING_PALETTE.find((preset) => preset.light.toLowerCase() === normalized) ?? null;
};

/** Id del preset selezionato a partire dal colore salvato (null se non e' un preset). */
export const getSelectedPresetId = (primaryColor: unknown): string | null =>
  findPresetByLightColor(primaryColor)?.id ?? null;

/**
 * Accenti per-tema a partire dal colore salvato nel branding.
 * Se il colore corrisponde a un preset ritorna la coppia chiaro/scuro curata;
 * altrimenti (workspace legacy con colore libero) ritorna lo stesso valore per
 * entrambi i temi, cosi' il rendering resta identico a com'era prima.
 */
export const getPresetAccents = (primaryColor: unknown): { light: string; dark: string } => {
  const preset = findPresetByLightColor(primaryColor);
  if (preset) {
    return { light: preset.light, dark: preset.dark };
  }

  const normalized = normalizeHex(primaryColor) ?? getDefaultPreset().light;
  return { light: normalized, dark: normalized };
};

/**
 * Preset piu' vicino a un colore qualsiasi (es. colore dominante del logo).
 * Confronto per tinta (hue) con guardia sulla saturazione: colori quasi grigi
 * suggeriscono Grafite. Ritorna sempre un preset.
 */
export const suggestPresetFromColor = (color: unknown): BrandingPreset => {
  const normalized = normalizeHex(color);
  if (!normalized) {
    return getDefaultPreset();
  }

  const target = toHsl(normalized);

  // Colore quasi acromatico -> Grafite (se presente in palette).
  if (target.s < 0.12) {
    return BRANDING_PALETTE.find((preset) => preset.id === 'graphite') ?? getDefaultPreset();
  }

  let best = getDefaultPreset();
  let bestScore = Number.POSITIVE_INFINITY;
  for (const preset of BRANDING_PALETTE) {
    const presetHsl = toHsl(preset.light);
    // Priorita' alla tinta; la luminosita' pesa poco (le varianti gestiscono il tema).
    const score = hueDistance(target.h, presetHsl.h) + Math.abs(target.l - presetHsl.l) * 40;
    if (score < bestScore) {
      bestScore = score;
      best = preset;
    }
  }

  return best;
};
