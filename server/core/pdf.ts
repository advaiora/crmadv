// Helper condivisi per la generazione di PDF brandizzati con pdfkit.
// Estratti da quotes/pdf/quotePdf.ts (dove vivevano) per essere riusati anche dal
// Report cliente Agency (V6) senza duplicare, in particolare, la risoluzione del
// logo con protezione SSRF (codice sensibile: deve stare in UN posto solo).
//
// Contiene: tipi dei dati brand del workspace, palette derivata dai colori brand,
// risoluzione del logo (data URL o URL https remoto, con anti-SSRF + cache), e due
// utility pdfkit generiche (buffer di output, salto pagina). Nulla di specifico dei
// preventivi resta qui.

import { isIP } from 'node:net';

// Dati brand del workspace usati dai PDF (nome, contatti, logo, colori).
export type WorkspacePdfData = {
  name: string;
  supportEmail: string | null;
  supportPhone: string | null;
  supportAddress: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
};

// Palette derivata dai due colori brand, con varianti pronte per fondali/bordi/testo.
export type BrandPalette = {
  primaryColor: string;
  secondaryColor: string;
  mutedColor: string;
  tableHeaderBackground: string;
  tableHeaderTextColor: string;
  tableBorderColor: string;
};

const HEX_COLOR_REGEX = /^#[A-Fa-f0-9]{6}$/;
const DEFAULT_PRIMARY_COLOR = '#0d6efd';
const DEFAULT_SECONDARY_COLOR = '#111827';
const LOGO_FETCH_TIMEOUT_MS = 4000;
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
const LOGO_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_LOGO_CACHE_ITEMS = 50;
const SUPPORTED_LOGO_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
const BLOCKED_HOSTNAME_SUFFIXES = ['.local', '.internal', '.localhost'];

const remoteImageCache = new Map<string, { buffer: Buffer; expiresAt: number }>();

// Raccoglie lo stream del PDFDocument in un Buffer unico.
export const toBuffer = (doc: PDFKit.PDFDocument) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

// Va a pagina nuova se non c'e' abbastanza spazio verticale per l'elemento successivo.
export const ensureVerticalSpace = (
  doc: PDFKit.PDFDocument,
  requiredHeight: number,
  onPageBreak?: () => void,
) => {
  const availableBottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + requiredHeight <= availableBottom) {
    return;
  }

  doc.addPage();
  if (onPageBreak) {
    onPageBreak();
  }
};

const normalizeHexColor = (value: string | null | undefined, fallback: string) => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();
  if (!HEX_COLOR_REGEX.test(normalized)) {
    return fallback;
  }

  return normalized.toLowerCase();
};

const parseHex = (hexColor: string) => ({
  r: Number.parseInt(hexColor.slice(1, 3), 16),
  g: Number.parseInt(hexColor.slice(3, 5), 16),
  b: Number.parseInt(hexColor.slice(5, 7), 16),
});

const toHex = ({ r, g, b }: { r: number; g: number; b: number }) =>
  `#${[r, g, b]
    .map((component) => Math.max(0, Math.min(255, Math.round(component))).toString(16).padStart(2, '0'))
    .join('')}`;

// Mescola due colori esadecimali secondo un rapporto 0..1 (0 = start, 1 = end).
export const mixColors = (startColor: string, endColor: string, ratio: number) => {
  const from = parseHex(startColor);
  const to = parseHex(endColor);
  const normalizedRatio = Math.max(0, Math.min(1, ratio));

  return toHex({
    r: from.r + (to.r - from.r) * normalizedRatio,
    g: from.g + (to.g - from.g) * normalizedRatio,
    b: from.b + (to.b - from.b) * normalizedRatio,
  });
};

const getReadableTextColor = (hexColor: string) => {
  const { r, g, b } = parseHex(hexColor);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance >= 0.62 ? '#111111' : '#ffffff';
};

