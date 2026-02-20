const HEX_COLOR_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_COLOR_REGEX = /^rgba?\(([^)]+)\)$/i;

const isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";

const normalizeHexColor = (rawColor) => {
  if (typeof rawColor !== "string") {
    return null;
  }

  const color = rawColor.trim();
  if (!HEX_COLOR_REGEX.test(color)) {
    return null;
  }

  if (color.length === 4) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return color.toLowerCase();
};

const parseRgbString = (rawColor) => {
  if (typeof rawColor !== "string") {
    return null;
  }

  const match = rawColor.trim().match(RGB_COLOR_REGEX);
  if (!match) {
    return null;
  }

  const channels = match[1]
    .split(",")
    .map((channel) => Number.parseFloat(channel.trim()))
    .slice(0, 3);

  if (channels.length !== 3 || channels.some((channel) => Number.isNaN(channel))) {
    return null;
  }

  return {
    r: Math.max(0, Math.min(255, Math.round(channels[0]))),
    g: Math.max(0, Math.min(255, Math.round(channels[1]))),
    b: Math.max(0, Math.min(255, Math.round(channels[2]))),
  };
};

const parseColorToRgb = (rawColor, fallbackHex = "#0d6efd") => {
  const normalizedHex = normalizeHexColor(rawColor);
  if (normalizedHex) {
    return {
      r: Number.parseInt(normalizedHex.slice(1, 3), 16),
      g: Number.parseInt(normalizedHex.slice(3, 5), 16),
      b: Number.parseInt(normalizedHex.slice(5, 7), 16),
    };
  }

  const rgb = parseRgbString(rawColor);
  if (rgb) {
    return rgb;
  }

  const safeFallbackHex = normalizeHexColor(fallbackHex) || "#0d6efd";
  return {
    r: Number.parseInt(safeFallbackHex.slice(1, 3), 16),
    g: Number.parseInt(safeFallbackHex.slice(3, 5), 16),
    b: Number.parseInt(safeFallbackHex.slice(5, 7), 16),
  };
};

export const readBrandingColor = (cssVariableName, fallbackColor) => {
  if (!isBrowser()) {
    return fallbackColor;
  }

  const value = getComputedStyle(document.documentElement).getPropertyValue(cssVariableName).trim();
  return value || fallbackColor;
};

export const colorToRgbaString = (color, alpha, fallbackHex = "#0d6efd") => {
  const { r, g, b } = parseColorToRgb(color, fallbackHex);
  const safeAlpha = Math.max(0, Math.min(1, Number(alpha)));
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
};

export const colorToAm5Number = (color, fallbackHex = "#0d6efd") => {
  const { r, g, b } = parseColorToRgb(color, fallbackHex);
  return (r << 16) + (g << 8) + b;
};
