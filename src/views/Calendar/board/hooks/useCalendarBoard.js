import { useCallback } from 'react';
import { useCalendarBoardViewState } from './useCalendarBoardViewState';
import { useCalendarBoardEvents } from './useCalendarBoardEvents';
import { useCalendarBoardSelection } from './useCalendarBoardSelection';
import { useCalendarBoardEventForm } from './useCalendarBoardEventForm';

// Hook radice della pagina Calendario: mette insieme i quattro pezzi nell'unico
// ordine possibile — la vista crea i riferimenti, gli eventi li usano per
// ricaricare, la selezione lavora sugli eventi, e il form chiude il dettaglio
// quando si apre in creazione.
// Estratto da src/views/Calendar/index.jsx nel giro di spezzatura del 5/8/2026.
//
// L'hook non sa niente dei permessi: chi puo' creare/modificare/eliminare lo
// decide la pagina e lo passa alle azioni che lo richiedono, come nell'originale.
export const useCalendarBoard = () => {
  const viewState = useCalendarBoardViewState();

  const events = useCalendarBoardEvents({
    calendarRef: viewState.calendarRef,
    visibleRangeRef: viewState.visibleRangeRef,
  });

  const selection = useCalendarBoardSelection({
    events: events.events,
    filteredEvents: events.filteredEvents,
    setSaving: events.setSaving,
    setError: events.setError,
    reloadVisibleRange: events.reloadVisibleRange,
  });

  const form = useCalendarBoardEventForm({
    setSelectedEvent: selection.setSelectedEvent,
    setSaving: events.setSaving,
    setError: events.setError,
    reloadVisibleRange: events.reloadVisibleRange,
  });

  // Si prendono per nome — e non come `viewState.qualcosa` dentro l'elenco
  // delle dipendenze qui sotto, che il controllo degli hook non sa leggere.
  // I setter di errore e salvataggio restano dentro: li usano gli hook a cui
  // sono stati passati, la pagina non deve poterli toccare.
  const { applyDatesSetToView, ...vista } = viewState;
  const {
    loadEvents,
    setSaving: _setSaving,
    setError: _setError,
    ...datiEventi
  } = events;

  // IL PUNTO DI GIUNZIONE. FullCalendar chiama questa a ogni cambio di periodo,
  // e nell'originale faceva due cose insieme: aggiornare la vista E ricaricare
  // gli eventi del periodo nuovo. Le due meta' ora stanno in due hook diversi e
  // vanno rimesse insieme qui, esplicitamente: se ne cadesse una, il calendario
  // cambierebbe mese continuando a mostrare gli eventi di quello prima, senza
  // nessun errore a segnalarlo.
  const handleDatesSet = useCallback((dateInfo) => {
    applyDatesSetToView(dateInfo);
    void loadEvents(dateInfo.start, dateInfo.end);
  }, [applyDatesSetToView, loadEvents]);

  return {
    ...vista,
    ...datiEventi,
    ...selection,
    ...form,
    handleDatesSet,
  };
};
