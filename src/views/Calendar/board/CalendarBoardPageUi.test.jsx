import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CalendarFiltersPanel from './CalendarFiltersPanel';
import CalendarToolbar from './CalendarToolbar';
import CalendarGrid from './CalendarGrid';
import CalendarEventFormModal from './CalendarEventFormModal';
import CalendarEventDetailsModal from './CalendarEventDetailsModal';

// FullCalendar si finge: montarlo davvero renderebbe il test lento e fragile.
//
// Il finto tiene da parte TUTTE le prop che riceve, gestori e riferimento
// compresi. Un finto che guardasse solo i dati lascerebbe passare in silenzio
// il guasto peggiore: un gestore scollegato (per esempio `datesSet`) non fa
// fallire niente, ma il calendario smette di caricare gli eventi.
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
        data-altezza={props.height}
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

const filtriTuttiAccesi = {
  custom: true,
  project_due: true,
  quote_issue_date: true,
  quote_valid_until: true,
};

describe('CalendarFiltersPanel', () => {
  const disegna = (props = {}) => render(
    <CalendarFiltersPanel
      canCreate
      onCreateEvent={vi.fn()}
      sourceFilters={filtriTuttiAccesi}
      onToggleSourceFilter={vi.fn()}
      upcomingEvents={[]}
      onSelectEvent={vi.fn()}
      {...props}
    />,
  );

  it('mostra le quattro sorgenti, tutte accese', () => {
    disegna();

    expect(screen.getByLabelText('Eventi custom')).toBeChecked();
    expect(screen.getByLabelText('Scadenze progetti')).toBeChecked();
    expect(screen.getByLabelText('Emissione preventivi')).toBeChecked();
    expect(screen.getByLabelText('Scadenza preventivi')).toBeChecked();
  });

  it('spegnendo una sorgente lo dice a chi la gestisce', () => {
    const onToggleSourceFilter = vi.fn();
    disegna({ onToggleSourceFilter });

    fireEvent.click(screen.getByLabelText('Scadenze progetti'));

    expect(onToggleSourceFilter).toHaveBeenCalledWith('project_due', false);
  });

  it('senza permesso di creare il tasto e spento', () => {
    disegna({ canCreate: false });

    expect(screen.getByRole('button', { name: 'Nuovo evento' })).toBeDisabled();
  });

  it('senza eventi imminenti lo dice', () => {
    disegna();

    expect(screen.getByText('Nessun evento imminente')).toBeInTheDocument();
  });

  it('cliccando un evento imminente lo apre', () => {
    const onSelectEvent = vi.fn();
    const imminente = evento();
    disegna({ upcomingEvents: [imminente], onSelectEvent });

    screen.getByText('Riunione').closest('.list-group-item').click();

    expect(onSelectEvent).toHaveBeenCalledWith(imminente);
  });
});

