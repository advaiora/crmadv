import React from 'react';
import { Badge, Button, Modal } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import moment from 'moment';
import { EVENT_SOURCE_BADGE } from './boardConstants';

// Riquadro di dettaglio dell'evento su cui si e' cliccato. Gli eventi derivati
// da progetti e preventivi arrivano con `editable: false`: per loro non
// compaiono ne' Modifica ne' Elimina, qualunque permesso si abbia.
// Estratto da src/views/Calendar/index.jsx nel giro di spezzatura del 5/8/2026.
const CalendarEventDetailsModal = ({
  event,
  onClose,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  saving,
}) => {
  if (!event) {
    return null;
  }

  return (
    <Modal show={Boolean(event)} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>{event.title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="d-flex align-items-center gap-2 mb-3">
          <Badge bg="light" text="dark">{EVENT_SOURCE_BADGE[event.sourceType] || 'Evento'}</Badge>
          <Badge style={{ backgroundColor: event.backgroundColor, color: event.textColor }}>
            {event.category || 'Generale'}
          </Badge>
        </div>

        <div className="small mb-2">
          <strong>Inizio:</strong> {moment(event.start).format('DD/MM/YYYY HH:mm')}
        </div>
        <div className="small mb-2">
          <strong>Fine:</strong> {event.end ? moment(event.end).format('DD/MM/YYYY HH:mm') : '-'}
        </div>
        <div className="small mb-2">
          <strong>Luogo:</strong> {event.location || '-'}
        </div>
        <div className="small mb-2">
          <strong>Descrizione:</strong> {event.description || '-'}
        </div>
        {event.url && (
          <div className="small mb-2">
            <strong>Collegamento:</strong>{' '}
            <Link to={event.url} onClick={onClose}>
              Apri dettaglio
            </Link>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onClose}>
          Chiudi
        </Button>
        {event.editable && canEdit && (
          <Button variant="outline-primary" onClick={() => onEdit(event)}>
            Modifica
          </Button>
        )}
        {event.editable && canDelete && (
          <Button variant="danger" onClick={() => void onDelete()} disabled={saving}>
            {saving ? 'Eliminazione...' : 'Elimina'}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default CalendarEventDetailsModal;
