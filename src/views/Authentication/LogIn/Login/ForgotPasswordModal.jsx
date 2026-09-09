import React, { useState } from 'react';
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap';
import { apiPost } from '../../../../utils/apiClient';
import {
  NEUTRAL_RESET_REQUEST_MESSAGE,
  resolvePasswordErrorMessage,
  validateResetEmail,
} from '../../../../lib/passwordRules';

// Il punto d'ingresso del recupero password: si apre da «Password dimenticata?»
// nella schermata di accesso.
//
// ⚠️ IL MESSAGGIO DI ESITO NON DEVE MAI DIRE «TI ABBIAMO MANDATO UN'EMAIL». Il
// server risponde `requested: true` sia che l'indirizzo esista sia che non
// esista, apposta: e' cio' che impedisce di usare il recupero password per
// scoprire chi ha un account nel CRM. Una maschera piu' precisa della risposta
// butterebbe via la protezione che il server ha costruito. La formula sta in un
// punto solo, `NEUTRAL_RESET_REQUEST_MESSAGE`, con un test che la difende.

const ForgotPasswordModal = ({ show, onHide, defaultEmail = '' }) => {
  const [email, setEmail] = useState(defaultEmail);
  const [emailError, setEmailError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [sentMessage, setSentMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [sending, setSending] = useState(false);

  const handleEnter = () => {
    setEmail(defaultEmail);
    setEmailError('');
    setErrorMessage('');
    setSentMessage('');
    setPreviewUrl('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');

    const invalidEmail = validateResetEmail(email);
    if (invalidEmail) {
      setEmailError(invalidEmail);
      return;
    }

    setEmailError('');
    setSending(true);

    try {
      const result = await apiPost(
        '/auth/password/reset/request',
        { email: email.trim().toLowerCase() },
        { skipAuthHeaders: true },
      );

      setSentMessage(NEUTRAL_RESET_REQUEST_MESSAGE);
      // Solo in sviluppo e solo con la casella finta: il server manda l'indirizzo
      // dove leggere il messaggio senza un server di posta vero. In produzione
      // questo campo non arriva mai.
      setPreviewUrl(typeof result?.previewUrl === 'string' ? result.previewUrl : '');
    } catch (requestError) {
      setErrorMessage(
        resolvePasswordErrorMessage(
          requestError,
          'Non è stato possibile inviare la richiesta. Riprova più tardi.',
        ),
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} onEnter={handleEnter} centered>
      <Modal.Header closeButton closeLabel="Chiudi">
        <Modal.Title as="h5">Password dimenticata</Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {sentMessage ? (
            <>
              <Alert variant="info" className="py-2 mb-0">
                {sentMessage}
              </Alert>
              <p className="text-muted small mt-3 mb-0">
                Il link vale trenta minuti e si può usare una volta sola.
              </p>
              {previewUrl && (
                <p className="small mt-2 mb-0">
                  <a href={previewUrl} target="_blank" rel="noreferrer">
                    Apri l&apos;anteprima del messaggio (solo in sviluppo)
                  </a>
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-muted small">
                Inserisci l&apos;indirizzo con cui entri nel CRM: riceverai un link per scegliere una
                password nuova.
              </p>

              {errorMessage && (
                <Alert variant="danger" className="py-2">
                  {errorMessage}
                </Alert>
              )}

              <Form.Group controlId="recupero-password-email">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setEmailError('');
                  }}
                  isInvalid={Boolean(emailError)}
                  autoComplete="email"
                />
                <Form.Control.Feedback type="invalid">{emailError}</Form.Control.Feedback>
              </Form.Group>
            </>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button type="button" variant="outline-secondary" onClick={onHide}>
            {sentMessage ? 'Chiudi' : 'Annulla'}
          </Button>
          {!sentMessage && (
            <Button type="submit" disabled={sending}>
              {sending ? (
                <span className="d-inline-flex align-items-center">
                  <Spinner animation="border" size="sm" className="me-2" />
                  Invio...
                </span>
              ) : (
                'Invia il link'
              )}
            </Button>
          )}
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default ForgotPasswordModal;
