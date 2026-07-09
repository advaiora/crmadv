import { badRequest, conflict, notFound } from '../../core/errors.js';
import { customFieldsRepository } from './custom-fields.repository.js';

// Entità che possono avere campi personalizzati. Per ora solo i clienti; la
// struttura è già pronta ad accoglierne altre in futuro.
export const CUSTOM_FIELD_ENTITIES = ['client'] as const;
export type CustomFieldEntity = (typeof CUSTOM_FIELD_ENTITIES)[number];

const FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'boolean', 'select'] as const;
type FieldType = (typeof FIELD_TYPES)[number];

const MAX_LABEL_LENGTH = 120;
const MAX_KEY_LENGTH = 60;
const MAX_OPTIONS = 100;
const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeEntity = (value: unknown): CustomFieldEntity => {
  if (value === undefined || value === null || value === '') {
    return 'client';
  }
  if (typeof value !== 'string' || !CUSTOM_FIELD_ENTITIES.includes(value as CustomFieldEntity)) {
    throw badRequest('Entità campo personalizzato non valida', { allowed: CUSTOM_FIELD_ENTITIES });
  }
  return value as CustomFieldEntity;
};

const normalizeLabel = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest('Etichetta del campo obbligatoria');
  }
  const label = value.trim();
  if (label.length > MAX_LABEL_LENGTH) {
    throw badRequest('Etichetta troppo lunga', { maxLength: MAX_LABEL_LENGTH });
  }
  return label;
};

// Genera uno slug tecnico valido a partire da un'etichetta (minuscole, underscore).
const slugifyKey = (label: string): string =>
  label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_')
    .slice(0, MAX_KEY_LENGTH) || 'campo';

const normalizeKeyInput = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest('Chiave del campo obbligatoria');
  }
  const key = value.trim().toLowerCase();
  if (key.length > MAX_KEY_LENGTH) {
    throw badRequest('Chiave troppo lunga', { maxLength: MAX_KEY_LENGTH });
  }
  if (!KEY_PATTERN.test(key)) {
    throw badRequest('Chiave non valida: usa lettere minuscole, numeri e underscore, iniziando con una lettera');
  }
  return key;
};

const normalizeType = (value: unknown): FieldType => {
  if (value === undefined || value === null) {
    return 'text';
  }
  if (typeof value !== 'string' || !FIELD_TYPES.includes(value as FieldType)) {
    throw badRequest('Tipo di campo non valido', { allowed: FIELD_TYPES });
  }
  return value as FieldType;
};

// Per i campi "select" valida/normalizza le opzioni: array di { value, label }.
const normalizeOptions = (type: FieldType, rawOptions: unknown): { value: string; label: string }[] | null => {
  if (type !== 'select') {
    return null;
  }
  if (!Array.isArray(rawOptions) || rawOptions.length === 0) {
    throw badRequest('Un campo a tendina richiede almeno un\'opzione');
  }
  if (rawOptions.length > MAX_OPTIONS) {
    throw badRequest('Troppe opzioni', { max: MAX_OPTIONS });
  }
  const seen = new Set<string>();
  const options = rawOptions.map((entry) => {
    // Accetta sia stringhe semplici sia oggetti { value, label }.
    const value = typeof entry === 'string' ? entry.trim() : isObject(entry) ? String(entry.value ?? '').trim() : '';
    const label = isObject(entry) && entry.label !== undefined ? String(entry.label).trim() : value;
    if (!value) {
      throw badRequest('Ogni opzione deve avere un valore');
    }
    if (seen.has(value)) {
      throw badRequest('Opzioni duplicate', { value });
    }
    seen.add(value);
    return { value, label: label || value };
  });
  return options;
};

