import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save, TriangleAlert } from 'lucide-react';
import {
  getQuoteNotificationTemplates,
  updateQuoteNotificationTemplates,
} from '../../modules/quotes/api/quotesApi';
import QuotesModuleGate from '../../modules/quotes/ui/QuotesModuleGate';
import { QUOTES_PERMISSIONS } from '../../modules/quotes/ui/constants';
import { getApiErrorMessage } from '../../modules/quotes/ui/helpers';
import '../../modules/quotes/ui/quotes-ui.css';

const initialState = {
  enabled: true,
  sentSubject: '',
  sentBody: '',
  acceptedSubject: '',
  acceptedBody: '',
  rejectedSubject: '',
  rejectedBody: '',
};

const QuoteNotificationsSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formState, setFormState] = useState(initialState);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await getQuoteNotificationTemplates();
        const templates = response?.templates || response;

        if (cancelled || !templates) {
          return;
        }

        setFormState({
          enabled: templates.enabled ?? true,
          sentSubject: templates?.SENT?.subject || templates.sentSubject || '',
          sentBody: templates?.SENT?.body || templates.sentBody || '',
          acceptedSubject: templates?.ACCEPTED?.subject || templates.acceptedSubject || '',
          acceptedBody: templates?.ACCEPTED?.body || templates.acceptedBody || '',
          rejectedSubject: templates?.REJECTED?.subject || templates.rejectedSubject || '',
          rejectedBody: templates?.REJECTED?.body || templates.rejectedBody || '',
        });
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(getApiErrorMessage(loadError, {
          forbiddenMessage: 'Non hai permessi',
          fallbackMessage: 'Errore caricamento impostazioni notifiche',
        }));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await updateQuoteNotificationTemplates({
        enabled: formState.enabled,
        sentSubject: formState.sentSubject || null,
        sentBody: formState.sentBody || null,
        acceptedSubject: formState.acceptedSubject || null,
        acceptedBody: formState.acceptedBody || null,
        rejectedSubject: formState.rejectedSubject || null,
        rejectedBody: formState.rejectedBody || null,
      });

      setSuccess('Template notifiche aggiornati.');
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, {
        forbiddenMessage: 'Non hai permessi',
        fallbackMessage: 'Salvataggio impostazioni notifiche non riuscito',
      }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <QuotesModuleGate requiredPermission={QUOTES_PERMISSIONS.manageTemplates}>
      <div className="container-fluid quotes-page-container">
        <div className="quotes-page-shell pt-3">
          <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap mb-3">
            <div>
              <h3 className="mb-1">Notifiche Preventivi</h3>
              <p className="text-muted mb-0">Template email per invio, accettazione e rifiuto.</p>
            </div>
            <Button as={Link} to="/apps/quotes/templates" variant="outline-secondary">
              <ArrowLeft size={14} className="me-1" />
              Torna ai template
            </Button>
          </div>

          {error && (
            <Alert variant="danger" className="d-flex align-items-center gap-2">
              <TriangleAlert size={16} />
              <span>{error}</span>
            </Alert>
          )}

          {success && <Alert variant="success">{success}</Alert>}

          <Card className="card-border mb-4">
            <Card.Body>
              {loading ? (
                <div className="text-muted d-inline-flex align-items-center gap-2">
                  <Spinner animation="border" size="sm" /> Caricamento...
                </div>
              ) : (
                <Form onSubmit={onSubmit}>
                  <Form.Check
                    className="mb-3"
                    label="Abilita notifiche automatiche"
                    checked={formState.enabled}
                    onChange={(event) => setFormState((current) => ({ ...current, enabled: event.target.checked }))}
                  />

                  <h6 className="mb-2">Stato INVIATO</h6>
                  <Form.Group className="mb-2">
                    <Form.Label>Oggetto</Form.Label>
                    <Form.Control
                      value={formState.sentSubject}
                      onChange={(event) => setFormState((current) => ({ ...current, sentSubject: event.target.value }))}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Messaggio</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={formState.sentBody}
                      onChange={(event) => setFormState((current) => ({ ...current, sentBody: event.target.value }))}
                    />
                  </Form.Group>

                  <h6 className="mb-2">Stato ACCETTATO</h6>
                  <Form.Group className="mb-2">
                    <Form.Label>Oggetto</Form.Label>
                    <Form.Control
                      value={formState.acceptedSubject}
                      onChange={(event) => setFormState((current) => ({ ...current, acceptedSubject: event.target.value }))}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Messaggio</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={formState.acceptedBody}
                      onChange={(event) => setFormState((current) => ({ ...current, acceptedBody: event.target.value }))}
                    />
                  </Form.Group>

                  <h6 className="mb-2">Stato RIFIUTATO</h6>
                  <Form.Group className="mb-2">
                    <Form.Label>Oggetto</Form.Label>
                    <Form.Control
                      value={formState.rejectedSubject}
                      onChange={(event) => setFormState((current) => ({ ...current, rejectedSubject: event.target.value }))}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Messaggio</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={formState.rejectedBody}
                      onChange={(event) => setFormState((current) => ({ ...current, rejectedBody: event.target.value }))}
                    />
                  </Form.Group>

                  <div className="small text-muted mb-3">
                    Placeholder disponibili: {'{cliente}'}, {'{numero}'}, {'{workspace}'}, {'{stato}'}, {'{totale}'}
                  </div>

                  <div className="d-flex justify-content-end">
                    <Button type="submit" disabled={saving}>
                      {saving ? (
                        <><Spinner animation="border" size="sm" className="me-1" /> Salvataggio...</>
                      ) : (
                        <><Save size={14} className="me-1" /> Salva template</>
                      )}
                    </Button>
                  </div>
                </Form>
              )}
            </Card.Body>
          </Card>
        </div>
      </div>
    </QuotesModuleGate>
  );
};

export default QuoteNotificationsSettings;
