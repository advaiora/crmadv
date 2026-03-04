const readEnv = (value) => (typeof value === "string" ? value.trim() : "");

export const getClientRuntimeConfig = () => {
  const envApiUrl = readEnv(import.meta.env.VITE_API_URL);
  const envApiBaseUrl = readEnv(import.meta.env.VITE_API_BASE_URL);
  const resolvedApiUrl = envApiUrl || envApiBaseUrl;
  const googleClientId = readEnv(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const googleRedirectUri = readEnv(import.meta.env.VITE_GOOGLE_REDIRECT_URI);
  const googleDebugRawResponse = readEnv(import.meta.env.VITE_GOOGLE_DEBUG_RAW_RESPONSE).toLowerCase() === "true";
  const apiBaseUrl = resolvedApiUrl ? resolvedApiUrl.replace(/\/$/, "") : "/api";

  return {
    apiBaseUrl,
    googleClientId,
    googleRedirectUri,
    googleDebugRawResponse,
    apiUrlConfigured: Boolean(resolvedApiUrl),
    googleClientIdConfigured: Boolean(googleClientId),
  };
};
