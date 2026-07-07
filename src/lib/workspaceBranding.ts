import { getPresetAccents } from './brandingPalette';

const HEX_COLOR_REGEX = /^#[A-Fa-f0-9]{6}$/;
const DEFAULT_PRIMARY_COLOR = '#0d6efd';
const DEFAULT_SECONDARY_COLOR = '#6c757d';
const STYLE_ELEMENT_ID = 'workspace-branding-vars';
// Superficie scura di base (token surface-1 = 10 10 11): serve a calcolare la
// tinta "soft" dell'accento nel tema scuro (accento mescolato col fondo, non col bianco).
const DARK_SOFT_BASE = '#0f0f13';

export type WorkspaceBrandingState = {
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  companyName?: string;
  supportEmail?: string;
};

export const DEFAULT_WORKSPACE_BRANDING: WorkspaceBrandingState = {
  primaryColor: DEFAULT_PRIMARY_COLOR,
  secondaryColor: DEFAULT_SECONDARY_COLOR,
};

const normalizeValue = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const normalizeHexColor = (value: unknown, fallback: string) => {
  const normalized = normalizeValue(value);
  if (!normalized || !HEX_COLOR_REGEX.test(normalized)) {
    return fallback;
  }

  return normalized.toLowerCase();
};

const parseHexColor = (hexColor: string) => ({
  r: Number.parseInt(hexColor.slice(1, 3), 16),
  g: Number.parseInt(hexColor.slice(3, 5), 16),
  b: Number.parseInt(hexColor.slice(5, 7), 16),
});

const toHexColor = ({ r, g, b }: { r: number; g: number; b: number }) =>
  `#${[r, g, b]
    .map((component) => Math.max(0, Math.min(255, Math.round(component))).toString(16).padStart(2, '0'))
    .join('')}`;

const mixHexColors = (startColor: string, endColor: string, ratio: number) => {
  const from = parseHexColor(startColor);
  const to = parseHexColor(endColor);
  const normalizedRatio = Math.max(0, Math.min(1, ratio));

  return toHexColor({
    r: from.r + (to.r - from.r) * normalizedRatio,
    g: from.g + (to.g - from.g) * normalizedRatio,
    b: from.b + (to.b - from.b) * normalizedRatio,
  });
};

