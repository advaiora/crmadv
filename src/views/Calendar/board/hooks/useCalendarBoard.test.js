import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCalendarBoard } from './useCalendarBoard';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
} from '../../../../modules/calendar/api/calendarApi';

vi.mock('../../../../modules/calendar/api/calendarApi', () => ({
  listCalendarEvents: vi.fn(),
  createCalendarEvent: vi.fn(),
  updateCalendarEvent: vi.fn(),
  deleteCalendarEvent: vi.fn(),
}));

const evento = (overrides = {}) => ({
  id: 'e1',
  title: 'Riunione',
  start: '2026-08-05T10:00:00.000Z',
  end: '2026-08-05T11:00:00.000Z',
  allDay: false,
  sourceType: 'custom',
  editable: true,
  backgroundColor: '#a1b2c3',
  ...overrides,
});

const inizio = new Date('2026-08-01T00:00:00.000Z');
const fine = new Date('2026-08-31T23:59:59.999Z');

// Quello che FullCalendar passa a ogni cambio di periodo.
const cambioPeriodo = (start = inizio, end = fine) => ({
  start,
  end,
  view: { currentStart: start },
});

// Le azioni chiamano `reloadVisibleRange()` al loro interno: si lanciano senza
// aspettarle e si attende l'ESITO con waitFor (nota operativa #41).
const lancia = (azione) => {
  act(() => { void azione(); });
};

// Con renderHook non c'e' nessun calendario montato, quindi il riferimento resta
// vuoto: e' il primo cambio di periodo a scrivere l'intervallo visibile, ed e'
// da li' che i ricaricamenti sanno cosa ricaricare.
const montaConPeriodo = async () => {
  const risultato = renderHook(() => useCalendarBoard());

  act(() => { risultato.result.current.handleDatesSet(cambioPeriodo()); });
  await waitFor(() => expect(risultato.result.current.loading).toBe(false));

  return risultato;
};

