let initializedClientId = null;
let pendingRequest = null;
const DEFAULT_TIMEOUT_MS = 30000;
const MIN_TIMEOUT_MS = 1000;

const getGoogleAccountsApi = () => window.google?.accounts?.id;
const isRunningInIframe = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

const settlePendingRequest = (resolver, value) => {
  if (!pendingRequest) {
    return;
  }

  const currentRequest = pendingRequest;
  pendingRequest = null;
  clearTimeout(currentRequest.timeoutId);
  resolver(value);
};

const summarizeGoogleCallbackResponse = (response) => {
  const credential = typeof response?.credential === "string" ? response.credential : "";
  const credentialPreview =
    credential.length > 16 ? `${credential.slice(0, 8)}...${credential.slice(-8)}` : credential || "(missing)";

  return {
    ...response,
    credential: credential ? "[redacted]" : "(missing)",
    credentialLength: credential.length,
    credentialPreview,
    select_by: typeof response?.select_by === "string" ? response.select_by : "(missing)",
  };
};

const resolvePromptErrorMessage = (reason) => {
  switch (reason) {
    case "suppressed_by_user":
    case "popup_failed_to_open":
      return "Popup Google bloccato dal browser. Abilita i popup e riprova.";
    case "user_cancel":
    case "auto_cancel":
    case "tap_outside":
    case "cancel_called":
    case "popup_closed_by_user":
      return "Accesso Google annullato dall'utente.";
    case "timeout":
      return "Timeout durante l'accesso Google. Verifica che il browser consenta il sign-in di terze parti (FedCM) e riprova.";
    case "invalid_client":
    case "missing_client_id":
    case "unregistered_origin":
      return "Configurazione Google non valida. Verifica client ID e origin autorizzate.";
    case "secure_http_required":
      return "Google Sign-In richiede HTTPS (localhost consentito in sviluppo).";
    case "browser_not_supported":
      return "Browser non supportato da Google Sign-In.";
    case "credential_missing":
      return "Google non ha restituito credenziali valide. Riprova.";
    case "skipped":
    case "issuing_failed":
      return "Google Sign-In non disponibile. Verifica origin OAuth, CSP e configurazione FedCM.";
    case "fedcm_iframe_not_allowed":
      return "FedCM bloccato nel frame corrente. Verifica allow=\"identity-credentials-get\" sugli iframe parent.";
    case "fedcm_network_error":
      return "Errore FedCM nel recupero token. Verifica CSP/connect-src verso accounts.google.com.";
    case "flow_restarted":
    case "dismissed":
      return "Google Sign-In non disponibile al momento. Riprova.";
    default:
      return "Google Sign-In non disponibile al momento. Riprova.";
  }
};

const buildPromptError = (reason) => {
  const message = resolvePromptErrorMessage(reason);
  return new Error(reason ? `${message} [${reason}]` : message);
};

const ensureGoogleInitialized = (clientId, diagnostics) => {
  const googleAccountsApi = getGoogleAccountsApi();
  if (!googleAccountsApi) {
    throw new Error("Google Identity Services non caricato.");
  }

  if (initializedClientId === clientId) {
    return;
  }

  if (import.meta.env.DEV) {
    console.info("[GoogleSignIn] Initializing GIS client", {
      clientId,
      clientIdLength: clientId.length,
      origin: diagnostics.origin,
      redirectUri: diagnostics.redirectUri || "(not-used-in-gis-popup-flow)",
    });
  }

  googleAccountsApi.initialize({
    client_id: clientId,
    auto_select: false,
    // Avoid forcing FedCM in all environments: some browser/site configurations can block it.
    itp_support: true,
    use_fedcm_for_prompt: false,
    callback: (response) => {
      if (!pendingRequest) {
        return;
      }

      if (import.meta.env.DEV) {
        if (diagnostics.debugRawResponse) {
          console.info("[GoogleSignIn] GIS callback raw response", response);
        } else {
          console.info("[GoogleSignIn] GIS callback response", summarizeGoogleCallbackResponse(response));
        }
      }

      const credential = typeof response?.credential === "string" ? response.credential.trim() : "";

      if (!credential) {
        settlePendingRequest(pendingRequest.reject, buildPromptError("credential_missing"));
        return;
      }

      settlePendingRequest(pendingRequest.resolve, credential);
    },
  });

  initializedClientId = clientId;
};

export const requestGoogleIdToken = (clientId, options = {}) =>
  new Promise((resolve, reject) => {
    if (!clientId || typeof clientId !== "string" || clientId.trim().length === 0) {
      reject(new Error("VITE_GOOGLE_CLIENT_ID mancante."));
      return;
    }

    const diagnostics = {
      redirectUri: typeof options.redirectUri === "string" ? options.redirectUri.trim() : "",
      debugRawResponse: options.debugRawResponse === true,
      origin: typeof window !== "undefined" ? window.location.origin : "(unknown-origin)",
    };

    if (import.meta.env.DEV) {
      console.info("[GoogleSignIn] Requesting ID token", {
        clientId,
        clientIdLength: clientId.trim().length,
        origin: diagnostics.origin,
        redirectUri: diagnostics.redirectUri || "(not-used-in-gis-popup-flow)",
        timeoutMs: options.timeoutMs,
        debugRawResponse: diagnostics.debugRawResponse,
        inIframe: typeof window !== "undefined" ? isRunningInIframe() : false,
      });
    }

    let googleAccountsApi;
    try {
      ensureGoogleInitialized(clientId.trim(), diagnostics);
      googleAccountsApi = getGoogleAccountsApi();
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Inizializzazione Google non riuscita."));
      return;
    }

    if (!googleAccountsApi) {
      reject(new Error("Google Identity Services non disponibile."));
      return;
    }

    if (pendingRequest) {
      settlePendingRequest(pendingRequest.reject, new Error("Richiesta Google precedente annullata."));
      if (typeof googleAccountsApi.cancel === "function") {
        googleAccountsApi.cancel();
      }
    }

    const parsedTimeoutMs = Number(options.timeoutMs);
    const timeoutMs = Number.isFinite(parsedTimeoutMs) && parsedTimeoutMs >= MIN_TIMEOUT_MS ? parsedTimeoutMs : DEFAULT_TIMEOUT_MS;
    pendingRequest = {
      resolve,
      reject,
      timeoutId: setTimeout(() => {
        settlePendingRequest(reject, buildPromptError("timeout"));
      }, timeoutMs),
    };

    googleAccountsApi.prompt();
  });

export const isGoogleIdentityAvailable = () => Boolean(getGoogleAccountsApi());

export const resetGoogleIdentitySession = () => {
  const googleAccountsApi = getGoogleAccountsApi();

  if (pendingRequest) {
    settlePendingRequest(pendingRequest.reject, buildPromptError("cancel_called"));
  }

  if (googleAccountsApi && typeof googleAccountsApi.cancel === "function") {
    googleAccountsApi.cancel();
  }

  // Recommended on app logout to avoid stale One Tap/FedCM state.
  if (googleAccountsApi && typeof googleAccountsApi.disableAutoSelect === "function") {
    googleAccountsApi.disableAutoSelect();
  }

  initializedClientId = null;
};
