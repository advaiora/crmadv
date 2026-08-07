import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import ModulePermissionGate from '../../components/guards/ModulePermissionGate';
import { listAuditLogs } from '../../modules/audit/api/auditApi';

const DEFAULT_LIMIT = 200;

const COMMON_ACTIONS = [
  'modules.',
  'branding.',
  'team.',
  'checklists.',
  'vault.',
  'web.',
];

const QUICK_FILTERS = [
  { label: 'Moduli', patch: { actionPrefix: 'modules.' } },
  { label: 'Team', patch: { actionPrefix: 'team.' } },
  { label: 'Checklist', patch: { actionPrefix: 'checklists.' } },
  { label: 'Web', patch: { actionPrefix: 'web.' } },
  { label: 'Credenziali', patch: { actionPrefix: 'vault.' } },
  { label: 'Branding', patch: { actionPrefix: 'branding.' } },
];

const toDateInput = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
};

const resolveDatePreset = (preset) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === 'today') {
    const value = toDateInput(today);
    return { from: value, to: value };
  }

  if (preset === 'last30') {
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    return { from: toDateInput(from), to: toDateInput(today) };
  }

  if (preset === 'all') {
    return { from: '', to: '' };
  }

  const from = new Date(today);
  from.setDate(from.getDate() - 6);
  return { from: toDateInput(from), to: toDateInput(today) };
};

const createDefaultFilters = () => ({
  ...resolveDatePreset('last7'),
  actionPrefix: '',
  actor: '',
  q: '',
  limit: DEFAULT_LIMIT,
});

const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

const formatJsonValue = (value) => {
  if (value === null || value === undefined) {
    return '-';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `${value.length} items`;
  }

  return 'object';
};

const summarizeMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return '-';
  }

  const entries = Object.entries(metadata).slice(0, 2);
  if (entries.length === 0) {
    return '-';
  }

  return entries.map(([key, value]) => `${key}: ${formatJsonValue(value)}`).join(' | ');
};

const readMetadataJson = (metadata) => {
  if (metadata === null || metadata === undefined) {
    return null;
  }

  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return null;
  }
};

