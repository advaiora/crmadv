import { useState } from 'react';
import { createCalendarEvent, updateCalendarEvent } from '../../../../modules/calendar/api/calendarApi';
import {
  applyAllDayToggle,
  buildDefaultFormState,
  mapApiError,
  normalizeHexColor,
  parseFormDateValue,
  toLocalDateInput,
  toLocalDateTimeInput,
  toOptionalTrimmedString,
} from '../boardPureFunctions';
import { DEFAULT_EVENT_COLOR } from '../boardConstants';

// Il riquadro di creazione/modifica evento: il suo modulo, l'apertura nei due
// modi e il salvataggio.
// Estratto da src/views/Calendar/index.jsx nel giro di spezzatura del 5/8/2026.
//
// Riceve `setSelectedEvent` perche' aprire il form in creazione chiude il
// dettaglio eventualmente aperto (comportamento dell'originale).
//
// `handleEventSelect` (trascinare su un'area vuota della griglia) sta QUI e non
// nell'hook della selezione: l'unica cosa che fa e' aprire questo form. Il
// piano di estrazione la metteva di la', ma cosi' i due hook avrebbero dovuto
// chiamarsi a vicenda.
export const useCalendarBoardEventForm = ({
  setSelectedEvent,
  setSaving,
  setError,
  reloadVisibleRange,
}) => {
  const [formState, setFormState] = useState(buildDefaultFormState());
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventModalMode, setEventModalMode] = useState('create');
  const [editingEventId, setEditingEventId] = useState(null);

  const setFormPatch = (patch) => {
    setFormState((current) => ({
      ...current,
      ...patch,
    }));
  };

  const setAllDay = (checked) => {
    setFormState((current) => applyAllDayToggle(current, checked));
  };

  const closeEventModal = () => {
    setEventModalOpen(false);
    setEditingEventId(null);
  };

  // Con un intervallo (trascinamento sulla griglia) il form nasce gia' con
  // quelle date. Sull'intera giornata la fine arriva esclusiva — il giorno DOPO
  // l'ultimo — quindi si toglie un millisecondo per mostrare il giorno giusto.
  const openCreateEventModal = (selectedRange = null) => {
    const nextState = buildDefaultFormState();
    setSelectedEvent(null);
    setEditingEventId(null);

    if (selectedRange) {
      nextState.allDay = Boolean(selectedRange.allDay);
      nextState.startValue = selectedRange.allDay
        ? toLocalDateInput(selectedRange.start)
        : toLocalDateTimeInput(selectedRange.start);
      nextState.endValue = selectedRange.end
        ? (selectedRange.allDay
          ? toLocalDateInput(new Date(selectedRange.end.getTime() - 1))
          : toLocalDateTimeInput(selectedRange.end))
        : '';
    }

    setEventModalMode('create');
    setFormState(nextState);
    setEventModalOpen(true);
  };

  const openEditEventModal = (eventItem) => {
    if (!eventItem) {
      return;
    }

    setEditingEventId(eventItem.id);
    setEventModalMode('edit');
    setFormState({
      title: eventItem.title || '',
      description: eventItem.description || '',
      location: eventItem.location || '',
      category: eventItem.category || '',
      color: normalizeHexColor(eventItem.backgroundColor, DEFAULT_EVENT_COLOR),
      allDay: Boolean(eventItem.allDay),
      startValue: eventItem.allDay
        ? toLocalDateInput(eventItem.start)
        : toLocalDateTimeInput(eventItem.start),
      endValue: eventItem.end
        ? (eventItem.allDay ? toLocalDateInput(eventItem.end) : toLocalDateTimeInput(eventItem.end))
        : '',
    });
    setEventModalOpen(true);
  };

  const handleEventSelect = (selectionInfo, canCreate) => {
    if (!canCreate) {
      return;
    }

    openCreateEventModal({
      start: selectionInfo.start,
      end: selectionInfo.end,
      allDay: selectionInfo.allDay,
    });
  };

  const handleUpsertEvent = async () => {
    if (!editingEventId && eventModalMode === 'edit') {
      setError('Evento non trovato. Riapri il dettaglio e riprova.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const title = String(formState.title ?? '').trim();
      if (!title) {
        throw new Error('Inserisci un titolo evento.');
      }

      const payload = {
        title,
        description: toOptionalTrimmedString(formState.description),
        location: toOptionalTrimmedString(formState.location),
        category: toOptionalTrimmedString(formState.category),
        color: normalizeHexColor(formState.color, DEFAULT_EVENT_COLOR),
        allDay: Boolean(formState.allDay),
        startAt: parseFormDateValue(formState.startValue, { allDay: formState.allDay }),
        endAt: parseFormDateValue(formState.endValue, { allDay: formState.allDay, isEnd: true }),
      };

      if (!payload.startAt) {
        throw new Error('Inserisci una data di inizio valida.');
      }

      if (eventModalMode === 'create') {
        await createCalendarEvent(payload);
      } else {
        await updateCalendarEvent(editingEventId, payload);
      }

      setEventModalOpen(false);
      setEditingEventId(null);
      await reloadVisibleRange();
    } catch (submitError) {
      setError(mapApiError(submitError, 'Salvataggio evento non riuscito'));
    } finally {
      setSaving(false);
    }
  };

  return {
    formState,
    setFormPatch,
    setAllDay,
    eventModalOpen,
    eventModalMode,
    closeEventModal,
    openCreateEventModal,
    openEditEventModal,
    handleEventSelect,
    handleUpsertEvent,
  };
};
