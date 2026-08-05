import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useCalendarBoard } from './board/hooks/useCalendarBoard';
import { CalendarPage } from './index';

// La pagina assembla l'hook radice e i cinque pezzi, e qui si verifica proprio
// l'assemblaggio: l'hook e' gia' coperto dal suo test e si finge.
vi.mock('./board/hooks/useCalendarBoard', () => ({
  useCalendarBoard: vi.fn(),
}));

// Il gate lascia passare e consegna i permessi, come fa quello vero quando
// l'utente ha il permesso di vedere il calendario. Nel progetto non c'era un
// precedente di test che finge un gate: i permessi arrivano come elenco di
// stringhe in `access.permissions`.
let permessiFinti = [];
vi.mock('../../modules/calendar/ui/CalendarModuleGate', () => ({
  default: ({ children }) => children({ access: { permissions: permessiFinti } }),
}));

// Il finto tiene da parte tutte le prop, gestori e riferimento compresi: e' cosi'
// che si verifica il cablaggio fino in fondo (vedi il test dei gestori).
let propsGriglia = null;
vi.mock('@fullcalendar/react', () => ({
  default: (props) => {
    propsGriglia = props;
    return (
      <div
        data-testid="griglia"
        data-eventi={props.events.length}
        data-modificabile={String(props.editable)}
        data-selezionabile={String(props.selectable)}
      />
    );
  },
}));
vi.mock('@fullcalendar/daygrid', () => ({ default: {} }));
vi.mock('@fullcalendar/timegrid', () => ({ default: {} }));
vi.mock('@fullcalendar/list', () => ({ default: {} }));
vi.mock('@fullcalendar/interaction', () => ({ default: {} }));

const evento = (overrides = {}) => ({
  id: 'e1',
  title: 'Riunione',
  start: '2026-08-05T10:00:00.000Z',
  end: '2026-08-05T11:00:00.000Z',
  category: 'Interno',
  location: 'Sala A',
  description: 'Punto settimanale',
  sourceType: 'custom',
  editable: true,
  backgroundColor: '#a1b2c3',
  textColor: '#ffffff',
  ...overrides,
});

const statoHook = (overrides = {}) => ({
  calendarRef: { current: null },
  dateLabel: 'August 2026',
  currentView: 'month',
  calendarHeight: 700,
  handleCalendarNavigation: vi.fn(),
  handleViewChange: vi.fn(),
  events: [evento()],
  filteredEvents: [evento()],
  upcomingEvents: [],
  loading: false,
  saving: false,
  error: '',
  sourceFilters: { custom: true, project_due: true, quote_issue_date: true, quote_valid_until: true },
  toggleSourceFilter: vi.fn(),
  selectedEvent: null,
  setSelectedEvent: vi.fn(),
  handleEventClick: vi.fn(),
  handleDeleteSelectedEvent: vi.fn(),
  handleDragOrResize: vi.fn(),
  formState: {
    title: '', description: '', location: '', category: '',
    color: '#0d6efd', allDay: false, startValue: '2026-08-05T10:00', endValue: '2026-08-05T11:00',
  },
  setFormPatch: vi.fn(),
  setAllDay: vi.fn(),
  eventModalOpen: false,
  eventModalMode: 'create',
  closeEventModal: vi.fn(),
  openCreateEventModal: vi.fn(),
  openEditEventModal: vi.fn(),
  handleEventSelect: vi.fn(),
  handleUpsertEvent: vi.fn(),
  handleDatesSet: vi.fn(),
  ...overrides,
});

const tuttiIPermessi = ['calendar.view', 'calendar.create', 'calendar.edit', 'calendar.delete'];

const montaPagina = (props = {}) => render(
  <MemoryRouter>
    <CalendarPage topNavCollapsed={false} toggleTopNav={vi.fn()} {...props} />
  </MemoryRouter>,
);

beforeEach(() => {
  vi.clearAllMocks();
  permessiFinti = tuttiIPermessi;
  useCalendarBoard.mockReturnValue(statoHook());
});

