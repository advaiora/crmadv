export const FALLBACK_STAGE_COLOR = '#94A3B8';

const HEX_COLOR_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toExpandedHex = (hexColor) => {
    const normalized = String(hexColor || '').trim();
    if (!HEX_COLOR_REGEX.test(normalized)) {
        return null;
    }

    if (normalized.length === 4) {
        return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
    }

    return normalized;
};

export const normalizeStageColor = (color, fallback = FALLBACK_STAGE_COLOR) => {
    const fallbackHex = toExpandedHex(fallback) || FALLBACK_STAGE_COLOR;
    const normalized = toExpandedHex(color);
    return normalized || fallbackHex;
};

export const hexToRgb = (color, fallback = FALLBACK_STAGE_COLOR) => {
    const safeColor = normalizeStageColor(color, fallback);
    const r = Number.parseInt(safeColor.slice(1, 3), 16);
    const g = Number.parseInt(safeColor.slice(3, 5), 16);
    const b = Number.parseInt(safeColor.slice(5, 7), 16);

    return { r, g, b };
};

export const rgbCsvFromHex = (color, fallback = FALLBACK_STAGE_COLOR) => {
    const { r, g, b } = hexToRgb(color, fallback);
    return `${r}, ${g}, ${b}`;
};

export const rgbaFromHex = (color, alpha, fallback = FALLBACK_STAGE_COLOR) => {
    const { r, g, b } = hexToRgb(color, fallback);
    const safeAlpha = clamp(Number(alpha), 0, 1);
    return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
};

const toSrgbLinear = (channel) => {
    const normalized = channel / 255;
    if (normalized <= 0.03928) {
        return normalized / 12.92;
    }
    return ((normalized + 0.055) / 1.055) ** 2.4;
};

export const resolveStageTextColor = (color, fallback = FALLBACK_STAGE_COLOR) => {
    const safeColor = normalizeStageColor(color, fallback);
    const { r, g, b } = hexToRgb(safeColor, fallback);

    // Relative luminance to avoid low-contrast text for very bright accent colors.
    const luminance = (0.2126 * toSrgbLinear(r)) + (0.7152 * toSrgbLinear(g)) + (0.0722 * toSrgbLinear(b));

    if (luminance > 0.68) {
        return '#1E293B';
    }

    if (luminance < 0.2) {
        return '#E2E8F0';
    }

    return safeColor;
};
