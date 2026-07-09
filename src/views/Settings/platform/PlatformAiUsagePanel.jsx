import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Card, Col, Form, Row, Spinner, Table } from 'react-bootstrap';
import { Cpu, DollarSign, Users, RotateCcw } from 'lucide-react';
import { toast } from 'react-toastify';
import { getAiConfig, getAiUsage } from '../../../modules/admin/api/adminApi';

const formatDateTime = (value) => {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('it-IT');
};

const formatUsd = (value) => `$${Number(value || 0).toFixed(4)}`;
const formatNum = (value) => Number(value || 0).toLocaleString('it-IT');

const USAGE_WINDOWS = [
  { days: 7, label: '7 giorni' },
  { days: 30, label: '30 giorni' },
  { days: 90, label: '90 giorni' },
];

const getErrorMessage = (error, fallback) => error?.message || fallback;

const EMPTY_FILTERS = { userId: '', model: '', functionName: '' };

// Pannello "Consumi & costi AI" della Console piattaforma: costi aggregati per
// workspace e per utente, configurazione AI dei workspace, ultime chiamate, con
// filtri per periodo, utente, modello e funzione.
const PlatformAiUsagePanel = () => {
  const [aiUsage, setAiUsage] = useState(null);
  const [aiConfig, setAiConfig] = useState([]);
  const [usageDays, setUsageDays] = useState(30);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const fetchUsage = useCallback(
    async (days, activeFilters) => {
      return getAiUsage({
        days,
        userId: activeFilters.userId || undefined,
        model: activeFilters.model || undefined,
        functionName: activeFilters.functionName || undefined,
      });
    },
    [],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [usageResult, configResult] = await Promise.all([
        fetchUsage(usageDays, filters),
        getAiConfig(),
      ]);
      setAiUsage(usageResult ?? null);
      setAiConfig(configResult?.workspaces ?? []);
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Impossibile caricare i consumi AI.'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Ricarica solo i consumi quando cambiano periodo/filtri (la config non cambia).
  const applyUsageQuery = useCallback(
    async (days, nextFilters) => {
      setRefreshing(true);
      try {
        const usageResult = await fetchUsage(days, nextFilters);
        setAiUsage(usageResult ?? null);
      } catch (error) {
        toast.error(getErrorMessage(error, 'Errore caricamento consumi AI'));
      } finally {
        setRefreshing(false);
      }
    },
    [fetchUsage],
  );

  const handleChangeDays = (days) => {
    setUsageDays(days);
    void applyUsageQuery(days, filters);
  };

  const handleChangeFilter = (key, value) => {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    void applyUsageQuery(usageDays, nextFilters);
  };

  const handleResetFilters = () => {
    setFilters(EMPTY_FILTERS);
    void applyUsageQuery(usageDays, EMPTY_FILTERS);
  };

  const options = aiUsage?.options ?? { users: [], models: [], functions: [] };
  const hasActiveFilters = Boolean(filters.userId || filters.model || filters.functionName);

  if (loading) {
    return (
      <div className="p-4 d-flex justify-content-center">
        <Spinner animation="border" size="sm" role="status" />
      </div>
    );
  }

  return (
    <>
      {loadError && (
        <Alert variant="danger" onClose={() => setLoadError('')} dismissible>
          {loadError}
        </Alert>
      )}

      <Card className="card-border mb-4">
        <Card.Header className="bg-transparent d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <h6 className="mb-0 d-flex align-items-center gap-2">
            <DollarSign size={16} />
            Costi AI
          </h6>
          {refreshing && <Spinner animation="border" size="sm" role="status" />}
        </Card.Header>
        <Card.Body>
          <Row className="g-2 align-items-end mb-3">
            <Col md={3}>
              <Form.Label className="small text-muted mb-1">Periodo</Form.Label>
              <Form.Select
                size="sm"
                value={usageDays}
                onChange={(event) => handleChangeDays(Number(event.target.value))}
                disabled={refreshing}
              >
                {USAGE_WINDOWS.map((window) => (
                  <option key={window.days} value={window.days}>
                    Ultimi {window.label}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Label className="small text-muted mb-1">Utente</Form.Label>
              <Form.Select
                size="sm"
                value={filters.userId}
                onChange={(event) => handleChangeFilter('userId', event.target.value)}
                disabled={refreshing}
              >
                <option value="">Tutti gli utenti</option>
                {options.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                    {user.email ? ` (${user.email})` : ''}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Label className="small text-muted mb-1">Modello</Form.Label>
              <Form.Select
                size="sm"
                value={filters.model}
                onChange={(event) => handleChangeFilter('model', event.target.value)}
                disabled={refreshing}
              >
                <option value="">Tutti i modelli</option>
                {options.models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Label className="small text-muted mb-1">Funzione</Form.Label>
              <Form.Select
                size="sm"
                value={filters.functionName}
                onChange={(event) => handleChangeFilter('functionName', event.target.value)}
                disabled={refreshing}
              >
                <option value="">Tutte le funzioni</option>
                {options.functions.map((fn) => (
                  <option key={fn} value={fn}>
                    {fn}
                  </option>
                ))}
              </Form.Select>
            </Col>
          </Row>

          {hasActiveFilters && (
            <div className="mb-3">
              <button
                type="button"
                className="btn btn-link btn-sm p-0 d-inline-flex align-items-center gap-1"
                onClick={handleResetFilters}
                disabled={refreshing}
              >
                <RotateCcw size={14} />
                Azzera filtri
              </button>
            </div>
          )}

          {aiUsage && (
            <Row className="g-3 mb-3">
              <Col sm={3}>
                <div className="small text-muted">Costo totale</div>
                <div className="h5 mb-0">{formatUsd(aiUsage.totals?.costUsd)}</div>
              </Col>
              <Col sm={3}>
                <div className="small text-muted">Chiamate</div>
                <div className="h5 mb-0">{formatNum(aiUsage.totals?.calls)}</div>
              </Col>
              <Col sm={3}>
                <div className="small text-muted">Token input</div>
                <div className="h5 mb-0">{formatNum(aiUsage.totals?.inputTokens)}</div>
              </Col>
              <Col sm={3}>
                <div className="small text-muted">Token output</div>
                <div className="h5 mb-0">{formatNum(aiUsage.totals?.outputTokens)}</div>
              </Col>
            </Row>
          )}

          <div className="fw-semibold small text-muted mb-2">Per workspace</div>
          {!aiUsage || aiUsage.perWorkspace?.length === 0 ? (
            <div className="text-muted mb-3">Nessun consumo AI nel periodo/filtri selezionati.</div>
          ) : (
            <Table responsive hover className="mb-4 align-middle">
              <thead>
                <tr>
                  <th>Workspace</th>
                  <th className="text-end">Chiamate</th>
                  <th className="text-end">Costo</th>
                  <th className="text-end">Token in</th>
                  <th className="text-end">Token out</th>
                  <th>Ultima chiamata</th>
                </tr>
              </thead>
              <tbody>
                {aiUsage.perWorkspace.map((row) => (
                  <tr key={row.workspaceId}>
                    <td className="fw-semibold">{row.name}</td>
                    <td className="text-end">{formatNum(row.calls)}</td>
                    <td className="text-end">{formatUsd(row.costUsd)}</td>
                    <td className="text-end">{formatNum(row.inputTokens)}</td>
                    <td className="text-end">{formatNum(row.outputTokens)}</td>
                    <td className="text-muted">{formatDateTime(row.lastCallAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          <div className="fw-semibold small text-muted mb-2 d-flex align-items-center gap-2">
            <Users size={14} />
            Per utente
          </div>
          {!aiUsage || aiUsage.perUser?.length === 0 ? (
            <div className="text-muted">Nessun consumo AI per utente nel periodo/filtri selezionati.</div>
          ) : (
            <Table responsive hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>Utente</th>
                  <th>Email</th>
                  <th className="text-end">Chiamate</th>
                  <th className="text-end">Costo</th>
                  <th className="text-end">Token in</th>
                  <th className="text-end">Token out</th>
                  <th>Ultima chiamata</th>
                </tr>
              </thead>
              <tbody>
                {aiUsage.perUser.map((row) => (
                  <tr key={row.userId ?? 'system'}>
                    <td className="fw-semibold">{row.name}</td>
                    <td className="text-muted">{row.email || '—'}</td>
                    <td className="text-end">{formatNum(row.calls)}</td>
                    <td className="text-end">{formatUsd(row.costUsd)}</td>
                    <td className="text-end">{formatNum(row.inputTokens)}</td>
                    <td className="text-end">{formatNum(row.outputTokens)}</td>
                    <td className="text-muted">{formatDateTime(row.lastCallAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {aiUsage?.recent?.length > 0 && (
        <Card className="card-border mb-4">
          <Card.Header className="bg-transparent">
            <h6 className="mb-0">Ultime chiamate</h6>
          </Card.Header>
          <Card.Body className="p-0">
            <Table responsive hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Utente</th>
                  <th>Workspace</th>
                  <th>Funzione</th>
                  <th>Modello</th>
                  <th className="text-end">Costo</th>
                </tr>
              </thead>
              <tbody>
                {aiUsage.recent.map((row) => (
                  <tr key={row.id}>
                    <td className="text-muted">{formatDateTime(row.createdAt)}</td>
                    <td>{row.userName}</td>
                    <td className="text-muted">{row.name || '—'}</td>
                    <td className="text-muted">{row.functionName}</td>
                    <td className="text-muted">{row.model}</td>
                    <td className="text-end">{formatUsd(row.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      <Card className="card-border mb-4">
        <Card.Header className="bg-transparent d-flex align-items-center gap-2">
          <Cpu size={16} />
          <h6 className="mb-0">Configurazione AI per workspace</h6>
        </Card.Header>
        <Card.Body className="p-0">
          {aiConfig.length === 0 ? (
            <div className="p-4 text-muted">Nessun workspace.</div>
          ) : (
            <Table responsive hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>Workspace</th>
                  <th>AI</th>
                  <th>Modello</th>
                  <th>Chiave API</th>
                  <th className="text-end">Max token output</th>
                </tr>
              </thead>
              <tbody>
                {aiConfig.map((row) => (
                  <tr key={row.workspaceId}>
                    <td className="fw-semibold">{row.name}</td>
                    <td>
                      <Badge bg={row.aiEnabled ? 'success' : 'secondary'}>
                        {row.aiEnabled ? 'Attiva' : 'Spenta'}
                      </Badge>
                    </td>
                    <td className="text-muted">{row.model || '—'}</td>
                    <td>
                      <Badge bg={row.apiKeyConfigured ? 'success' : 'secondary'}>
                        {row.apiKeyConfigured ? 'Configurata' : 'Assente'}
                      </Badge>
                    </td>
                    <td className="text-end">
                      {row.maxOutputTokens != null ? formatNum(row.maxOutputTokens) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </>
  );
};

export default PlatformAiUsagePanel;
