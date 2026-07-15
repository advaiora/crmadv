import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { getAgencyAiUsage } from "../../modules/agency-os/data/agencyDataAdapter";

// Rendiconto consumi AI del workspace (V4 — cost control): totali, dettaglio per
// dipendente, per funzione e per progetto, ultime chiamate, con filtri periodo/
// utente/modello/funzione/progetto. È la versione per-workspace della panoramica
// cross-workspace della Console piattaforma. Vive in Impostazioni Agency, accanto
// al Budget AI (budget = controllo, questo = monitoraggio). Accesso super-admin
// di workspace.

const formatUsd = (value) => `$${Number(value || 0).toFixed(4)}`;
const formatNum = (value) => Number(value || 0).toLocaleString("it-IT");

const formatDateTime = (value) => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("it-IT");
};

const USAGE_WINDOWS = [
  { days: 7, label: "7 giorni" },
  { days: 30, label: "30 giorni" },
  { days: 90, label: "90 giorni" },
];

const EMPTY_FILTERS = { userId: "", model: "", functionName: "", projectId: "" };

const AgencyAiUsagePanel = () => {
  const [usage, setUsage] = useState(null);
  const [days, setDays] = useState(30);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchUsage = useCallback(
    (nextDays, nextFilters) =>
      getAgencyAiUsage({
        days: nextDays,
        userId: nextFilters.userId || undefined,
        model: nextFilters.model || undefined,
        functionName: nextFilters.functionName || undefined,
        projectId: nextFilters.projectId || undefined,
      }),
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchUsage(days, filters);
      setUsage(result ?? null);
    } catch (err) {
      setError(err?.message || "Impossibile caricare i consumi AI.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applyQuery = useCallback(
    async (nextDays, nextFilters) => {
      setRefreshing(true);
      setError("");
      try {
        const result = await fetchUsage(nextDays, nextFilters);
        setUsage(result ?? null);
      } catch (err) {
        setError(err?.message || "Errore caricamento consumi AI.");
      } finally {
        setRefreshing(false);
      }
    },
    [fetchUsage],
  );

  const handleChangeDays = (value) => {
    setDays(value);
    void applyQuery(value, filters);
  };

  const handleChangeFilter = (key, value) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    void applyQuery(days, next);
  };

  const handleResetFilters = () => {
    setFilters(EMPTY_FILTERS);
    void applyQuery(days, EMPTY_FILTERS);
  };

  const options = usage?.options ?? { users: [], models: [], functions: [], projects: [] };
  const hasActiveFilters = Boolean(
    filters.userId || filters.model || filters.functionName || filters.projectId,
  );

  return (
    <Card className="card-border">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2 flex-wrap">
          <div>
            <h6 className="mb-1">Consumi &amp; costi AI</h6>
            <p className="small text-muted mb-0">
              Rendiconto della spesa AI del workspace: per dipendente, per funzione, per
              progetto e ultime chiamate. Complementare al budget qui sotto (qui vedi
              quanto è stato speso, lì imposti quanto si può spendere).
            </p>
          </div>
          {refreshing && <Spinner animation="border" size="sm" role="status" />}
        </div>

        {error && (
          <Alert variant="danger" className="py-2" dismissible onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        {loading ? (
          <div className="p-3 d-flex justify-content-center">
            <Spinner animation="border" size="sm" role="status" />
          </div>
        ) : (
          <>
            {/* Cinque filtri in una riga sola su desktop: 2+3+2+2+3 = 12 colonne. */}
            <Row className="g-2 align-items-end mb-3">
              <Col md={2}>
                <Form.Label className="small text-muted mb-1">Periodo</Form.Label>
                <Form.Select
                  size="sm"
                  value={days}
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
                <Form.Label className="small text-muted mb-1">Dipendente</Form.Label>
                <Form.Select
                  size="sm"
                  value={filters.userId}
                  onChange={(event) => handleChangeFilter("userId", event.target.value)}
                  disabled={refreshing}
                >
                  <option value="">Tutti</option>
                  {options.users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                      {user.email ? ` (${user.email})` : ""}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={2}>
                <Form.Label className="small text-muted mb-1">Modello</Form.Label>
                <Form.Select
                  size="sm"
                  value={filters.model}
                  onChange={(event) => handleChangeFilter("model", event.target.value)}
                  disabled={refreshing}
                >
                  <option value="">Tutti</option>
                  {options.models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={2}>
                <Form.Label className="small text-muted mb-1">Funzione</Form.Label>
                <Form.Select
                  size="sm"
                  value={filters.functionName}
                  onChange={(event) => handleChangeFilter("functionName", event.target.value)}
                  disabled={refreshing}
                >
                  <option value="">Tutte</option>
                  {options.functions.map((fn) => (
                    <option key={fn} value={fn}>
                      {fn}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={3}>
                <Form.Label className="small text-muted mb-1">Progetto</Form.Label>
                <Form.Select
                  size="sm"
                  value={filters.projectId}
                  onChange={(event) => handleChangeFilter("projectId", event.target.value)}
                  disabled={refreshing}
                >
                  <option value="">Tutti</option>
                  {options.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Form.Select>
              </Col>
            </Row>

            {hasActiveFilters && (
              <div className="mb-3">
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0"
                  onClick={handleResetFilters}
                  disabled={refreshing}
                >
                  Azzera filtri
                </button>
              </div>
            )}

            <Row className="g-3 mb-3">
              <Col sm={3}>
                <div className="small text-muted">Costo totale</div>
                <div className="h5 mb-0">{formatUsd(usage?.totals?.costUsd)}</div>
              </Col>
              <Col sm={3}>
                <div className="small text-muted">Chiamate</div>
                <div className="h5 mb-0">{formatNum(usage?.totals?.calls)}</div>
              </Col>
              <Col sm={3}>
                <div className="small text-muted">Token input</div>
                <div className="h5 mb-0">{formatNum(usage?.totals?.inputTokens)}</div>
              </Col>
              <Col sm={3}>
                <div className="small text-muted">Token output</div>
                <div className="h5 mb-0">{formatNum(usage?.totals?.outputTokens)}</div>
              </Col>
            </Row>

            <div className="fw-semibold small text-muted mb-2">Per dipendente</div>
            {!usage || usage.perUser?.length === 0 ? (
              <div className="text-muted mb-4">Nessun consumo AI nel periodo/filtri selezionati.</div>
            ) : (
              <div className="table-responsive mb-4">
                <Table size="sm" hover className="align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Dipendente</th>
                      <th className="text-end">Chiamate</th>
                      <th className="text-end">Costo</th>
                      <th className="text-end">Token in</th>
                      <th className="text-end">Token out</th>
                      <th>Ultima chiamata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.perUser.map((row) => (
                      <tr key={row.userId ?? "system"}>
                        <td>
                          <div className="fw-semibold small">{row.name}</div>
                          {row.email && <div className="small text-muted">{row.email}</div>}
                        </td>
                        <td className="text-end">{formatNum(row.calls)}</td>
                        <td className="text-end">{formatUsd(row.costUsd)}</td>
                        <td className="text-end">{formatNum(row.inputTokens)}</td>
                        <td className="text-end">{formatNum(row.outputTokens)}</td>
                        <td className="text-muted">{formatDateTime(row.lastCallAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}

            <div className="fw-semibold small text-muted mb-2">Per funzione AI</div>
            {!usage || usage.perFunction?.length === 0 ? (
              <div className="text-muted mb-4">Nessun consumo AI nel periodo/filtri selezionati.</div>
            ) : (
              <div className="table-responsive mb-4">
                <Table size="sm" hover className="align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Funzione</th>
                      <th className="text-end">Chiamate</th>
                      <th className="text-end">Costo</th>
                      <th className="text-end">Token in</th>
                      <th className="text-end">Token out</th>
                      <th>Ultima chiamata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.perFunction.map((row) => (
                      <tr key={row.functionName}>
                        <td className="fw-semibold small">{row.functionName}</td>
                        <td className="text-end">{formatNum(row.calls)}</td>
                        <td className="text-end">{formatUsd(row.costUsd)}</td>
                        <td className="text-end">{formatNum(row.inputTokens)}</td>
                        <td className="text-end">{formatNum(row.outputTokens)}</td>
                        <td className="text-muted">{formatDateTime(row.lastCallAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}

            {/* Per progetto: risponde a "quanto è costato il progetto X". Le chiamate
                senza progetto (chat generale, ricerche su più progetti) finiscono
                nella riga "Senza progetto". */}
            <div className="fw-semibold small text-muted mb-2">Per progetto</div>
            {!usage || usage.perProject?.length === 0 ? (
              <div className="text-muted mb-4">Nessun consumo AI nel periodo/filtri selezionati.</div>
            ) : (
              <div className="table-responsive mb-4">
                <Table size="sm" hover className="align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Progetto</th>
                      <th className="text-end">Chiamate</th>
                      <th className="text-end">Costo</th>
                      <th className="text-end">Token in</th>
                      <th className="text-end">Token out</th>
                      <th>Ultima chiamata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.perProject.map((row) => (
                      <tr key={row.projectId || "senza-progetto"}>
                        <td className={row.projectId ? "fw-semibold small" : "small text-muted"}>{row.name}</td>
                        <td className="text-end">{formatNum(row.calls)}</td>
                        <td className="text-end">{formatUsd(row.costUsd)}</td>
                        <td className="text-end">{formatNum(row.inputTokens)}</td>
                        <td className="text-end">{formatNum(row.outputTokens)}</td>
                        <td className="text-muted">{formatDateTime(row.lastCallAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}

            <div className="fw-semibold small text-muted mb-2">Ultime chiamate</div>
            {!usage || usage.recent?.length === 0 ? (
              <div className="text-muted mb-0">Nessuna chiamata AI recente.</div>
            ) : (
              <div className="table-responsive">
                <Table size="sm" hover className="align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Quando</th>
                      <th>Dipendente</th>
                      <th>Progetto</th>
                      <th>Funzione</th>
                      <th>Modello</th>
                      <th className="text-end">Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.recent.map((row) => (
                      <tr key={row.id}>
                        <td className="text-muted">{formatDateTime(row.createdAt)}</td>
                        <td>{row.userName}</td>
                        <td className={row.projectName ? "" : "text-muted"}>{row.projectName || "—"}</td>
                        <td className="text-muted">
                          {row.functionName}
                          {row.fromConversation && (
                            <Badge bg="secondary" className="ms-2 fw-normal">
                              chat
                            </Badge>
                          )}
                        </td>
                        <td className="text-muted">{row.model}</td>
                        <td className="text-end">{formatUsd(row.costUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
};

export default AgencyAiUsagePanel;
