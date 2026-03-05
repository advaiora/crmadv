import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Modal,
  Placeholder,
  Row,
  Spinner,
  Table,
} from 'react-bootstrap';
import { Link, useHistory, useLocation, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  Download,
  Mail,
  Pencil,
  ThumbsDown,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import {
  acceptQuote,
  cancelSendQuote,
  deleteQuote,
  downloadQuotePdf,
  getQuote,
  rejectQuote,
  resendQuote,
  sendQuote,
} from '../../modules/quotes/api/quotesApi';
import QuoteStatusBadge from '../../modules/quotes/ui/components/QuoteStatusBadge';
import QuoteTotalsSummary from '../../modules/quotes/ui/components/QuoteTotalsSummary';
import QuotesModuleGate from '../../modules/quotes/ui/QuotesModuleGate';
import { QUOTES_PERMISSIONS } from '../../modules/quotes/ui/constants';
import {
  formatCurrency,
  formatDateOnly,
  formatDateTime,
  getApiErrorMessage,
  shortQuoteId,
  triggerBlobDownload,
} from '../../modules/quotes/ui/helpers';
import '../../modules/quotes/ui/quotes-ui.css';
import { hasPermission } from '../../utils/workspaceAccess';

const ACTION_CONFIG = {
  send: {
    label: 'Invia preventivo',
    body: 'Confermi il cambio stato da BOZZA a INVIATO?',
  },
  accept: {
    label: 'Accetta preventivo',
    body: 'Confermi il cambio stato da INVIATO a ACCETTATO?',
  },
  reject: {
    label: 'Rifiuta preventivo',
    body: 'Confermi il cambio stato da INVIATO a RIFIUTATO?',
  },
  cancelSend: {
    label: 'Annulla invio',
    body: 'Confermi il ritorno da INVIATO a BOZZA?',
  },
  resend: {
    label: 'Reinvia preventivo',
    body: 'Confermi il reinvio email con PDF aggiornato al cliente?',
  },
  delete: {
    label: 'Elimina preventivo',
    body: "Confermi l'eliminazione della bozza? Questa azione non e reversibile.",
  },
};

const initialPdfOptions = {
  includeItems: true,
  includeCompanyFooter: true,
  headerTitle: '',
  footerNote: '',
  signatureUrl: '',
};

const QuoteDetail = () => {
  const history = useHistory();
  const location = useLocation();
  const { id } = useParams();

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(() => location.state?.flash || '');
  const [pendingAction, setPendingAction] = useState(null);
  const [runningAction, setRunningAction] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfOptions, setPdfOptions] = useState(initialPdfOptions);

  useEffect(() => {
    if (!location.state?.flash) {
      return;
    }

    history.replace({
      pathname: location.pathname,
      search: location.search,
      state: {
        ...(location.state || {}),
        flash: undefined,
      },
    });
  }, [history, location.pathname, location.search, location.state]);

  const loadQuote = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await getQuote(id);
      const quoteData = response?.quote || response;
      setQuote(quoteData || null);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, {
        forbiddenMessage: 'Non hai permessi',
        notFoundMessage: 'Preventivo non trovato',
        fallbackMessage: 'Errore caricamento preventivo',
      }));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadQuote();
  }, [loadQuote]);

  const performStateAction = async () => {
    if (!quote || !pendingAction) {
      return;
    }

    setRunningAction(true);
    setError('');

    try {
      if (pendingAction === 'send') {
        await sendQuote(quote.id);
      } else if (pendingAction === 'accept') {
        await acceptQuote(quote.id);
      } else if (pendingAction === 'reject') {
        await rejectQuote(quote.id);
      } else if (pendingAction === 'cancelSend') {
        await cancelSendQuote(quote.id);
      } else if (pendingAction === 'resend') {
        await resendQuote(quote.id);
      } else if (pendingAction === 'delete') {
        await deleteQuote(quote.id);
        history.push('/apps/quotes', {
          flash: 'Preventivo eliminato.',
        });
        return;
      }

      setFlash('Stato preventivo aggiornato.');
      setPendingAction(null);
      await loadQuote();
    } catch (actionError) {
      setError(getApiErrorMessage(actionError, {
        forbiddenMessage: 'Non hai permessi',
        notFoundMessage: 'Preventivo non trovato',
        conflictMessage: 'Operazione non valida per lo stato attuale',
        fallbackMessage: 'Operazione non riuscita',
      }));
    } finally {
      setRunningAction(false);
    }
  };

  const exportPdf = async () => {
    if (!quote) {
      return;
    }

    setPdfExporting(true);
    setError('');
    try {
      const requestOptions = {
        includeItems: pdfOptions.includeItems,
        includeCompanyFooter: pdfOptions.includeCompanyFooter,
        headerTitle: pdfOptions.headerTitle?.trim() || undefined,
        footerNote: pdfOptions.footerNote?.trim() || undefined,
        signatureUrl: pdfOptions.signatureUrl?.trim() || undefined,
      };
      const { blob, filename } = await downloadQuotePdf(quote.id, requestOptions);
      triggerBlobDownload(blob, filename);
      setShowPdfModal(false);
    } catch (downloadError) {
      setError(getApiErrorMessage(downloadError, {
        forbiddenMessage: 'Non hai permessi',
        notFoundMessage: 'Preventivo non trovato',
        fallbackMessage: 'Esportazione PDF non riuscita',
      }));
    } finally {
      setPdfExporting(false);
    }
  };

  const pendingActionConfig = pendingAction ? ACTION_CONFIG[pendingAction] : null;

  return (
    <QuotesModuleGate requiredPermission={QUOTES_PERMISSIONS.view}>
      {({ access }) => {
        const canEdit = hasPermission(access, QUOTES_PERMISSIONS.edit) || hasPermission(access, QUOTES_PERMISSIONS.create);
        const canDelete = hasPermission(access, QUOTES_PERMISSIONS.delete);
        const canSend = hasPermission(access, QUOTES_PERMISSIONS.send);
        const canAccept = hasPermission(access, QUOTES_PERMISSIONS.accept);
        const isDraft = quote?.status === 'DRAFT';
        const isSent = quote?.status === 'SENT';
        const permissionHints = [];

        if (quote && isDraft && !canEdit) {
          permissionHints.push('Non hai i permessi per modificare questa bozza.');
        }
        if (quote && isDraft && !canSend) {
          permissionHints.push('Non hai i permessi per inviare questa bozza.');
        }
        if (quote && isDraft && !canDelete) {
          permissionHints.push('Non hai i permessi per eliminare questa bozza.');
        }
        if (quote && isSent && !canEdit) {
          permissionHints.push('Non hai i permessi per modificare un preventivo inviato.');
        }
        if (quote && isSent && !canAccept) {
          permissionHints.push('Non hai i permessi per accettare o rifiutare il preventivo.');
        }
        if (quote && isSent && !canSend) {
          permissionHints.push('Non hai i permessi per annullare o reinviare il preventivo.');
        }

        return (
          <>
            <div className="container-fluid quotes-page-container">
              <div className="quotes-page-shell pt-3">
                <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap mb-3">
                  <div>
                    <h3 className="mb-1">Preventivo #{shortQuoteId(id)}</h3>
                    <p className="text-muted mb-0">Dettaglio completo e gestione stato.</p>
                  </div>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    {quote && (
                      <Button
                        type="button"
                        variant="outline-secondary"
                        onClick={() => setShowPdfModal(true)}
                        className="d-inline-flex align-items-center gap-1"
                      >
                        <Download size={14} />
                        Esporta PDF
                      </Button>
                    )}

                    {quote && (isDraft || isSent) && canEdit && (
                      <Button
                        as={Link}
                        to={`/apps/quotes/${quote.id}/edit`}
                        className="d-inline-flex align-items-center gap-1"
                      >
                        <Pencil size={14} />
                        Modifica
                      </Button>
                    )}

                    {quote && isDraft && canSend && (
                      <Button
                        type="button"
                        variant="info"
                        onClick={() => setPendingAction('send')}
                        className="d-inline-flex align-items-center gap-1"
                      >
                        <Mail size={14} />
                        Invia
                      </Button>
                    )}

                    {quote && isSent && canAccept && (
                      <>
                        <Button
                          type="button"
                          variant="success"
                          onClick={() => setPendingAction('accept')}
                          className="d-inline-flex align-items-center gap-1"
                        >
                          <CheckCircle2 size={14} />
                          Accetta
                        </Button>
                        <Button
                          type="button"
                          variant="outline-danger"
                          onClick={() => setPendingAction('reject')}
                          className="d-inline-flex align-items-center gap-1"
                        >
                          <ThumbsDown size={14} />
                          Rifiuta
                        </Button>
                      </>
                    )}

                    {quote && isSent && canSend && (
                      <>
                        <Button
                          type="button"
                          variant="outline-secondary"
                          onClick={() => setPendingAction('cancelSend')}
                          className="d-inline-flex align-items-center gap-1"
                        >
                          Annulla invio
                        </Button>
                        <Button
                          type="button"
                          variant="outline-primary"
                          onClick={() => setPendingAction('resend')}
                          className="d-inline-flex align-items-center gap-1"
                        >
                          <Mail size={14} />
                          Reinvia
                        </Button>
                      </>
                    )}

                    {quote && isDraft && canDelete && (
                      <Button
                        type="button"
                        variant="outline-danger"
                        onClick={() => setPendingAction('delete')}
                        className="d-inline-flex align-items-center gap-1"
                      >
                        <Trash2 size={14} />
                        Elimina
                      </Button>
                    )}
                  </div>
                </div>

                {flash && (
                  <Alert variant="success" dismissible onClose={() => setFlash('')}>
                    {flash}
                  </Alert>
                )}

                {permissionHints.length > 0 && (
                  <Alert variant="warning">
                    <div className="fw-semibold mb-1">Azioni limitate dai permessi utente</div>
                    <ul className="mb-0 ps-3">
                      {permissionHints.map((hint) => (
                        <li key={hint}>{hint}</li>
                      ))}
                    </ul>
                  </Alert>
                )}

                {error && (
                  <Alert variant="danger" className="d-flex align-items-center gap-2">
                    <TriangleAlert size={16} />
                    <span>{error}</span>
                  </Alert>
                )}

                {loading && (
                  <Card className="card-border mb-3">
                    <Card.Body>
                      <Placeholder as="div" animation="glow">
                        <Placeholder xs={12} className="mb-2" />
                        <Placeholder xs={10} className="mb-2" />
                        <Placeholder xs={8} />
                      </Placeholder>
                    </Card.Body>
                  </Card>
                )}

                {!loading && quote && (
                  <>
                    <Card className="card-border mb-3">
                      <Card.Body>
                        <Row className="g-2 align-items-center">
                          <Col md={4}>
                            <div className="text-muted small">Cliente</div>
                            <div className="fw-semibold">{quote?.client?.name || '-'}</div>
                          </Col>
                          <Col md={3}>
                            <div className="text-muted small">Stato</div>
                            <QuoteStatusBadge status={quote.status} />
                          </Col>
                          <Col md={3}>
                            <div className="text-muted small">Totale</div>
                            <div className="fw-semibold">{formatCurrency(quote.total, quote.currency)}</div>
                          </Col>
                          <Col md={2}>
                            <div className="text-muted small">Validita</div>
                            <div>{formatDateOnly(quote.validUntil)}</div>
                          </Col>
                        </Row>
                      </Card.Body>
                    </Card>

                    <Row className="g-3 mb-3">
                      <Col lg={8}>
                        <Card className="card-border mb-3">
                          <Card.Body>
                            <h6 className="mb-2">Dati preventivo</h6>
                            <Row className="g-2 small">
                              <Col md={6}><span className="text-muted">Emissione:</span> {formatDateOnly(quote.issueDate)}</Col>
                              <Col md={6}><span className="text-muted">Aggiornato:</span> {formatDateTime(quote.updatedAt)}</Col>
                            </Row>

                            <div className="mt-3">
                              <div className="text-muted small mb-1">Note</div>
                              <div>{quote.notes || <span className="text-muted">Nessuna nota</span>}</div>
                            </div>

                            <div className="mt-3">
                              <div className="text-muted small mb-1">Note interne</div>
                              <div>{quote.internalNotes || <span className="text-muted">Nessuna nota interna</span>}</div>
                            </div>
                          </Card.Body>
                        </Card>

                        <Card className="card-border">
                          <Card.Body>
                            <h6 className="mb-2">Voci</h6>
                            <div className="table-responsive">
                              <Table bordered hover className="mb-0 align-middle quote-items-table" size="sm">
                                <thead>
                                  <tr>
                                    <th>Descrizione</th>
                                    <th className="text-end">Qta</th>
                                    <th className="text-end quote-money-cell">Prezzo</th>
                                    <th className="text-end">Sconto</th>
                                    <th className="text-end quote-money-cell">Totale riga</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Array.isArray(quote.items) && quote.items.length > 0 ? (
                                    quote.items.map((item) => (
                                      <tr key={item.id}>
                                        <td>
                                          <div>{item.title}</div>
                                          {item.description && <div className="small text-muted">{item.description}</div>}
                                        </td>
                                        <td className="text-end">{item.quantity}</td>
                                        <td className="text-end quote-money-cell">{formatCurrency(item.unitPrice, quote.currency)}</td>
                                        <td className="text-end">
                                          {item.discountType
                                            ? `${item.discountType === 'PERCENT' ? `${item.discountValue}%` : formatCurrency(item.discountValue, quote.currency)}`
                                            : '-'}
                                        </td>
                                        <td className="text-end fw-semibold quote-money-cell">{formatCurrency(item.lineTotal, quote.currency)}</td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan={5} className="text-center text-muted py-3">Nessuna riga presente</td>
                                    </tr>
                                  )}
                                </tbody>
                              </Table>
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>

                      <Col lg={4}>
                        <QuoteTotalsSummary
                          subtotal={quote.subtotal}
                          taxTotal={quote.taxTotal}
                          total={quote.total}
                          taxRate={quote.taxRate}
                          currency={quote.currency}
                        />
                      </Col>
                    </Row>
                  </>
                )}
              </div>
            </div>

            <Modal className="quotes-modal" show={Boolean(pendingAction)} onHide={() => setPendingAction(null)} centered>
              <Modal.Header closeButton={!runningAction}>
                <Modal.Title>{pendingActionConfig?.label || 'Conferma azione'}</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                {pendingActionConfig?.body || 'Confermi questa azione?'}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="outline-secondary" onClick={() => setPendingAction(null)} disabled={runningAction}>
                  Annulla
                </Button>
                <Button variant="primary" onClick={() => void performStateAction()} disabled={runningAction}>
                  {runningAction ? 'Esecuzione...' : 'Conferma'}
                </Button>
              </Modal.Footer>
            </Modal>

            <Modal className="quotes-modal" show={showPdfModal} onHide={() => setShowPdfModal(false)} centered>
              <Modal.Header closeButton={!pdfExporting}>
                <Modal.Title>Opzioni esportazione PDF</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <Form.Check
                  id="pdf-include-items"
                  className="mb-2"
                  label="Includi lista voci"
                  checked={pdfOptions.includeItems}
                  onChange={(event) =>
                    setPdfOptions((current) => ({
                      ...current,
                      includeItems: event.target.checked,
                    }))
                  }
                />
                <Form.Check
                  id="pdf-include-company-footer"
                  className="mb-3"
                  label="Includi footer aziendale"
                  checked={pdfOptions.includeCompanyFooter}
                  onChange={(event) =>
                    setPdfOptions((current) => ({
                      ...current,
                      includeCompanyFooter: event.target.checked,
                    }))
                  }
                />

                <Form.Group className="mb-2">
                  <Form.Label>Intestazione personalizzata</Form.Label>
                  <Form.Control
                    value={pdfOptions.headerTitle}
                    maxLength={120}
                    onChange={(event) =>
                      setPdfOptions((current) => ({
                        ...current,
                        headerTitle: event.target.value,
                      }))
                    }
                    placeholder="Es. Offerta commerciale"
                  />
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>Nota footer</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={pdfOptions.footerNote}
                    maxLength={400}
                    onChange={(event) =>
                      setPdfOptions((current) => ({
                        ...current,
                        footerNote: event.target.value,
                      }))
                    }
                    placeholder="Nota opzionale nel footer"
                  />
                </Form.Group>

                <Form.Group>
                  <Form.Label>Firma (URL immagine, opzionale)</Form.Label>
                  <Form.Control
                    value={pdfOptions.signatureUrl}
                    onChange={(event) =>
                      setPdfOptions((current) => ({
                        ...current,
                        signatureUrl: event.target.value,
                      }))
                    }
                    placeholder="https://.../firma.png"
                  />
                </Form.Group>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="outline-secondary" onClick={() => setShowPdfModal(false)} disabled={pdfExporting}>
                  Annulla
                </Button>
                <Button variant="primary" onClick={() => void exportPdf()} disabled={pdfExporting}>
                  {pdfExporting ? (
                    <><Spinner animation="border" size="sm" className="me-1" /> Esportazione...</>
                  ) : (
                    'Scarica PDF'
                  )}
                </Button>
              </Modal.Footer>
            </Modal>
          </>
        );
      }}
    </QuotesModuleGate>
  );
};

export default QuoteDetail;
