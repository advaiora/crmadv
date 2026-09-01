// Logica pura della bozza di un campo personalizzato: i sei tipi, il formato
// testuale delle opzioni, l'anteprima della chiave e la costruzione del payload.
// Vive fuori dai componenti perche' la usano sia la pagina «Campi personalizzati»
// sia l'ingresso dentro il percorso di registrazione di un cliente nuovo.

export const FIELD_TYPE_OPTIONS = [
  { value: 'text', label: 'Testo breve' },
  { value: 'textarea', label: 'Testo lungo' },
  { value: 'number', label: 'Numero' },
  { value: 'date', label: 'Data' },
  { value: 'boolean', label: 'Sì / No' },
  { value: 'select', label: 'Elenco a tendina' },
];

export const FIELD_TYPE_LABELS = Object.fromEntries(
  FIELD_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

// Trasforma le opzioni [{value,label}] in testo "una per riga" (value | label).
export const optionsToText = (options) =>
  (Array.isArray(options) ? options : [])
    .map((option) => (option.label && option.label !== option.value ? `${option.value} | ${option.label}` : option.value))
    .join('\n');

// Parsa il testo "una per riga" in [{value,label}].
export const textToOptions = (text) =>
  String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [value, ...rest] = line.split('|');
      const cleanValue = value.trim();
      const label = rest.join('|').trim();
      return { value: cleanValue, label: label || cleanValue };
    })
    .filter((option) => option.value);

export const createEmptyDraft = () => ({
  id: null,
  label: '',
  key: '',
  type: 'text',
  required: false,
  active: true,
  optionsText: '',
});

// Bozza a partire da una definizione gia' salvata (apertura in modifica).
export const fieldToDraft = (field) => {
  if (!field) {
    return createEmptyDraft();
  }

  return {
    id: field.id,
    label: field.label || '',
    key: field.key || '',
    type: field.type || 'text',
    required: Boolean(field.required),
    active: field.active !== false,
    optionsText: optionsToText(field.options),
  };
};

export const isEditingDraft = (draft) => Boolean(draft?.id);

// Anteprima dello slug generato dall'etichetta (indicativa; il server e' la fonte di verita').
export const previewKeyFromDraft = (draft) => {
  if (isEditingDraft(draft) || draft?.key) {
    return draft?.key || '';
  }

  return String(draft?.label || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

// Costruisce il corpo della richiesta, oppure spiega perche' non si puo'.
// La chiave si invia solo in creazione: in modifica e' immutabile.
export const buildCustomFieldPayload = (draft) => {
  const label = String(draft?.label || '').trim();
  if (!label) {
    return { ok: false, error: 'Etichetta obbligatoria' };
  }

  const payload = {
    label,
    type: draft?.type || 'text',
    required: Boolean(draft?.required),
    active: Boolean(draft?.active),
  };

  if (payload.type === 'select') {
    const options = textToOptions(draft?.optionsText);
    if (options.length === 0) {
      return { ok: false, error: "Un elenco a tendina richiede almeno un'opzione" };
    }
    payload.options = options;
  }

  const key = String(draft?.key || '').trim();
  if (!isEditingDraft(draft) && key) {
    payload.key = key;
  }

  return { ok: true, payload };
};