describe('CalendarToolbar', () => {
  const disegna = (props = {}) => render(
    <CalendarToolbar
      dateLabel="August 2026"
      currentView="month"
      onNavigate={vi.fn()}
      onViewChange={vi.fn()}
      topNavCollapsed={false}
      onToggleTopNav={vi.fn()}
      {...props}
    />,
  );

  it('mostra il periodo che si sta guardando', () => {
    disegna();

    expect(screen.getByRole('heading', { name: 'August 2026' })).toBeInTheDocument();
  });

  it('i tre comandi di navigazione mandano la loro azione', () => {
    const onNavigate = vi.fn();
    const { container } = disegna({ onNavigate });

    screen.getByRole('button', { name: 'Today' }).click();
    const [, precedente, successivo] = container.querySelectorAll('button');
    precedente.click();
    successivo.click();

    expect(onNavigate.mock.calls.map(([azione]) => azione)).toEqual(['today', 'prev', 'next']);
  });

  it('le quattro viste sono collegate e quella in uso e evidenziata', () => {
    const onViewChange = vi.fn();
    disegna({ currentView: 'week', onViewChange });

    expect(screen.getByRole('button', { name: 'Week' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Month' })).not.toHaveClass('active');

    screen.getByRole('button', { name: 'List' }).click();

    expect(onViewChange).toHaveBeenCalledWith('list');
  });

  it('il tasto della barra di sistema ne rovescia lo stato', () => {
    const onToggleTopNav = vi.fn();
    const { container } = disegna({ topNavCollapsed: true, onToggleTopNav });

    container.querySelector('.hk-navbar-togglable').click();

    expect(onToggleTopNav).toHaveBeenCalledWith(false);
  });
});

describe('CalendarGrid', () => {
  const disegna = (props = {}) => render(
    <CalendarGrid
      error=""
      loading={false}
      calendarRef={{ current: null }}
      calendarHeight={700}
      events={[evento()]}
      canCreate
      canEdit
      onDatesSet={vi.fn()}
      onSelectRange={vi.fn()}
      onEventClick={vi.fn()}
      onDragOrResize={vi.fn()}
      {...props}
    />,
  );

  it('passa alla griglia eventi, permessi e altezza', () => {
    disegna();

    const griglia = screen.getByTestId('griglia');
    expect(griglia).toHaveAttribute('data-eventi', '1');
    expect(griglia).toHaveAttribute('data-modificabile', 'true');
    expect(griglia).toHaveAttribute('data-selezionabile', 'true');
    expect(griglia).toHaveAttribute('data-altezza', '700');
  });

  // Il riferimento e' quello con cui la barra in alto comanda il calendario:
  // se non arrivasse, Today, precedente, successivo e le quattro viste
  // smetterebbero di fare qualsiasi cosa, senza un errore.
  it('il riferimento al calendario arriva alla griglia', () => {
    const calendarRef = { current: null };
    disegna({ calendarRef });

    expect(propsGriglia.ref).toBe(calendarRef);
  });

  it('i cinque gestori sono collegati e chiamano il loro', () => {
    const onDatesSet = vi.fn();
    const onEventClick = vi.fn();
    const onDragOrResize = vi.fn();
    const onSelectRange = vi.fn();
    disegna({ onDatesSet, onEventClick, onDragOrResize, onSelectRange });

    propsGriglia.datesSet({ start: new Date(2026, 7, 1), end: new Date(2026, 7, 31) });
    propsGriglia.eventClick({ event: { id: 'e1' } });
    propsGriglia.eventDrop({ event: { id: 'e1' }, revert: vi.fn() });
    propsGriglia.eventResize({ event: { id: 'e1' }, revert: vi.fn() });
    propsGriglia.select({ start: new Date(2026, 7, 5), end: new Date(2026, 7, 6), allDay: true });

    expect(onDatesSet).toHaveBeenCalledTimes(1);
    expect(onEventClick).toHaveBeenCalledTimes(1);
    // Trascinamento e ridimensionamento passano tutti e due di qui.
    expect(onDragOrResize).toHaveBeenCalledTimes(2);
    expect(onSelectRange).toHaveBeenCalledTimes(1);
  });

  // I due gestori che ricevono anche il permesso: se lo perdessero, si
  // potrebbe spostare un evento (o crearne uno) senza averne il diritto.
  it('trascinamento e selezione ricevono il permesso insieme all evento', () => {
    const onDragOrResize = vi.fn();
    const onSelectRange = vi.fn();
    disegna({ onDragOrResize, onSelectRange, canEdit: false, canCreate: false });

    propsGriglia.eventDrop({ event: { id: 'e1' }, revert: vi.fn() });
    propsGriglia.select({ start: new Date(2026, 7, 5), end: new Date(2026, 7, 6), allDay: true });

    expect(onDragOrResize.mock.calls[0][1]).toBe(false);
    expect(onSelectRange.mock.calls[0][1]).toBe(false);
  });

  // Sotto una certa altezza la griglia diventa illeggibile: c'e' un minimo.
  it('sotto il minimo l altezza non scende', () => {
    disegna({ calendarHeight: 120 });

    expect(screen.getByTestId('griglia')).toHaveAttribute('data-altezza', '520');
  });

  it('senza permessi la griglia non e ne modificabile ne selezionabile', () => {
    disegna({ canCreate: false, canEdit: false });

    const griglia = screen.getByTestId('griglia');
    expect(griglia).toHaveAttribute('data-modificabile', 'false');
    expect(griglia).toHaveAttribute('data-selezionabile', 'false');
  });

  it('mostra errore e caricamento quando ci sono', () => {
    disegna({ error: 'Non hai permessi', loading: true });

    expect(screen.getByText('Non hai permessi')).toBeInTheDocument();
    expect(screen.getByText(/Caricamento calendario/)).toBeInTheDocument();
  });

  it('senza errori e senza caricamento non mostra ne l uno ne l altro', () => {
    disegna();

    expect(screen.queryByText(/Caricamento calendario/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('CalendarEventFormModal', () => {
  const formVuoto = {
    title: '',
    description: '',
    location: '',
    category: '',
    color: '#0d6efd',
    allDay: false,
    startValue: '2026-08-05T10:00',
    endValue: '2026-08-05T11:00',
  };

  const disegna = (props = {}) => render(
    <CalendarEventFormModal
      open
      mode="create"
      formState={formVuoto}
      onPatch={vi.fn()}
      onAllDayChange={vi.fn()}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
      saving={false}
      {...props}
    />,
  );

  it('il titolo in cima dice se si crea o si modifica', () => {
    const { unmount } = disegna();
    expect(screen.getByText('Nuovo evento')).toBeInTheDocument();
    unmount();

    disegna({ mode: 'edit' });
    expect(screen.getByText('Modifica evento')).toBeInTheDocument();
  });

  // Dimostra il collegamento etichetta-campo: se una `Form.Group` perdesse il
  // suo `controlId`, l'etichetta smetterebbe di puntare al campo e questo test
  // fallirebbe. E' il guardrail del debito di accessibilita' censito in roadmap.
  it('tutti i campi si raggiungono dalla loro etichetta', () => {
    disegna();

    ['Titolo', 'Inizio', 'Fine', 'Categoria', 'Luogo', 'Descrizione', 'Colore'].forEach((etichetta) => {
      expect(screen.getByLabelText(etichetta)).toBeInTheDocument();
    });
  });

  it('scrivere nel titolo arriva a chi tiene il modulo', () => {
    const onPatch = vi.fn();
    disegna({ onPatch });

    fireEvent.change(screen.getByLabelText('Titolo'), { target: { value: 'Riunione' } });

    expect(onPatch).toHaveBeenCalledWith({ title: 'Riunione' });
  });

  // I due campi cambiano TIPO con la spunta: e' la ragione per cui accenderla
  // non e' una modifica come le altre.
  it('con intera giornata i due campi diventano di sola data', () => {
    disegna({ formState: { ...formVuoto, allDay: true, startValue: '2026-08-05', endValue: '2026-08-05' } });

    expect(screen.getByLabelText('Inizio')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Fine')).toHaveAttribute('type', 'date');
  });

  it('senza intera giornata i due campi portano anche l ora', () => {
    disegna();

    expect(screen.getByLabelText('Inizio')).toHaveAttribute('type', 'datetime-local');
    expect(screen.getByLabelText('Fine')).toHaveAttribute('type', 'datetime-local');
  });

  it('la spunta passa dalla sua funzione, non da una modifica qualunque', () => {
    const onAllDayChange = vi.fn();
    const onPatch = vi.fn();
    disegna({ onAllDayChange, onPatch });

    fireEvent.click(screen.getByLabelText('Intera giornata'));

    expect(onAllDayChange).toHaveBeenCalledWith(true);
    expect(onPatch).not.toHaveBeenCalled();
  });

  it('mentre salva i due tasti sono spenti e il testo cambia', () => {
    disegna({ saving: true });

    expect(screen.getByRole('button', { name: 'Salvataggio...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Annulla' })).toBeDisabled();
  });

  it('salva e annulla sono collegati', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    disegna({ onSubmit, onClose });

    screen.getByRole('button', { name: 'Salva' }).click();
    screen.getByRole('button', { name: 'Annulla' }).click();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('CalendarEventDetailsModal', () => {
  const disegna = (props = {}) => render(
    <MemoryRouter>
      <CalendarEventDetailsModal
        event={evento()}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        canEdit
        canDelete
        saving={false}
        {...props}
      />
    </MemoryRouter>,
  );

  it('senza evento non disegna niente', () => {
    const { container } = render(
      <MemoryRouter>
        <CalendarEventDetailsModal event={null} onClose={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('mostra titolo, sorgente e i campi dell evento', () => {
    disegna();

    expect(screen.getByText('Riunione')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
    expect(screen.getByText('Interno')).toBeInTheDocument();
    expect(screen.getByText('Sala A')).toBeInTheDocument();
  });

  it('i campi vuoti si vedono come trattino, non spariscono', () => {
    disegna({ event: evento({ location: '', description: '', end: null, category: '' }) });

    expect(screen.getAllByText('-')).toHaveLength(3);
    // Senza categoria il distintivo dice "Generale".
    expect(screen.getByText('Generale')).toBeInTheDocument();
  });

  it('un evento derivato porta l etichetta della sua sorgente', () => {
    disegna({ event: evento({ sourceType: 'project_due' }) });

    expect(screen.getByText('Progetto')).toBeInTheDocument();
  });

  it('modifica ed elimina compaiono solo con i permessi', () => {
    const { unmount } = disegna({ canEdit: false, canDelete: false });
    expect(screen.queryByRole('button', { name: 'Modifica' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Elimina' })).not.toBeInTheDocument();
    unmount();

    disegna();
    expect(screen.getByRole('button', { name: 'Modifica' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elimina' })).toBeInTheDocument();
  });

  // Gli eventi derivati da progetti e preventivi non si toccano, qualunque
  // permesso si abbia.
  it('su un evento non modificabile i due comandi non ci sono comunque', () => {
    disegna({ event: evento({ editable: false }), canEdit: true, canDelete: true });

    expect(screen.queryByRole('button', { name: 'Modifica' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Elimina' })).not.toBeInTheDocument();
  });

  it('Modifica passa l evento a chi deve aprirlo', () => {
    const onEdit = vi.fn();
    const aperto = evento();
    disegna({ event: aperto, onEdit });

    screen.getByRole('button', { name: 'Modifica' }).click();

    expect(onEdit).toHaveBeenCalledWith(aperto);
  });

  it('mentre elimina il tasto e spento e il testo cambia', () => {
    disegna({ saving: true });

    expect(screen.getByRole('button', { name: 'Eliminazione...' })).toBeDisabled();
  });

  it('il collegamento c e solo se l evento ne ha uno', () => {
    const { unmount } = disegna();
    expect(screen.queryByRole('link', { name: 'Apri dettaglio' })).not.toBeInTheDocument();
    unmount();

    disegna({ event: evento({ url: '/projects/p1' }) });
    expect(screen.getByRole('link', { name: 'Apri dettaglio' })).toHaveAttribute('href', '/projects/p1');
  });
});
