import React, { useEffect, useState } from 'react';
import { Alert, Button, Form, Modal, Spinner, Table } from 'react-bootstrap';
import { lookupQuoteProjects } from '../../api/quotesApi';
import { formatDateOnly } from '../helpers';

const ProjectPicker = ({
  clientId,
  selectedProjectId,
  selectedProjectName,
  onSelectProject,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!open || !clientId) {
      return undefined;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      setError('');

      try {
        const response = await lookupQuoteProjects({
          clientId,
          q: query || undefined,
          createdFrom: createdFrom || undefined,
          createdTo: createdTo || undefined,
          limit: 50,
        });

        if (cancelled) {
          return;
        }

        setItems(Array.isArray(response?.items) ? response.items : []);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(loadError?.message || 'Errore caricamento progetti');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [clientId, createdFrom, createdTo, open, query]);

  const selectedLabel = selectedProjectName || (selectedProjectId ? `Progetto ${selectedProjectId.slice(0, 8)}` : 'Nessun progetto');

  return (
    <div>
      <Form.Label>Progetto (opzionale)</Form.Label>
      <div className="d-flex gap-2">
        <Form.Control value={selectedLabel} readOnly />
        <Button
          type="button"
          variant="outline-secondary"
          onClick={() => setOpen(true)}
          disabled={disabled || !clientId}
        >
          Seleziona
        </Button>
      </div>
      {selectedProjectId && (
        <Button
          type="button"
          variant="link"
          className="px-0 mt-1"
          onClick={() => onSelectProject(null, null)}
          disabled={disabled}
        >
          Rimuovi progetto
        </Button>
      )}

      <Modal show={open} onHide={() => setOpen(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Seleziona progetto</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!clientId && (
            <Alert variant="warning" className="py-2 px-3">
              Seleziona prima un cliente.
            </Alert>
          )}

          <div className="row g-2 mb-2">
            <div className="col-md-6">
              <Form.Control
                placeholder="Cerca per nome o ID"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                disabled={!clientId}
              />
            </div>
            <div className="col-md-3">
              <Form.Control
                type="date"
                value={createdFrom}
                onChange={(event) => setCreatedFrom(event.target.value)}
                disabled={!clientId}
              />
            </div>
            <div className="col-md-3">
              <Form.Control
                type="date"
                value={createdTo}
                onChange={(event) => setCreatedTo(event.target.value)}
                disabled={!clientId}
              />
            </div>
          </div>

          {loading && (
            <div className="small text-muted mb-2 d-inline-flex align-items-center gap-1">
              <Spinner size="sm" animation="border" /> Ricerca progetti...
            </div>
          )}

          {error && (
            <Alert variant="danger" className="py-2 px-3">
              {error}
            </Alert>
          )}

          <div className="table-responsive">
            <Table size="sm" hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th style={{ width: 42 }} />
                  <th>Progetto</th>
                  <th>ID</th>
                  <th>Creato</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="text-center text-muted py-3">
                      Nessun progetto trovato.
                    </td>
                  </tr>
                )}
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Form.Check
                        type="radio"
                        checked={selectedProjectId === item.id}
                        onChange={() => onSelectProject(item.id, item)}
                      />
                    </td>
                    <td>{item.name}</td>
                    <td className="small text-muted">{item.id.slice(0, 8)}</td>
                    <td>{formatDateOnly(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setOpen(false)}>Chiudi</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ProjectPicker;
