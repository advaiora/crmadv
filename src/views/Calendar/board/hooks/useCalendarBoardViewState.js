import { useCallback, useRef, useState } from 'react';
import moment from 'moment';
import { useWindowHeight } from '@react-hook/window-size';

// Stato di "dove siamo" nel calendario: la vista scelta, l'etichetta del
// periodo, il periodo visibile e l'altezza della griglia. Non sa niente degli
// eventi: chi li carica riceve i due riferimenti per parametro.
// Estratto da src/views/Calendar/index.jsx nel giro di spezzatura del 5/8/2026.
//
// I due riferimenti si creano QUI e in un punto solo: `calendarRef` e' quello
// attaccato davvero al componente FullCalendar, ricrearlo altrove darebbe un
// riferimento diverso e le chiamate all'API del calendario finirebbero nel
// vuoto.
export const useCalendarBoardViewState = () => {
  const calendarRef = useRef(null);
  const visibleRangeRef = useRef({ start: null, end: null });

  const [dateLabel, setDateLabel] = useState(moment().format('MMMM YYYY'));
  const [currentView, setCurrentView] = useState('month');

  // Non e' stato: si ricalcola a ogni render dall'altezza della finestra.
  const calendarHeight = useWindowHeight() - 180;

  const handleCalendarNavigation = (action) => {
    const calendarApi = calendarRef.current?.getApi?.();
    if (!calendarApi) {
      return;
    }

    if (action === 'prev') {
      calendarApi.prev();
    } else if (action === 'next') {
      calendarApi.next();
    } else {
      calendarApi.today();
    }
  };

  const handleViewChange = (view) => {
    const calendarApi = calendarRef.current?.getApi?.();
    if (!calendarApi) {
      return;
    }

    if (view === 'week') {
      calendarApi.changeView('timeGridWeek');
    } else if (view === 'day') {
      calendarApi.changeView('timeGridDay');
    } else if (view === 'list') {
      calendarApi.changeView('listWeek');
    } else {
      calendarApi.changeView('dayGridMonth');
    }

    setCurrentView(view);
  };

  // Meta' "vista" di quello che FullCalendar chiama a ogni cambio di periodo:
  // segna il periodo visibile e aggiorna l'etichetta in cima. L'altra meta'
  // (ricaricare gli eventi del periodo nuovo) sta nell'hook degli eventi, e le
  // due vengono rimesse insieme nell'hook radice: se una delle due si perde, il
  // calendario cambia mese e mostra ancora gli eventi di quello prima, senza
  // nessun errore.
  const applyDatesSetToView = useCallback((dateInfo) => {
    visibleRangeRef.current = {
      start: dateInfo.start,
      end: dateInfo.end,
    };

    setDateLabel(moment(dateInfo.view.currentStart).format('MMMM YYYY'));
  }, []);

  return {
    calendarRef,
    visibleRangeRef,
    dateLabel,
    currentView,
    calendarHeight,
    handleCalendarNavigation,
    handleViewChange,
    applyDatesSetToView,
  };
};