const AuditPage = () => {
  const [filters, setFilters] = useState(createDefaultFilters);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activePreset, setActivePreset] = useState('last7');

  const runSearch = async (nextFilters) => {
    setLoading(true);
    setError('');

    try {
      const payload = await listAuditLogs(nextFilters);
      setItems(Array.isArray(payload?.items) ? payload.items : []);
    } catch (loadError) {
      setItems([]);
      setError(loadError?.message || 'Errore caricamento audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runSearch(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = async (event) => {
    event.preventDefault();
    await runSearch(filters);
  };

  const applyPreset = async (preset) => {
    const nextDates = resolveDatePreset(preset);
    const next = {
      ...filters,
      ...nextDates,
    };
    setActivePreset(preset);
    setFilters(next);
    await runSearch(next);
  };

  const applyQuickFilter = async (patch) => {
    const next = {
      ...filters,
      ...patch,
    };
    setFilters(next);
    await runSearch(next);
  };

  const resetFilters = async () => {
    const defaults = createDefaultFilters();
    setActivePreset('last7');
    setFilters(defaults);
    await runSearch(defaults);
  };

  const rows = useMemo(() => items, [items]);

  const actionPrefixOptions = useMemo(() => {
    const dynamic = rows
      .map((entry) => String(entry.action || '').split('.').slice(0, 1).join('.'))
      .filter(Boolean)
      .map((entry) => `${entry}.`);
    return Array.from(new Set([...COMMON_ACTIONS, ...dynamic])).sort((left, right) => left.localeCompare(right));
  }, [rows]);

  const actorSuggestions = useMemo(() => {
    const dynamic = rows
      .map((entry) => entry.actor?.email || entry.actor?.name || entry.actor?.id || '')
      .filter(Boolean);
    return Array.from(new Set(dynamic)).sort((left, right) => left.localeCompare(right));
  }, [rows]);

  return (
    <ModulePermissionGate requiredModule="audit" requiredPermission="audit.view" moduleName="Audit">
      <div className="container-fluid">
        <div className="hk-pg-header pt-7 pb-4">
          <h1 className="pg-title">Audit Log</h1>
          <p>Filtri rapidi per periodo, area funzionale e utente (email, nome o userId).</p>
        </div>

        <div className="hk-pg-body">
          <Card className="card-border mb-3">
            <Card.Body className="d-flex flex-wrap gap-2">
              <span className="small text-muted align-self-center">Periodo:</span>
              <Button size="sm" variant={activePreset === 'today' ? 'primary' : 'outline-secondary'} onClick={() => void applyPreset('today')}>
                Oggi
              </Button>
              <Button size="sm" variant={activePreset === 'last7' ? 'primary' : 'outline-secondary'} onClick={() => void applyPreset('last7')}>
                7 giorni
              </Button>
              <Button size="sm" variant={activePreset === 'last30' ? 'primary' : 'outline-secondary'} onClick={() => void applyPreset('last30')}>
                30 giorni
              </Button>
              <Button size="sm" variant={activePreset === 'all' ? 'primary' : 'outline-secondary'} onClick={() => void applyPreset('all')}>
                Tutto
              </Button>
            </Card.Body>
          </Card>

          <Card className="card-border mb-3">
            <Card.Body className="d-flex flex-wrap gap-2">
              <span className="small text-muted align-self-center">Filtri rapidi:</span>
              {QUICK_FILTERS.map((entry) => (
                <Button
                  key={entry.label}
                  size="sm"
                  variant="outline-primary"
                  onClick={() => void applyQuickFilter(entry.patch)}
                  disabled={loading}
                >
                  {entry.label}
                </Button>
              ))}
            </Card.Body>
          </Card>

          <Card className="card-border mb-3">
            <Card.Body>
              <Form onSubmit={onSearch}>
                <Row className="g-2">
                  <Col md={2}>
                    <Form.Control
                      type="date"
                      value={filters.from}
                      onChange={(event) => {
                        setActivePreset('');
                        setFilters((current) => ({ ...current, from: event.target.value }));
                      }}
                    />
                  </Col>
                  <Col md={2}>
                    <Form.Control
                      type="date"
                      value={filters.to}
                      onChange={(event) => {
                        setActivePreset('');
                        setFilters((current) => ({ ...current, to: event.target.value }));
                      }}
                    />
                  </Col>
                  <Col md={2}>
                    <Form.Control
                      list="audit-action-prefix-list"
                      placeholder="Prefisso azione (es. team.)"
                      value={filters.actionPrefix}
                      onChange={(event) => setFilters((current) => ({ ...current, actionPrefix: event.target.value }))}
                    />
                    <datalist id="audit-action-prefix-list">
                      {actionPrefixOptions.map((entry) => (
                        <option key={entry} value={entry} />
                      ))}
                    </datalist>
                  </Col>
                  <Col md={4}>
                    <Form.Control
                      list="audit-actor-list"
                      placeholder="Utente: email, nome o userId"
                      value={filters.actor}
                      onChange={(event) => setFilters((current) => ({ ...current, actor: event.target.value }))}
                    />
                    <datalist id="audit-actor-list">
                      {actorSuggestions.map((entry) => (
                        <option key={entry} value={entry} />
                      ))}
                    </datalist>
                  </Col>
                  <Col md={6}>
                    <Form.Control
                      placeholder="Ricerca libera (azione, target id, utente)"
                      value={filters.q}
                      onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
                    />
                  </Col>
                  <Col md={2}>
                    <Form.Select
                      value={String(filters.limit)}
                      onChange={(event) =>
                        setFilters((current) => ({ ...current, limit: Number(event.target.value) || DEFAULT_LIMIT }))}
                    >
                      <option value="100">100 righe</option>
                      <option value="200">200 righe</option>
                      <option value="500">500 righe</option>
                    </Form.Select>
                  </Col>
                  <Col md={4}>
                    <div className="d-flex gap-2">
                      <Button type="submit" disabled={loading}>
                        Cerca
                      </Button>
                      <Button type="button" variant="outline-secondary" onClick={() => void resetFilters()} disabled={loading}>
                        Reset
                      </Button>
                    </div>
                  </Col>
                </Row>
              </Form>
            </Card.Body>
          </Card>

          {error && <Alert variant="danger">{error}</Alert>}

          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="small text-muted">{rows.length} eventi trovati</div>
            {loading && (
              <div className="d-flex align-items-center gap-2 text-muted">
                <Spinner animation="border" size="sm" />
                Caricamento audit...
              </div>
            )}
          </div>

          <Card className="card-border">
            <Card.Body className="p-0">
              <div className="table-responsive">
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Azione</th>
                      <th>Utente</th>
                      <th>Target</th>
                      <th>Target ID</th>
                      <th>Dettagli</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-muted px-3 py-3">
                          Nessun evento trovato.
                        </td>
                      </tr>
                    )}
                    {rows.map((entry) => {
                      const metadataJson = readMetadataJson(entry.metadata);
                      return (
                        <tr key={entry.id}>
                          <td className="text-nowrap">{formatDateTime(entry.timestamp)}</td>
                          <td>
                            <Badge bg="light" text="dark">
                              {entry.action}
                            </Badge>
                          </td>
                          <td>{entry.actor?.email || entry.actor?.name || entry.actor?.id || '-'}</td>
                          <td>{entry.targetType || '-'}</td>
                          <td>{entry.targetId || '-'}</td>
                          <td>
                            <div className="small text-muted mb-1">{summarizeMetadata(entry.metadata)}</div>
                            {metadataJson && (
                              <details>
                                <summary className="small">Apri JSON</summary>
                                <pre className="small mb-0">{metadataJson}</pre>
                              </details>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
    </ModulePermissionGate>
  );
};

export default AuditPage;
