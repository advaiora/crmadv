// Store delle scorciatoie: tiene gli override dell'utente (rispetto ai default),
// li persiste in localStorage e notifica chi è in ascolto (gestore + impostazioni).
// Stessa filosofia della preferenza tema: salvataggio lato browser, per-dispositivo.

import { SHORTCUT_COMMANDS, keysEqual } from './shortcutCommands';

const STORAGE_KEY = 'shortcuts:bindings:v1';

const COMMANDS_BY_ID = new Map(SHORTCUT_COMMANDS.map((command) => [command.id, command]));

const listeners = new Set();

// Flag globale: mentre la pagina impostazioni sta "registrando" una nuova
// combinazione, il gestore globale deve stare zitto per non intercettare i tasti.
let capturing = false;

const readOverrides = () => {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    // Tiene solo override validi (id noto + lista di stringhe non vuota).
    const clean = {};
    Object.entries(parsed).forEach(([id, keys]) => {
      if (COMMANDS_BY_ID.has(id) && Array.isArray(keys) && keys.length > 0
        && keys.every((step) => typeof step === 'string' && step.length > 0)) {
        clean[id] = keys;
      }
    });
    return clean;
  } catch (_error) {
    return {};
  }
};

let overrides = readOverrides();

const persist = () => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (Object.keys(overrides).length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    }
  } catch (_error) {
    // Storage non disponibile (es. modalità privata): restiamo comunque operativi in memoria.
  }
};

const emit = () => {
  listeners.forEach((listener) => listener());
};

// Ritorna i comandi con i tasti "risolti" (override utente oppure default).
export const getResolvedCommands = () =>
  SHORTCUT_COMMANDS.map((command) => ({
    ...command,
    keys: overrides[command.id] ?? command.defaultKeys,
    isCustom: Boolean(overrides[command.id]),
  }));

export const setBinding = (commandId, keys) => {
  const command = COMMANDS_BY_ID.get(commandId);
  if (!command || !Array.isArray(keys) || keys.length === 0) {
    return;
  }
  if (keysEqual(keys, command.defaultKeys)) {
    // Se coincide col default, non serve salvare un override.
    delete overrides[commandId];
  } else {
    overrides[commandId] = keys;
  }
  persist();
  emit();
};

export const resetBinding = (commandId) => {
  if (overrides[commandId]) {
    delete overrides[commandId];
    persist();
    emit();
  }
};

export const resetAllBindings = () => {
  if (Object.keys(overrides).length === 0) {
    return;
  }
  overrides = {};
  persist();
  emit();
};

// Cerca un altro comando che usa già la stessa combinazione (per evitare conflitti).
export const findConflict = (commandId, keys) =>
  getResolvedCommands().find(
    (command) => command.id !== commandId && keysEqual(command.keys, keys),
  ) ?? null;

export const setCapturing = (value) => {
  capturing = Boolean(value);
};

export const isCapturing = () => capturing;

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
