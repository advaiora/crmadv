const isDev = Boolean(import.meta.env?.DEV);
let hasLoggedMissingEnvWarning = false;

const readEnv = (value) => (typeof value === "string" ? value.trim() : "");

export const getClientRuntimeConfig = () => {
  const envApiUrl = readEnv(import.meta.env.VITE_API_URL);
  const envApiBaseUrl = readEnv(import.meta.env.VITE_API_BASE_URL);
  const resolvedApiUrl = envApiUrl || envApiBaseUrl;
  const googleClientId = readEnv(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const googleRedirectUri = readEnv(import.meta.env.VITE_GOOGLE_REDIRECT_URI);
  const googleDebugRawResponse = readEnv(import.meta.env.VITE_GOOGLE_DEBUG_RAW_RESPONSE).toLowerCase() === "true";
  const apiBaseUrl = resolvedApiUrl ? resolvedApiUrl.replace(/\/$/, "") : "/api";
  const looksLikeGoogleClientId = /\.apps\.googleusercontent\.com$/i.test(googleClientId);

  if (isDev && !hasLoggedMissingEnvWarning) {
    if (!resolvedApiUrl) {
      console.warn("[RuntimeConfig] VITE_API_URL non definita. Uso fallback '/api'.");
    }

    if (envApiUrl && envApiBaseUrl && envApiUrl !== envApiBaseUrl) {
      console.warn("[RuntimeConfig] VITE_API_URL e VITE_API_BASE_URL differiscono. Uso VITE_API_URL.");
    }

    if (!googleClientId) {
      console.warn("[RuntimeConfig] VITE_GOOGLE_CLIENT_ID non definita. Google Sign-In disabilitato.");
    } else if (!looksLikeGoogleClientId) {
      console.warn("[RuntimeConfig] VITE_GOOGLE_CLIENT_ID sembra non valida. Atteso formato *.apps.googleusercontent.com.");
    }

    console.info("[RuntimeConfig] Google Sign-In diagnostics", {
      origin: typeof window !== "undefined" ? window.location.origin : "(server)",
      googleClientId,
      googleClientIdLength: googleClientId.length,
      googleRedirectUri: googleRedirectUri || "(not-set)",
      googleDebugRawResponse,
    });

    hasLoggedMissingEnvWarning = true;
  }

  return {
    apiBaseUrl,
    googleClientId,
    googleRedirectUri,
    googleDebugRawResponse,
    apiUrlConfigured: Boolean(resolvedApiUrl),
    googleClientIdConfigured: Boolean(googleClientId),
  };
};
