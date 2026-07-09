import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from 'react-bootstrap';
import { ArrowDown, ArrowUp, ListPlus, Pencil, Trash2 } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import {
  createCustomField,
  deleteCustomField,
  listCustomFields,
  reorderCustomFields,
  updateCustomField,
} from '../api/customFieldsApi';

const FIELD_TYPE_OPTIONS = [
  { value: 'text', label: 'Testo breve' },
  { value: 'textarea', label: 'Testo lungo' },
  { value: 'number', label: 'Numero' },
  { value: 'date', label: 'Data' },
  { value: 'boolean', label: 'Sì / No' },
  { value: 'select', label: 'Elenco a tendina' },
];

const TYPE_LABEL = Object.fromEntries(FIELD_TYPE_OPTIONS.map((option) => [option.value, option.label]));

const getErrorMessage = (error, fallback) => error?.message || fallback;

// Trasforma le opzioni [{value,label}] in testo "una per riga" (value | label).
const optionsToText = (options) =>
  (Array.isArray(options) ? options : [])
    .map((option) => (option.label && option.label !== option.value ? `${option.value} | ${option.label}` : option.value))
    .join('\n');

// Parsa il testo "una per riga" in [{value,label}].
const textToOptions = (text) =>
  String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [value, ...rest] = line.split('|');
      const cleanValue = value.trim();
      const label = rest.join('|').trim();
      return { value: cleanValue, label: label || cleanValue };
    })
    .filter((option) => option.value);

const emptyDraft = { id: null, label: '', key: '', type: 'text', required: false, active: true, optionsText: '' };

// Pagina di gestione dei campi personalizzati del cliente (Custom Fields, V3).
const CustomFieldsPage = () => {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reordering, setReordering] = useState(false);

  const [draft, setDraft] = useState(null); // null = modale chiusa
  const [saving, setSaving] = useState(false);
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

  const isEditing = Boolean(draft?.id);
  const isSelect = draft?.type === 'select';

  const openCreate = () => setDraft({ ...emptyDraft });
  const openEdit = (field) =>
    setDraft({
      id: field.id,
      label: field.label,
      key: field.key,
      type: field.type,
      required: field.required,
      active: field.active,
      optionsText: optionsToText(field.options),
    });

  const handleSave = async () => {
    if (!draft?.label.trim()) {
      toast.error('Etichetta obbligatoria');
      return;
    }
    const payload = {
      label: draft.label.trim(),
      type: draft.type,
      required: draft.required,
      active: draft.active,
    };
    if (draft.type === 'select') {
      const options = textToOptions(draft.optionsText);
      if (options.length === 0) {
        toast.error('Un elenco a tendina richiede almeno un\'opzione');
        return;
      }
      payload.options = options;
    }
    // La chiave si invia solo in creazione (in modifica è immutabile).
    if (!isEditing && draft.key.trim()) {
      payload.key = draft.key.trim();
    }

    setSaving(true);
    try {
      if (isEditing) {
        await updateCustomField(draft.id, payload);
        toast.success('Campo aggiornato');
      } else {
        await createCustomField(payload);
        toast.success('Campo creato');
      }
      setDraft(null);
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Errore salvataggio campo'));
    } finally {
      setSaving(false);
    }
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

  const previewKey = useMemo(() => {
    if (isEditing || draft?.key) {
      return draft?.key || '';
    }
    // Anteprima dello slug generato dall'etichetta (indicativa; il server è la fonte di verità).
    return String(draft?.label || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }, [draft, isEditing]);

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
                    <td>{TYPE_LABEL[field.type] || field.type}</td>
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

      <Modal show={Boolean(draft)} onHide={() => setDraft(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{isEditing ? 'Modifica campo' : 'Nuovo campo personalizzato'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Etichetta</Form.Label>
            <Form.Control
              value={draft?.label || ''}
              onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
              placeholder="Es. Settore merceologico"
              autoFocus
            />
            {!isEditing && previewKey && (
              <Form.Text className="text-muted">Chiave tecnica: <code>{previewKey}</code></Form.Text>
            )}
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Tipo</Form.Label>
            <Form.Select
              value={draft?.type || 'text'}
              onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))}
            >
              {FIELD_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Form.Select>
          </Form.Group>

          {isSelect && (
            <Form.Group className="mb-3">
              <Form.Label>Opzioni <span className="text-muted small">(una per riga; «valore | etichetta»)</span></Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={draft?.optionsText || ''}
                onChange={(event) => setDraft((current) => ({ ...current, optionsText: event.target.value }))}
                placeholder={'alta | Alta\nmedia | Media\nbassa | Bassa'}
              />
            </Form.Group>
          )}

          <Form.Check
            type="switch"
            id="cf-required"
            className="mb-2"
            label="Campo obbligatorio"
            checked={Boolean(draft?.required)}
            onChange={(event) => setDraft((current) => ({ ...current, required: event.target.checked }))}
          />
          <Form.Check
            type="switch"
            id="cf-active"
            label="Attivo (mostrato nella scheda cliente)"
            checked={Boolean(draft?.active)}
            onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDraft(null)} disabled={saving}>
            Annulla
          </Button>
          <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Salvataggio…' : 'Salva'}
          </Button>
        </Modal.Footer>
      </Modal>

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
