import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Placeholder,
  Row,
  Table,
} from 'react-bootstrap';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, TriangleAlert } from 'lucide-react';
import { listQuotes, lookupQuoteClients } from '../../modules/quotes/api/quotesApi';
import QuoteStatusBadge from '../../modules/quotes/ui/components/QuoteStatusBadge';
import QuotesModuleGate from '../../modules/quotes/ui/QuotesModuleGate';
import {
  QUOTES_PAGE_SIZE_OPTIONS,
  QUOTES_PERMISSIONS,
  QUOTE_STATUSES,
} from '../../modules/quotes/ui/constants';
import {
  formatCurrency,
  formatDateTime,
  getApiErrorMessage,
  shortQuoteId,
} from '../../modules/quotes/ui/helpers';
import '../../modules/quotes/ui/quotes-ui.css';
import { hasPermission } from '../../utils/workspaceAccess';
import CollapsibleSection from '../../components/ui/CollapsibleSection';
import RowDisclosureButton from '../../components/ui/RowDisclosureButton';
import DetailField from '../../components/ui/DetailField';

// Contenuto della linguetta di un preventivo: i campi economici/di dettaglio
// gia' presenti nella risposta di lista ma non mostrati nella riga compatta.
const emptyDetailValue = <span className="text-muted">—</span>;

const QuoteRowDetails = React.memo(function QuoteRowDetails({ quote }) {
  const notes = typeof quote?.notes === 'string' ? quote.notes.trim() : '';
  const taxRate = Number.isFinite(quote?.taxRate) ? `${quote.taxRate}%` : null;
  return (
    <div className="ui-row-detail-grid">
      <DetailField label="Subtotale">
        {quote?.subtotal != null ? formatCurrency(quote.subtotal, quote.currency) : emptyDetailValue}
      </DetailField>
      <DetailField label="Imposte">
        {quote?.taxTotal != null ? formatCurrency(quote.taxTotal, quote.currency) : emptyDetailValue}
        {taxRate ? <span className="text-muted"> ({taxRate})</span> : null}
      </DetailField>
      <DetailField label="Emissione">
        {quote?.issueDate ? formatDateTime(quote.issueDate) : emptyDetailValue}
      </DetailField>
      <DetailField label="Valido fino al">
        {quote?.validUntil ? formatDateTime(quote.validUntil) : emptyDetailValue}
      </DetailField>
      <DetailField label="Note" fullWidth>
        {notes || emptyDetailValue}
      </DetailField>
    </div>
  );
});

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const parsePageSize = (value) => {
  const parsed = parsePositiveInt(value, QUOTES_PAGE_SIZE_OPTIONS[1] || 20);
  return QUOTES_PAGE_SIZE_OPTIONS.includes(parsed)
    ? parsed
    : (QUOTES_PAGE_SIZE_OPTIONS[1] || 20);
};

