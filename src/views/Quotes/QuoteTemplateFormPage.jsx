import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Placeholder,
  Row,
  Spinner,
} from 'react-bootstrap';
import { Link, useHistory, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, TriangleAlert } from 'lucide-react';
import {
  createQuoteTemplate,
  getQuoteTemplate,
  updateQuoteTemplate,
} from '../../modules/quotes/api/quotesApi';
import QuoteItemsEditor from '../../modules/quotes/ui/components/QuoteItemsEditor';
import QuotesModuleGate from '../../modules/quotes/ui/QuotesModuleGate';
import { QUOTES_PERMISSIONS } from '../../modules/quotes/ui/constants';
import {
  createEmptyQuoteItem,
  getApiErrorMessage,
  normalizeItemsForPayload,
  normalizeQuoteItemForForm,
} from '../../modules/quotes/ui/helpers';
import '../../modules/quotes/ui/quotes-ui.css';

const TemplateInitialState = {
  name: '',
  description: '',
  defaultNotes: '',
  items: [createEmptyQuoteItem(1)],
};

const QuoteTemplateFormPage = ({ mode = 'create' }) => {
  const history = useHistory();
  const { id } = useParams();
  const location = useLocation();

  const isEditMode = mode === 'edit' || location.pathname.endsWith('/edit');

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formState, setFormState] = useState(TemplateInitialState);

  const loadTemplate = useCallback(async () => {
    if (!isEditMode || !id) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await getQuoteTemplate(id);
      const template = response?.template || response;

      setFormState({
        name: template?.name || '',
        description: template?.description || '',
        defaultNotes: template?.defaultNotes || '',
        items: Array.isArray(template?.items) && template.items.length > 0
          ? template.items.map((item, index) => normalizeQuoteItemForForm(item, index))
          : [createEmptyQuoteItem(1)],
      });
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, {
        forbiddenMessage: 'Non hai permessi',
        notFoundMessage: 'Template non trovato',
        fallbackMessage: 'Errore caricamento template',
      }));
    } finally {
      setLoading(false);
    }
  }, [id, isEditMode]);

  useEffect(() => {
    void loadTemplate();
  }, [loadTemplate]);

  const onSubmit = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError('');

    try {
      const payload = {
        name: formState.name.trim(),
        description: formState.description.trim() || null,
        defaultNotes: formState.defaultNotes.trim() || null,
        items: normalizeItemsForPayload(formState.items),
      };

      if (!payload.name) {
        throw new Error('Il nome template e obbligatorio.');
      }

      if (isEditMode && id) {
        await updateQuoteTemplate(id, payload);
      } else {
        await createQuoteTemplate(payload);
      }

      history.push('/apps/quotes/templates');
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, {
        forbiddenMessage: 'Non hai permessi',
        notFoundMessage: 'Template non trovato',
        fallbackMessage: 'Salvataggio template non riuscito',
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
              <h3 className="mb-1">{isEditMode ? 'Modifica template' : 'Nuovo template'}</h3>
              <p className="text-muted mb-0">Configura righe e note predefinite per i preventivi.</p>
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

          {loading ? (
            <Card className="card-border">
              <Card.Body>
                <Placeholder as="div" animation="glow">
                  <Placeholder xs={12} className="mb-2" />
                  <Placeholder xs={10} className="mb-2" />
                  <Placeholder xs={8} />
                </Placeholder>
              </Card.Body>
            </Card>
          ) : (
            <Card className="card-border mb-4">
              <Card.Body>
                <Form onSubmit={onSubmit}>
                  <Row className="g-3 mb-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Nome template</Form.Label>
                        <Form.Control
                          type="text"
                          value={formState.name}
                          onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Descrizione</Form.Label>
                        <Form.Control
                          type="text"
                          value={formState.description}
                          onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={12}>
                      <Form.Group>
                        <Form.Label>Note default</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={3}
                          value={formState.defaultNotes}
                          onChange={(event) => setFormState((current) => ({ ...current, defaultNotes: event.target.value }))}
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <QuoteItemsEditor
                    items={formState.items}
                    onChange={(items) => setFormState((current) => ({ ...current, items }))}
                    currency="EUR"
                  />

                  <div className="d-flex justify-content-end mt-3">
                    <Button type="submit" disabled={saving}>
                      {saving ? (
                        <><Spinner animation="border" size="sm" className="me-1" /> Salvataggio...</>
                      ) : (
                        <><CheckCircle2 size={14} className="me-1" /> Salva template</>
                      )}
                    </Button>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          )}
        </div>
      </div>
    </QuotesModuleGate>
  );
};

export default QuoteTemplateFormPage;