describe('CalendarPage', () => {
  it('mette in pagina i pezzi: filtri, barra e griglia', () => {
    montaPagina();

    expect(screen.getByRole('button', { name: 'Nuovo evento' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'August 2026' })).toBeInTheDocument();
    expect(screen.getByTestId('griglia')).toHaveAttribute('data-eventi', '1');
  });

  // Il collegamento piu' delicato di tutta la pagina. Se cadesse
  // `onDatesSet={board.handleDatesSet}`, la pagina si disegnerebbe uguale e
  // nessun altro test si accorgerebbe di niente — ma il calendario non
  // caricherebbe piu' un solo evento, e cambiando mese non se ne accorgerebbe
  // nessuno finche' non lo vede un utente.
  it('i gestori della griglia sono quelli dell hook, non altri', () => {
    const stato = statoHook();
    useCalendarBoard.mockReturnValue(stato);
    montaPagina();

    expect(propsGriglia.datesSet).toBe(stato.handleDatesSet);
    expect(propsGriglia.eventClick).toBe(stato.handleEventClick);
    expect(propsGriglia.ref).toBe(stato.calendarRef);

    // Questi due passano per una funzione che aggiunge il permesso, quindi si
    // controllano chiamandoli.
    propsGriglia.eventDrop({ event: { id: 'e1' }, revert: vi.fn() });
    propsGriglia.select({ start: new Date(2026, 7, 5), end: new Date(2026, 7, 6), allDay: true });

    expect(stato.handleDragOrResize).toHaveBeenCalledTimes(1);
    expect(stato.handleEventSelect).toHaveBeenCalledTimes(1);
  });

  it('la griglia riceve gli eventi FILTRATI, non quelli grezzi', () => {
    useCalendarBoard.mockReturnValue(statoHook({
      events: [evento(), evento({ id: 'e2' }), evento({ id: 'e3' })],
      filteredEvents: [evento()],
    }));
    montaPagina();

    expect(screen.getByTestId('griglia')).toHaveAttribute('data-eventi', '1');
  });

  // I tre permessi si calcolano qui dal gate: se si scollegassero, la pagina si
  // disegnerebbe uguale ma o si bloccherebbe chi puo' fare le cose, o si
  // lascerebbe fare a chi non puo'.
  it('con la sola lettura non si crea e non si trascina', () => {
    permessiFinti = ['calendar.view'];
    montaPagina();

    expect(screen.getByRole('button', { name: 'Nuovo evento' })).toBeDisabled();
    const griglia = screen.getByTestId('griglia');
    expect(griglia).toHaveAttribute('data-modificabile', 'false');
    expect(griglia).toHaveAttribute('data-selezionabile', 'false');
  });

  it('con tutti i permessi si crea e si trascina', () => {
    montaPagina();

    expect(screen.getByRole('button', { name: 'Nuovo evento' })).not.toBeDisabled();
    const griglia = screen.getByTestId('griglia');
    expect(griglia).toHaveAttribute('data-modificabile', 'true');
    expect(griglia).toHaveAttribute('data-selezionabile', 'true');
  });

  it('il riquadro del modulo compare solo quando e aperto', () => {
    const { unmount } = montaPagina();
    expect(screen.queryByLabelText('Titolo')).not.toBeInTheDocument();
    unmount();

    useCalendarBoard.mockReturnValue(statoHook({ eventModalOpen: true }));
    montaPagina();
    expect(screen.getByLabelText('Titolo')).toBeInTheDocument();
  });

  it('il dettaglio compare solo quando c e un evento aperto', () => {
    const { unmount } = montaPagina();
    expect(screen.queryByText('Sala A')).not.toBeInTheDocument();
    unmount();

    useCalendarBoard.mockReturnValue(statoHook({ selectedEvent: evento() }));
    montaPagina();
    expect(screen.getByText('Sala A')).toBeInTheDocument();
  });

  // Il passaggio "Modifica": si chiude il dettaglio e si apre il modulo. L'evento
  // arriva come argomento, quindi chiudere prima non puo' perderlo.
  it('Modifica chiude il dettaglio e apre il modulo su quell evento', () => {
    const stato = statoHook({ selectedEvent: evento() });
    useCalendarBoard.mockReturnValue(stato);
    montaPagina();

    screen.getByRole('button', { name: 'Modifica' }).click();

    expect(stato.setSelectedEvent).toHaveBeenCalledWith(null);
    expect(stato.openEditEventModal).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
  });

  it('l eliminazione dal dettaglio e collegata', () => {
    const stato = statoHook({ selectedEvent: evento() });
    useCalendarBoard.mockReturnValue(stato);
    montaPagina();

    screen.getByRole('button', { name: 'Elimina' }).click();

    expect(stato.handleDeleteSelectedEvent).toHaveBeenCalledTimes(1);
  });

  it('il tasto della barra di sistema e collegato allo stato Redux', () => {
    const toggleTopNav = vi.fn();
    const { container } = montaPagina({ topNavCollapsed: true, toggleTopNav });

    container.querySelector('.hk-navbar-togglable').click();

    expect(toggleTopNav).toHaveBeenCalledWith(false);
  });

  it('l errore e il caricamento arrivano dalla griglia', () => {
    useCalendarBoard.mockReturnValue(statoHook({ error: 'Non hai permessi', loading: true }));
    montaPagina();

    expect(screen.getByText('Non hai permessi')).toBeInTheDocument();
    expect(screen.getByText(/Caricamento calendario/)).toBeInTheDocument();
  });
});
