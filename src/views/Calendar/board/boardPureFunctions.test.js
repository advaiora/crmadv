import { describe, expect, it } from 'vitest';
import {
  applyAllDayToggle,
  buildDefaultFormState,
  mapApiError,
  normalizeHexColor,
  parseFormDateValue,
  toLocalDateInput,
  toLocalDateTimeInput,
  toOptionalTrimmedString,
} from './boardPureFunctions';
import { DEFAULT_EVENT_COLOR } from './boardConstants';

describe('toLocalDateInput', () => {
  it('tiene solo la data, senza ora', () => {
    expect(toLocalDateInput(new Date(2026, 7, 5, 14, 30))).toBe('2026-08-05');
  });

  it('mette lo zero davanti a mese e giorno a una cifra', () => {
    expect(toLocalDateInput(new Date(2026, 0, 9, 0, 0))).toBe('2026-01-09');
  });

  it('su valore assente o data non valida torna stringa vuota', () => {
    expect(toLocalDateInput(null)).toBe('');
    expect(toLocalDateInput('')).toBe('');
    expect(toLocalDateInput('non-una-data')).toBe('');
  });
});

describe('toLocalDateTimeInput', () => {
  it('tiene data e ora nel formato del campo datetime-local', () => {
    expect(toLocalDateTimeInput(new Date(2026, 7, 5, 9, 5))).toBe('2026-08-05T09:05');
  });

  it('su valore assente o data non valida torna stringa vuota', () => {
    expect(toLocalDateTimeInput(null)).toBe('');
    expect(toLocalDateTimeInput('non-una-data')).toBe('');
  });
});

describe('buildDefaultFormState', () => {
  it('parte vuoto, non intera giornata, col colore predefinito', () => {
    const form = buildDefaultFormState();

    expect(form.title).toBe('');
    expect(form.description).toBe('');
    expect(form.location).toBe('');
    expect(form.category).toBe('');
    expect(form.allDay).toBe(false);
    expect(form.color).toBe(DEFAULT_EVENT_COLOR);
  });

  it('la fine cade un ora dopo l inizio', () => {
    const form = buildDefaultFormState();

    const start = new Date(form.startValue).getTime();
    const end = new Date(form.endValue).getTime();

    // Il formato del campo taglia i secondi, quindi il confronto e' al minuto.
    expect(end - start).toBe(60 * 60 * 1000);
  });
});

describe('normalizeHexColor', () => {
  it('tiene un esadecimale a sei cifre', () => {
    expect(normalizeHexColor('#a1b2c3')).toBe('#a1b2c3');
    expect(normalizeHexColor('#A1B2C3')).toBe('#A1B2C3');
  });

  it('toglie gli spazi intorno', () => {
    expect(normalizeHexColor('  #a1b2c3  ')).toBe('#a1b2c3');
  });

  it('ripiega sul predefinito quando il valore non e un esadecimale a sei cifre', () => {
    expect(normalizeHexColor('#abc')).toBe(DEFAULT_EVENT_COLOR);
    expect(normalizeHexColor('rosso')).toBe(DEFAULT_EVENT_COLOR);
    expect(normalizeHexColor('')).toBe(DEFAULT_EVENT_COLOR);
    expect(normalizeHexColor(null)).toBe(DEFAULT_EVENT_COLOR);
    expect(normalizeHexColor(123)).toBe(DEFAULT_EVENT_COLOR);
  });

  it('usa il ripiego passato quando c e', () => {
    expect(normalizeHexColor('rosso', '#ffffff')).toBe('#ffffff');
  });
});

describe('toOptionalTrimmedString', () => {
  it('toglie gli spazi e tiene il testo', () => {
    expect(toOptionalTrimmedString('  ciao  ')).toBe('ciao');
  });

  it('torna undefined su vuoto, solo spazi o non stringa', () => {
    expect(toOptionalTrimmedString('')).toBeUndefined();
    expect(toOptionalTrimmedString('   ')).toBeUndefined();
    expect(toOptionalTrimmedString(null)).toBeUndefined();
    expect(toOptionalTrimmedString(42)).toBeUndefined();
  });
});

