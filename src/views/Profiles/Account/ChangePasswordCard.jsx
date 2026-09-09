import React, { useState } from 'react';
import { Alert, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import { apiPost } from '../../../utils/apiClient';
import { useSession } from '../../../hooks/useSession';
import NewPasswordFields from '../../../components/ui/NewPasswordFields';
import {
  NEUTRAL_RESET_REQUEST_MESSAGE,
  resolvePasswordErrorMessage,
  validateNewPassword,
} from '../../../lib/passwordRules';

// Il cambio della propria password dentro «Impostazioni Account». Sta in un file
// suo e non dentro `index.jsx` perche' quella pagina e' a 388 righe: aggiungerci
// una maschera intera la porterebbe oltre la soglia delle 500.
//
// ⚠️ IL TOKEN NELLA RISPOSTA NON E' UN DI PIU'. Dal 9/9/2026 il server revoca
// davvero le altre sessioni (scrive `User.passwordChangedAt` e rifiuta ogni token
// emesso prima): compreso quello con cui questa richiesta e' appena partita. Il
// `token` che torna e' il suo rimpiazzo e va messo in sessione esattamente come
// dopo il login, altrimenti la richiesta successiva riporta alla schermata di
// accesso. Vedi il commento in `server/modules/password/routes/password.route.ts`.

const EMPTY_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' };

const ChangePasswordCard = () => {
  const { session, login } = useSession();

  const [values, setValues] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resetLinkMessage, setResetLinkMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [requestingResetLink, setRequestingResetLink] = useState(false);

  const updateValue = (fieldName) => (value) => {
    setValues((current) => ({ ...current, [fieldName]: value }));
    setFieldErrors((current) => {
      if (!current[fieldName]) {
        return current;
      }

      const next = { ...current };
      delete next[fieldName];
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setErrorCode('');
    setSuccessMessage('');
    setResetLinkMessage('');

    const errors = validateNewPassword(values.newPassword, values.confirmPassword);
    if (!values.currentPassword) {
      errors.currentPassword = 'Inserisci la password attuale';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSaving(true);

    try {
      const result = await apiPost('/auth/password/change', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });

      // Il rimpiazzo del token: senza questa riga l'utente resta con in mano un
      // token che il server ha appena smesso di accettare.
      if (result?.token && session) {
        login({ ...session, accessToken: result.token });
      }

      setValues(EMPTY_FORM);
      setSuccessMessage(
        result?.otherSessionsRevoked
          ? 'Password aggiornata. Gli altri accessi con la password vecchia sono stati chiusi; questa sessione resta attiva.'
          : 'Password aggiornata.',
      );
    } catch (requestError) {
      setErrorCode(requestError?.code || '');
      setErrorMessage(
        resolvePasswordErrorMessage(requestError, 'Non è stato possibile cambiare la password. Riprova.'),
      );
    } finally {
      setSaving(false);
    }
  };

  // Chi entra con Google non ha una password del CRM da confermare, quindi il
  // cambio password gli e' precluso per costruzione (409 PASSWORD_NOT_SET). La
  // via che gli resta e' il recupero, che per quegli account non REIMPOSTA una
  // password: gliene imposta una che prima non c'era.
  const handleRequestResetLink = async () => {
    const email = session?.userEmail;
    if (!email) {
      return;
    }

    setRequestingResetLink(true);
    setResetLinkMessage('');

    try {
      await apiPost('/auth/password/reset/request', { email }, { skipAuthHeaders: true });
    } catch (_requestError) {
      // Volutamente muto: la rotta risponde allo stesso modo a un indirizzo
      // esistente e a uno inesistente, e distinguere qui rimetterebbe in piedi
      // proprio la differenza che il server nasconde.
    } finally {
      setRequestingResetLink(false);
      setResetLinkMessage(NEUTRAL_RESET_REQUEST_MESSAGE);
    }
  };

  return (
    <Card className="card-border h-100">
      <Card.Header>
        <h6 className="mb-0">Cambia password</h6>
      </Card.Header>
      <Card.Body>
        <p className="text-muted small">
          Serve la password attuale. Cambiandola, gli altri accessi fatti con la password vecchia
          vengono chiusi.
        </p>

        {successMessage && (
          <Alert variant="success" className="py-2">
            {successMessage}
          </Alert>
        )}

        {errorMessage && (
          <Alert variant="danger" className="py-2">
            <div>{errorMessage}</div>
            {errorCode === 'PASSWORD_NOT_SET' && (
              <div className="mt-2">
                <Button
                  type="button"
                  variant="outline-danger"
                  size="sm"
                  onClick={handleRequestResetLink}
                  disabled={requestingResetLink}
                >
                  {requestingResetLink ? 'Invio in corso...' : 'Ricevi un link per impostarla'}
                </Button>
              </div>
            )}
          </Alert>
        )}

        {resetLinkMessage && (
          <Alert variant="info" className="py-2">
            {resetLinkMessage}
          </Alert>
        )}

        <Form onSubmit={handleSubmit}>
          <Row className="g-3">
            <Col md={12}>
              <Form.Group controlId="account-password-attuale">
                <Form.Label>Password attuale</Form.Label>
                <Form.Control
                  type="password"
                  value={values.currentPassword}
                  onChange={(event) => updateValue('currentPassword')(event.target.value)}
                  isInvalid={Boolean(fieldErrors.currentPassword)}
                  autoComplete="current-password"
                />
                <Form.Control.Feedback type="invalid">
                  {fieldErrors.currentPassword}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>

            <Col md={12}>
              <NewPasswordFields
                idPrefix="account-password"
                newPassword={values.newPassword}
                confirmPassword={values.confirmPassword}
                errors={fieldErrors}
                onChangeNewPassword={updateValue('newPassword')}
                onChangeConfirmPassword={updateValue('confirmPassword')}
              />
            </Col>
          </Row>

          <div className="mt-3">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <span className="d-inline-flex align-items-center">
                  <Spinner animation="border" size="sm" className="me-2" />
                  Salvataggio...
                </span>
              ) : (
                'Cambia password'
              )}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default ChangePasswordCard;
