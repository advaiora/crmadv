import { useCallback, useMemo, useState } from 'react';
import { listCalendarEvents } from '../../../../modules/calendar/api/calendarApi';
import { mapApiError } from '../boardPureFunctions';

// Gli eventi del periodo visibile, i filtri per sorgente e i due elenchi
// derivati (griglia e "prossimi eventi").
// Estratto da src/views/Calendar/index.jsx nel giro di spezzatura del 5/8/2026.
//
// Qui stanno anche `error` e `saving`, che NON appartengono solo al
// caricamento: sono condivisi con il salvataggio, l'eliminazione e il
// trascinamento. Un solo avviso in cima mostra l'ultimo errore da qualunque
// parte arrivi, quindi i due stati vivono in un posto solo e gli altri hook
// ricevono i setter per parametro.
export const useCalendarBoardEvents = ({ calendarRef, visibleRangeRef }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sourceFilters, setSourceFilters] = useState({
    custom: true,
    project_due: true,
    quote_issue_date: true,
    quote_valid_until: true,
  });

  const loadEvents = useCallback(async (start, end) => {
    setLoading(true);
    setError('');

    try {
      const response = await listCalendarEvents({
        start: start.toISOString(),
        end: end.toISOString(),
        includeDerived: true,
      });

      setEvents(Array.isArray(response?.items) ? response.items : []);
    } catch (loadError) {
      setError(mapApiError(loadError, 'Errore caricamento calendario'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Ricarica il periodo che si sta guardando. Il riferimento al periodo e' la
  // via principale; quando non e' ancora stato scritto (nessun `datesSet`
  // arrivato) si ripiega sull'API del calendario, e se manca anche quella non
  // si fa niente.
  const reloadVisibleRange = useCallback(async () => {
    const { start, end } = visibleRangeRef.current;
    if (start && end) {
      await loadEvents(start, end);
      return;
    }

    const calendarApi = calendarRef.current?.getApi?.();
    if (!calendarApi) {
      return;
    }

    const currentStart = calendarApi.view.currentStart;
    const currentEnd = calendarApi.view.currentEnd;
    if (!currentStart || !currentEnd) {
      return;
    }

    await loadEvents(currentStart, currentEnd);
  }, [loadEvents, calendarRef, visibleRangeRef]);

  const toggleSourceFilter = (key, checked) => {
    setSourceFilters((current) => ({
      ...current,
      [key]: checked,
    }));
  };

  // I due elenchi restano derivati, non diventano stato.
  const filteredEvents = useMemo(() => {
    return events.filter((item) => sourceFilters[item.sourceType] !== false);
  }, [events, sourceFilters]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();

    return filteredEvents
      .filter((item) => new Date(item.start).getTime() >= now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 8);
  }, [filteredEvents]);

  return {
    events,
    loading,
    saving,
    setSaving,
    error,
    setError,
    sourceFilters,
    toggleSourceFilter,
    filteredEvents,
    upcomingEvents,
    loadEvents,
    reloadVisibleRange,
  };
};
