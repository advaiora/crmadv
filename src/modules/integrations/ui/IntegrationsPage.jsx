import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Spinner } from 'react-bootstrap';
import { CheckCircle2, Plug, RefreshCw, Trash2, Zap } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import {
  deleteIntegration,
  getIntegration,
  saveIntegration,
  syncIntegration,
  testIntegration,
} from '../api/integrationsApi';

const PROVIDER = 'brevo';

const getErrorMessage = (error, fallback) => error?.message || fallback;

const formatDateTime = (value) => {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString('it-IT');
  } catch {
    return value;
  }
};

const SYNC_STATUS_VARIANT = { success: 'success', partial: 'warning', error: 'danger' };

// Pagina di configurazione del connettore Brevo (V3 — layer integrazioni).
// Permette di salvare la chiave API (cifrata lato server), testare la
// connessione, abilitare/disabilitare e sincronizzare i clienti come contatti.
const IntegrationsPage = () => {
  const [integration, setIntegration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [apiKey, setApiKey] = useState('');
  const [listId, setListId] = useState('');

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [removing, setRemoving] = useState(false);

  const hasApiKey = Boolean(integration?.hasApiKey);
  const enabled = Boolean(integration?.enabled);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await getIntegration(PROVIDER);
      const current = result?.integration ?? null;
      setIntegration(current);
      setListId(current?.config?.listId ? String(current.config.listId) : '');
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Impossibile caricare l\'integrazione.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Salva chiave API (se inserita) e id lista. Non tocca lo stato abilitato.
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { listId: listId.trim() === '' ? null : Number(listId) };
      if (apiKey.trim() !== '') {
        payload.apiKey = apiKey.trim();
      }
      const result = await saveIntegration(PROVIDER, payload);
      setIntegration(result?.integration ?? null);
      setApiKey('');
      toast.success('Configurazione salvata.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Salvataggio non riuscito.'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (nextEnabled) => {
    setSaving(true);
    try {
      const result = await saveIntegration(PROVIDER, { enabled: nextEnabled });
      setIntegration(result?.integration ?? null);
      toast.success(nextEnabled ? 'Integrazione abilitata.' : 'Integrazione disabilitata.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Operazione non riuscita.'));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await testIntegration(PROVIDER);
      if (result?.ok) {
        const account = result.account?.email ? ` (${result.account.email})` : '';
        toast.success(`Connessione riuscita${account}.`);
      } else {
        toast.error(result?.message || 'Connessione non riuscita.');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Test non riuscito.'));
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncIntegration(PROVIDER);
      setIntegration((prev) =>
        prev
          ? {
              ...prev,
              lastSyncAt: new Date().toISOString(),
              lastSyncStatus: result?.status ?? null,
              lastSyncMessage: result?.message ?? null,
              lastSyncStats: result?.stats ?? null,
            }
          : prev,
      );
      const variant = result?.status === 'success' ? toast.success : toast.warning;
      variant(result?.message || 'Sincronizzazione completata.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Sincronizzazione non riuscita.'));
    } finally {
      setSyncing(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Rimuovere la configurazione Brevo (inclusa la chiave API)?')) {
      return;
    }
    setRemoving(true);
    try {
      await deleteIntegration(PROVIDER);
      setIntegration(null);
      setApiKey('');
      setListId('');
      toast.success('Configurazione rimossa.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Rimozione non riuscita.'));
    } finally {
      setRemoving(false);
    }
  };

  const stats = integration?.lastSyncStats ?? null;

  return (
    <div className="container-fluid py-4">
      <ToastContainer position="top-right" autoClose={4000} newestOnTop theme="colored" />

      <div className="mb-4">
        <h3 className="mb-1 d-flex align-items-center gap-2">
          <Plug size={22} />
          Integrazioni
        </h3>
        <p className="text-muted mb-0">
          Collega servizi esterni per sincronizzare i dati dei clienti.
        </p>
      </div>

      {loadError && (
        <Alert variant="danger" onClose={() => setLoadError('')} dismissible>
          {loadError}
        </Alert>
      )}

      {loading ? (
        <div className="p-4 d-flex justify-content-center">
          <Spinner animation="border" size="sm" role="status" />
        </div>
      ) : (
        <Card className="card-border" style={{ maxWidth: 720 }}>
          <Card.Body>
            <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
              <div>
                <h5 className="mb-1 d-flex align-items-center gap-2">
                  <Zap size={18} />
                  Brevo
                </h5>
                <p className="text-muted mb-0">
                  Sincronizza i clienti con email come contatti Brevo.
                </p>
              </div>
              <div className="d-flex align-items-center gap-2">
                {hasApiKey ? (
                  <Badge bg={enabled ? 'success' : 'secondary'}>
                    {enabled ? 'Abilitata' : 'Configurata'}
                  </Badge>
                ) : (
                  <Badge bg="light" text="dark">Non configurata</Badge>
                )}
              </div>
            </div>

            <Form.Group className="mb-3">
              <Form.Label>Chiave API</Form.Label>
              <Form.Control
                type="password"
                autoComplete="off"
                placeholder={hasApiKey ? '•••••••••• (già configurata, lascia vuoto per non cambiarla)' : 'Incolla qui la chiave API Brevo'}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
              <Form.Text className="text-muted">
                La chiave viene cifrata e non è più visibile dopo il salvataggio.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>ID lista Brevo (opzionale)</Form.Label>
              <Form.Control
                type="number"
                min="1"
                placeholder="Es. 3 — aggiunge i contatti a questa lista"
                value={listId}
                onChange={(event) => setListId(event.target.value)}
              />
            </Form.Group>

            <div className="d-flex flex-wrap gap-2 mb-3">
              <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Salvataggio…' : 'Salva configurazione'}
              </Button>
              <Button
                variant="outline-secondary"
                className="d-inline-flex align-items-center gap-2"
                onClick={() => void handleTest()}
                disabled={testing || !hasApiKey}
              >
                <CheckCircle2 size={16} />
                {testing ? 'Verifica…' : 'Testa connessione'}
              </Button>
            </div>

            {hasApiKey && (
              <>
                <hr />
                <Form.Check
                  type="switch"
                  id="brevo-enabled"
                  className="mb-3"
                  label="Integrazione abilitata"
                  checked={enabled}
                  disabled={saving}
                  onChange={(event) => void handleToggleEnabled(event.target.checked)}
                />

                <div className="d-flex flex-wrap gap-2">
                  <Button
                    variant="success"
                    className="d-inline-flex align-items-center gap-2"
                    onClick={() => void handleSync()}
                    disabled={syncing || !enabled}
                  >
                    <RefreshCw size={16} />
                    {syncing ? 'Sincronizzazione…' : 'Sincronizza clienti ora'}
                  </Button>
                  <Button
                    variant="outline-danger"
                    className="d-inline-flex align-items-center gap-2"
                    onClick={() => void handleRemove()}
                    disabled={removing}
                  >
                    <Trash2 size={16} />
                    {removing ? 'Rimozione…' : 'Rimuovi'}
                  </Button>
                </div>

                {integration?.lastSyncAt && (
                  <div className="mt-3 p-3 rounded" style={{ background: 'var(--bs-tertiary-bg)' }}>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <strong>Ultima sincronizzazione</strong>
                      {integration.lastSyncStatus && (
                        <Badge bg={SYNC_STATUS_VARIANT[integration.lastSyncStatus] ?? 'secondary'}>
                          {integration.lastSyncStatus}
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted small mb-1">{formatDateTime(integration.lastSyncAt)}</div>
                    <div className="mb-0">{integration.lastSyncMessage}</div>
                    {stats && (
                      <div className="text-muted small mt-2">
                        {stats.synced} sincronizzati · {stats.failed} falliti · {stats.skippedNoEmail} senza email (saltati) su {stats.totalClients} clienti.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default IntegrationsPage;
