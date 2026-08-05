import React from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';

// La griglia vera e propria, con sopra l'avviso di errore e la riga di
// caricamento. L'avviso e' uno solo e mostra l'ultimo errore da qualunque parte
// arrivi: caricamento, salvataggio, eliminazione o trascinamento.
// Estratta da src/views/Calendar/index.jsx nel giro di spezzatura del 5/8/2026.
const CalendarGrid = ({
  error,
  loading,
  calendarRef,
  calendarHeight,
  events,
  canCreate,
  canEdit,
  onDatesSet,
  onSelectRange,
  onEventClick,
  onDragOrResize,
}) => (
  <>
    {error && <Alert variant="danger" className="py-2">{error}</Alert>}

    {loading && (
      <div className="d-flex align-items-center gap-2 text-muted small mb-2">
        <Spinner animation="border" size="sm" />
        Caricamento calendario...
      </div>
    )}

    <FullCalendar
      ref={calendarRef}
      plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      locale="it"
      headerToolbar={false}
      themeSystem="bootstrap"
      height={Math.max(520, calendarHeight)}
      editable={canEdit}
      selectable={canCreate}
      events={events}
      datesSet={onDatesSet}
      select={(selectionInfo) => onSelectRange(selectionInfo, canCreate)}
      eventClick={onEventClick}
      eventDrop={(info) => void onDragOrResize(info, canEdit)}
      eventResize={(info) => void onDragOrResize(info, canEdit)}
    />
  </>
);

export default CalendarGrid;
