import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useEffect, useRef, useState } from "react";
import { Button, Col, Container, Form, InputGroup, Row } from "react-bootstrap";
import { Link, useHistory, useLocation } from "react-router-dom";
import CommanFooter1 from "../../CommanFooter1";
import { useSession } from "../../../../hooks/useSession";
import { authenticateWithGoogle, GoogleAuthError } from "../../../../utils/googleAuthClient";
import { requestGoogleIdToken } from "../../../../utils/googleIdentity";
import { getClientRuntimeConfig } from "../../../../utils/runtimeConfig";

// Images
import AdvaioraLogoWhite from "../../../../assets/img/AdvaioraLogo-White.png";
import AdvaioraLogoBlack from "../../../../assets/img/AdvaioraLogo-Black.png";

import signupBg from "../../../../assets/img/signup-bg.jpg";

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const Signup = () => {
  const history = useHistory();
  const location = useLocation();
  const { login } = useSession();
  const redirectTimeoutRef = useRef(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googlePendingIdToken, setGooglePendingIdToken] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState({
    email: false,
    workspaceName: false,
    workspaceSlug: false,
    password: false,
    terms: false,
  });

  const runtimeConfig = getClientRuntimeConfig();
  const apiBaseUrl = runtimeConfig.apiBaseUrl;
  const googleClientId = runtimeConfig.googleClientId;
  const googleRedirectUri = runtimeConfig.googleRedirectUri;
  const googleDebugRawResponse = runtimeConfig.googleDebugRawResponse;
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = name.trim();
  const normalizedWorkspaceName = workspaceName.trim();
  const normalizedWorkspaceSlug = workspaceSlug.trim().toLowerCase();
  const emailError = normalizedEmail === "" || !isValidEmail(normalizedEmail);
  const passwordError = password.length < 8;
  const workspaceNameError = normalizedWorkspaceName === "";
  const workspaceSlugError = normalizedWorkspaceSlug === "";
  const termsError = !termsAccepted;
  const slugHasInvalidChars = normalizedWorkspaceSlug !== "" && /[^a-z0-9-]/.test(normalizedWorkspaceSlug);
  const isBusy = formLoading || googleLoading;
  const isSubmitDisabled = isBusy || emailError || passwordError || workspaceNameError || workspaceSlugError || termsError || slugHasInvalidChars;
  const showEmailError = (touched.email || submitAttempted) && emailError;
  const showWorkspaceNameError = (touched.workspaceName || submitAttempted) && workspaceNameError;
  const showWorkspaceSlugError = (touched.workspaceSlug || submitAttempted) && (workspaceSlugError || slugHasInvalidChars);
  const showPasswordError = (touched.password || submitAttempted) && passwordError;
  const showTermsError = (touched.terms || submitAttempted) && termsError;
  const isGoogleSignupDisabled = isBusy || !googleClientId;
  const isGoogleWorkspaceStep = googlePendingIdToken.length > 0;
  const resolvePostAuthPath = (onboardingRequired) => (onboardingRequired ? "/dashboard?onboarding=1" : "/dashboard");

  useEffect(
    () => () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const suggestedEmail =
      location?.state && typeof location.state === "object" && typeof location.state.suggestedEmail === "string"
        ? location.state.suggestedEmail.trim().toLowerCase()
        : "";
    const pendingGoogleToken =
      location?.state && typeof location.state === "object" && typeof location.state.googlePendingIdToken === "string"
        ? location.state.googlePendingIdToken.trim()
        : "";

    if (suggestedEmail && !email.trim()) {
      setEmail(suggestedEmail);
    }
    if (pendingGoogleToken && !googlePendingIdToken) {
      setGooglePendingIdToken(pendingGoogleToken);
      setErrorMessage("");
      setSuccessMessage("Accesso Google completato. Inserisci i dati del workspace per terminare.");
    }
  }, [location, email, googlePendingIdToken]);

  const handleWorkspaceNameChange = (event) => {
    const value = event.target.value;
    setWorkspaceName(value);
    if (!slugEdited) {
      setWorkspaceSlug(slugify(value));
    }
  };

  const handleWorkspaceSlugChange = (event) => {
    setSlugEdited(true);
    setWorkspaceSlug(
      event.target.value
        .toLowerCase()
        .trim()
        .replace(/[\s_]+/g, "-")
    );
  };

  const handleFieldBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const resolveErrorMessage = (status, payload) => {
    const serverMessage = payload?.error?.message || payload?.message;

    if (status === 409) {
      return "Errore durante la registrazione.";
    }

    if (status === 400) {
      return "Errore durante la registrazione.";
    }

    if (status === 401) {
      return "Accesso Google non valido. Riprova.";
    }

    return serverMessage || "Registrazione non riuscita. Riprova.";
  };

  const scheduleRedirect = (path, delayMs = 700) => {
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
    }

    redirectTimeoutRef.current = setTimeout(() => {
      history.push(path);
    }, delayMs);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isBusy) {
      return;
    }

    setSubmitAttempted(true);
    setErrorMessage("");
    setSuccessMessage("");

    if (emailError || passwordError || workspaceNameError || workspaceSlugError || termsError || slugHasInvalidChars) {
      return;
    }

    setFormLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: normalizedName || undefined,
          email: normalizedEmail,
          password,
          workspaceName: normalizedWorkspaceName,
          workspaceSlug: normalizedWorkspaceSlug,
        }),
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch (_error) {
        payload = null;
      }

      if (!response.ok) {
        setErrorMessage(resolveErrorMessage(response.status, payload));
        return;
      }

      const responseData = payload?.data ?? payload;
      const token = responseData?.token;
      const user = responseData?.user;
      const workspace = responseData?.workspace;
      const onboardingRequired = responseData?.onboardingRequired === true;

      if (!token || !user?.id || !user?.email || !user?.role) {
        setErrorMessage("Risposta di autenticazione non valida.");
        return;
      }

      login({
        accessToken: token,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        workspaceId: workspace?.id,
        workspaceSlug: workspace?.slug,
      });

      setSuccessMessage("Account creato con successo. Reindirizzamento...");
      scheduleRedirect(resolvePostAuthPath(onboardingRequired), 500);
    } catch (_error) {
      setErrorMessage("Errore di rete. Riprova tra qualche istante.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (isBusy) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    if (!isGoogleWorkspaceStep) {
      setTouched((prev) => ({
        ...prev,
        terms: true,
      }));
      if (termsError) {
        return;
      }
    } else {
      setTouched((prev) => ({
        ...prev,
        workspaceName: true,
        workspaceSlug: true,
        terms: true,
      }));
      if (workspaceNameError || workspaceSlugError || termsError || slugHasInvalidChars) {
        return;
      }
    }

    if (!googleClientId) {
      setErrorMessage("Registrazione Google non disponibile al momento.");
      return;
    }

    if (import.meta.env.DEV) {
      console.info("[GoogleSignIn] Starting signup flow", {
        googleClientId,
        googleClientIdLength: googleClientId.length,
        redirectUri: googleRedirectUri || "(not-used-in-gis-popup-flow)",
        origin: window.location.origin,
        apiBaseUrl,
        googleDebugRawResponse,
        isGoogleWorkspaceStep,
      });
    }

    setGoogleLoading(true);

    try {
      if (!isGoogleWorkspaceStep) {
        const idToken = await requestGoogleIdToken(googleClientId, {
          redirectUri: googleRedirectUri,
          debugRawResponse: googleDebugRawResponse,
        });

        try {
          const result = await authenticateWithGoogle({
            apiBaseUrl,
            googleClientId,
            redirectUri: googleRedirectUri,
            debugRawResponse: googleDebugRawResponse,
            mode: "login",
            idToken,
          });
          const { token, user, workspace, onboardingRequired } = result;

          login({
            accessToken: token,
            userId: user.id,
            userEmail: user.email,
            userRole: user.role,
            workspaceId: workspace?.id,
            workspaceSlug: workspace?.slug,
          });

          setSuccessMessage("Accesso effettuato. Reindirizzamento...");
          scheduleRedirect(resolvePostAuthPath(onboardingRequired), 500);
          return;
        } catch (error) {
          const normalizedError =
            error instanceof GoogleAuthError
              ? error
              : new GoogleAuthError({
                  message: "Registrazione Google non riuscita. Riprova.",
                });

          if (normalizedError.code === "NO_WORKSPACE") {
            setGooglePendingIdToken(idToken);
            setSuccessMessage("Accesso Google completato. Inserisci i dati del workspace per terminare.");
            return;
          }

          throw normalizedError;
        }
      }

      const result = await authenticateWithGoogle({
        apiBaseUrl,
        googleClientId,
        redirectUri: googleRedirectUri,
        debugRawResponse: googleDebugRawResponse,
        mode: "signup",
        workspaceName: normalizedWorkspaceName,
        workspaceSlug: normalizedWorkspaceSlug,
        idToken: googlePendingIdToken,
      });
      const { token, user, workspace, onboardingRequired } = result;

      login({
        accessToken: token,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        workspaceId: workspace?.id,
        workspaceSlug: workspace?.slug,
      });

      setGooglePendingIdToken("");
      setSuccessMessage("Accesso effettuato. Reindirizzamento...");
      scheduleRedirect(resolvePostAuthPath(onboardingRequired), 500);
    } catch (error) {
      const normalizedError =
        error instanceof GoogleAuthError
          ? error
          : new GoogleAuthError({
              message: "Registrazione Google non riuscita. Riprova.",
            });
      if (normalizedError.code === "SLUG_TAKEN") {
        setTouched((prev) => ({ ...prev, workspaceSlug: true }));
      }
      if (normalizedError.code === "INVALID_TOKEN" && isGoogleWorkspaceStep) {
        setGooglePendingIdToken("");
        setErrorMessage("Sessione Google scaduta. Premi di nuovo \"Registrati con Google\".");
        return;
      }
      setErrorMessage(normalizedError.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  // Coerente con il giallo usato nella Login (Advaiora)
  const leftPanelBackground = "var(--primary, #facc15)";

  return (
    <div className="hk-pg-wrapper py-0">
      <div className="hk-pg-body py-0">
        <Container fluid>
          <Row className="auth-split">
            {/* PANNELLO SINISTRO (GIALLO ADVAIORA) */}
            <Col
              xl={5}
              lg={6}
              md={5}
              className="d-md-block d-none position-relative"
              style={{
                background: leftPanelBackground,
                overflow: "hidden",
                color: "#000", // FORZA TESTO NERO SU TUTTO IL PANNELLO
              }}
            >
              {/* Immagine tenue sopra il giallo (senza blend mode, così il testo resta nero) */}
              <img
                className="bg-img"
                src={signupBg}
                alt="sfondo"
                style={{
                  opacity: 0.08,
                }}
              />

              <div className="auth-content py-8">
                <Row>
                  <Col xxl={8} className="mx-auto">
                    <div className="text-center">
                      <img src={AdvaioraLogoBlack} alt="Advaiora" style={{ width: "220px" }} className="mb-4" />
                      <h3 className="mb-2">Crea il tuo account</h3>
                      <p className="mb-0" style={{ opacity: 0.75 }}>
                        Entra in Advaiora e inizia a lavorare sui progetti.
                      </p>
                    </div>

                    <ul className="list-icon mt-4" style={{ opacity: 0.9 }}>
                      <li className="mb-1">
                        <p className="mb-0">
                          <i className="ri-check-fill" />
                          <span>Accesso a progetti, pipeline e attività del workspace</span>
                        </p>
                      </li>
                      <li className="mb-1">
                        <p className="mb-0">
                          <i className="ri-check-fill" />
                          <span>Flusso di lavoro chiaro, aggiornamenti in tempo reale</span>
                        </p>
                      </li>
                    </ul>
                  </Col>
                </Row>
              </div>
            </Col>

            {/* PANNELLO DESTRO (FORM) */}
            <Col xl={7} lg={6} md={7} sm={10} className="position-relative mx-auto">
              <div className="auth-content flex-column pt-8 pb-md-8 pb-13 mb-4">
                <div className="text-center mb-7"></div>

                <Form className="w-100" onSubmit={handleSubmit}>
                  <Row>
                    <Col xxl={5} xl={7} lg={10} className="mx-auto">
                      <h4 className="text-center mb-4 d-flex align-items-center justify-content-center gap-2">
                        Registrati su
                        <img
                          src={AdvaioraLogoWhite}
                          alt="Advaiora"
                          style={{
                            height: "26px",
                            width: "auto",
                          }}
                        />
                      </h4>

                      <Button variant="outline-dark" className="btn-rounded btn-block mb-3" type="button" onClick={handleGoogleSignup} disabled={isGoogleSignupDisabled}>
                        <span>
                          <span className="icon">
                            <FontAwesomeIcon icon={faGoogle} />
                          </span>
                          <span>
                            {googleLoading
                              ? isGoogleWorkspaceStep
                                ? "Completamento..."
                                : "Accesso..."
                              : isGoogleWorkspaceStep
                                ? "Completa registrazione Google"
                                : "Registrati con Google"}
                          </span>
                        </span>
                      </Button>
                      {isGoogleWorkspaceStep && <small className="text-muted d-block mb-2">Ora completa nome e indirizzo del workspace.</small>}

                      <div className="title-sm title-wth-divider divider-center my-4">
                        <span>Oppure</span>
                      </div>

                      {errorMessage && (
                        <div className="alert alert-danger py-2" role="alert">
                          {errorMessage}
                        </div>
                      )}

                      {successMessage && (
                        <div className="alert alert-success py-2" role="alert">
                          {successMessage}
                        </div>
                      )}

                      <Row className="gx-3">
                        <Col lg={12} as={Form.Group} className="mb-3">
                          <Form.Label>Nome</Form.Label>
                          <Form.Control
                            placeholder="Inserisci il tuo nome"
                            type="text"
                            value={name}
                            onChange={(event) => {
                              setName(event.target.value);
                              setErrorMessage("");
                            }}
                          />
                        </Col>

                        <Col lg={12} as={Form.Group} className="mb-3">
                          <Form.Label>Email</Form.Label>
                          <Form.Control
                            placeholder="Inserisci la tua email"
                            type="email"
                            value={email}
                            onChange={(event) => {
                              setEmail(event.target.value);
                              setErrorMessage("");
                            }}
                            onBlur={() => handleFieldBlur("email")}
                          />
                          {showEmailError && <small className="text-danger d-block mt-1">Inserisci un'email valida.</small>}
                        </Col>

                        <Col lg={12} as={Form.Group} className="mb-3">
                          <Form.Label>Nome del tuo spazio di lavoro</Form.Label>
                          <Form.Control
                            placeholder="Es. Advaiora Team"
                            type="text"
                            value={workspaceName}
                            onChange={(event) => {
                              handleWorkspaceNameChange(event);
                              setErrorMessage("");
                            }}
                            onBlur={() => handleFieldBlur("workspaceName")}
                          />
                          <Form.Text className="text-muted d-block mt-1">E' il nome che vedrai nel tuo CRM.</Form.Text>
                          {showWorkspaceNameError && <small className="text-danger d-block mt-1">Inserisci il nome del tuo spazio di lavoro.</small>}
                        </Col>

                        <Col lg={12} as={Form.Group} className="mb-3">
                          <Form.Label>Indirizzo personalizzato</Form.Label>
                          <Form.Control
                            placeholder="es. advaiora-team"
                            type="text"
                            value={workspaceSlug}
                            onChange={(event) => {
                              handleWorkspaceSlugChange(event);
                              setErrorMessage("");
                            }}
                            onBlur={() => handleFieldBlur("workspaceSlug")}
                          />
                          <Form.Text className="text-muted d-block mt-1">Sara' usato nell'indirizzo di accesso.</Form.Text>
                          {showWorkspaceSlugError && (
                            <small className="text-danger d-block mt-1">
                              {workspaceSlugError ? "Inserisci un indirizzo personalizzato." : "Usa solo lettere minuscole, numeri e trattini."}
                            </small>
                          )}
                          {workspaceSlug && (
                            <small className={`d-block mt-1 ${slugHasInvalidChars ? "text-danger" : "text-muted"}`}>
                              L'indirizzo sara': app.tuosito.com/{normalizedWorkspaceSlug}
                            </small>
                          )}
                        </Col>

                        <Col lg={12} as={Form.Group} className="mb-3">
                          <Form.Label>Password</Form.Label>
                          <InputGroup className="password-check">
                            <span className="input-affix-wrapper affix-wth-text">
                              <Form.Control
                                placeholder="Minimo 8 caratteri"
                                type={showPassword ? "text" : "password"}
                                autoComplete="new-password"
                                value={password}
                                onChange={(event) => {
                                  setPassword(event.target.value);
                                  setErrorMessage("");
                                }}
                                onBlur={() => handleFieldBlur("password")}
                              />
                              {/* Show/Hide: niente navigazione */}
                              <button
                                type="button"
                                className="input-suffix text-primary text-uppercase fs-8 fw-medium btn btn-link p-0"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{ textDecoration: "none" }}
                              >
                                {showPassword ? <span>Nascondi</span> : <span>Mostra</span>}
                              </button>
                            </span>
                          </InputGroup>
                          {showPasswordError && <small className="text-danger d-block mt-1">La password deve contenere almeno 8 caratteri.</small>}
                        </Col>
                      </Row>

                      <Form.Check id="terms" className="form-check-sm mb-3">
                        <Form.Check.Input
                          type="checkbox"
                          checked={termsAccepted}
                          onChange={(event) => {
                            setTermsAccepted(event.target.checked);
                            setTouched((prev) => ({ ...prev, terms: true }));
                            setErrorMessage("");
                          }}
                          onBlur={() => handleFieldBlur("terms")}
                        />
                        <Form.Check.Label className="text-muted fs-7">
                          Creando un account confermi di aver letto e accettato i <Link to="#">Termini di utilizzo</Link> e la{" "}
                          <Link to="#">Privacy Policy</Link>. Puoi modificare le notifiche in qualsiasi momento.
                        </Form.Check.Label>
                        {showTermsError && <small className="text-danger d-block mt-1">Devi accettare termini e privacy policy.</small>}
                      </Form.Check>

                      {/* Bottone submit (poi collegheremo POST /auth/register) */}
                      <Button variant="primary" className="btn-rounded btn-uppercase btn-block" type="submit" disabled={isSubmitDisabled}>
                        {formLoading ? "Creazione..." : "Crea account"}
                      </Button>

                      {/* Link verso login (nel tuo RouteList è /login, quindi linko quello) */}
                      <p className="p-xs mt-2 text-center">
                        Hai già un account?{" "}
                        <Link to="/login">
                          <u>Accedi</u>
                        </Link>
                      </p>
                    </Col>
                  </Row>
                </Form>
              </div>

              {/* Footer pagina */}
              <CommanFooter1 />
            </Col>
          </Row>
        </Container>
      </div>
    </div>
  );
};

export default Signup;
