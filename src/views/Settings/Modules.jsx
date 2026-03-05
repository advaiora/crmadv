import React, { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Spinner } from 'react-bootstrap';
import ModulePermissionGate from '../../components/guards/ModulePermissionGate';
import { listWorkspaceModules, patchWorkspaceModule } from '../../modules/core/api/modulesApi';

const getErrorMessage = (error, fallback) => error?.message || fallback;

const ModulesSettingsPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState('');

  const loadModules = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await listWorkspaceModules();
      setItems(Array.isArray(payload?.modules) ? payload.modules : []);
    } catch (loadError) {
      setItems([]);
      setError(getErrorMessage(loadError, 'Errore caricamento moduli'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadModules();
  }, []);

  const onToggle = async (entry) => {
    if (!entry || savingKey) {
      return;
    }

    setSavingKey(entry.key);
    setError('');
    try {
      const payload = await patchWorkspaceModule(entry.key, !entry.enabled);
      const updated = payload?.module;
      setItems((current) => current.map((item) => (item.key === entry.key ? { ...item, ...updated } : item)));
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Impossibile aggiornare il modulo'));
    } finally {
      setSavingKey('');
    }
  };

  return (
    <ModulePermissionGate requiredModule="modules" requiredPermission="modules.manage" moduleName="Moduli">
      <div className="container-fluid">
        <div className="hk-pg-header pt-7 pb-4">
          <h1 className="pg-title">Gestione Moduli</h1>
          <p>Abilita o disabilita i moduli per il workspace corrente.</p>
        </div>

        <div className="hk-pg-body">
          {error && <Alert variant="danger">{error}</Alert>}

          {loading && (
            <div className="d-flex align-items-center gap-2 text-muted py-4">
              <Spinner animation="border" size="sm" />
              Caricamento moduli...
            </div>
          )}

          {!loading && (
            <div className="d-flex flex-column gap-3">
              {items.map((entry) => (
                <Card key={entry.key} className="card-border">
                  <Card.Body className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                    <div>
                      <div className="d-flex align-items-center gap-2">
                        <h6 className="mb-0">{entry.name || entry.key}</h6>
                        {entry.isCore && <Badge bg="secondary">Core</Badge>}
                      </div>
                      <div className="small text-muted">{entry.description || entry.key}</div>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                      {savingKey === entry.key && <Spinner animation="border" size="sm" />}
                      <Form.Check
                        type="switch"
                        id={`module-${entry.key}`}
                        checked={Boolean(entry.enabled)}
                        disabled={Boolean(entry.isCore) || savingKey === entry.key}
                        onChange={() => void onToggle(entry)}
                        label={entry.enabled ? 'Abilitato' : 'Disabilitato'}
                      />
                    </div>
                  </Card.Body>
                </Card>
              ))}

              {!loading && items.length === 0 && (
                <Card className="card-border">
                  <Card.Body className="text-muted">Nessun modulo trovato.</Card.Body>
                </Card>
              )}

              <div>
                <Button variant="outline-secondary" onClick={() => void loadModules()} disabled={loading || !!savingKey}>
                  Aggiorna
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModulePermissionGate>
  );
};

export default ModulesSettingsPage;
