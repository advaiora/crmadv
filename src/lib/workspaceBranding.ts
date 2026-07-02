const HEX_COLOR_REGEX = /^#[A-Fa-f0-9]{6}$/;
const DEFAULT_PRIMARY_COLOR = '#0d6efd';
const DEFAULT_SECONDARY_COLOR = '#6c757d';

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

export const applyWorkspaceBranding = (workspaceBranding?: WorkspaceBrandingState | null) => {
  if (typeof document === 'undefined') {
    return;
  }

  const branding = workspaceBranding ?? DEFAULT_WORKSPACE_BRANDING;
  const primaryColor = normalizeHexColor(branding.primaryColor, DEFAULT_PRIMARY_COLOR);
  const secondaryColor = normalizeHexColor(branding.secondaryColor, DEFAULT_SECONDARY_COLOR);
  const primaryHover = mixHexColors(primaryColor, '#000000', 0.14);
  const primaryActive = mixHexColors(primaryColor, '#000000', 0.24);
  const primarySoft = mixHexColors(primaryColor, '#ffffff', 0.84);
  const primaryForeground = getReadableTextColor(primaryColor);
  const primaryHoverForeground = getReadableTextColor(primaryHover);
  const primaryActiveForeground = getReadableTextColor(primaryActive);
  const primarySoftForeground = getReadableTextColor(primarySoft);
  const secondaryForeground = getReadableTextColor(secondaryColor);
  const menuBorder = mixHexColors(secondaryColor, '#000000', 0.22);
  const menuArrowColor = toRgba(secondaryForeground, 0.72);

  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--branding-primary', toRgbSpace(primaryColor));
  rootStyle.setProperty('--branding-secondary', toRgbSpace(secondaryColor));
  rootStyle.setProperty('--brand-accent', primaryColor);
  rootStyle.setProperty('--brand-accent-hover', primaryHover);
  rootStyle.setProperty('--brand-accent-active', primaryActive);
  rootStyle.setProperty('--brand-accent-soft', primarySoft);
  rootStyle.setProperty('--brand-accent-hover-foreground', primaryHoverForeground);
  rootStyle.setProperty('--brand-accent-active-foreground', primaryActiveForeground);
  rootStyle.setProperty('--brand-accent-soft-foreground', primarySoftForeground);
  rootStyle.setProperty('--primary', primaryColor);
  rootStyle.setProperty('--primary-foreground', primaryForeground);
  rootStyle.setProperty('--secondary', secondaryColor);
  rootStyle.setProperty('--secondary-foreground', secondaryForeground);
  rootStyle.setProperty('--accent', primarySoft);
  rootStyle.setProperty('--accent-foreground', primarySoftForeground);
  rootStyle.setProperty('--ring', primaryColor);
  rootStyle.setProperty('--focus-ring-shadow', toRgba(primaryColor, 0.45));
  rootStyle.setProperty('--bs-primary', primaryColor);
  rootStyle.setProperty('--bs-primary-rgb', toRgbCsv(primaryColor));
  rootStyle.setProperty('--bs-secondary', secondaryColor);
  rootStyle.setProperty('--bs-secondary-rgb', toRgbCsv(secondaryColor));
  rootStyle.setProperty('--hk-menu-bg', secondaryColor);
  rootStyle.setProperty('--hk-menu-text', secondaryForeground);
  rootStyle.setProperty('--hk-menu-icon-color', secondaryForeground);
  rootStyle.setProperty('--hk-menu-arrow-color', menuArrowColor);
  rootStyle.setProperty('--hk-menu-border', menuBorder);
  rootStyle.setProperty('--hk-menu-item-active-bg', primaryColor);
  rootStyle.setProperty('--hk-menu-item-active-text', primaryForeground);
  rootStyle.setProperty('--hk-menu-hover-bg', toRgba(primaryColor, 0.12));
};
