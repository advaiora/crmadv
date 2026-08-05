import { useState } from 'react';
import { deleteCalendarEvent, updateCalendarEvent } from '../../../../modules/calendar/api/calendarApi';
import { mapApiError } from '../boardPureFunctions';

// L'evento aperto nel riquadro di dettaglio, la sua eliminazione, e lo
// spostamento di un evento trascinandolo o ridimensionandolo sulla griglia.
// Estratto da src/views/Calendar/index.jsx nel giro di spezzatura del 5/8/2026.
//
// `error` e `saving` non stanno qui: sono condivisi con il caricamento e il
// salvataggio, e arrivano per parametro dall'hook degli eventi.
export const useCalendarBoardSelection = ({
  events,
  filteredEvents,
  setSaving,
  setError,
  reloadVisibleRange,
}) => {
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Il click cerca fra gli eventi FILTRATI, il trascinamento (piu' sotto) fra
  // quelli grezzi. In pratica danno lo stesso risultato — un evento nascosto
  // dal filtro non e' sulla griglia, quindi non lo si puo' ne' cliccare ne'
  // trascinare — ma l'asimmetria e' quella dell'originale e non va uniformata
  // dentro un riordino.
  const handleEventClick = (clickInfo) => {
    clickInfo.jsEvent?.preventDefault?.();
    const eventId = clickInfo.event.id;
    const found = filteredEvents.find((item) => item.id === eventId);

    if (found) {
      setSelectedEvent(found);
    }
  };

  const handleDeleteSelectedEvent = async () => {
    if (!selectedEvent) {
      return;
    }

    const shouldDelete = window.confirm('Confermi eliminazione evento?');
    if (!shouldDelete) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      await deleteCalendarEvent(selectedEvent.id);
      setSelectedEvent(null);
      await reloadVisibleRange();
    } catch (deleteError) {
      setError(mapApiError(deleteError, 'Eliminazione evento non riuscita'));
    } finally {
      setSaving(false);
    }
  };

  // Trascinamento e ridimensionamento passano tutti e due di qui. Gli eventi
  // derivati da progetti e preventivi non sono spostabili: si rimette a posto
  // la griglia e basta.
  //
  // Nota: questo NON accende `saving`, a differenza di salvataggio ed
  // eliminazione. Aggiungerlo cambierebbe quello che si vede (i tasti del
  // dettaglio si spegnerebbero durante un trascinamento).
  const handleDragOrResize = async (interactionInfo, canEdit) => {
    const eventId = interactionInfo.event.id;
    const current = events.find((item) => item.id === eventId);

    if (!current || !current.editable || !canEdit) {
      interactionInfo.revert();
      return;
    }

    setError('');

    try {
      await updateCalendarEvent(eventId, {
        startAt: interactionInfo.event.start?.toISOString(),
        endAt: interactionInfo.event.end ? interactionInfo.event.end.toISOString() : null,
        allDay: interactionInfo.event.allDay,
      });

      await reloadVisibleRange();
    } catch (updateError) {
      interactionInfo.revert();
      setError(mapApiError(updateError, 'Aggiornamento evento non riuscito'));
    }
  };

  return {
    selectedEvent,
    setSelectedEvent,
    handleEventClick,
    handleDeleteSelectedEvent,
    handleDragOrResize,
  };
};
