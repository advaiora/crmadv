import React, { useEffect, useId, useState } from 'react';
import { Alert, Button, Form, Modal } from 'react-bootstrap';
import { createCustomField, updateCustomField } from '../api/customFieldsApi';
import {
  FIELD_TYPE_OPTIONS,
  buildCustomFieldPayload,
  createEmptyDraft,
  fieldToDraft,
  isEditingDraft,
  previewKeyFromDraft,
} from './customFieldDraft';

// Modale unica per creare o modificare un campo personalizzato.
// La usano sia la pagina «Campi personalizzati» sia la scheda del cliente:
// una sola modale, cosi' le due strade non divergono col tempo.
const CustomFieldDraftModal = ({ show, field = null, onHide, onSaved }) => {
  const idPrefix = useId();
  const [draft, setDraft] = useState(createEmptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!show) {
      return;
    }
    setDraft(fieldToDraft(field));
    setError('');
  }, [show, field]);

  const isEditing = isEditingDraft(draft);
  const isSelect = draft.type === 'select';
  const previewKey = previewKeyFromDraft(draft);

  const patchDraft = (changes) => setDraft((current) => ({ ...current, ...changes }));

  const handleSave = async () => {
    const result = buildCustomFieldPayload(draft);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const response = isEditing
        ? await updateCustomField(draft.id, result.payload)
        : await createCustomField(result.payload);
      onSaved?.(response?.definition ?? null, { isEditing });
    } catch (saveError) {
      setError(saveError?.message || 'Errore salvataggio campo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>{isEditing ? 'Modifica campo' : 'Nuovo campo personalizzato'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger" className="py-2">{error}</Alert>}

        <Form.Group className="mb-3" controlId={`${idPrefix}-label`}>
          <Form.Label>Etichetta</Form.Label>
          <Form.Control
            value={draft.label}
            onChange={(event) => patchDraft({ label: event.target.value })}
            placeholder="Es. Settore merceologico"
            autoFocus
          />
          {!isEditing && previewKey && (
            <Form.Text className="text-muted">Chiave tecnica: <code>{previewKey}</code></Form.Text>
          )}
        </Form.Group>

        <Form.Group className="mb-3" controlId={`${idPrefix}-type`}>
          <Form.Label>Tipo</Form.Label>
          <Form.Select
            value={draft.type}
            onChange={(event) => patchDraft({ type: event.target.value })}
          >
            {FIELD_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Form.Select>
        </Form.Group>

        {isSelect && (
          <Form.Group className="mb-3" controlId={`${idPrefix}-options`}>
            <Form.Label>Opzioni <span className="text-muted small">(una per riga; «valore | etichetta»)</span></Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={draft.optionsText}
              onChange={(event) => patchDraft({ optionsText: event.target.value })}
              placeholder={'alta | Alta\nmedia | Media\nbassa | Bassa'}
            />
          </Form.Group>
        )}

        <Form.Check
          type="switch"
          id={`${idPrefix}-required`}
          className="mb-2"
          label="Campo obbligatorio"
          checked={Boolean(draft.required)}
          onChange={(event) => patchDraft({ required: event.target.checked })}
        />
        <Form.Check
          type="switch"
          id={`${idPrefix}-active`}
          label="Attivo (mostrato nella scheda cliente)"
          checked={Boolean(draft.active)}
          onChange={(event) => patchDraft({ active: event.target.checked })}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button type="button" variant="outline-secondary" onClick={onHide} disabled={saving}>
          Annulla
        </Button>
        <Button type="button" variant="primary" onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Salvataggio…' : 'Salva'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CustomFieldDraftModal;
