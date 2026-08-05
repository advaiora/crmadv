import React from 'react';
import { Button, Card, Form, ListGroup } from 'react-bootstrap';
import moment from 'moment';
import { SOURCE_FILTERS } from './boardConstants';

// Colonna di sinistra: il tasto per creare, i filtri per sorgente e i prossimi
// eventi in ordine di data.
// Estratta da src/views/Calendar/index.jsx nel giro di spezzatura del 5/8/2026.
const CalendarFiltersPanel = ({
  canCreate,
  onCreateEvent,
  sourceFilters,
  onToggleSourceFilter,
  upcomingEvents,
  onSelectEvent,
}) => (
  <Card className="card-border h-100">
    <Card.Body>
      <div className="d-grid mb-3">
        <Button onClick={() => onCreateEvent()} disabled={!canCreate}>
          Nuovo evento
        </Button>
      </div>

      <div className="small fw-semibold text-uppercase text-muted mb-2">Filtri sorgente</div>
      <div className="d-grid gap-1 mb-3">
        {Object.entries(SOURCE_FILTERS).map(([key, label]) => (
          <Form.Check
            key={key}
            id={`calendar-filter-${key}`}
            type="checkbox"
            label={label}
            checked={sourceFilters[key] !== false}
            onChange={(event) => onToggleSourceFilter(key, event.target.checked)}
          />
        ))}
      </div>

      <div className="small fw-semibold text-uppercase text-muted mb-2">Prossimi eventi</div>
      <ListGroup variant="flush">
        {upcomingEvents.length === 0 && (
          <ListGroup.Item className="px-0 text-muted small">Nessun evento imminente</ListGroup.Item>
        )}

        {upcomingEvents.map((item) => (
          <ListGroup.Item
            key={`upcoming-${item.id}`}
            className="px-0 cursor-pointer"
            action
            onClick={() => onSelectEvent(item)}
          >
            <div className="small fw-semibold">{item.title}</div>
            <div className="small text-muted">{moment(item.start).format('DD/MM/YYYY HH:mm')}</div>
          </ListGroup.Item>
        ))}
      </ListGroup>
    </Card.Body>
  </Card>
);

export default CalendarFiltersPanel;
