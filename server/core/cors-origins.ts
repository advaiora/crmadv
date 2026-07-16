// Logica PURA di decisione sulle origini (CORS). Estratta da app.ts perche' serve in
// due posti: l'handshake CORS delle richieste HTTP e il controllo Origin dell'apertura
// del WebSocket (realtime). Una sola fonte di verita': niente regole di sicurezza
// duplicate che poi divergono.

const DEV_DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const DEV_ALLOWED_LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

export const normalizeOrigin = (value: string): string | null => {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized).origin;
  } catch {
    return null;
  }
};

export const parseAllowedOrigins = (): string[] => {
  const rawValue = process.env.ALLOWED_ORIGINS;
  const isProduction = process.env.NODE_ENV === 'production';
  const candidates = rawValue
    ? rawValue.split(',')
    : isProduction
      ? []
      : DEV_DEFAULT_ALLOWED_ORIGINS;

  const normalizedOrigins = new Set<string>();
  for (const candidate of candidates) {
    const normalized = normalizeOrigin(candidate);
    if (normalized) {
      normalizedOrigins.add(normalized);
    }
  }

  return [...normalizedOrigins];
};

export const isDevLoopbackOrigin = (origin: string): boolean => {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.protocol === 'http:' && DEV_ALLOWED_LOCALHOST_HOSTNAMES.has(parsedOrigin.hostname);
  } catch {
    return false;
  }
};

export type CorsDecision = {
  requestOriginRaw: string | null;
  requestOriginNormalized: string | null;
  allowedByList: boolean;
  allowedByDevLoopback: boolean;
  isAllowed: boolean;
};

export const buildCorsDecision = (
  requestOriginRaw: string | null,
  corsAllowedOriginsSet: Set<string>,
): CorsDecision => {
  const requestOriginNormalized = requestOriginRaw ? normalizeOrigin(requestOriginRaw) : null;
  const allowedByList = requestOriginNormalized ? corsAllowedOriginsSet.has(requestOriginNormalized) : false;
  const allowedByDevLoopback = requestOriginNormalized ? isDevLoopbackOrigin(requestOriginNormalized) : false;
  const isAllowed = requestOriginNormalized ? (allowedByList || allowedByDevLoopback) : false;

  return {
    requestOriginRaw,
    requestOriginNormalized,
    allowedByList,
    allowedByDevLoopback,
    isAllowed,
  };
};

// Decisione singola comoda per il WebSocket: nessun Origin = rifiutato (i browser lo
// mandano sempre nell'handshake; l'assenza indica un client non-browser).
export const isOriginAllowed = (origin: string | null | undefined): boolean => {
  if (!origin) {
    return false;
  }
  const allowedOriginsSet = new Set(parseAllowedOrigins());
  return buildCorsDecision(origin, allowedOriginsSet).isAllowed;
};
