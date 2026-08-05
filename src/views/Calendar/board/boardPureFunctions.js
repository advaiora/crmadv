// Funzioni pure della pagina Calendario: costruzione dello stato iniziale del
// form evento, conversioni fra date e valori dei campi `date`/`datetime-local`,
// e traduzione degli errori del server in messaggi leggibili.
// Estratte da src/views/Calendar/index.jsx nel giro di spezzatura del 5/8/2026.
//
// Nessuna gestione di fusi orari: si usa sempre quello del browser, come prima.

import { DEFAULT_EVENT_COLOR } from './boardConstants';

// Valore per un campo `<input type="date">`: solo la data, ora scartata.
export const toLocalDateInput = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

// Valore per un campo `<input type="datetime-local">`: data e ora, senza fuso.
export const toLocalDateTimeInput = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Form di un evento nuovo: adesso, fino a un'ora dopo.
export const buildDefaultFormState = () => {
  const now = new Date();
  const plusHour = new Date(now.getTime() + 60 * 60 * 1000);

  return {
    title: '',
    description: '',
    location: '',
    category: '',
    color: DEFAULT_EVENT_COLOR,
    allDay: false,
    startValue: toLocalDateTimeInput(now),
    endValue: toLocalDateTimeInput(plusHour),
  };
};

export const normalizeHexColor = (value, fallback = DEFAULT_EVENT_COLOR) => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : fallback;
};

// I campi facoltativi vanno al server come `undefined` (cioe' assenti) quando
// sono vuoti, non come stringa vuota.
export const toOptionalTrimmedString = (value) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

// Dal valore del campo alla data ISO da mandare al server. Su un evento di
// intera giornata la fine e' l'ultimo istante del giorno scelto, cosi' un
// evento "solo oggi" copre tutta la giornata e non finisce a mezzanotte.
export const parseFormDateValue = (value, { allDay, isEnd = false }) => {
  if (!value) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  const parsed = allDay
    ? new Date(`${raw}${isEnd ? 'T23:59:59.999' : 'T00:00:00.000'}`)
    : new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Data non valida (${raw})`);
  }

  return parsed.toISOString();
};

// Spunta "Intera giornata": i due campi cambiano tipo, quindi il valore va
// riscritto nel formato del tipo nuovo. La fine vuota resta vuota.
export const applyAllDayToggle = (currentForm, checked) => ({
  ...currentForm,
  allDay: checked,
  startValue: checked
    ? toLocalDateInput(currentForm.startValue)
    : toLocalDateTimeInput(currentForm.startValue),
  endValue: currentForm.endValue
    ? (checked ? toLocalDateInput(currentForm.endValue) : toLocalDateTimeInput(currentForm.endValue))
    : '',
});

// Sul 400 si prova a tirare fuori il primo errore di validazione dello schema;
// se non c'e', si ripiega sul messaggio dell'errore.
export const mapApiError = (error, fallback = 'Operazione non riuscita') => {
  const status = error?.status;
  if (status === 403) {
    return 'Non hai permessi';
  }
  if (status === 404) {
    return 'Evento non trovato';
  }
  if (status === 409) {
    return 'Operazione non valida per lo stato attuale';
  }

  if (status === 400) {
    const issues = error?.details?.issues;
    const formErrors = Array.isArray(issues?.formErrors) ? issues.formErrors : [];
    const fieldErrors = issues?.fieldErrors && typeof issues.fieldErrors === 'object'
      ? Object.values(issues.fieldErrors).flat().filter(Boolean)
      : [];
    const firstValidationError = [...formErrors, ...fieldErrors][0];
    if (firstValidationError) {
      return String(firstValidationError);
    }
  }

  return error?.message || fallback;
};
