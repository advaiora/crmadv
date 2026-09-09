import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { apiPost } from '../../../utils/apiClient';
import {
  resolvePasswordErrorMessage,
  validateNewPassword,
} from '../../../lib/passwordRules';
import NewPasswordFields from '../../../components/ui/NewPasswordFields';
import { useTheme } from '../../../utils/theme-provider/theme-provider';
import CommanFooter1 from '../CommanFooter1';
import AdvaioraLogoBlack from '../../../assets/img/AdvaioraLogo-Black.png';
import AdvaioraLogoWhite from '../../../assets/img/AdvaioraLogo-White.png';

// La pagina dove atterra chi ha cliccato il link ricevuto per email. Fino al
// 9/9/2026 era lo stub del tema Jampack: sei campi finti, zero chiamate.
//
// ⚠️ TRE COSE CHE NON SONO DETTAGLI.
//
// 1. IL LINK VIENE CONTROLLATO ALL'APERTURA (`reset/check`), prima di mostrare
//    la maschera. Senza, si farebbe scegliere e digitare due volte una password
//    per poi annunciare che il link era scaduto: il lavoro buttato lo scopre chi
//    lo ha gia' fatto.
// 2. NESSUNA SESSIONE A BUON FINE, ed e' voluto lato server (nota 4 di
//    `password-reset.service.ts`): chi reimposta una password potrebbe essere
//    qualcuno che ha trovato il link, quindi si passa dalla schermata di accesso.
// 3. UN GUASTO DI RETE NON E' UN LINK SCADUTO. Sono due stati distinti, con due
//    messaggi diversi: dire «link non valido» a chi ha perso la connessione lo
//    manda a chiedere un link nuovo che non gli serve.
//
// ⚠️ L'indirizzo e' `/reset-password` (rotta di primo livello in `App.jsx`),
// perche' e' quello che il server scrive nell'email —
// `${baseUrl}/reset-password?token=...` in `password-reset.service.ts`. La voce
// gemella in `RouteList.jsx` vive invece sotto `/auth/...`, che e' il prefisso di
// tutte le pagine di autenticazione del tema.

const STATO = {
  verifica: 'verifica',
  pronto: 'pronto',
  linkNonValido: 'linkNonValido',
  verificaFallita: 'verificaFallita',
};

const leggiToken = (search) => {
  const value = new URLSearchParams(search).get('token');
  return typeof value === 'string' ? value.trim() : '';
};

/** Il link non vale piu' (scaduto, gia' usato, o mai stato un link). */
const PannelloLinkNonValido = () => (
  <>
    <Alert variant="warning" className="py-2">
      Questo link non è più valido: potrebbe essere scaduto o già usato.
    </Alert>
    <p className="text-muted small">
      Il link vale trenta minuti e una volta sola. Puoi chiederne un altro dalla schermata di
      accesso.
    </p>
    <Button as={Link} to="/auth/login" className="w-100">
      Vai alla schermata di accesso
    </Button>
  </>
);

/**
 * Il controllo del link non è riuscito — che è un'altra cosa dal link scaduto.
 * Qui il link potrebbe essere ottimo: a non aver funzionato è la verifica.
 */
const PannelloVerificaFallita = ({ message }) => (
  <>
    <Alert variant="danger" className="py-2">
      {message}
    </Alert>
    <Button
      type="button"
      variant="outline-primary"
      className="w-100"
      onClick={() => window.location.reload()}
    >
      Riprova
    </Button>
  </>
);

const ResetPassword = () => {
  const { theme } = useTheme();
  const history = useHistory();
  const location = useLocation();

  const token = useMemo(() => leggiToken(location.search), [location.search]);

  const [stato, setStato] = useState(token ? STATO.verifica : STATO.linkNonValido);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) {
      setStato(STATO.linkNonValido);
      return undefined;
    }

    let annullato = false;
    setStato(STATO.verifica);

    apiPost('/auth/password/reset/check', { token }, { skipAuthHeaders: true })
      .then((result) => {
        if (annullato) {
          return;
        }

        setStato(result?.valid === true ? STATO.pronto : STATO.linkNonValido);
      })
      .catch((requestError) => {
        if (annullato) {
          return;
        }

        setErrorMessage(
          resolvePasswordErrorMessage(requestError, 'Non è stato possibile verificare il link. Riprova.'),
        );
        setStato(STATO.verificaFallita);
      });

    return () => {
      annullato = true;
    };
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');

    const errors = validateNewPassword(newPassword, confirmPassword);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSaving(true);

    try {
      await apiPost('/auth/password/reset/confirm', { token, newPassword }, { skipAuthHeaders: true });

      history.replace({
        pathname: '/auth/login',
        state: { passwordReset: true },
      });
    } catch (requestError) {
      if (requestError?.code === 'INVALID_RESET_TOKEN') {
        setStato(STATO.linkNonValido);
        return;
      }

      setErrorMessage(
        resolvePasswordErrorMessage(requestError, 'Non è stato possibile reimpostare la password. Riprova.'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hk-pg-wrapper pt-0 pb-xl-0 pb-5">
      <div className="hk-pg-body pt-0 pb-xl-0">
        <Container>
          <Row>
            <Col sm={10} className="position-relative mx-auto">
              <div className="auth-content py-8">
                <Row>
                  <Col lg={5} md={7} sm={10} className="mx-auto">
                    <div className="text-center mb-7">
                      <Link to="/auth/login" className="navbar-brand me-0">
                        <img
                          src={theme === 'dark' ? AdvaioraLogoWhite : AdvaioraLogoBlack}
                          alt="Advaiora"
                          className="brand-img d-inline-block"
                          style={{ maxWidth: 220 }}
                        />
                      </Link>
                    </div>

                    <Card className="card-flush">
                      <Card.Body>
                        <h4 className="text-center mb-4">Scegli una password nuova</h4>

                        {stato === STATO.verifica && (
                          <div className="d-flex align-items-center justify-content-center gap-2 text-muted py-4">
                            <Spinner animation="border" size="sm" />
                            Controllo del link in corso...
                          </div>
                        )}

                        {stato === STATO.linkNonValido && <PannelloLinkNonValido />}

                        {stato === STATO.verificaFallita && (
                          <PannelloVerificaFallita message={errorMessage} />
                        )}

                        {stato === STATO.pronto && (
                          <Form onSubmit={handleSubmit}>
                            <p className="text-muted small">
                              Dopo il salvataggio dovrai entrare con la password nuova: questo
                              passaggio non apre una sessione.
                            </p>

                            {errorMessage && (
                              <Alert variant="danger" className="py-2">
                                {errorMessage}
                              </Alert>
                            )}

                            <NewPasswordFields
                              idPrefix="recupero-password"
                              newPassword={newPassword}
                              confirmPassword={confirmPassword}
                              errors={fieldErrors}
                              onChangeNewPassword={setNewPassword}
                              onChangeConfirmPassword={setConfirmPassword}
                            />

                            <Button type="submit" className="w-100 mt-2" disabled={saving}>
                              {saving ? (
                                <span className="d-inline-flex align-items-center">
                                  <Spinner animation="border" size="sm" className="me-2" />
                                  Salvataggio...
                                </span>
                              ) : (
                                'Reimposta la password'
                              )}
                            </Button>

                            <p className="text-center mt-3 mb-0">
                              <Link to="/auth/login">Torna alla schermata di accesso</Link>
                            </p>
                          </Form>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </div>
            </Col>
          </Row>
        </Container>
      </div>
      <CommanFooter1 />
    </div>
  );
};

export default ResetPassword;
