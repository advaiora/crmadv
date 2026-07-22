import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Container, Spinner } from 'react-bootstrap';
import { useHistory, useLocation } from 'react-router-dom';
import { useSession } from '../../../hooks/useSession';
import { buildApiUrl } from '../../../lib/apiFetch';

const readApiPayload = async (response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const resolveErrorMessage = ({ status, code, message }) => {
  if (status === 410) {
    return 'Questo invito non e piu valido (scaduto o revocato). Contatta un admin del workspace.';
  }

  if (status === 400) {
    return 'Token invito non valido. Contatta un admin del workspace.';
  }

  if (status === 403 && code === 'FORBIDDEN') {
    return message || "Non puoi accettare questo invito con l'account corrente. Prova da finestra anonima.";
  }

  return message || "Impossibile accettare l'invito. Riprova tra poco.";
};

const AcceptInvite = () => {
  const history = useHistory();
  const location = useLocation();
  const { login } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const inviteToken = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return (params.get('token') || '').trim();
  }, [location.search]);

  const acceptInvite = async () => {
    if (!inviteToken) {
      setError('Token invito mancante.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };

      const response = await fetch(buildApiUrl('/api/team/invites/accept'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          token: inviteToken,
        }),
      });

      const payload = await readApiPayload(response);
      if (!response.ok) {
        const apiError = payload?.error ?? {};
        setError(resolveErrorMessage({
          status: response.status,
          code: apiError.code,
          message: apiError.message,
        }));
        return;
      }

      const data = payload?.data ?? {};
      if (!data.accessToken || !data.user?.id || !data.user?.email || !data.user?.role) {
        setError("Risposta server non valida durante l'accettazione invito.");
        return;
      }

      login({
        accessToken: data.accessToken,
        userId: data.user.id,
        userEmail: data.user.email,
        userRole: data.user.role,
        workspaceId: data.workspaceId,
        workspaceSlug: data.workspaceSlug,
      });

      setSuccess('Invito accettato con successo. Reindirizzamento alla dashboard...');
      window.setTimeout(() => {
        history.replace('/dashboard');
      }, 700);
    } catch {
      setError("Errore di rete durante l'accettazione invito.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!inviteToken) {
      return;
    }

    void acceptInvite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteToken]);

  return (
    <div className="hk-pg-wrapper py-0">
      <div className="hk-pg-body py-0 d-flex align-items-center min-vh-100">
        <Container style={{ maxWidth: 560 }}>
          <Card className="border-0 shadow-sm">
            <Card.Body className="p-4 p-md-5">
              <h4 className="mb-2">Accettazione invito</h4>
              <p className="text-muted mb-4">
                Stiamo verificando il token invito e configurando l&apos;accesso al workspace.
              </p>

              {loading && (
                <div className="d-flex align-items-center gap-2 mb-3">
                  <Spinner animation="border" size="sm" />
                  <span>Elaborazione in corso...</span>
                </div>
              )}

              {error && (
                <Alert variant="danger" className="mb-3">
                  {error}
                </Alert>
              )}

              {success && (
                <Alert variant="success" className="mb-3">
                  {success}
                </Alert>
              )}

              {!loading && error && (
                <div className="d-flex gap-2">
                  <Button variant="primary" onClick={acceptInvite} disabled={!inviteToken}>
                    Riprova
                  </Button>
                  <Button variant="outline-secondary" onClick={() => history.push('/login')}>
                    Vai al login
                  </Button>
                </div>
              )}
            </Card.Body>
          </Card>
        </Container>
      </div>
    </div>
  );
};

export default AcceptInvite;
