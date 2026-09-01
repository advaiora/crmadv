import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Modal, Spinner, Table } from 'react-bootstrap';
import { ArrowDown, ArrowUp, ListPlus, Pencil, Trash2 } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import {
  deleteCustomField,
  listCustomFields,
  reorderCustomFields,
} from '../api/customFieldsApi';
import CustomFieldDraftModal from './CustomFieldDraftModal';
import { FIELD_TYPE_LABELS } from './customFieldDraft';

const getErrorMessage = (error, fallback) => error?.message || fallback;

// Pagina di gestione dei campi personalizzati del cliente (Custom Fields, V3).
const CustomFieldsPage = () => {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reordering, setReordering] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingField, setEditingField] = useState(null); // null = creazione
  const [deleting, setDeleting] = useState(null); // definizione in eliminazione

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await listCustomFields('client');
      setFields(result?.definitions ?? []);
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Impossibile caricare i campi personalizzati.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingField(null);
    setModalOpen(true);
  };

  const openEdit = (field) => {
    setEditingField(field);
    setModalOpen(true);
  };

  const handleSaved = async (definition, { isEditing }) => {
    setModalOpen(false);
    toast.success(isEditing ? 'Campo aggiornato' : 'Campo creato');
    await load();
  };

  const handleDelete = async () => {
    if (!deleting) {
      return;
    }
    try {
      await deleteCustomField(deleting.id);
      toast.success('Campo eliminato');
      setDeleting(null);
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Errore eliminazione campo'));
    }
  };

  const move = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) {
      return;
    }
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    setFields(next);
    setReordering(true);
    try {
      await reorderCustomFields(next.map((field) => field.id), 'client');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Errore riordino'));
      await load();
    } finally {
      setReordering(false);
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="mb-4 d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <h3 className="mb-1 d-flex align-items-center gap-2">
            <ListPlus size={22} />
            Campi personalizzati
          </h3>
          <p className="text-muted mb-0">
            Campi aggiuntivi per la scheda cliente, definiti a livello di workspace.
          </p>
        </div>
        <Button variant="primary" className="d-inline-flex align-items-center gap-2" onClick={openCreate}>
          <ListPlus size={16} />
          Nuovo campo
        </Button>
      </div>

      {loadError && (
        <Alert variant="danger" onClose={() => setLoadError('')} dismissible>
          {loadError}
        </Alert>
      )}

      <Card className="card-border">
        <Card.Body className="p-0">
          {loading ? (
            <div className="p-4 d-flex justify-content-center">
              <Spinner animation="border" size="sm" role="status" />
            </div>
          ) : fields.length === 0 ? (
            <div className="p-4 text-muted">Nessun campo personalizzato. Creane uno con «Nuovo campo».</div>
          ) : (
            <Table responsive hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Ordine</th>
                  <th>Etichetta</th>
                  <th>Chiave</th>
                  <th>Tipo</th>
                  <th>Obbligatorio</th>
                  <th>Stato</th>
                  <th className="text-end">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => (
                  <tr key={field.id}>
                    <td>
                      <div className="d-flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline-secondary"
                          onClick={() => void move(index, -1)}
                          disabled={reordering || index === 0}
                          aria-label="Sposta su"
                        >
                          <ArrowUp size={14} />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline-secondary"
                          onClick={() => void move(index, 1)}
                          disabled={reordering || index === fields.length - 1}
                          aria-label="Sposta giù"
                        >
                          <ArrowDown size={14} />
                        </Button>
                      </div>
                    </td>
                    <td className="fw-semibold">{field.label}</td>
                    <td className="text-muted"><code>{field.key}</code></td>
                    <td>{FIELD_TYPE_LABELS[field.type] || field.type}</td>
                    <td>{field.required ? <Badge bg="warning" text="dark">Obbligatorio</Badge> : <span className="text-muted">—</span>}</td>
                    <td>
                      <Badge bg={field.active ? 'success' : 'secondary'}>
                        {field.active ? 'Attivo' : 'Nascosto'}
                      </Badge>
                    </td>
                    <td>
                      <div className="d-flex justify-content-end gap-1">
                        <Button type="button" size="sm" variant="outline-secondary" onClick={() => openEdit(field)}>
                          <Pencil size={14} />
                        </Button>
                        <Button type="button" size="sm" variant="outline-danger" onClick={() => setDeleting(field)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <CustomFieldDraftModal
        show={modalOpen}
        field={editingField}
        onHide={() => setModalOpen(false)}
        onSaved={handleSaved}
      />

      <Modal show={Boolean(deleting)} onHide={() => setDeleting(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Elimina campo</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Vuoi eliminare il campo <strong>{deleting?.label}</strong>? I valori già salvati nei clienti
          resteranno nei dati ma non saranno più mostrati.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDeleting(null)}>Annulla</Button>
          <Button variant="danger" onClick={() => void handleDelete()}>Elimina</Button>
        </Modal.Footer>
      </Modal>

      <ToastContainer position="bottom-right" theme="light" />
    </div>
  );
};

export default CustomFieldsPage;