beforeEach(() => {
  vi.clearAllMocks();
  listCalendarEvents.mockResolvedValue({ items: [evento()] });
  createCalendarEvent.mockResolvedValue({});
  updateCalendarEvent.mockResolvedValue({});
  deleteCalendarEvent.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('caricamento del periodo visibile', () => {
  it('al cambio di periodo carica gli eventi e aggiorna l etichetta', async () => {
    const { result } = await montaConPeriodo();

    expect(listCalendarEvents).toHaveBeenCalledWith({
      start: inizio.toISOString(),
      end: fine.toISOString(),
      includeDerived: true,
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.dateLabel).toBe('August 2026');
  });

  // Il punto di giunzione: le due meta' di `datesSet` stanno in due hook
  // diversi. Se si scollegassero, il calendario cambierebbe mese continuando a
  // mostrare gli eventi di quello prima, senza nessun errore.
  it('cambiando mese ricarica sul periodo NUOVO', async () => {
    const { result } = await montaConPeriodo();
    const settembre = new Date('2026-09-01T00:00:00.000Z');
    const fineSettembre = new Date('2026-09-30T23:59:59.999Z');

    act(() => { result.current.handleDatesSet(cambioPeriodo(settembre, fineSettembre)); });

    await waitFor(() => expect(listCalendarEvents).toHaveBeenLastCalledWith({
      start: settembre.toISOString(),
      end: fineSettembre.toISOString(),
      includeDerived: true,
    }));
    await waitFor(() => expect(result.current.dateLabel).toBe('September 2026'));
  });

  it('una risposta senza elenco non rompe niente', async () => {
    listCalendarEvents.mockResolvedValue({});
    const { result } = await montaConPeriodo();

    expect(result.current.events).toEqual([]);
  });

  it('un errore di caricamento diventa un messaggio leggibile', async () => {
    listCalendarEvents.mockRejectedValue({ status: 403 });
    const { result } = await montaConPeriodo();

    expect(result.current.error).toBe('Non hai permessi');
    expect(result.current.loading).toBe(false);
  });
});

// Navigazione e viste passano tutte per l'API del calendario montato. Nei test
// non c'e' nessun calendario, quindi il riferimento va riempito a mano: senza,
// queste funzioni escono alla prima riga e non verificherebbero niente.
describe('navigazione e viste', () => {
  const attaccaCalendarioFinto = (result) => {
    const api = {
      prev: vi.fn(),
      next: vi.fn(),
      today: vi.fn(),
      changeView: vi.fn(),
      view: {},
    };
    result.current.calendarRef.current = { getApi: () => api };
    return api;
  };

  it('i tre comandi di navigazione arrivano al calendario', async () => {
    const { result } = await montaConPeriodo();
    const api = attaccaCalendarioFinto(result);

    act(() => { result.current.handleCalendarNavigation('prev'); });
    act(() => { result.current.handleCalendarNavigation('next'); });
    act(() => { result.current.handleCalendarNavigation('today'); });

    expect(api.prev).toHaveBeenCalledTimes(1);
    expect(api.next).toHaveBeenCalledTimes(1);
    expect(api.today).toHaveBeenCalledTimes(1);
  });

  // Un'azione sconosciuta cade su "oggi": e' il ramo finale dell'originale.
  it('un comando sconosciuto porta a oggi', async () => {
    const { result } = await montaConPeriodo();
    const api = attaccaCalendarioFinto(result);

    act(() => { result.current.handleCalendarNavigation('qualcosaltro'); });

    expect(api.today).toHaveBeenCalledTimes(1);
  });

  // I quattro nomi che FullCalendar conosce non somigliano ai nostri: uno
  // scambio fra due rami darebbe all'utente la vista sbagliata, in silenzio.
  it('ogni vista si traduce nel nome che il calendario conosce', async () => {
    const { result } = await montaConPeriodo();
    const api = attaccaCalendarioFinto(result);

    act(() => { result.current.handleViewChange('week'); });
    expect(api.changeView).toHaveBeenLastCalledWith('timeGridWeek');
    expect(result.current.currentView).toBe('week');

    act(() => { result.current.handleViewChange('day'); });
    expect(api.changeView).toHaveBeenLastCalledWith('timeGridDay');

    act(() => { result.current.handleViewChange('list'); });
    expect(api.changeView).toHaveBeenLastCalledWith('listWeek');

    act(() => { result.current.handleViewChange('month'); });
    expect(api.changeView).toHaveBeenLastCalledWith('dayGridMonth');
    expect(result.current.currentView).toBe('month');
  });

  // Prima che il calendario sia montato i comandi non devono esplodere: e' il
  // caso vero dei primi istanti della pagina.
  it('senza calendario montato i comandi non fanno niente e non esplodono', async () => {
    const { result } = await montaConPeriodo();

    act(() => { result.current.handleCalendarNavigation('next'); });
    act(() => { result.current.handleViewChange('week'); });

    // La vista NON cambia: senza calendario il cambio si ferma prima.
    expect(result.current.currentView).toBe('month');
  });
});

describe('filtri per sorgente', () => {
  it('spegnendo una sorgente i suoi eventi spariscono dalla griglia', async () => {
    listCalendarEvents.mockResolvedValue({
      items: [evento(), evento({ id: 'e2', sourceType: 'project_due' })],
    });
    const { result } = await montaConPeriodo();
    expect(result.current.filteredEvents).toHaveLength(2);

    act(() => { result.current.toggleSourceFilter('project_due', false); });

    expect(result.current.filteredEvents).toHaveLength(1);
    expect(result.current.filteredEvents[0].id).toBe('e1');
    // L'elenco grezzo non si tocca: il filtro e' solo una vista.
    expect(result.current.events).toHaveLength(2);
  });
});

describe('creazione e modifica evento', () => {
  it('senza titolo non chiama il server e lo dice', async () => {
    const { result } = await montaConPeriodo();
    act(() => { result.current.openCreateEventModal(); });
    act(() => { result.current.setFormPatch({ title: '   ' }); });

    lancia(() => result.current.handleUpsertEvent());

    await waitFor(() => expect(result.current.error).toBe('Inserisci un titolo evento.'));
    expect(createCalendarEvent).not.toHaveBeenCalled();
    // Il riquadro resta aperto: c'e' da correggere.
    expect(result.current.eventModalOpen).toBe(true);
  });

  it('crea l evento, chiude il riquadro e ricarica', async () => {
    const { result } = await montaConPeriodo();
    act(() => { result.current.openCreateEventModal(); });
    act(() => { result.current.setFormPatch({ title: '  Nuovo evento  ', location: '  Sala A  ' }); });

    lancia(() => result.current.handleUpsertEvent());

    await waitFor(() => expect(createCalendarEvent).toHaveBeenCalledTimes(1));
    const payload = createCalendarEvent.mock.calls[0][0];
    expect(payload.title).toBe('Nuovo evento');
    expect(payload.location).toBe('Sala A');
    // I campi facoltativi vuoti non si mandano affatto.
    expect(payload.description).toBeUndefined();
    await waitFor(() => expect(result.current.eventModalOpen).toBe(false));
    await waitFor(() => expect(listCalendarEvents).toHaveBeenCalledTimes(2));
  });

  it('aprendo in modifica il modulo si riempie con l evento', async () => {
    const { result } = await montaConPeriodo();

    act(() => { result.current.openEditEventModal(evento({ title: 'Da rivedere', location: 'Sala B' })); });

    expect(result.current.eventModalMode).toBe('edit');
    expect(result.current.formState.title).toBe('Da rivedere');
    expect(result.current.formState.location).toBe('Sala B');
    expect(result.current.formState.color).toBe('#a1b2c3');
  });

  it('salvando una modifica aggiorna quell evento', async () => {
    const { result } = await montaConPeriodo();
    act(() => { result.current.openEditEventModal(evento()); });

    lancia(() => result.current.handleUpsertEvent());

    await waitFor(() => expect(updateCalendarEvent).toHaveBeenCalledTimes(1));
    expect(updateCalendarEvent.mock.calls[0][0]).toBe('e1');
  });

  it('un salvataggio rifiutato lascia il riquadro aperto col messaggio', async () => {
    createCalendarEvent.mockRejectedValue({ status: 409 });
    const { result } = await montaConPeriodo();
    act(() => { result.current.openCreateEventModal(); });
    act(() => { result.current.setFormPatch({ title: 'Nuovo evento' }); });

    lancia(() => result.current.handleUpsertEvent());

    await waitFor(() => expect(result.current.error).toBe('Operazione non valida per lo stato attuale'));
    expect(result.current.eventModalOpen).toBe(true);
    expect(result.current.saving).toBe(false);
  });

  it('aprire in creazione chiude il dettaglio aperto', async () => {
    const { result } = await montaConPeriodo();
    act(() => { result.current.setSelectedEvent(evento()); });

    act(() => { result.current.openCreateEventModal(); });

    expect(result.current.selectedEvent).toBeNull();
    expect(result.current.eventModalMode).toBe('create');
  });

  // Trascinare su un'area vuota apre la creazione gia' con quelle date; senza
  // il permesso di creare non deve succedere niente.
  it('trascinare su un area vuota apre la creazione solo se si puo creare', async () => {
    const { result } = await montaConPeriodo();

    act(() => {
      result.current.handleEventSelect({ start: new Date(2026, 7, 5), end: new Date(2026, 7, 6), allDay: true }, false);
    });
    expect(result.current.eventModalOpen).toBe(false);

    act(() => {
      result.current.handleEventSelect({ start: new Date(2026, 7, 5), end: new Date(2026, 7, 6), allDay: true }, true);
    });
    expect(result.current.eventModalOpen).toBe(true);
    expect(result.current.formState.allDay).toBe(true);
    expect(result.current.formState.startValue).toBe('2026-08-05');
    // La fine arriva esclusiva (il giorno dopo l'ultimo): si mostra il 5, non il 6.
    expect(result.current.formState.endValue).toBe('2026-08-05');
  });
});

describe('dettaglio ed eliminazione', () => {
  it('il click apre il dettaglio dell evento cliccato', async () => {
    const { result } = await montaConPeriodo();

    act(() => {
      result.current.handleEventClick({ event: { id: 'e1' }, jsEvent: { preventDefault: vi.fn() } });
    });

    expect(result.current.selectedEvent?.id).toBe('e1');
  });

  it('cliccare un evento nascosto dal filtro non apre niente', async () => {
    listCalendarEvents.mockResolvedValue({ items: [evento({ id: 'e2', sourceType: 'project_due' })] });
    const { result } = await montaConPeriodo();
    act(() => { result.current.toggleSourceFilter('project_due', false); });

    act(() => { result.current.handleEventClick({ event: { id: 'e2' } }); });

    expect(result.current.selectedEvent).toBeNull();
  });

  it('annullando la conferma non elimina', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    const { result } = await montaConPeriodo();
    act(() => { result.current.setSelectedEvent(evento()); });

    lancia(() => result.current.handleDeleteSelectedEvent());

    expect(deleteCalendarEvent).not.toHaveBeenCalled();
    expect(result.current.selectedEvent).not.toBeNull();
  });

  it('confermando elimina, chiude il dettaglio e ricarica', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    const { result } = await montaConPeriodo();
    act(() => { result.current.setSelectedEvent(evento()); });

    lancia(() => result.current.handleDeleteSelectedEvent());

    await waitFor(() => expect(deleteCalendarEvent).toHaveBeenCalledWith('e1'));
    await waitFor(() => expect(result.current.selectedEvent).toBeNull());
    await waitFor(() => expect(listCalendarEvents).toHaveBeenCalledTimes(2));
  });
});

describe('trascinamento e ridimensionamento', () => {
  const trascinamento = (overrides = {}) => ({
    event: {
      id: 'e1',
      start: new Date('2026-08-06T10:00:00.000Z'),
      end: new Date('2026-08-06T11:00:00.000Z'),
      allDay: false,
      ...overrides,
    },
    revert: vi.fn(),
  });

  it('sposta l evento e ricarica', async () => {
    const { result } = await montaConPeriodo();
    const info = trascinamento();

    lancia(() => result.current.handleDragOrResize(info, true));

    await waitFor(() => expect(updateCalendarEvent).toHaveBeenCalledWith('e1', {
      startAt: '2026-08-06T10:00:00.000Z',
      endAt: '2026-08-06T11:00:00.000Z',
      allDay: false,
    }));
    expect(info.revert).not.toHaveBeenCalled();
  });

  it('senza permesso di modifica rimette la griglia com era', async () => {
    const { result } = await montaConPeriodo();
    const info = trascinamento();

    lancia(() => result.current.handleDragOrResize(info, false));

    expect(info.revert).toHaveBeenCalledTimes(1);
    expect(updateCalendarEvent).not.toHaveBeenCalled();
  });

  it('un evento non modificabile (scadenza progetto) non si sposta', async () => {
    listCalendarEvents.mockResolvedValue({
      items: [evento({ id: 'e1', sourceType: 'project_due', editable: false })],
    });
    const { result } = await montaConPeriodo();
    const info = trascinamento();

    lancia(() => result.current.handleDragOrResize(info, true));

    expect(info.revert).toHaveBeenCalledTimes(1);
    expect(updateCalendarEvent).not.toHaveBeenCalled();
  });

  // Se il server rifiuta, la griglia deve tornare com'era: senza `revert()`
  // l'evento resterebbe dove l'utente l'ha lasciato pur non essendo salvato.
  it('se il server rifiuta rimette la griglia com era e lo dice', async () => {
    updateCalendarEvent.mockRejectedValue({ status: 400, message: 'Data non valida' });
    const { result } = await montaConPeriodo();
    const info = trascinamento();

    lancia(() => result.current.handleDragOrResize(info, true));

    await waitFor(() => expect(info.revert).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.error).toBe('Data non valida'));
  });

  it('un evento senza fine manda fine nulla', async () => {
    const { result } = await montaConPeriodo();
    const info = trascinamento({ end: null });

    lancia(() => result.current.handleDragOrResize(info, true));

    await waitFor(() => expect(updateCalendarEvent).toHaveBeenCalledWith('e1', {
      startAt: '2026-08-06T10:00:00.000Z',
      endAt: null,
      allDay: false,
    }));
  });
});
