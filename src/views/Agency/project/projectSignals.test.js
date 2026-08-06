import { describe, expect, it } from 'vitest';
import { EMPTY_SIGNAL_LABEL, SIGNAL_TONE, buildSectionSignals, describeSignal } from './projectSignals';

// I pallini dicono all'utente che c'e' qualcosa che lo aspetta senza entrare nella
// scheda. Il rischio da presidiare e' che restino accesi su roba gia' chiusa: un
// pallino sempre acceso smette di significare qualcosa e si impara a ignorarlo.

const contesto = {
  alerts: [
    { id: 'a1', severity: 'critical', status: 'open' },
    { id: 'a2', severity: 'medium', status: 'todo' },
    { id: 'a3', severity: 'high', status: 'resolved' },
  ],
  tasks: [
    { id: 't1', priority: 'high', status: 'todo' },
    { id: 't2', priority: 'low', status: 'todo' },
    { id: 't3', priority: 'critical', status: 'done' },
  ],
  opportunities: [
    { id: 'o1', priority: 'high', status: 'open' },
    { id: 'o2', priority: 'low', status: 'rejected' },
  ],
};

describe('buildSectionSignals', () => {
  it('conta solo quello che e\' ancora aperto', () => {
    expect(buildSectionSignals(contesto)).toEqual({ alerts: 2, tasks: 1, opportunities: 1 });
  });

  it('sui task conta solo quelli importanti', () => {
    // Contarli tutti terrebbe il pallino sempre acceso, e smetterebbe di dire nulla.
    const soloMinori = { tasks: [{ priority: 'low', status: 'todo' }, { priority: 'medium', status: 'todo' }] };
    expect(buildSectionSignals(soloMinori).tasks).toBe(0);
  });

  it('non si fa ingannare dalle maiuscole', () => {
    const misto = {
      alerts: [{ status: 'RESOLVED' }],
      tasks: [{ priority: 'HIGH', status: 'Todo' }],
    };
    expect(buildSectionSignals(misto).alerts).toBe(0);
    expect(buildSectionSignals(misto).tasks).toBe(1);
  });

  it('senza contesto non accende niente', () => {
    // E' il caso normale al primo disegno, prima che il server risponda: nessun
    // pallino, non tre pallini spenti a caso.
    expect(buildSectionSignals(null)).toEqual({ alerts: 0, tasks: 0, opportunities: 0 });
    expect(buildSectionSignals({})).toEqual({ alerts: 0, tasks: 0, opportunities: 0 });
  });

  it('regge liste malformate', () => {
    expect(buildSectionSignals({ alerts: 'non una lista', tasks: null }).alerts).toBe(0);
  });
});

describe('colori dei pallini', () => {
  it('uno per voce, fisso', () => {
    // Il colore dice di che tipo di segnale si tratta, non quanto e' grave.
    expect(SIGNAL_TONE).toEqual({ alerts: 'danger', tasks: 'warning', opportunities: 'success' });
  });
});

describe('describeSignal', () => {
  it('dice a parole quello che il pallino dice col colore', () => {
    expect(describeSignal('alerts', 3)).toBe('3 segnalazioni da risolvere');
    expect(describeSignal('tasks', 2)).toBe('2 task importanti da chiudere');
    expect(describeSignal('opportunities', 5)).toBe('5 opportunita da valutare');
  });

  it('usa il singolare quando ce n\'e\' uno solo', () => {
    expect(describeSignal('alerts', 1)).toBe('1 segnalazione da risolvere');
    expect(describeSignal('tasks', 1)).toBe('1 task importante da chiudere');
  });

  it('senza segnali non dice niente', () => {
    expect(describeSignal('alerts', 0)).toBe('');
  });
});

describe('EMPTY_SIGNAL_LABEL', () => {
  it('spiega il pallino spento per tutte e tre le voci', () => {
    // E' il testo che compare passando il mouse quando non c'e' niente: senza,
    // il pallino spento sarebbe un puntino grigio senza spiegazione.
    expect(Object.keys(EMPTY_SIGNAL_LABEL).sort()).toEqual(['alerts', 'opportunities', 'tasks']);
    Object.values(EMPTY_SIGNAL_LABEL).forEach((testo) => expect(testo.length).toBeGreaterThan(0));
  });
});
