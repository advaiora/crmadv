import { requestGoogleIdToken } from "./googleIdentity";

const GOOGLE_AUTH_MODE = {
  login: "login",
  signup: "signup",
};

const ERROR_CODE = {
  INVALID_TOKEN: "INVALID_TOKEN",
  SLUG_TAKEN: "SLUG_TAKEN",
  NO_WORKSPACE: "NO_WORKSPACE",
  EMAIL_CONFLICT: "EMAIL_CONFLICT",
  BAD_REQUEST: "BAD_REQUEST",
  UNKNOWN: "UNKNOWN",
};

const DEFAULT_ERROR_MESSAGE = "Errore durante l'accesso con Google.";

const isObject = (value) => typeof value === "object" && value !== null;

const readServerMessage = (payload) => {
  if (!isObject(payload)) {
    return "";
  }

  const errorMessage = isObject(payload.error) && typeof payload.error.message === "string" ? payload.error.message : "";
  const topLevelMessage = typeof payload.message === "string" ? payload.message : "";
  return errorMessage || topLevelMessage || "";
};

const sanitizePayload = (payload) => {
  if (!isObject(payload)) {
    return undefined;
  }

  const sanitized = {};
  if (typeof payload.message === "string") {
    sanitized.message = payload.message;
  }

  if (isObject(payload.error)) {
    const error = {};
    if (typeof payload.error.code === "string") {
      error.code = payload.error.code;
    }
    if (typeof payload.error.message === "string") {
      error.message = payload.error.message;
    }
    if (Object.keys(error).length > 0) {
      sanitized.error = error;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

const resolve409Mapping = (serverMessage) => {
  const lowerMessage = serverMessage.toLowerCase();
  if (lowerMessage.includes("slug")) {
    return {
      code: ERROR_CODE.SLUG_TAKEN,
      message: "Questo indirizzo workspace e gia in uso. Scegline un altro.",
    };
  }

  if (
    lowerMessage.includes("workspace") ||
    lowerMessage.includes("complete") ||
    lowerMessage.includes("completa") ||
    lowerMessage.includes("signup")
  ) {
    return {
      code: ERROR_CODE.NO_WORKSPACE,
      message: "Completa la registrazione creando il workspace.",
    };
  }

  return {
    code: ERROR_CODE.EMAIL_CONFLICT,
    message: "Questa email e gia associata a un altro accesso. Usa email/password o contatta supporto.",
  };
};

const mapErrorFromResponse = (status, payload) => {
  const serverCode =
    isObject(payload) && isObject(payload.error) && typeof payload.error.code === "string"
      ? payload.error.code.trim().toUpperCase()
      : "";

  if (serverCode === ERROR_CODE.INVALID_TOKEN) {
    return {
      code: ERROR_CODE.INVALID_TOKEN,
      message: "Accesso Google non valido. Riprova.",
    };
  }

  if (serverCode === ERROR_CODE.SLUG_TAKEN) {
    return {
      code: ERROR_CODE.SLUG_TAKEN,
      message: "Questo indirizzo workspace e gia in uso. Scegline un altro.",
    };
  }

  if (serverCode === ERROR_CODE.NO_WORKSPACE) {
    return {
      code: ERROR_CODE.NO_WORKSPACE,
      message: "Completa la registrazione creando il workspace.",
    };
  }

  if (serverCode === ERROR_CODE.EMAIL_CONFLICT) {
    return {
      code: ERROR_CODE.EMAIL_CONFLICT,
      message: "Questa email e gia associata a un altro accesso. Usa email/password o contatta supporto.",
    };
  }

  if (serverCode === ERROR_CODE.BAD_REQUEST) {
    const serverMessage = readServerMessage(payload);
    return {
      code: ERROR_CODE.BAD_REQUEST,
      message: serverMessage || "Richiesta Google non valida. Controlla i dati e riprova.",
    };
  }

  if (status === 401) {
    return {
      code: ERROR_CODE.INVALID_TOKEN,
      message: "Accesso Google non valido. Riprova.",
    };
  }

  if (status === 400) {
    return {
      code: ERROR_CODE.BAD_REQUEST,
      message: "Richiesta Google non valida. Controlla i dati e riprova.",
    };
  }

  if (status === 409) {
    return resolve409Mapping(readServerMessage(payload));
  }

  if (status === 429) {
    return {
      code: ERROR_CODE.UNKNOWN,
      message: "Troppi tentativi di login Google. Attendi un minuto e riprova.",
    };
  }

  return {
    code: ERROR_CODE.UNKNOWN,
    message: DEFAULT_ERROR_MESSAGE,
  };
};

const isFriendlyClientMessage = (message) =>
  /google|popup|annull|timeout|configur|credential|workspace|signup|non disponibile|fedcm|networkerror|token/i.test(message);
const isPopupOrCancelMessage = (message) =>
  /popup|annull|cancel|tap_outside|suppressed_by_user|popup_failed_to_open|popup_closed_by_user/i.test(message);
const isFedCmNetworkError = (message) =>
  /fedcm.*networkerror|networkerror.*retrieving a token|errore fedcm nel recupero token|issuing_failed/i.test(
    String(message || "").toLowerCase(),
  );
const isFedCmDisabledByBrowser = (message) =>
  /fedcm was disabled|third-party sign-in|manage third-party sign-in|site settings/i.test(
    String(message || "").toLowerCase(),
  );

const safeParseJson = async (response) => {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
};

const normalizeGoogleIdToken = (value) => (typeof value === "string" ? value.trim() : "");

const logGoogleConfigHints = (message, { origin, redirectUri, clientId } = {}) => {
  if (!import.meta.env.DEV) {
    return;
  }

  const lowerMessage = String(message || "").toLowerCase();
  const isOriginIssue =
    lowerMessage.includes("origin") ||
    lowerMessage.includes("unregistered_origin") ||
    lowerMessage.includes("not available for this origin");
  const isClientIssue =
    lowerMessage.includes("invalid_client") || lowerMessage.includes("missing_client_id");
  const isFedCmIssue = lowerMessage.includes("fedcm") || lowerMessage.includes("networkerror") || lowerMessage.includes("issuing_failed");

  if (!isOriginIssue && !isClientIssue && !isFedCmIssue) {
    return;
  }

  console.warn("[GoogleAuth] Possible OAuth configuration issue", {
    message,
    origin: origin || (typeof window !== "undefined" ? window.location.origin : "(unknown-origin)"),
    redirectUri: redirectUri || "(not-used-in-gis-popup-flow)",
    clientId,
    hints: [
      "Verifica Authorized JavaScript origins nel Google Cloud Console",
      "Verifica che VITE_GOOGLE_CLIENT_ID e GOOGLE_CLIENT_ID coincidano",
      "Se usi redirect flow, verifica Authorized redirect URIs",
      "Verifica CSP connect-src/script-src verso https://accounts.google.com",
      "Se in iframe, verifica allow=\"identity-credentials-get\" sul frame parent",
    ],
  });
};

export const maskEmail = (email) => {
  if (typeof email !== "string" || !email.includes("@")) {
    return "(unknown)";
  }

  const [localPartRaw, domainPartRaw] = email.split("@");
  const localPart = localPartRaw?.trim() || "";
  const domainPart = domainPartRaw?.trim() || "";

  if (!localPart || !domainPart) {
    return "(invalid-email)";
  }

  const [domainNameRaw, ...domainSuffixParts] = domainPart.split(".");
  const domainName = domainNameRaw?.trim() || "";
  if (!domainName) {
    return "(invalid-email)";
  }

  const maskedLocal = localPart.length <= 2 ? `${localPart[0]}*` : `${localPart.slice(0, 1)}***${localPart.slice(-1)}`;
  const maskedDomain = `${domainName.slice(0, 1)}***`;
  const suffix = domainSuffixParts.join(".");

  return `${maskedLocal}@${maskedDomain}${suffix ? `.${suffix}` : ""}`;
};

export class GoogleAuthError extends Error {
  constructor({ status = 0, code = ERROR_CODE.UNKNOWN, message = DEFAULT_ERROR_MESSAGE, payload } = {}) {
    super(message);
    this.name = "GoogleAuthError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

export const authenticateWithGoogle = async ({
  apiBaseUrl,
  googleClientId,
  redirectUri,
  debugRawResponse = false,
  mode,
  workspaceName,
  workspaceSlug,
  idToken,
}) => {
  if (!googleClientId) {
    throw new GoogleAuthError({
      code: ERROR_CODE.UNKNOWN,
      message: "Login Google non disponibile al momento.",
    });
  }

  if (!apiBaseUrl) {
    throw new GoogleAuthError({
      code: ERROR_CODE.UNKNOWN,
      message: DEFAULT_ERROR_MESSAGE,
    });
  }

  if (mode !== GOOGLE_AUTH_MODE.login && mode !== GOOGLE_AUTH_MODE.signup) {
    throw new GoogleAuthError({
      status: 400,
      code: ERROR_CODE.BAD_REQUEST,
      message: "Richiesta Google non valida. Controlla i dati e riprova.",
    });
  }

  if (mode === GOOGLE_AUTH_MODE.signup && (!workspaceName || !workspaceSlug)) {
    throw new GoogleAuthError({
      status: 400,
      code: ERROR_CODE.BAD_REQUEST,
      message: "Richiesta Google non valida. Controlla i dati e riprova.",
    });
  }

  try {
    const providedIdToken = normalizeGoogleIdToken(idToken);
    const googleIdTokenRaw =
      providedIdToken ||
      (await requestGoogleIdToken(googleClientId, {
        redirectUri,
        debugRawResponse,
      }));
    const googleIdToken = normalizeGoogleIdToken(googleIdTokenRaw);

    if (!googleIdToken) {
      throw new GoogleAuthError({
        status: 400,
        code: ERROR_CODE.BAD_REQUEST,
        message: "Google non ha restituito un token valido. Riprova.",
      });
    }

    if (import.meta.env.DEV) {
      console.info("[GoogleAuth] Received Google ID token", {
        idTokenLength: googleIdToken.length,
        origin: typeof window !== "undefined" ? window.location.origin : "(unknown-origin)",
        redirectUri: redirectUri || "(not-used-in-gis-popup-flow)",
      });
    }

    const requestBody =
      mode === GOOGLE_AUTH_MODE.signup
        ? {
            mode,
            idToken: googleIdToken,
            credential: googleIdToken,
            workspaceName,
            workspaceSlug,
          }
        : {
            mode,
            idToken: googleIdToken,
            credential: googleIdToken,
          };

    const response = await fetch(`${apiBaseUrl}/auth/google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(import.meta.env.DEV ? { "x-google-client-id-debug": googleClientId } : {}),
      },
      credentials: "include",
      body: JSON.stringify(requestBody),
    });

    const payload = await safeParseJson(response);

    if (import.meta.env.DEV) {
      console.info("[GoogleAuth] /auth/google response", {
        status: response.status,
        ok: response.ok,
        payload,
      });
    }

    if (!response.ok) {
      const mappedError = mapErrorFromResponse(response.status, payload);
      logGoogleConfigHints(mappedError.message, {
        origin: typeof window !== "undefined" ? window.location.origin : "(unknown-origin)",
        redirectUri,
        clientId: googleClientId,
      });
      throw new GoogleAuthError({
        status: response.status,
        code: mappedError.code,
        message: mappedError.message,
        payload: sanitizePayload(payload),
      });
    }

    const responseData = payload?.data ?? payload;
    const token = responseData?.token;
    const user = responseData?.user;
    const workspace = responseData?.workspace;
    const branding = responseData?.branding;
    const onboardingRequired = responseData?.onboardingRequired === true;
    const isNewUser = responseData?.isNewUser === true;
    const isNewWorkspace = responseData?.isNewWorkspace === true;

    if (!token || !user?.id || !user?.email || !user?.role) {
      throw new GoogleAuthError({
        code: ERROR_CODE.UNKNOWN,
        message: "Risposta di autenticazione non valida.",
      });
    }

    if (import.meta.env.DEV) {
      console.info(`[GoogleAuth] ${mode} ok per ${maskEmail(user.email)}`);
    }

    return {
      token,
      user,
      workspace,
      branding,
      onboardingRequired,
      isNewUser,
      isNewWorkspace,
    };
  } catch (error) {
    if (error instanceof GoogleAuthError) {
      throw error;
    }

    const rawMessage = error instanceof Error ? error.message : "";
    logGoogleConfigHints(rawMessage, {
      origin: typeof window !== "undefined" ? window.location.origin : "(unknown-origin)",
      redirectUri,
      clientId: googleClientId,
    });
    const message = isPopupOrCancelMessage(rawMessage)
      ? "Popup Google bloccato o accesso annullato. Abilita i popup e riprova."
      : isFedCmDisabledByBrowser(rawMessage)
        ? "Sign-in Google bloccato dal browser: FedCM/dispositivo di terze parti disabilitato per questo sito. Riabilitalo nelle impostazioni del sito e riprova."
      : isFedCmNetworkError(rawMessage)
        ? "Errore FedCM nel recupero del token Google. Verifica origin OAuth, CSP e configurazione browser."
      : rawMessage && isFriendlyClientMessage(rawMessage)
        ? rawMessage
        : DEFAULT_ERROR_MESSAGE;

    throw new GoogleAuthError({
      code: ERROR_CODE.UNKNOWN,
      message,
    });
  }
};
