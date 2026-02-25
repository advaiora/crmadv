import React, { useMemo, useState } from 'react';
import { Alert, Button, Card, Form, Modal } from 'react-bootstrap';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { MAX_QUOTE_ITEMS } from '../constants';
import {
  computeLineTotal,
  createEmptyQuoteItem,
  formatCurrency,
} from '../helpers';

const buildEmptyErrors = () => ({
  title: '',
  quantity: '',
  unitPrice: '',
  discountValue: '',
});

const parseNumber = (value) => Number(String(value ?? '').replace(',', '.'));

const validateRow = (row) => {
  const errors = buildEmptyErrors();

  const title = String(row?.title || '').trim();
  if (!title) {
    errors.title = 'La descrizione e obbligatoria.';
  }

  const quantity = parseNumber(row?.quantity);
  if (!Number.isFinite(quantity) || quantity < 1) {
    errors.quantity = 'La quantita deve essere almeno 1.';
  }

  const unitPrice = parseNumber(row?.unitPrice);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    errors.unitPrice = 'Il prezzo unitario deve essere maggiore o uguale a 0.';
  }

  if (row?.discountType) {
    const discountValue = parseNumber(row?.discountValue);
    if (!Number.isFinite(discountValue) || discountValue < 0) {
      errors.discountValue = 'Lo sconto deve essere maggiore o uguale a 0.';
    }
  }

  return errors;
};

const hasErrors = (errors) => Object.values(errors).some((value) => Boolean(value));

