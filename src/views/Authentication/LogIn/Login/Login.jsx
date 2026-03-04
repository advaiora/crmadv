import React, { useState } from "react";
import { z } from "zod";
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Alert, Button, Card, Col, Container, Form, Row, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import { apiPost, ApiRequestError } from "../../../../utils/apiClient";
import { useSession } from "../../../../hooks/useSession";
import { authenticateWithGoogle, GoogleAuthError } from "../../../../utils/googleAuthClient";
import { requestGoogleIdToken } from "../../../../utils/googleIdentity";
import { getClientRuntimeConfig } from "../../../../utils/runtimeConfig";
import AdvaioraLogoBlack from "../../../../assets/img/AdvaioraLogo-Black.png";

const loginSchema = z.object({
  email: z.string().trim().email("Email non valida"),
  password: z.string().min(1, "Inserisci la password"),
});

const extractProfileFromIdToken = (idToken) => {
  if (typeof idToken !== "string") {
    return { email: "", name: "" };
  }

  const tokenParts = idToken.split(".");
  if (tokenParts.length < 2) {
    return { email: "", name: "" };
  }

  try {
    const base64Url = tokenParts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const paddedBase64 = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
    const payload = JSON.parse(window.atob(paddedBase64));
    const extractedEmail = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
    const extractedName = typeof payload?.name === "string" ? payload.name.trim() : "";
    return {
      email: extractedEmail.includes("@") ? extractedEmail : "",
      name: extractedName,
    };
  } catch (_error) {
    return { email: "", name: "" };
  }
};

const resolveGoogleLoginError = (error) => {
  if (error instanceof GoogleAuthError) {
    return error;
  }

  const fallbackMessage = "Impossibile completare il login Google. Riprova.";
  const rawMessage = error instanceof Error ? error.message?.trim() : "";
  const isUserFriendlyMessage =
    rawMessage.length > 0 &&
    /google|popup|annull|timeout|configur|credential|fedcm|token|origin/i.test(rawMessage);

  return new GoogleAuthError({
    message: isUserFriendlyMessage ? rawMessage : fallbackMessage,
  });
};