// Costruisce la palette brand a partire dai colori del workspace (con fallback).
export const buildBrandPalette = (workspace: WorkspacePdfData): BrandPalette => {
  const primaryColor = normalizeHexColor(workspace.primaryColor, DEFAULT_PRIMARY_COLOR);
  const secondaryColor = normalizeHexColor(workspace.secondaryColor, DEFAULT_SECONDARY_COLOR);

  return {
    primaryColor,
    secondaryColor,
    mutedColor: mixColors(secondaryColor, '#ffffff', 0.36),
    tableHeaderBackground: mixColors(primaryColor, '#ffffff', 0.84),
    tableHeaderTextColor: getReadableTextColor(mixColors(primaryColor, '#ffffff', 0.84)),
    tableBorderColor: mixColors(secondaryColor, '#ffffff', 0.78),
  };
};

const parseLogoDataUrl = (logoUrl: string) => {
  const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(logoUrl);
  if (!match) {
    return null;
  }

  const mimeType = match[1].toLowerCase();
  if (!SUPPORTED_LOGO_MIME_TYPES.has(mimeType)) {
    return null;
  }

  try {
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0 || buffer.length > MAX_LOGO_SIZE_BYTES) {
      return null;
    }

    return buffer;
  } catch {
    return null;
  }
};

const isPrivateIpv4Address = (host: string) => {
  const parts = host.split('.').map((segment) => Number.parseInt(segment, 10));
  if (parts.length !== 4 || parts.some((segment) => Number.isNaN(segment) || segment < 0 || segment > 255)) {
    return false;
  }

  if (parts[0] === 10) {
    return true;
  }
  if (parts[0] === 127) {
    return true;
  }
  if (parts[0] === 169 && parts[1] === 254) {
    return true;
  }
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true;
  }
  if (parts[0] === 192 && parts[1] === 168) {
    return true;
  }

  return false;
};

const isBlockedHostname = (hostname: string) => {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  if (LOCAL_HOSTNAMES.has(normalized)) {
    return true;
  }

  if (BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) {
    return true;
  }

  const ipVersion = isIP(normalized);
  if (ipVersion === 4 && isPrivateIpv4Address(normalized)) {
    return true;
  }
  if (ipVersion === 6 && (normalized === '::1' || normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd'))) {
    return true;
  }

  return false;
};

const isAllowedRemoteImageUrl = (rawUrl: string) => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && parsed.protocol === 'http:')) {
    return false;
  }

  if (isBlockedHostname(parsed.hostname)) {
    return false;
  }

  return true;
};

const getCachedImageBuffer = (url: string) => {
  const cached = remoteImageCache.get(url);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    remoteImageCache.delete(url);
    return null;
  }

  return cached.buffer;
};

const setCachedImageBuffer = (url: string, buffer: Buffer) => {
  if (remoteImageCache.size >= MAX_LOGO_CACHE_ITEMS) {
    const oldest = remoteImageCache.keys().next();
    if (!oldest.done) {
      remoteImageCache.delete(oldest.value);
    }
  }

  remoteImageCache.set(url, {
    buffer,
    expiresAt: Date.now() + LOGO_CACHE_TTL_MS,
  });
};

const fetchLogoBuffer = async (logoUrl: string) => {
  if (!isAllowedRemoteImageUrl(logoUrl)) {
    return null;
  }

  const cached = getCachedImageBuffer(logoUrl);
  if (cached) {
    return cached;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LOGO_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(logoUrl, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    if (contentType && !SUPPORTED_LOGO_MIME_TYPES.has(contentType)) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length === 0 || buffer.length > MAX_LOGO_SIZE_BYTES) {
      return null;
    }

    setCachedImageBuffer(logoUrl, buffer);
    return buffer;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};

// Risolve il logo (data URL o URL https remoto) in un Buffer, o null se assente/non
// valido/non consentito. Le immagini locali/private sono bloccate (anti-SSRF).
export const resolveLogoBuffer = async (logoUrl: string | null) => {
  if (!logoUrl) {
    return null;
  }

  const normalized = logoUrl.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('data:image/')) {
    return parseLogoDataUrl(normalized);
  }

  if (!/^https?:\/\//i.test(normalized)) {
    return null;
  }

  return fetchLogoBuffer(normalized);
};
