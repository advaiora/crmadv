import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Placeholder,
  Row,
  Spinner,
  Table,
} from 'react-bootstrap';
import { Link, useHistory } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Download } from 'lucide-react';
import {
  createQuote,
  downloadQuotePdf,
  getQuote,
  getQuoteTemplate,
  listQuoteTemplates,
  updateQuote,
} from '../api/quotesApi';
import {
  DEFAULT_CURRENCY,
  DEFAULT_TAX_RATE,
  MAX_QUOTE_ITEMS,
} from './constants';
import {
  computeLineTotal,
  computeQuoteTotals,
  createEmptyQuoteItem,
  formatCurrency,
  formatDateOnly,
  getApiErrorMessage,
  normalizeItemsForPayload,
  normalizeQuoteItemForForm,
  shortQuoteId,
  toInputDateValue,
  triggerBlobDownload,
} from './helpers';
import ClientPicker from './components/ClientPicker';
import ProjectPicker from './components/ProjectPicker';
import QuoteItemsEditor from './components/QuoteItemsEditor';
import QuoteTotalsSummary from './components/QuoteTotalsSummary';
import TemplatePicker from './components/TemplatePicker';

const WIZARD_STEPS = [
  { id: 1, label: 'Cliente' },
  { id: 2, label: 'Template' },
  { id: 3, label: 'Voci e dati' },
  { id: 4, label: 'Review' },
];

const initialFormState = {
  clientId: '',
  clientName: '',
  projectId: '',
  projectName: '',
  templateId: '',
  currency: DEFAULT_CURRENCY,
  taxRate: String(DEFAULT_TAX_RATE),
  issueDate: '',
  validUntil: '',
  notes: '',
  internalNotes: '',
  items: [createEmptyQuoteItem(1)],
};

const toIsoDate = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
};

