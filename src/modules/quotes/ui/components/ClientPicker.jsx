import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Modal, Spinner, Table } from 'react-bootstrap';
import { lookupQuoteClients } from '../../api/quotesApi';
import { formatDateOnly } from '../helpers';

const mergeUniqueClients = (first, second) => {
  const map = new Map();
  [...(Array.isArray(first) ? first : []), ...(Array.isArray(second) ? second : [])].forEach((item) => {
    if (!item?.id) {
      return;
    }

    map.set(item.id, item);
  });

  return Array.from(map.values());
};

const ClientPicker = ({
  selectedClientId,
  selectedClientName,
  onSelectClient,
  disabled = false,
  label = 'Cliente',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      setError('');

      try {
        const response = await lookupQuoteClients({
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

        setError(loadError?.message || 'Errore caricamento clienti');
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
  }, [createdFrom, createdTo, open, query]);

  const selectedFallback = useMemo(() => {
    if (!selectedClientId) {
      return [];
    }

    if (items.some((item) => item.id === selectedClientId)) {
      return [];
    }

    return [{ id: selectedClientId, name: selectedClientName || `Cliente ${selectedClientId.slice(0, 8)}` }];
  }, [items, selectedClientId, selectedClientName]);

  const options = useMemo(() => mergeUniqueClients(selectedFallback, items), [items, selectedFallback]);
  const selectedLabel = useMemo(() => {
    const selected = options.find((item) => item.id === selectedClientId);
    return selected?.name || selectedClientName || 'Nessun cliente selezionato';
  }, [options, selectedClientId, selectedClientName]);

  return (
    <div>
      <Form.Label>{label}</Form.Label>
      <div className="d-flex gap-2">
        <Form.Control value={selectedLabel} readOnly />
        <Button type="button" variant="outline-secondary" onClick={() => setOpen(true)} disabled={disabled}>
          Seleziona
        </Button>
      </div>
      {selectedClientId && (
        <Button
          type="button"
          variant="link"
          className="px-0 mt-1"
          onClick={() => onSelectClient(null, null)}
          disabled={disabled}
        >
          Rimuovi cliente
        </Button>
      )}

      <Modal show={open} onHide={() => setOpen(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Seleziona cliente</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="row g-2 mb-2">
            <div className="col-md-6">
              <Form.Control
                placeholder="Cerca per nome, email o ID"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="col-md-3">
              <Form.Control
                type="date"
                value={createdFrom}
                onChange={(event) => setCreatedFrom(event.target.value)}
              />
            </div>
            <div className="col-md-3">
              <Form.Control
                type="date"
                value={createdTo}
                onChange={(event) => setCreatedTo(event.target.value)}
              />
            </div>
          </div>

          {loading && (
            <div className="small text-muted mb-2 d-inline-flex align-items-center gap-1">
              <Spinner size="sm" animation="border" /> Ricerca clienti...
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
                  <th>Cliente</th>
                  <th>Email</th>
                  <th>ID</th>
                  <th>Creato</th>
                </tr>
              </thead>
              <tbody>
                {options.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-3">
                      Nessun cliente trovato.
                    </td>
                  </tr>
                )}

                {options.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Form.Check
                        type="radio"
                        checked={selectedClientId === item.id}
                        onChange={() => onSelectClient(item.id, item)}
                      />
                    </td>
                    <td>{item.name}</td>
                    <td>{item.email || '-'}</td>
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

export default ClientPicker;
