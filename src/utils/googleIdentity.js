let initializedClientId = null;
let pendingPromptRequest = null;
const DEFAULT_TIMEOUT_MS = 30000;
const MIN_TIMEOUT_MS = 1000;
const GOOGLE_OAUTH_SCOPES = "openid email profile";

const getGoogleAccountsApi = () => window.google?.accounts?.id;
const getGoogleOauthApi = () => window.google?.accounts?.oauth2;

const settlePromptRequest = (resolver, value) => {
  if (!pendingPromptRequest) {
    return;
  }

  const currentRequest = pendingPromptRequest;
  pendingPromptRequest = null;
  clearTimeout(currentRequest.timeoutId);
  resolver(value);
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
    case "access_token_missing":
      return "Google non ha restituito un access token valido. Riprova.";
    case "skipped":
    case "issuing_failed":
      return "Google Sign-In non disponibile. Verifica origin OAuth, CSP e configurazione FedCM.";
    case "not_displayed":
      return "Google Sign-In non visualizzato. Verifica origin OAuth e configurazione browser.";
    case "fedcm_iframe_not_allowed":
      return "FedCM bloccato nel frame corrente. Verifica allow=\"identity-credentials-get\" sugli iframe parent.";
    case "fedcm_network_error":
      return "Errore FedCM nel recupero token. Verifica CSP/connect-src verso accounts.google.com.";
    case "oauth_popup_failed_to_open":
      return "Popup OAuth non aperto. Abilita i popup e riprova.";
    case "oauth_popup_closed":
      return "Popup OAuth chiuso prima del completamento.";
    case "access_denied":
      return "Permesso Google negato. Riprova.";
    case "origin_mismatch":
      return "Origin non autorizzata nel client OAuth Google.";
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

const normalizeToken = (value) => (typeof value === "string" ? value.trim() : "");

const shouldFallbackToOauthPopup = (error) => {
  const message = String(error instanceof Error ? error.message : "").toLowerCase();
  if (!message) {
    return true;
  }

  if (
    message.includes("invalid_client")
    || message.includes("missing_client_id")
    || message.includes("unregistered_origin")
    || message.includes("origin_mismatch")
    || message.includes("secure_http_required")
    || message.includes("browser_not_supported")
  ) {
    return false;
  }

  if (
    message.includes("suppressed_by_user")
    || message.includes("popup_failed_to_open")
    || message.includes("popup_closed_by_user")
    || message.includes("user_cancel")
    || message.includes("cancel_called")
  ) {
    return false;
  }

  return true;
};

const ensureGoogleInitialized = (clientId) => {
  const googleAccountsApi = getGoogleAccountsApi();
  if (!googleAccountsApi) {
    throw new Error("Google Identity Services non caricato.");
  }

  if (initializedClientId === clientId) {
    return;
  }

  googleAccountsApi.initialize({
    client_id: clientId,
    auto_select: false,
    // Avoid forcing FedCM in all environments: some browser/site configurations can block it.
    itp_support: true,
    use_fedcm_for_prompt: false,
    callback: (response) => {
      if (!pendingPromptRequest) {
        return;
      }

      const credential = typeof response?.credential === "string" ? response.credential.trim() : "";

      if (!credential) {
        settlePromptRequest(pendingPromptRequest.reject, buildPromptError("credential_missing"));
        return;
      }

      settlePromptRequest(pendingPromptRequest.resolve, credential);
    },
  });

  initializedClientId = clientId;
};

const requestIdTokenViaPrompt = (clientId, options = {}) =>
  new Promise((resolve, reject) => {
    if (!clientId || typeof clientId !== "string" || clientId.trim().length === 0) {
      reject(new Error("VITE_GOOGLE_CLIENT_ID mancante."));
      return;
    }

    let googleAccountsApi;
    try {
      ensureGoogleInitialized(clientId.trim());
      googleAccountsApi = getGoogleAccountsApi();
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Inizializzazione Google non riuscita."));
      return;
    }

    if (!googleAccountsApi) {
      reject(new Error("Google Identity Services non disponibile."));
      return;
    }

    if (pendingPromptRequest) {
      settlePromptRequest(pendingPromptRequest.reject, new Error("Richiesta Google precedente annullata."));
      if (typeof googleAccountsApi.cancel === "function") {
        googleAccountsApi.cancel();
      }
    }

    const parsedTimeoutMs = Number(options.timeoutMs);
    const timeoutMs = Number.isFinite(parsedTimeoutMs) && parsedTimeoutMs >= MIN_TIMEOUT_MS ? parsedTimeoutMs : DEFAULT_TIMEOUT_MS;
    pendingPromptRequest = {
      resolve,
      reject,
      timeoutId: setTimeout(() => {
        settlePromptRequest(reject, buildPromptError("timeout"));
      }, timeoutMs),
    };

    googleAccountsApi.prompt();
  });

const requestAccessTokenViaOauthPopup = (clientId, options = {}) =>
  new Promise((resolve, reject) => {
    if (!clientId || typeof clientId !== "string" || clientId.trim().length === 0) {
      reject(new Error("VITE_GOOGLE_CLIENT_ID mancante."));
      return;
    }

    const googleOauthApi = getGoogleOauthApi();
    if (!googleOauthApi || typeof googleOauthApi.initTokenClient !== "function") {
      reject(buildPromptError("browser_not_supported"));
      return;
    }

    const parsedTimeoutMs = Number(options.timeoutMs);
    const timeoutMs = Number.isFinite(parsedTimeoutMs) && parsedTimeoutMs >= MIN_TIMEOUT_MS ? parsedTimeoutMs : DEFAULT_TIMEOUT_MS;
    let completed = false;
    const finish = (resolver, value) => {
      if (completed) {
        return;
      }

      completed = true;
      clearTimeout(timeoutId);
      resolver(value);
    };

    const timeoutId = setTimeout(() => {
      finish(reject, buildPromptError("timeout"));
    }, timeoutMs);

    try {
      const tokenClient = googleOauthApi.initTokenClient({
        client_id: clientId.trim(),
        scope: GOOGLE_OAUTH_SCOPES,
        prompt: "select_account",
        callback: (response) => {
          if (!response || typeof response !== "object") {
            finish(reject, buildPromptError("access_token_missing"));
            return;
          }

          const oauthError = typeof response.error === "string" ? response.error : "";
          if (oauthError) {
            finish(reject, buildPromptError(oauthError));
            return;
          }

          const accessToken = normalizeToken(response.access_token);
          if (!accessToken) {
            finish(reject, buildPromptError("access_token_missing"));
            return;
          }

          finish(resolve, accessToken);
        },
        error_callback: (oauthError) => {
          const fallbackReason =
            typeof oauthError?.type === "string"
              ? oauthError.type
              : "oauth_popup_failed_to_open";
          finish(reject, buildPromptError(fallbackReason));
        },
      });

      tokenClient.requestAccessToken();
    } catch {
      finish(reject, buildPromptError("oauth_popup_failed_to_open"));
    }
  });

export const requestGoogleIdToken = async (clientId, options = {}) => {
  try {
    return await requestIdTokenViaPrompt(clientId, options);
  } catch (error) {
    if (!shouldFallbackToOauthPopup(error)) {
      throw error;
    }

    return requestAccessTokenViaOauthPopup(clientId, options);
  }
};

export const isGoogleIdentityAvailable = () => Boolean(getGoogleAccountsApi());

export const resetGoogleIdentitySession = () => {
  const googleAccountsApi = getGoogleAccountsApi();

  if (pendingPromptRequest) {
    settlePromptRequest(pendingPromptRequest.reject, buildPromptError("cancel_called"));
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