const Login = ({ history }) => {
  const { login } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [googleErrorCode, setGoogleErrorCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { apiBaseUrl, googleClientId, googleRedirectUri, googleDebugRawResponse } = getClientRuntimeConfig();
  const isBusy = loading || googleLoading;
  const resolvePostAuthPath = (onboardingRequired) => (
    onboardingRequired ? "/pages/workspace-branding?onboarding=1" : "/dashboard"
  );

  const leftPanelBackground = "var(--secondary, #0f172a)";
  const leftPanelTextColor = "var(--secondary-foreground, #ffffff)";
  const leftPanelMutedTextColor = "var(--hk-menu-header-text, rgba(255,255,255,0.82))";
  const rightPanelBackground = "var(--primary, #facc15)";
  const rightPanelTextColor = "var(--primary-foreground, #111111)";

  const clearFieldError = (fieldName) => {
    if (!fieldErrors[fieldName]) {
      return;
    }

    setFieldErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors[fieldName];
      return nextErrors;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setGoogleErrorCode("");

    const parsed = loginSchema.safeParse({
      email,
      password,
    });

    if (!parsed.success) {
      const issues = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        ...(issues.email?.[0] ? { email: issues.email[0] } : {}),
        ...(issues.password?.[0] ? { password: issues.password[0] } : {}),
      });
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      const result = await apiPost(
        "/auth/login",
        {
          email: parsed.data.email,
          password: parsed.data.password,
        },
        { skipAuthHeaders: true },
      );

      const user = result?.user;
      const workspace = result?.workspace;
      const token = result?.token;
      const branding = result?.branding;
      const onboardingRequired = result?.onboardingRequired === true;

      if (!token || !user?.id || !user?.email || !user?.role) {
        setError("Risposta di autenticazione non valida");
        return;
      }

      login({
        accessToken: token,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        workspaceId: workspace?.id,
        workspaceSlug: workspace?.slug,
        workspaceBranding: branding,
      });

      history.push(resolvePostAuthPath(onboardingRequired));
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && requestError.status === 401) {
        setError("Credenziali non valide");
      } else {
        setError(requestError?.message || "Errore durante il login");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isBusy) {
      return;
    }

    if (!googleClientId) {
      setError("Login Google non disponibile al momento.");
      return;
    }

    setError("");
    setGoogleErrorCode("");
    setGoogleLoading(true);
    let requestedIdToken = "";
    let suggestedProfileFromGoogle = { email: "", name: "" };

    try {
      requestedIdToken = await requestGoogleIdToken(googleClientId, {
        redirectUri: googleRedirectUri,
        debugRawResponse: googleDebugRawResponse,
      });
      suggestedProfileFromGoogle = extractProfileFromIdToken(requestedIdToken);

      const result = await authenticateWithGoogle({
        apiBaseUrl,
        googleClientId,
        redirectUri: googleRedirectUri,
        debugRawResponse: googleDebugRawResponse,
        mode: "login",
        idToken: requestedIdToken,
      });
      const { token, user, workspace, branding, onboardingRequired } = result;

      login({
        accessToken: token,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        workspaceId: workspace?.id,
        workspaceSlug: workspace?.slug,
        workspaceBranding: branding,
      });

      history.push(resolvePostAuthPath(onboardingRequired));
    } catch (error) {
      const normalizedError = resolveGoogleLoginError(error);
      if (normalizedError.code === "NO_WORKSPACE" && requestedIdToken) {
        const fallbackEmail = email.trim().toLowerCase();
        const suggestedEmail =
          suggestedProfileFromGoogle.email || (fallbackEmail.includes("@") ? fallbackEmail : "");
        const suggestedName = suggestedProfileFromGoogle.name || "";

        history.push({
          pathname: "/auth/signup",
          state: {
            ...(suggestedName ? { suggestedName } : {}),
            ...(suggestedEmail ? { suggestedEmail } : {}),
            googlePendingIdToken: requestedIdToken,
          },
        });
        return;
      }
      setError(normalizedError.message);
      setGoogleErrorCode(normalizedError.code);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="hk-pg-wrapper py-0" data-bs-theme="dark">
      <div className="hk-pg-body py-0">
        <Container fluid className="min-vh-100 px-0">
          <Row className="g-0 min-vh-100">
            <Col
              xs={12}
              lg={6}
              className="d-flex align-items-center justify-content-center px-4 px-md-5 py-5"
              style={{
                background: leftPanelBackground,
                color: leftPanelTextColor,
              }}
            >
              <div style={{ width: "100%", maxWidth: 420 }}>
                <Card className="border-0 bg-transparent shadow-none">
                  <Card.Body className="p-4 p-md-5">
                    <div className="text-center mb-4">
                      <h4 className="mt-1 mb-1">Accedi</h4>
                      <p className="mb-0" style={{ color: leftPanelMutedTextColor }}>
                        Inserisci email e password
                      </p>
                    </div>

                    {error && (
                      <Alert variant="danger" className="py-2">
                        <div>{error}</div>
                        {googleErrorCode === "NO_WORKSPACE" && (
                          <div className="mt-2">
                            <Link
                              to={{
                                pathname: "/auth/signup",
                                state: {
                                  ...(email.trim() ? { suggestedEmail: email.trim().toLowerCase() } : {}),
                                },
                              }}
                              className="btn btn-sm btn-outline-danger"
                            >
                              Crea workspace
                            </Link>
                          </div>
                        )}
                      </Alert>
                    )}

                    <Form onSubmit={handleSubmit}>
                      <Button type="button" variant="outline-light" className="w-100 mb-3" onClick={handleGoogleLogin} disabled={isBusy}>
                        {googleLoading ? (
                          <span className="d-inline-flex align-items-center">
                            <Spinner animation="border" size="sm" className="me-2" />
                            Accesso Google...
                          </span>
                        ) : (
                          <span className="d-inline-flex align-items-center justify-content-center gap-2">
                            <FontAwesomeIcon icon={faGoogle} />
                            <span>Continua con Google</span>
                          </span>
                        )}
                      </Button>

                      <div className="title-sm title-wth-divider divider-center my-3">
                        <span>Oppure</span>
                      </div>

                      <Form.Group className="mb-3">
                        <Form.Label>Email</Form.Label>
                        <Form.Control
                          aria-label="Email"
                          type="email"
                          value={email}
                          onChange={(event) => {
                            setEmail(event.target.value);
                            clearFieldError("email");
                          }}
                          isInvalid={Boolean(fieldErrors.email)}
                          placeholder="admin@test.com"
                          autoComplete="email"
                        />
                        <Form.Control.Feedback type="invalid">{fieldErrors.email}</Form.Control.Feedback>
                      </Form.Group>

                      <Form.Group className="mb-4">
                        <Form.Label>Password</Form.Label>
                        <Form.Control
                          aria-label="Password"
                          type="password"
                          value={password}
                          onChange={(event) => {
                            setPassword(event.target.value);
                            clearFieldError("password");
                          }}
                          isInvalid={Boolean(fieldErrors.password)}
                          placeholder="Inserisci password"
                          autoComplete="current-password"
                        />
                        <Form.Control.Feedback type="invalid">{fieldErrors.password}</Form.Control.Feedback>
                      </Form.Group>

                      <Button type="submit" className="w-100" disabled={isBusy}>
                        {loading ? (
                          <span className="d-inline-flex align-items-center">
                            <Spinner animation="border" size="sm" className="me-2" />
                            Accesso in corso...
                          </span>
                        ) : (
                          "Accedi"
                        )}
                      </Button>
                      {/* Sotto al bottone Accedi */}
                      <div className="text-center mt-3">
                        <span style={{ color: leftPanelMutedTextColor }}>Non hai un account?</span>{" "}
                        <Link to="/auth/signup" className="text-decoration-underline" style={{ color: leftPanelTextColor }}>
                          Registrati
                        </Link>
                      </div>
                    </Form>
                  </Card.Body>
                </Card>
              </div>
            </Col>

            <Col
              lg={6}
              className="d-none d-lg-flex align-items-center justify-content-center"
              style={{
                color: rightPanelTextColor,
                background: rightPanelBackground,
                boxShadow: "none",
              }}
            >
              <div className="text-center px-4 w-100">
                <Link to="/" className="d-inline-flex align-items-center justify-content-center p-2">
                  <img src={AdvaioraLogoBlack} alt="Advaiora" className="img-fluid" style={{ width: "min(420px, 36vw)" }} />
                </Link>
              </div>
            </Col>
          </Row>
        </Container>
      </div>
    </div>
  );
};

export default Login;