const QuoteWizardForm = ({ mode = 'create', quoteId }) => {
  const history = useHistory();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errorList, setErrorList] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');

  const [quoteStatus, setQuoteStatus] = useState('DRAFT');
  const [formState, setFormState] = useState(initialFormState);

  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState('');
  const [templateSummaries, setTemplateSummaries] = useState([]);
  const [templateDetailsById, setTemplateDetailsById] = useState({});
  const [selectedTemplateLoading, setSelectedTemplateLoading] = useState(false);

  const isEditMode = mode === 'edit';
  const isEditableStatus = quoteStatus === 'DRAFT' || quoteStatus === 'SENT';
  const isReadOnly = isEditMode && !isEditableStatus;

  const totals = useMemo(
    () => computeQuoteTotals(formState.items, formState.taxRate),
    [formState.items, formState.taxRate],
  );

  const selectedTemplate = useMemo(() => {
    if (!formState.templateId) {
      return null;
    }

    return templateDetailsById[formState.templateId] || null;
  }, [formState.templateId, templateDetailsById]);

  const templatesForPicker = useMemo(() => {
    return templateSummaries.map((summary) => {
      const detail = templateDetailsById[summary.id];
      if (!detail) {
        return summary;
      }

      return {
        ...summary,
        ...detail,
      };
    });
  }, [templateDetailsById, templateSummaries]);

  const setFormPatch = (patch) => {
    setFormState((current) => ({
      ...current,
      ...patch,
    }));
  };

  const loadTemplateDetail = useCallback(async (templateId) => {
    if (!templateId || templateDetailsById[templateId]) {
      return templateDetailsById[templateId] || null;
    }

    setSelectedTemplateLoading(true);
    setTemplatesError('');

    try {
      const response = await getQuoteTemplate(templateId);
      const detail = response?.template || response;
      if (detail?.id) {
        setTemplateDetailsById((current) => ({
          ...current,
          [detail.id]: detail,
        }));
      }

      return detail || null;
    } catch (loadError) {
      setTemplatesError(loadError?.message || 'Errore caricamento template');
      return null;
    } finally {
      setSelectedTemplateLoading(false);
    }
  }, [templateDetailsById]);

  useEffect(() => {
    let cancelled = false;

    const loadTemplates = async () => {
      setTemplatesLoading(true);
      setTemplatesError('');

      try {
        const response = await listQuoteTemplates();
        if (cancelled) {
          return;
        }

        setTemplateSummaries(Array.isArray(response?.items) ? response.items : []);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setTemplatesError(loadError?.message || 'Errore caricamento templates');
      } finally {
        if (!cancelled) {
          setTemplatesLoading(false);
        }
      }
    };

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isEditMode || !quoteId) {
      return undefined;
    }

    let cancelled = false;

    const loadQuote = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await getQuote(quoteId);
        const quote = response?.quote || response;

        if (cancelled || !quote) {
          return;
        }

        setQuoteStatus(quote.status || 'DRAFT');
        setFormState({
          clientId: quote.clientId || '',
          clientName: quote?.client?.name || '',
          projectId: quote.projectId || '',
          projectName: quote?.project?.name || '',
          templateId: quote.templateId || '',
          currency: quote.currency || DEFAULT_CURRENCY,
          taxRate:
            quote.taxRate === null || quote.taxRate === undefined
              ? ''
              : String(quote.taxRate),
          issueDate: toInputDateValue(quote.issueDate),
          validUntil: toInputDateValue(quote.validUntil),
          notes: quote.notes || '',
          internalNotes: quote.internalNotes || '',
          items: Array.isArray(quote.items) && quote.items.length > 0
            ? quote.items.map((item, index) => normalizeQuoteItemForForm(item, index))
            : [createEmptyQuoteItem(1)],
        });

        if (quote.templateId) {
          void loadTemplateDetail(quote.templateId);
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(getApiErrorMessage(loadError, {
          notFoundMessage: 'Preventivo non trovato',
          fallbackMessage: 'Errore caricamento preventivo',
        }));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadQuote();

    return () => {
      cancelled = true;
    };
  }, [isEditMode, loadTemplateDetail, quoteId]);

  useEffect(() => {
    if (!formState.templateId) {
      return;
    }

    void loadTemplateDetail(formState.templateId);
  }, [formState.templateId, loadTemplateDetail]);

  const applyTemplate = async (templateInput) => {
    if (isReadOnly) {
      return;
    }

    let template = templateInput;
    if (!template?.items) {
      template = await loadTemplateDetail(templateInput?.id);
      if (!template) {
        return;
      }
    }

    const hasCurrentRows = formState.items.some((item) => String(item.title || '').trim().length > 0);
    if (hasCurrentRows) {
      const shouldReplace = window.confirm('Applicare il template sovrascrivendo le righe attuali?');
      if (!shouldReplace) {
        return;
      }
    }

    const templateItems = Array.isArray(template.items)
      ? template.items.map((item, index) => normalizeQuoteItemForForm(item, index))
      : [];

    setFormState((current) => ({
      ...current,
      templateId: template.id || current.templateId,
      notes: current.notes || template.defaultNotes || '',
      items: templateItems.length > 0 ? templateItems : [createEmptyQuoteItem(1)],
    }));
  };

  const validateStep = () => {
    const issues = [];

    if (step === 1) {
      if (!formState.clientId) {
        issues.push('Seleziona un cliente prima di procedere.');
      }
    }

    if (step === 3) {
      if (formState.items.length > MAX_QUOTE_ITEMS) {
        issues.push(`Numero massimo righe superato (${MAX_QUOTE_ITEMS}).`);
      }

      try {
        normalizeItemsForPayload(formState.items);
      } catch (validationError) {
        issues.push(validationError?.message || 'Controlla le righe del preventivo.');
      }
    }

    if (issues.length > 0) {
      const first = issues[0];
      const error = new Error(first);
      error.issues = issues;
      throw error;
    }
  };

  const handleNextStep = () => {
    try {
      validateStep();
      setError('');
      setErrorList([]);
      setStep((current) => Math.min(current + 1, WIZARD_STEPS.length));
    } catch (validationError) {
      setError(validationError?.message || 'Controlla i dati inseriti');
      setErrorList(Array.isArray(validationError?.issues) ? validationError.issues : [validationError?.message || 'Controlla i dati inseriti']);
    }
  };

  const handlePrevStep = () => {
    setError('');
    setErrorList([]);
    setStep((current) => Math.max(current - 1, 1));
  };

  const handleSubmit = async ({ downloadAfterSave = false } = {}) => {
    if (isReadOnly) {
      return;
    }

    setSaving(true);
    setError('');
    setErrorList([]);
    setSuccessMessage('');

    try {
      const payload = {
        clientId: formState.clientId,
        projectId: formState.projectId || null,
        templateId: formState.templateId || null,
        currency: formState.currency || DEFAULT_CURRENCY,
        taxRate: formState.taxRate === '' ? null : Number(formState.taxRate),
        issueDate: toIsoDate(formState.issueDate),
        validUntil: toIsoDate(formState.validUntil),
        notes: formState.notes?.trim() || null,
        internalNotes: formState.internalNotes?.trim() || null,
        items: normalizeItemsForPayload(formState.items),
      };

      const response = isEditMode
        ? await updateQuote(quoteId, payload)
        : await createQuote(payload);

      const quote = response?.quote || response;
      const nextQuoteId = quote?.id;

      if (!nextQuoteId) {
        throw new Error('Risposta API non valida: id preventivo mancante');
      }

      if (downloadAfterSave) {
        const { blob, filename } = await downloadQuotePdf(nextQuoteId);
        triggerBlobDownload(blob, filename);
      }

      history.push(`/apps/quotes/${nextQuoteId}`, {
        flash: isEditMode ? 'Preventivo aggiornato.' : 'Preventivo creato.',
      });
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, {
        forbiddenMessage: 'Non hai permessi',
        notFoundMessage: 'Preventivo non trovato',
        conflictMessage: 'Operazione non valida per lo stato attuale',
        fallbackMessage: 'Salvataggio preventivo non riuscito',
      }));
      setErrorList([submitError?.message || 'Salvataggio preventivo non riuscito']);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="card-border">
        <Card.Body>
          <Placeholder as="div" animation="glow">
            <Placeholder xs={12} className="mb-2" />
            <Placeholder xs={10} className="mb-2" />
            <Placeholder xs={8} />
          </Placeholder>
        </Card.Body>
      </Card>
    );
  }

  return (
    <div className="quotes-page-shell pt-3">
      <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap mb-3">
        <div>
          <h3 className="mb-1">
            {isEditMode ? 'Modifica preventivo' : 'Nuovo preventivo'}
            {quoteId && (
              <Badge bg="light" text="dark" className="ms-2">#{shortQuoteId(quoteId)}</Badge>
            )}
          </h3>
          <p className="text-muted mb-0">
            Wizard rapido in 4 step con calcolo totali realtime.
          </p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <Button as={Link} to={isEditMode && quoteId ? `/apps/quotes/${quoteId}` : '/apps/quotes'} variant="outline-secondary">
            <ArrowLeft size={14} className="me-1" />
            {isEditMode ? 'Torna al dettaglio' : 'Torna alla lista'}
          </Button>
        </div>
      </div>

      {isReadOnly && (
        <Alert variant="warning">
          Questo preventivo e in stato <strong>{quoteStatus}</strong> e non puo essere modificato.
        </Alert>
      )}

      {error && <Alert variant="danger">{error}</Alert>}
      {errorList.length > 1 && (
        <Alert variant="danger">
          <div className="fw-semibold mb-1">Correggi i seguenti errori:</div>
          <ul className="mb-0 ps-3">
            {errorList.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </Alert>
      )}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      <Card className="card-border mb-3">
        <Card.Body className="py-2">
          <div className="d-flex flex-wrap gap-2">
            {WIZARD_STEPS.map((wizardStep) => (
              <button
                key={wizardStep.id}
                type="button"
                className={`quote-step-chip ${step === wizardStep.id ? 'is-active' : ''}`}
                onClick={() => setStep(wizardStep.id)}
              >
                <span className="quote-step-index">{wizardStep.id}</span>
                <span>{wizardStep.label}</span>
              </button>
            ))}
          </div>
        </Card.Body>
      </Card>

      <Card className="card-border mb-3">
        <Card.Body>
          {step === 1 && (
            <Row className="g-3">
              <Col md={7}>
                <ClientPicker
                  selectedClientId={formState.clientId}
                  selectedClientName={formState.clientName}
                  onSelectClient={(clientId, selectedClient) => {
                    setFormState((current) => ({
                      ...current,
                      clientId: clientId || '',
                      clientName: selectedClient?.name || '',
                      projectId: '',
                      projectName: '',
                    }));
                  }}
                  disabled={isReadOnly}
                />
              </Col>
              <Col md={5}>
                <ProjectPicker
                  clientId={formState.clientId}
                  selectedProjectId={formState.projectId}
                  selectedProjectName={formState.projectName}
                  onSelectProject={(projectId, selectedProject) => {
                    setFormPatch({
                      projectId: projectId || '',
                      projectName: selectedProject?.name || '',
                    });
                  }}
                  disabled={isReadOnly}
                />
              </Col>
            </Row>
          )}

          {step === 2 && (
            <TemplatePicker
              templates={templatesForPicker}
              selectedTemplateId={formState.templateId || null}
              onSelectTemplate={(templateId) => setFormPatch({ templateId: templateId || '' })}
              onApplyTemplate={(template) => void applyTemplate(template)}
              loading={templatesLoading || selectedTemplateLoading}
              error={templatesError}
              disabled={isReadOnly}
            />
          )}

          {step === 3 && (
            <Row className="g-3">
              <Col lg={8}>
                <Row className="g-2 mb-2">
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Valuta</Form.Label>
                      <Form.Control
                        type="text"
                        value={formState.currency}
                        maxLength={3}
                        onChange={(event) => setFormPatch({ currency: event.target.value.toUpperCase() })}
                        disabled={isReadOnly}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>IVA %</Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        step="0.01"
                        value={formState.taxRate}
                        onChange={(event) => setFormPatch({ taxRate: event.target.value })}
                        disabled={isReadOnly}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Data emissione</Form.Label>
                      <Form.Control
                        type="date"
                        value={formState.issueDate}
                        onChange={(event) => setFormPatch({ issueDate: event.target.value })}
                        disabled={isReadOnly}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Valido fino a</Form.Label>
                      <Form.Control
                        type="date"
                        value={formState.validUntil}
                        onChange={(event) => setFormPatch({ validUntil: event.target.value })}
                        disabled={isReadOnly}
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-2">
                  <Form.Label>Note per cliente</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={formState.notes}
                    onChange={(event) => setFormPatch({ notes: event.target.value })}
                    disabled={isReadOnly}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Note interne</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={formState.internalNotes}
                    onChange={(event) => setFormPatch({ internalNotes: event.target.value })}
                    disabled={isReadOnly}
                  />
                </Form.Group>

                <QuoteItemsEditor
                  items={formState.items}
                  onChange={(items) => setFormPatch({ items })}
                  currency={formState.currency}
                  disabled={isReadOnly}
                />
              </Col>
              <Col lg={4}>
                <QuoteTotalsSummary
                  subtotal={totals.subtotal}
                  taxTotal={totals.taxTotal}
                  total={totals.total}
                  currency={formState.currency}
                  taxRate={formState.taxRate}
                />
              </Col>
            </Row>
          )}

          {step === 4 && (
            <Row className="g-3">
              <Col lg={8}>
                <Card className="card-border mb-3">
                  <Card.Body>
                    <h6 className="mb-3">Dati preventivo</h6>
                    <Row className="g-2 small">
                      <Col md={6}><span className="text-muted">Cliente:</span> {formState.clientName || formState.clientId || '-'}</Col>
                      <Col md={6}><span className="text-muted">Progetto:</span> {formState.projectName || formState.projectId || '-'}</Col>
                      <Col md={6}><span className="text-muted">Template:</span> {selectedTemplate?.name || '-'}</Col>
                      <Col md={6}><span className="text-muted">Valuta:</span> {formState.currency}</Col>
                      <Col md={6}><span className="text-muted">Emissione:</span> {formatDateOnly(formState.issueDate)}</Col>
                      <Col md={6}><span className="text-muted">Validita:</span> {formatDateOnly(formState.validUntil)}</Col>
                    </Row>

                    {formState.notes && (
                      <div className="mt-3">
                        <div className="text-muted small mb-1">Note cliente</div>
                        <div>{formState.notes}</div>
                      </div>
                    )}
                  </Card.Body>
                </Card>

                <Card className="card-border">
                  <Card.Body>
                    <h6 className="mb-2">Voci</h6>
                    <div className="table-responsive">
                      <Table size="sm" bordered className="mb-0 align-middle quote-items-table">
                        <thead>
                          <tr>
                            <th>Descrizione</th>
                            <th className="text-end">Qta</th>
                            <th className="text-end quote-money-cell">Prezzo</th>
                            <th className="text-end quote-money-cell">Totale</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formState.items.map((item, index) => (
                            <tr key={`${item.id || 'review'}-${index}`}>
                              <td>
                                <div>{item.title || <span className="text-muted">-</span>}</div>
                                {item.description && (
                                  <div className="small text-muted">{item.description}</div>
                                )}
                              </td>
                              <td className="text-end">{item.quantity}</td>
                              <td className="text-end quote-money-cell">{formatCurrency(item.unitPrice, formState.currency)}</td>
                              <td className="text-end fw-semibold quote-money-cell">{formatCurrency(computeLineTotal(item), formState.currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  </Card.Body>
                </Card>
              </Col>

              <Col lg={4}>
                <QuoteTotalsSummary
                  subtotal={totals.subtotal}
                  taxTotal={totals.taxTotal}
                  total={totals.total}
                  currency={formState.currency}
                  taxRate={formState.taxRate}
                />
              </Col>
            </Row>
          )}
        </Card.Body>
      </Card>

      <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-4">
        <div>
          {step > 1 && (
            <Button variant="outline-secondary" onClick={handlePrevStep} disabled={saving}>
              <ArrowLeft size={14} className="me-1" />
              Indietro
            </Button>
          )}
        </div>

        <div className="d-flex align-items-center gap-2">
          {step < WIZARD_STEPS.length && (
            <Button onClick={handleNextStep} disabled={saving || isReadOnly}>
              Avanti
              <ArrowRight size={14} className="ms-1" />
            </Button>
          )}

          {step === WIZARD_STEPS.length && (
            <>
              <Button
                variant="outline-primary"
                onClick={() => void handleSubmit({ downloadAfterSave: true })}
                disabled={saving || isReadOnly}
              >
                {saving ? (
                  <><Spinner animation="border" size="sm" className="me-1" /> Salvataggio...</>
                ) : (
                  <><Download size={14} className="me-1" /> Salva e scarica PDF</>
                )}
              </Button>

              <Button
                onClick={() => void handleSubmit({ downloadAfterSave: false })}
                disabled={saving || isReadOnly}
              >
                {saving ? (
                  <><Spinner animation="border" size="sm" className="me-1" /> Salvataggio...</>
                ) : (
                  <><CheckCircle2 size={14} className="me-1" /> Salva bozza</>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuoteWizardForm;
