// Helper condivisi per la generazione di PDF brandizzati con pdfkit.
// Estratti da quotes/pdf/quotePdf.ts (dove vivevano) per essere riusati anche dal
// Report cliente Agency (V6) senza duplicare, in particolare, la risoluzione del
// logo con protezione SSRF (codice sensibile: deve stare in UN posto solo).
//
// Contiene: tipi dei dati brand del workspace, palette derivata dai colori brand,
// risoluzione del logo (data URL o URL https remoto, con anti-SSRF + cache), e due
// utility pdfkit generiche (buffer di output, salto pagina). Nulla di specifico dei
// preventivi resta qui.

import { type RisolutoreDns, safeFetch } from './net-guard.js';

/**
 * Opzioni della risoluzione del logo. L'unico campo serve **ai test**: la difesa che
 * conta — «nome pubblico che risolve a un indirizzo privato» — non si puo' provare
 * altrimenti, servirebbe una zona DNS vera sotto controllo del test. Chi genera un PDF
 * non passa niente e prende il risolutore di sistema.
 */
type LogoFetchOptions = {
  risolviDns?: RisolutoreDns;
};

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

const fetchLogoBuffer = async (logoUrl: string, options: LogoFetchOptions = {}) => {
  const cached = getCachedImageBuffer(logoUrl);
  if (cached) {
    return cached;
  }

  // Il timeout dentro `safeFetch` si spegne quando la risposta torna: da solo lascerebbe
  // scoperta la lettura del corpo, cioe' un server che sgocciola i byte per sempre
  // tenendo appesa la generazione del PDF. Questo segnale copre l'intero giro, come
  // faceva l'AbortController che stava qui prima.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LOGO_FETCH_TIMEOUT_MS);

  try {
    // `safeFetch` fa da solo tutto quello che qui veniva scritto a mano — e in piu' le
    // due cose che mancavano: risolve il DNS (un nome pubblico che punta a 127.0.0.1 o
    // ai metadati della macchina non passa) e segue i redirect a mano ri-validando ogni
    // salto. Include il controllo dello schema, http accettato solo fuori produzione:
    // e' la stessa regola di prima, non un allentamento.
    const response = await safeFetch(logoUrl, {
      timeoutMs: LOGO_FETCH_TIMEOUT_MS,
      signal: controller.signal,
      risolviDns: options.risolviDns,
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
    // Comprende `SsrfBlockedError` (host privato, host che risolve a un indirizzo
    // privato, redirect verso la rete interna, troppi redirect) oltre a timeout ed
    // errori di rete. Per il PDF sono tutti lo stesso caso: il logo non c'e', si
    // disegna senza. L'esito non torna a chi ha chiesto il PDF, quindi non c'e' niente
    // da distinguere nel messaggio.
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};

// Risolve il logo (data URL o URL https remoto) in un Buffer, o null se assente/non
// valido/non consentito. Le immagini locali/private sono bloccate (anti-SSRF).
export const resolveLogoBuffer = async (logoUrl: string | null, options: LogoFetchOptions = {}) => {
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

  return fetchLogoBuffer(normalized, options);
};