describe('parseFormDateValue', () => {
  it('su valore assente o vuoto torna null', () => {
    expect(parseFormDateValue('', { allDay: false })).toBeNull();
    expect(parseFormDateValue(null, { allDay: false })).toBeNull();
    expect(parseFormDateValue('   ', { allDay: false })).toBeNull();
  });

  it('converte un valore datetime-local in ISO', () => {
    const iso = parseFormDateValue('2026-08-05T10:30', { allDay: false });

    expect(new Date(iso).getTime()).toBe(new Date(2026, 7, 5, 10, 30).getTime());
  });

  it('su intera giornata l inizio e a mezzanotte', () => {
    const iso = parseFormDateValue('2026-08-05', { allDay: true });

    expect(new Date(iso).getTime()).toBe(new Date(2026, 7, 5, 0, 0, 0, 0).getTime());
  });

  it('su intera giornata la fine e l ultimo istante del giorno', () => {
    const iso = parseFormDateValue('2026-08-05', { allDay: true, isEnd: true });

    expect(new Date(iso).getTime()).toBe(new Date(2026, 7, 5, 23, 59, 59, 999).getTime());
  });

  it('su data non valida lancia un errore che riporta il valore', () => {
    expect(() => parseFormDateValue('non-una-data', { allDay: false }))
      .toThrow('Data non valida (non-una-data)');
  });
});

describe('applyAllDayToggle', () => {
  it('accendendo la spunta i due campi passano al formato solo data', () => {
    const next = applyAllDayToggle({
      title: 'Riunione',
      allDay: false,
      startValue: '2026-08-05T10:30',
      endValue: '2026-08-05T11:30',
    }, true);

    expect(next.allDay).toBe(true);
    expect(next.startValue).toBe('2026-08-05');
    expect(next.endValue).toBe('2026-08-05');
  });

  // Attenzione all'ora che esce: una data "nuda" ('2026-08-05') JavaScript la
  // legge come UTC, quindi in Italia diventa le 02:00 d'estate (01:00
  // d'inverno), non mezzanotte. E' il comportamento dell'originale, questo test
  // lo fotografa com'e'; il difetto e' annotato in roadmap.
  it('spegnendo la spunta i due campi tornano al formato con l ora', () => {
    const next = applyAllDayToggle({
      allDay: true,
      startValue: '2026-08-05',
      endValue: '2026-08-06',
    }, false);

    const oraDelFuso = new Date('2026-08-05').getHours();

    expect(next.allDay).toBe(false);
    expect(next.startValue).toBe(`2026-08-05T${String(oraDelFuso).padStart(2, '0')}:00`);
    expect(next.endValue).toBe(`2026-08-06T${String(oraDelFuso).padStart(2, '0')}:00`);
  });

  it('la fine vuota resta vuota, non diventa una data', () => {
    const acceso = applyAllDayToggle({ allDay: false, startValue: '2026-08-05T10:30', endValue: '' }, true);
    const spento = applyAllDayToggle({ allDay: true, startValue: '2026-08-05', endValue: '' }, false);

    expect(acceso.endValue).toBe('');
    expect(spento.endValue).toBe('');
  });

  it('lascia stare gli altri campi del form', () => {
    const next = applyAllDayToggle({
      title: 'Riunione',
      description: 'note',
      color: '#a1b2c3',
      allDay: false,
      startValue: '2026-08-05T10:30',
      endValue: '',
    }, true);

    expect(next.title).toBe('Riunione');
    expect(next.description).toBe('note');
    expect(next.color).toBe('#a1b2c3');
  });
});

describe('mapApiError', () => {
  it('traduce i tre stati con messaggio fisso', () => {
    expect(mapApiError({ status: 403 })).toBe('Non hai permessi');
    expect(mapApiError({ status: 404 })).toBe('Evento non trovato');
    expect(mapApiError({ status: 409 })).toBe('Operazione non valida per lo stato attuale');
  });

  it('sul 400 tira fuori il primo errore di forma', () => {
    const messaggio = mapApiError({
      status: 400,
      details: { issues: { formErrors: ['La fine precede l inizio'], fieldErrors: {} } },
    });

    expect(messaggio).toBe('La fine precede l inizio');
  });

  it('sul 400 senza errori di forma prende il primo errore di campo', () => {
    const messaggio = mapApiError({
      status: 400,
      details: { issues: { formErrors: [], fieldErrors: { title: ['Titolo obbligatorio'] } } },
    });

    expect(messaggio).toBe('Titolo obbligatorio');
  });

  it('sul 400 senza dettagli di validazione ripiega sul messaggio dell errore', () => {
    expect(mapApiError({ status: 400, message: 'Richiesta non valida' })).toBe('Richiesta non valida');
  });

  it('sul 400 con dettagli malformati non esplode e ripiega', () => {
    expect(mapApiError({ status: 400, details: { issues: 'rotto' }, message: 'Richiesta non valida' }))
      .toBe('Richiesta non valida');
  });

  it('senza stato ne messaggio usa il ripiego passato', () => {
    expect(mapApiError({}, 'Operazione fallita')).toBe('Operazione fallita');
    expect(mapApiError(null, 'Operazione fallita')).toBe('Operazione fallita');
  });

  it('senza ripiego passato usa quello predefinito', () => {
    expect(mapApiError(null)).toBe('Operazione non riuscita');
  });
});