const MAX_TEXT_VALUE = 500;
const MAX_TEXTAREA_VALUE = 4000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Normalizza/valida un singolo valore in base al tipo del campo. Ritorna null se
// il valore è "vuoto" (da non salvare); lancia badRequest se non valido.
const normalizeValueForType = (
  definition: { key: string; label: string; type: string; options: unknown },
  raw: unknown,
): string | number | boolean | null => {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }

  switch (definition.type) {
    case 'text':
    case 'textarea': {
      if (typeof raw !== 'string') {
        throw badRequest(`"${definition.label}" deve essere testo`);
      }
      const value = raw.trim();
      if (!value) {
        return null;
      }
      const max = definition.type === 'textarea' ? MAX_TEXTAREA_VALUE : MAX_TEXT_VALUE;
      if (value.length > max) {
        throw badRequest(`"${definition.label}" è troppo lungo`, { maxLength: max });
      }
      return value;
    }
    case 'number': {
      const value = typeof raw === 'number' ? raw : Number(String(raw).trim());
      if (!Number.isFinite(value)) {
        throw badRequest(`"${definition.label}" deve essere un numero`);
      }
      return value;
    }
    case 'boolean': {
      if (typeof raw === 'boolean') {
        return raw;
      }
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      throw badRequest(`"${definition.label}" deve essere vero o falso`);
    }
    case 'date': {
      const value = String(raw).trim();
      if (!DATE_PATTERN.test(value) || Number.isNaN(new Date(value).getTime())) {
        throw badRequest(`"${definition.label}" deve essere una data valida (AAAA-MM-GG)`);
      }
      return value;
    }
    case 'select': {
      const options = Array.isArray(definition.options) ? definition.options : [];
      const allowed = new Set(
        options.map((option) => (isObject(option) ? String(option.value) : String(option))),
      );
      const value = String(raw).trim();
      if (!allowed.has(value)) {
        throw badRequest(`"${definition.label}": opzione non valida`, { value });
      }
      return value;
    }
    default:
      return null;
  }
};

const serializeDefinition = (definition: {
  id: string;
  entity: string;
  key: string;
  label: string;
  type: string;
  options: unknown;
  required: boolean;
  order: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: definition.id,
  entity: definition.entity,
  key: definition.key,
  label: definition.label,
  type: definition.type,
  options: Array.isArray(definition.options) ? definition.options : [],
  required: definition.required,
  order: definition.order,
  active: definition.active,
  createdAt: definition.createdAt,
  updatedAt: definition.updatedAt,
});

// Forma minima di una definizione necessaria per validare un valore.
type FieldDefinitionForValidation = {
  key: string;
  label: string;
  type: string;
  options: unknown;
  required: boolean;
};

