import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Modal,
  Placeholder,
  Table,
} from 'react-bootstrap';
import { Link, useHistory } from 'react-router-dom';
import { Bell, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react';
import {
  deleteQuoteTemplate,
  listQuoteTemplates,
} from '../../modules/quotes/api/quotesApi';
import QuotesModuleGate from '../../modules/quotes/ui/QuotesModuleGate';
import { QUOTES_PERMISSIONS } from '../../modules/quotes/ui/constants';
import { formatDateTime, getApiErrorMessage } from '../../modules/quotes/ui/helpers';
import '../../modules/quotes/ui/quotes-ui.css';

const QuoteTemplatesList = () => {
  const history = useHistory();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [deletingTemplate, setDeletingTemplate] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await listQuoteTemplates();
      setItems(Array.isArray(response?.items) ? response.items : []);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, {
        forbiddenMessage: 'Non hai permessi',
        fallbackMessage: 'Errore caricamento template',
      }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const onDeleteTemplate = async () => {
    if (!deletingTemplate || deleting) {
      return;
    }

    setDeleting(true);
    setError('');

    try {
      await deleteQuoteTemplate(deletingTemplate.id);
      setDeletingTemplate(null);
      await loadTemplates();
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError, {
        forbiddenMessage: 'Non hai permessi',
        notFoundMessage: 'Template non trovato',
        fallbackMessage: 'Eliminazione template non riuscita',
      }));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <QuotesModuleGate requiredPermission={QUOTES_PERMISSIONS.manageTemplates}>
      <div className="container-fluid quotes-page-container">
        <div className="quotes-page-shell pt-3">
          <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap mb-3">
            <div>
              <h3 className="mb-1">Template Preventivi</h3>
              <p className="text-muted mb-0">Gestisci righe e note precompilate per creazione rapida.</p>
            </div>
            <div className="d-flex align-items-center gap-2">
              <Button
                as={Link}
                to="/apps/quotes/notifications"
                variant="outline-secondary"
                className="d-inline-flex align-items-center gap-1"
              >
                <Bell size={15} />
                Notifiche
              </Button>
              <Button as={Link} to="/apps/quotes/templates/new" className="d-inline-flex align-items-center gap-1">
                <Plus size={15} />
                Nuovo template
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="danger" className="d-flex align-items-center gap-2">
              <TriangleAlert size={16} />
              <span>{error}</span>
            </Alert>
          )}

          <Card className="card-border mb-3">
            <Card.Body className="py-2">
              <div className="table-responsive">
                <Table hover className="mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Descrizione</th>
                      <th className="text-center">Righe</th>
                      <th>Aggiornato</th>
                      <th className="text-end">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && [1, 2, 3].map((row) => (
                      <tr key={row}>
                        <td colSpan={5}>
                          <Placeholder as="div" animation="glow">
                            <Placeholder xs={12} />
                          </Placeholder>
                        </td>
                      </tr>
                    ))}

                    {!loading && items.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center text-muted py-4">
                          Nessun template disponibile.
                        </td>
                      </tr>
                    )}

                    {!loading && items.map((template) => (
                      <tr key={template.id}>
                        <td className="fw-semibold">{template.name}</td>
                        <td>{template.description || <span className="text-muted">-</span>}</td>
                        <td className="text-center">{template.itemsCount || 0}</td>
                        <td>{formatDateTime(template.updatedAt)}</td>
                        <td className="text-end">
                          <div className="d-inline-flex gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline-secondary"
                              onClick={() => history.push(`/apps/quotes/templates/${template.id}/edit`)}
                            >
                              <Pencil size={14} />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline-danger"
                              onClick={() => setDeletingTemplate(template)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>

      <Modal show={Boolean(deletingTemplate)} onHide={() => setDeletingTemplate(null)} centered>
        <Modal.Header closeButton={!deleting}>
          <Modal.Title>Elimina template</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Confermi l'eliminazione del template <strong>{deletingTemplate?.name}</strong>?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDeletingTemplate(null)} disabled={deleting}>
            Annulla
          </Button>
          <Button variant="danger" onClick={() => void onDeleteTemplate()} disabled={deleting}>
            {deleting ? 'Eliminazione...' : 'Elimina'}
          </Button>
        </Modal.Footer>
      </Modal>
    </QuotesModuleGate>
  );
};

export default QuoteTemplatesList;
