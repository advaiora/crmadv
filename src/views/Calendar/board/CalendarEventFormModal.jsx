import React from 'react';
import { Button, Col, Form, Modal, Row } from 'react-bootstrap';

// Riquadro di creazione e modifica evento: e' lo stesso modulo per tutti e due
// i casi, cambia solo il titolo in cima e cosa fa il salvataggio.
// Estratto da src/views/Calendar/index.jsx nel giro di spezzatura del 5/8/2026.
//
// I due campi data cambiano TIPO con la spunta "Intera giornata" (`date` contro
// `datetime-local`): per questo la spunta non e' una modifica come le altre e
// passa da `onAllDayChange`, che riscrive anche i due valori nel formato nuovo.
const CalendarEventFormModal = ({
  open,
  mode,
  formState,
  onPatch,
  onAllDayChange,
  onClose,
  onSubmit,
  saving,
}) => (
  <Modal show={open} onHide={onClose} centered>
    <Modal.Header closeButton>
      <Modal.Title>{mode === 'create' ? 'Nuovo evento' : 'Modifica evento'}</Modal.Title>
    </Modal.Header>
    <Modal.Body>
      {/* Ogni gruppo ha il suo `controlId`: senza, react-bootstrap non mette
          `htmlFor` sull'etichetta ne' `id` sul campo, e i due restano scollegati
          — chi usa un lettore di schermo non sente a cosa serve il campo su cui
          si trova. E' il debito di accessibilita' censito in roadmap, che si
          chiude in scia ai giri di spezzatura. */}
      <Form>
        <Form.Group className="mb-2" controlId="calendar-event-title">
          <Form.Label>Titolo</Form.Label>
          <Form.Control
            value={formState.title}
            onChange={(event) => onPatch({ title: event.target.value })}
            maxLength={160}
          />
        </Form.Group>

        <Row className="g-2 mb-2">
          <Col md={6}>
            <Form.Group controlId="calendar-event-start">
              <Form.Label>Inizio</Form.Label>
              <Form.Control
                type={formState.allDay ? 'date' : 'datetime-local'}
                value={formState.startValue}
                onChange={(event) => onPatch({ startValue: event.target.value })}
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group controlId="calendar-event-end">
              <Form.Label>Fine</Form.Label>
              <Form.Control
                type={formState.allDay ? 'date' : 'datetime-local'}
                value={formState.endValue}
                onChange={(event) => onPatch({ endValue: event.target.value })}
              />
            </Form.Group>
          </Col>
        </Row>

        <Form.Check
          className="mb-2"
          type="checkbox"
          id="calendar-event-all-day"
          label="Intera giornata"
          checked={formState.allDay}
          onChange={(event) => onAllDayChange(event.target.checked)}
        />

        <Row className="g-2 mb-2">
          <Col md={6}>
            <Form.Group controlId="calendar-event-category">
              <Form.Label>Categoria</Form.Label>
              <Form.Control
                value={formState.category}
                onChange={(event) => onPatch({ category: event.target.value })}
                maxLength={60}
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group controlId="calendar-event-location">
              <Form.Label>Luogo</Form.Label>
              <Form.Control
                value={formState.location}
                onChange={(event) => onPatch({ location: event.target.value })}
                maxLength={160}
              />
            </Form.Group>
          </Col>
        </Row>

        <Form.Group className="mb-2" controlId="calendar-event-description">
          <Form.Label>Descrizione</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={formState.description}
            onChange={(event) => onPatch({ description: event.target.value })}
            maxLength={2000}
          />
        </Form.Group>

        <Form.Group controlId="calendar-event-color">
          <Form.Label>Colore</Form.Label>
          <Form.Control
            type="color"
            value={formState.color}
            onChange={(event) => onPatch({ color: event.target.value })}
          />
        </Form.Group>
      </Form>
    </Modal.Body>
    <Modal.Footer>
      <Button variant="outline-secondary" onClick={onClose} disabled={saving}>
        Annulla
      </Button>
      <Button onClick={() => void onSubmit()} disabled={saving}>
        {saving ? 'Salvataggio...' : 'Salva'}
      </Button>
    </Modal.Footer>
  </Modal>
);

export default CalendarEventFormModal;