const toLinearChannel = (channel: number) => {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

const getRelativeLuminance = (hexColor: string) => {
  const { r, g, b } = parseHexColor(hexColor);
  return 0.2126 * toLinearChannel(r) + 0.7152 * toLinearChannel(g) + 0.0722 * toLinearChannel(b);
};

const getContrastRatio = (firstColor: string, secondColor: string) => {
  const firstLuminance = getRelativeLuminance(firstColor);
  const secondLuminance = getRelativeLuminance(secondColor);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
};

const getReadableTextColor = (backgroundColor: string) => {
  const darkText = '#111111';
  const lightText = '#ffffff';
  const darkContrast = getContrastRatio(backgroundColor, darkText);
  const lightContrast = getContrastRatio(backgroundColor, lightText);
  return darkContrast >= lightContrast ? darkText : lightText;
};

const toRgbCsv = (hexColor: string) => {
  const { r, g, b } = parseHexColor(hexColor);
  return `${r}, ${g}, ${b}`;
};

const toRgbSpace = (hexColor: string) => {
  const { r, g, b } = parseHexColor(hexColor);
  return `${r} ${g} ${b}`;
};

const toRgba = (hexColor: string, alpha: number) => {
  const { r, g, b } = parseHexColor(hexColor);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const normalizeWorkspaceBranding = (rawBranding: unknown): WorkspaceBrandingState | undefined => {
  if (!rawBranding || typeof rawBranding !== 'object') {
    return undefined;
  }

  const source = rawBranding as Record<string, unknown>;
  const companyName = normalizeValue(source.companyName);
  const supportEmail = normalizeValue(source.supportEmail)?.toLowerCase();
  const logoUrl = normalizeValue(source.logoUrl);
  const primaryColor = normalizeHexColor(source.primaryColor, DEFAULT_PRIMARY_COLOR);
  const secondaryColor = normalizeHexColor(
    source.secondaryColor ?? source.accentColor,
    DEFAULT_SECONDARY_COLOR,
  );

  return {
    primaryColor,
    secondaryColor,
    ...(companyName ? { companyName } : {}),
    ...(supportEmail ? { supportEmail } : {}),
    ...(logoUrl ? { logoUrl } : {}),
  };
};

// Calcola l'insieme dei token dell'accento per un dato tema.
// `softBase` e' il colore verso cui si mescola la tinta tenue (bianco in chiaro,
// fondo scuro in scuro) cosi' la "soft" resta coerente col tema.
const buildAccentVariables = (accentColor: string, softBase: string) => {
  const accentHover = mixHexColors(accentColor, '#000000', 0.14);
  const accentActive = mixHexColors(accentColor, '#000000', 0.24);
  const accentSoft = mixHexColors(accentColor, softBase, 0.84);

  return {
    '--branding-primary': toRgbSpace(accentColor),
    '--brand-accent': accentColor,
    '--brand-accent-hover': accentHover,
    '--brand-accent-active': accentActive,
    '--brand-accent-soft': accentSoft,
    '--brand-accent-hover-foreground': getReadableTextColor(accentHover),
    '--brand-accent-active-foreground': getReadableTextColor(accentActive),
    '--brand-accent-soft-foreground': getReadableTextColor(accentSoft),
    '--primary': accentColor,
    '--primary-foreground': getReadableTextColor(accentColor),
    '--accent': accentSoft,
    '--accent-foreground': getReadableTextColor(accentSoft),
    '--ring': accentColor,
    '--focus-ring-shadow': toRgba(accentColor, 0.45),
    '--bs-primary': accentColor,
    '--bs-primary-rgb': toRgbCsv(accentColor),
    // La sidebar segue il tema (token in globals.css), non il colore secondario:
    // qui impostiamo solo lo stato attivo/hover sull'accento.
    '--hk-menu-item-active-bg': accentColor,
    '--hk-menu-item-active-text': getReadableTextColor(accentColor),
    '--hk-menu-hover-bg': toRgba(accentColor, 0.12),
  } as Record<string, string>;
};

const serializeVariables = (variables: Record<string, string>) =>
  Object.entries(variables)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');

/**
 * Applica il branding del workspace iniettando (o aggiornando) un foglio di stile
 * con DUE blocchi theme-scoped: l'accento chiaro per il tema chiaro, quello scuro
 * (desaturato) per il tema scuro. Il CSS commuta da solo al cambio tema.
 *
 * Il colore secondario resta ai token del tema (neutra), non viene sovrascritto.
 */
export const applyWorkspaceBranding = (workspaceBranding?: WorkspaceBrandingState | null) => {
  if (typeof document === 'undefined') {
    return;
  }

  const branding = workspaceBranding ?? DEFAULT_WORKSPACE_BRANDING;
  const primaryColor = normalizeHexColor(branding.primaryColor, DEFAULT_PRIMARY_COLOR);
  // La coppia chiaro/scuro viene dalla palette curata; se il colore non e' un
  // preset (workspace legacy con colore libero) si usa lo stesso valore su entrambi.
  const { light: lightAccent, dark: darkAccent } = getPresetAccents(primaryColor);

  const css = [
    `:root[data-bs-theme="light"] {\n${serializeVariables(
      buildAccentVariables(lightAccent, '#ffffff'),
    )}\n}`,
    `:root[data-bs-theme="dark"] {\n${serializeVariables(
      buildAccentVariables(darkAccent, DARK_SOFT_BASE),
    )}\n}`,
  ].join('\n\n');

  let styleElement = document.getElementById(STYLE_ELEMENT_ID);
  if (!(styleElement instanceof HTMLStyleElement)) {
    styleElement = document.createElement('style');
    styleElement.id = STYLE_ELEMENT_ID;
    document.head.appendChild(styleElement);
  }
  styleElement.textContent = css;
};