const toStartIso = (inputDate) => {
  if (!inputDate) {
    return undefined;
  }

  const date = new Date(`${inputDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
};

const toEndIso = (inputDate) => {
  if (!inputDate) {
    return undefined;
  }

  const date = new Date(`${inputDate}T23:59:59`);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
};

const QuotesList = () => {
  const history = useHistory();
  const location = useLocation();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const activeStatus = params.get('status') || '';
  const activeClientId = params.get('clientId') || '';
  const activeSearch = (params.get('q') || '').trim();
  const activeFromDate = params.get('from') || '';
  const activeToDate = params.get('to') || '';
  const activePage = parsePositiveInt(params.get('page'), 1);
  const activePageSize = parsePageSize(params.get('pageSize'));

  const [searchDraft, setSearchDraft] = useState(activeSearch);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clients, setClients] = useState([]);
  const [quotesData, setQuotesData] = useState({
    items: [],
    pageInfo: {
      page: activePage,
      pageSize: activePageSize,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPrevPage: false,
    },
  });
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const toggleExpanded = useCallback((quoteId) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(quoteId)) {
        next.delete(quoteId);
      } else {
        next.add(quoteId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    setSearchDraft(activeSearch);
  }, [activeSearch]);

  const updateRouteQuery = useCallback((nextParams) => {
    const routeParams = new URLSearchParams(location.search);

    Object.entries(nextParams).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        routeParams.delete(key);
        return;
      }

      routeParams.set(key, String(value));
    });

    history.push({
      pathname: '/apps/quotes',
      search: routeParams.toString(),
    });
  }, [history, location.search]);

  const loadClients = useCallback(async () => {
    try {
      const response = await lookupQuoteClients({ limit: 50 });
      setClients(Array.isArray(response?.items) ? response.items : []);
    } catch (_error) {
      setClients([]);
    }
  }, []);

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await listQuotes({
        status: activeStatus || undefined,
        clientId: activeClientId || undefined,
        q: activeSearch || undefined,
        createdFrom: toStartIso(activeFromDate),
        createdTo: toEndIso(activeToDate),
        page: activePage,
        pageSize: activePageSize,
      });

      setQuotesData({
        items: Array.isArray(response?.items) ? response.items : [],
        pageInfo: response?.pageInfo || {
          page: activePage,
          pageSize: activePageSize,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, {
        forbiddenMessage: 'Non hai permessi',
        fallbackMessage: 'Errore caricamento preventivi',
      }));
    } finally {
      setLoading(false);
    }
  }, [activeClientId, activeFromDate, activePage, activePageSize, activeSearch, activeStatus, activeToDate]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  useEffect(() => {
    void loadQuotes();
  }, [loadQuotes]);

  const onSearchSubmit = (event) => {
    event.preventDefault();
    updateRouteQuery({
      q: searchDraft || undefined,
      page: 1,
    });
  };

  const resetFilters = () => {
    history.push('/apps/quotes');
  };

  const goToPage = (page) => {
    updateRouteQuery({ page });
  };

  const renderLoadingRows = () => (
    <>
      {[1, 2, 3, 4, 5].map((row) => (
        <tr key={row}>
          <td colSpan={7}>
            <Placeholder as="div" animation="glow">
              <Placeholder xs={12} />
            </Placeholder>
          </td>
        </tr>
      ))}
    </>
  );

  return (
    <QuotesModuleGate requiredPermission={QUOTES_PERMISSIONS.view}>
      {({ access }) => {
        const canCreate = hasPermission(access, QUOTES_PERMISSIONS.create);
        const totalPages = Math.max(1, Number(quotesData?.pageInfo?.totalPages) || 0);

        return (
          <div className="container-fluid quotes-page-container page-flat">
            <div className="quotes-page-shell pt-3">
              <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap mb-3">
                <div>
                  <h3 className="mb-1">Preventivi</h3>
                  <p className="text-muted mb-0">Gestione bozze, invio, accettazione e storico preventivi.</p>
                </div>
                {canCreate && (
                  <Button as={Link} to="/apps/quotes/new" className="d-inline-flex align-items-center gap-1">
                    <Plus size={15} />
                    Nuovo preventivo
                  </Button>
                )}
              </div>

              <Card className="card-border mb-3">
                <Card.Body>
                  <Form onSubmit={onSearchSubmit}>
                    <div className="quote-filter-grid">
                      <Form.Group>
                        <Form.Label className="small">Ricerca</Form.Label>
                        <Form.Control
                          value={searchDraft}
                          onChange={(event) => setSearchDraft(event.target.value)}
                          placeholder="ID o cliente"
                        />
                      </Form.Group>

                      <Form.Group>
                        <Form.Label className="small">Stato</Form.Label>
                        <Form.Select
                          value={activeStatus}
                          onChange={(event) => updateRouteQuery({ status: event.target.value || undefined, page: 1 })}
                        >
                          <option value="">Tutti</option>
                          {QUOTE_STATUSES.map((status) => (
                            <option key={status.value} value={status.value}>{status.label}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>

                      <Form.Group>
                        <Form.Label className="small">Cliente</Form.Label>
                        <Form.Select
                          value={activeClientId}
                          onChange={(event) => updateRouteQuery({ clientId: event.target.value || undefined, page: 1 })}
                        >
                          <option value="">Tutti i clienti</option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>{client.name}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>

                      <Form.Group>
                        <Form.Label className="small">Dal</Form.Label>
                        <Form.Control
                          type="date"
                          value={activeFromDate}
                          onChange={(event) => updateRouteQuery({ from: event.target.value || undefined, page: 1 })}
                        />
                      </Form.Group>

                      <Form.Group>
                        <Form.Label className="small">Al</Form.Label>
                        <Form.Control
                          type="date"
                          value={activeToDate}
                          onChange={(event) => updateRouteQuery({ to: event.target.value || undefined, page: 1 })}
                        />
                      </Form.Group>

                      <Form.Group>
                        <Form.Label className="small">Righe pagina</Form.Label>
                        <Form.Select
                          value={activePageSize}
                          onChange={(event) => updateRouteQuery({ pageSize: Number(event.target.value), page: 1 })}
                        >
                          {QUOTES_PAGE_SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size}>{size}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </div>

                    <div className="d-flex justify-content-end gap-2 mt-3">
                      <Button type="button" variant="outline-secondary" onClick={resetFilters}>
                        Reset
                      </Button>
                      <Button type="submit">Applica filtri</Button>
                    </div>
                  </Form>
                </Card.Body>
              </Card>

              {error && (
                <Alert variant="danger" className="d-flex justify-content-between align-items-center gap-2">
                  <div className="d-inline-flex align-items-center gap-2">
                    <TriangleAlert size={16} />
                    <span>{error}</span>
                  </div>
                  <Button variant="outline-danger" size="sm" onClick={() => void loadQuotes()}>
                    Riprova
                  </Button>
                </Alert>
              )}

              <Card className="card-border flat-keep mb-3">
                <Card.Body className="py-2">
                  <div className="table-responsive">
                    <Table hover className="mb-0 align-middle">
                      <thead>
                        <tr>
                          <th className="ui-col-disclosure">
                            <span className="visually-hidden">Espandi</span>
                          </th>
                          <th>Numero</th>
                          <th>Cliente</th>
                          <th>Stato</th>
                          <th className="text-end">Totale</th>
                          <th>Creato</th>
                          <th>Aggiornato</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading && renderLoadingRows()}
                        {!loading && quotesData.items.length === 0 && (
                          <tr>
                            <td colSpan={7} className="text-center text-muted py-4">
                              Nessun preventivo trovato.
                            </td>
                          </tr>
                        )}
                        {!loading && quotesData.items.map((quote) => {
                          const isExpanded = expandedIds.has(quote.id);
                          const detailId = `quote-detail-${quote.id}`;
                          return (
                            <React.Fragment key={quote.id}>
                              <tr
                                className={`quote-clickable-row ${isExpanded ? 'ui-row-expanded' : ''}`.trim()}
                                onClick={() => history.push(`/apps/quotes/${quote.id}`)}
                              >
                                <td className="ui-col-disclosure">
                                  <RowDisclosureButton
                                    expanded={isExpanded}
                                    onToggle={() => toggleExpanded(quote.id)}
                                    controlsId={detailId}
                                    label={`preventivo ${shortQuoteId(quote.id)}`}
                                  />
                                </td>
                                <td>#{shortQuoteId(quote.id)}</td>
                                <td>{quote?.client?.name || '-'}</td>
                                <td><QuoteStatusBadge status={quote.status} /></td>
                                <td className="text-end fw-semibold">{formatCurrency(quote.total, quote.currency)}</td>
                                <td>{formatDateTime(quote.createdAt)}</td>
                                <td>{formatDateTime(quote.updatedAt)}</td>
                              </tr>
                              <tr className="ui-row-detail-row">
                                <td colSpan={7} className="ui-row-detail-cell">
                                  <CollapsibleSection open={isExpanded} id={detailId}>
                                    <QuoteRowDetails quote={quote} />
                                  </CollapsibleSection>
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                </Card.Body>
              </Card>

              <Row className="align-items-center gy-2 mb-4">
                <Col md={6}>
                  <div className="text-muted small">Totale preventivi: {quotesData.pageInfo.totalItems || 0}</div>
                </Col>
                <Col md={6}>
                  <div className="d-flex justify-content-md-end align-items-center gap-2">
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => goToPage(activePage - 1)}
                      disabled={!quotesData.pageInfo.hasPrevPage || loading}
                      aria-label="Pagina precedente"
                    >
                      <ChevronLeft size={15} />
                    </Button>
                    <span className="small">Pagina {quotesData.pageInfo.page || 1} di {totalPages}</span>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => goToPage(activePage + 1)}
                      disabled={!quotesData.pageInfo.hasNextPage || loading}
                      aria-label="Pagina successiva"
                    >
                      <ChevronRight size={15} />
                    </Button>
                  </div>
                </Col>
              </Row>
            </div>
          </div>
        );
      }}
    </QuotesModuleGate>
  );
};

export default QuotesList;