export const customFieldsService = {
  parseEntityQuery: normalizeEntity,

  async listDefinitions(workspaceId: string, entityInput: unknown) {
    const entity = normalizeEntity(entityInput);
    const definitions = await customFieldsRepository.list(workspaceId, entity);
    return definitions.map(serializeDefinition);
  },

  // Restituisce le definizioni ATTIVE di un'entità. Utile per validare molti
  // record (es. import CSV) recuperando le definizioni una sola volta.
  async listActiveDefinitions(workspaceId: string, entityInput: unknown) {
    const entity = normalizeEntity(entityInput);
    return customFieldsRepository.listActive(workspaceId, entity);
  },

  // Variante pura di validateValues: valida una mappa { chiave: valore } contro
  // un elenco di definizioni GIÀ recuperato (nessun accesso al DB). Usata per
  // l'import CSV, dove le definizioni si leggono una volta sola.
  validateValuesWithDefinitions(
    definitions: readonly FieldDefinitionForValidation[],
    rawValues: unknown,
    options?: { enforceRequired?: boolean },
  ): Record<string, string | number | boolean> {
    const values = rawValues === undefined || rawValues === null ? {} : rawValues;
    if (!isObject(values)) {
      throw badRequest('customFields deve essere un oggetto');
    }

    const result: Record<string, string | number | boolean> = {};

    for (const definition of definitions) {
      const normalized = normalizeValueForType(definition, values[definition.key]);
      if (normalized === null) {
        if (options?.enforceRequired && definition.required) {
          throw badRequest(`Il campo "${definition.label}" è obbligatorio`);
        }
        continue;
      }
      result[definition.key] = normalized;
    }

    return result;
  },

  // Valida e normalizza una mappa di valori { chiave: valore } contro le
  // definizioni ATTIVE dell'entità. Ritorna solo i valori validi e non vuoti;
  // le chiavi sconosciute (campi rimossi) vengono ignorate. Con enforceRequired
  // i campi obbligatori vuoti generano un errore.
  async validateValues(
    workspaceId: string,
    entityInput: unknown,
    rawValues: unknown,
    options?: { enforceRequired?: boolean },
  ): Promise<Record<string, string | number | boolean>> {
    const definitions = await this.listActiveDefinitions(workspaceId, entityInput);
    return this.validateValuesWithDefinitions(definitions, rawValues, options);
  },

  async createDefinition(workspaceId: string, body: unknown) {
    if (!isObject(body)) {
      throw badRequest('Body must be a JSON object');
    }

    const entity = normalizeEntity(body.entity);
    const label = normalizeLabel(body.label);
    const type = normalizeType(body.type);
    const options = normalizeOptions(type, body.options);
    const required = body.required === true;

    // Chiave: usa quella fornita oppure genera dallo slug dell'etichetta.
    const key = body.key !== undefined && body.key !== null && body.key !== ''
      ? normalizeKeyInput(body.key)
      : slugifyKey(label);

    const existing = await customFieldsRepository.findByKey(workspaceId, entity, key);
    if (existing) {
      throw conflict('Esiste già un campo con questa chiave', { key });
    }

    const order = await customFieldsRepository.nextOrder(workspaceId, entity);

    const created = await customFieldsRepository.create({
      workspaceId,
      entity,
      key,
      label,
      type,
      options: options ?? undefined,
      required,
      order,
      active: body.active === undefined ? true : body.active === true,
    });

    return serializeDefinition(created);
  },

  async updateDefinition(workspaceId: string, id: string, body: unknown) {
    if (!isObject(body)) {
      throw badRequest('Body must be a JSON object');
    }

    const existing = await customFieldsRepository.findById(workspaceId, id);
    if (!existing) {
      throw notFound('Campo personalizzato non trovato');
    }

    // La chiave è immutabile dopo la creazione (i valori salvati sono mappati per
    // chiave: cambiarla li orfanerebbe). Modificabili: etichetta, tipo, opzioni,
    // obbligatorietà, stato attivo.
    const data: Record<string, unknown> = {};

    if (body.label !== undefined) {
      data.label = normalizeLabel(body.label);
    }

    const nextType = body.type !== undefined ? normalizeType(body.type) : (existing.type as FieldType);
    if (body.type !== undefined) {
      data.type = nextType;
    }

    if (body.type !== undefined || body.options !== undefined) {
      const options = normalizeOptions(nextType, body.options !== undefined ? body.options : existing.options);
      data.options = options ?? null;
    }

    if (body.required !== undefined) {
      data.required = body.required === true;
    }

    if (body.active !== undefined) {
      data.active = body.active === true;
    }

    if (Object.keys(data).length === 0) {
      throw badRequest('Nothing to update');
    }

    const updated = await customFieldsRepository.update(id, data);
    return serializeDefinition(updated);
  },

  async deleteDefinition(workspaceId: string, id: string) {
    const existing = await customFieldsRepository.findById(workspaceId, id);
    if (!existing) {
      throw notFound('Campo personalizzato non trovato');
    }
    await customFieldsRepository.delete(id);
  },

  // Riordina i campi di un'entità secondo l'elenco di id fornito.
  async reorderDefinitions(workspaceId: string, body: unknown) {
    if (!isObject(body) || !Array.isArray(body.ids)) {
      throw badRequest('ids deve essere un array di identificativi');
    }
    const entity = normalizeEntity(body.entity);
    const ids = body.ids.map((value) => {
      if (typeof value !== 'string' || !value.trim()) {
        throw badRequest('ids deve contenere solo stringhe');
      }
      return value;
    });

    // Verifica che tutti gli id appartengano al workspace/entità.
    const current = await customFieldsRepository.list(workspaceId, entity);
    const currentIds = new Set(current.map((definition) => definition.id));
    if (ids.length !== current.length || ids.some((id) => !currentIds.has(id))) {
      throw badRequest('L\'elenco degli id non corrisponde ai campi esistenti');
    }

    await customFieldsRepository.reorder(ids);
    return this.listDefinitions(workspaceId, entity);
  },
};