const QuoteItemsEditor = ({
  items,
  onChange,
  currency,
  disabled = false,
  maxItems = MAX_QUOTE_ITEMS,
}) => {
  const safeItems = Array.isArray(items) ? items : [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [draftItem, setDraftItem] = useState(createEmptyQuoteItem(1));
  const [fieldErrors, setFieldErrors] = useState(buildEmptyErrors());
  const [summaryError, setSummaryError] = useState('');

  const emitItems = (nextItems) => {
    const normalized = nextItems.map((item, index) => ({
      ...item,
      position: index + 1,
    }));

    onChange(normalized);
  };

  const openCreateModal = () => {
    if (safeItems.length >= maxItems) {
      setSummaryError(`Numero massimo righe raggiunto (${maxItems}).`);
      return;
    }

    setEditingIndex(null);
    setDraftItem(createEmptyQuoteItem(safeItems.length + 1));
    setFieldErrors(buildEmptyErrors());
    setSummaryError('');
    setModalOpen(true);
  };

  const openEditModal = (index) => {
    const item = safeItems[index];
    if (!item) {
      return;
    }

    setEditingIndex(index);
    setDraftItem({
      ...item,
      discountValue: item.discountValue ?? '',
    });
    setFieldErrors(buildEmptyErrors());
    setSummaryError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingIndex(null);
    setDraftItem(createEmptyQuoteItem(1));
    setFieldErrors(buildEmptyErrors());
  };

  const saveModal = () => {
    const nextErrors = validateRow(draftItem);
    setFieldErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }

    const normalizedDraft = {
      ...draftItem,
      title: String(draftItem.title || '').trim(),
      description: String(draftItem.description || '').trim(),
      quantity: String(parseNumber(draftItem.quantity)),
      unitPrice: String(parseNumber(draftItem.unitPrice)),
      discountValue: draftItem.discountType
        ? String(parseNumber(draftItem.discountValue ?? 0))
        : '',
    };

    if (editingIndex === null) {
      emitItems([...safeItems, normalizedDraft]);
    } else {
      emitItems(safeItems.map((item, index) => (index === editingIndex ? normalizedDraft : item)));
    }

    closeModal();
  };

  const removeItem = (index) => {
    emitItems(safeItems.filter((_, itemIndex) => itemIndex !== index));
  };

  const onDragEnd = (result) => {
    if (disabled) {
      return;
    }
    if (!result.destination) {
      return;
    }

    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) {
      return;
    }

    const reordered = [...safeItems];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    emitItems(reordered);
  };

  const lineTotals = useMemo(() => safeItems.map((item) => computeLineTotal(item)), [safeItems]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0">Voci preventivo</h6>
        <Button
          type="button"
          size="sm"
          variant="outline-primary"
          onClick={openCreateModal}
          disabled={disabled || safeItems.length >= maxItems}
          className="d-inline-flex align-items-center gap-1"
        >
          <Plus size={14} />
          Aggiungi riga
        </Button>
      </div>

      {summaryError && (
        <Alert variant="danger" className="py-2 px-3">
          {summaryError}
        </Alert>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="quote-items-list">
          {(droppableProvided) => (
            <div ref={droppableProvided.innerRef} {...droppableProvided.droppableProps} className="d-grid gap-2">
              {safeItems.length === 0 && (
                <Card className="card-border">
                  <Card.Body className="text-muted text-center py-3">
                    Nessuna voce inserita.
                  </Card.Body>
                </Card>
              )}

              {safeItems.map((item, index) => (
                <Draggable
                  key={`${item.id || 'new'}-${index}`}
                  draggableId={`${item.id || 'new'}-${index}`}
                  index={index}
                  isDragDisabled={disabled}
                >
                  {(draggableProvided) => (
                    <Card
                      className="card-border"
                      ref={draggableProvided.innerRef}
                      {...draggableProvided.draggableProps}
                    >
                      <Card.Body className="py-2">
                        <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                          <div className="d-flex align-items-start gap-2">
                            <span {...draggableProvided.dragHandleProps} className="text-muted" style={{ cursor: 'grab' }}>
                              <GripVertical size={16} />
                            </span>
                            <div>
                              <div className="fw-semibold">{item.title || <span className="text-muted">Senza descrizione</span>}</div>
                              {item.description && <div className="small text-muted">{item.description}</div>}
                              <div className="small text-muted mt-1">
                                Qta: {item.quantity} | Prezzo: {formatCurrency(item.unitPrice, currency)}
                                {item.discountType ? ` | Sconto: ${item.discountType} ${item.discountValue || 0}` : ''}
                              </div>
                            </div>
                          </div>

                          <div className="d-flex align-items-center gap-2">
                            <div className="fw-semibold">{formatCurrency(lineTotals[index], currency)}</div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline-secondary"
                              onClick={() => openEditModal(index)}
                              disabled={disabled}
                            >
                              <Pencil size={14} />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline-danger"
                              onClick={() => removeItem(index)}
                              disabled={disabled}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  )}
                </Draggable>
              ))}
              {droppableProvided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <div className="small text-muted mt-2">
        Righe: {safeItems.length}/{maxItems}
      </div>

      <Modal show={modalOpen} onHide={closeModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingIndex === null ? 'Nuova riga' : 'Modifica riga'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-2">
            <Form.Label>Descrizione</Form.Label>
            <Form.Control
              value={draftItem.title || ''}
              onChange={(event) => setDraftItem((current) => ({ ...current, title: event.target.value }))}
              isInvalid={Boolean(fieldErrors.title)}
            />
            <Form.Control.Feedback type="invalid">{fieldErrors.title}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Dettaglio (opzionale)</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={draftItem.description || ''}
              onChange={(event) => setDraftItem((current) => ({ ...current, description: event.target.value }))}
            />
          </Form.Group>

          <div className="row g-2">
            <div className="col-6">
              <Form.Group>
                <Form.Label>Quantita</Form.Label>
                <Form.Control
                  type="number"
                  min="1"
                  step="1"
                  value={draftItem.quantity}
                  onChange={(event) => setDraftItem((current) => ({ ...current, quantity: event.target.value }))}
                  isInvalid={Boolean(fieldErrors.quantity)}
                />
                <Form.Control.Feedback type="invalid">{fieldErrors.quantity}</Form.Control.Feedback>
              </Form.Group>
            </div>
            <div className="col-6">
              <Form.Group>
                <Form.Label>Prezzo unitario</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  step="0.01"
                  value={draftItem.unitPrice}
                  onChange={(event) => setDraftItem((current) => ({ ...current, unitPrice: event.target.value }))}
                  isInvalid={Boolean(fieldErrors.unitPrice)}
                />
                <Form.Control.Feedback type="invalid">{fieldErrors.unitPrice}</Form.Control.Feedback>
              </Form.Group>
            </div>
          </div>

          <div className="row g-2 mt-1">
            <div className="col-6">
              <Form.Group>
                <Form.Label>Tipo sconto</Form.Label>
                <Form.Select
                  value={draftItem.discountType || ''}
                  onChange={(event) => {
                    const discountType = event.target.value || null;
                    setDraftItem((current) => ({
                      ...current,
                      discountType,
                      discountValue: discountType ? current.discountValue || '0' : '',
                    }));
                  }}
                >
                  <option value="">Nessuno</option>
                  <option value="PERCENT">Percentuale</option>
                  <option value="FIXED">Valore</option>
                </Form.Select>
              </Form.Group>
            </div>
            <div className="col-6">
              <Form.Group>
                <Form.Label>Valore sconto</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  step="0.01"
                  value={draftItem.discountValue ?? ''}
                  onChange={(event) => setDraftItem((current) => ({ ...current, discountValue: event.target.value }))}
                  disabled={!draftItem.discountType}
                  isInvalid={Boolean(fieldErrors.discountValue)}
                />
                <Form.Control.Feedback type="invalid">{fieldErrors.discountValue}</Form.Control.Feedback>
              </Form.Group>
            </div>
          </div>

          <div className="mt-3 small text-muted">
            Totale riga: {formatCurrency(computeLineTotal(draftItem), currency)}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeModal}>Annulla</Button>
          <Button variant="primary" onClick={saveModal}>Salva riga</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default QuoteItemsEditor;
