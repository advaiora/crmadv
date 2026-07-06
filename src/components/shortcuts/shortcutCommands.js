// Registro delle scorciatoie da tastiera (V1 "set curato").
// Ogni comando ha una combinazione di default (defaultKeys) rimappabile dall'utente.
//
// Formato dei tasti: ogni scorciatoia è una lista di "passi" (steps).
//  - un passo singolo con modificatore  → "mod+k"  (chord: funziona anche mentre si scrive)
//  - più passi senza modificatore        → ["g", "d"] (sequenza tipo "g poi d")
//  - un passo singolo senza modificatore  → ["c"]   (tasto secco, solo fuori dai campi di testo)
// "mod" = Ctrl su Windows/Linux, Cmd su Mac.

export const SHORTCUT_GROUPS = ['Generale', 'Navigazione', 'Azioni'];

export const SHORTCUT_COMMANDS = [
  // Generale
  {
    id: 'open-search',
    group: 'Generale',
    label: 'Apri ricerca globale',
    type: 'search',
    defaultKeys: ['mod+k'],
  },
  {
    id: 'show-help',
    group: 'Generale',
    label: 'Mostra le scorciatoie',
    type: 'help',
    defaultKeys: ['?'],
  },
  {
    id: 'toggle-theme',
    group: 'Generale',
    label: 'Cambia tema chiaro/scuro',
    type: 'theme',
    defaultKeys: ['t', 't'],
  },

  // Navigazione (sequenze con "g" come tasto guida)
  {
    id: 'go-dashboard',
    group: 'Navigazione',
    label: 'Vai a Dashboard',
    type: 'navigate',
    path: '/dashboard',
    requiredModule: 'dashboard',
    requiredPermission: 'dashboard.view',
    defaultKeys: ['g', 'd'],
  },
  {
    id: 'go-clients',
    group: 'Navigazione',
    label: 'Vai a Clienti',
    type: 'navigate',
    path: '/apps/clients',
    requiredModule: 'clients',
    requiredPermission: 'clients.view',
    defaultKeys: ['g', 'c'],
  },
  {
    id: 'go-quotes',
    group: 'Navigazione',
    label: 'Vai a Preventivi',
    type: 'navigate',
    path: '/apps/quotes',
    requiredModule: 'quotes',
    requiredPermission: 'quotes.view',
    defaultKeys: ['g', 'p'],
  },
  {
    id: 'go-projects',
    group: 'Navigazione',
    label: 'Vai a Progetti',
    type: 'navigate',
    path: '/projects',
    requiredModule: 'projects',
    requiredPermission: 'projects.view',
    defaultKeys: ['g', 'r'],
  },

  // Azioni (tasti secchi)
  {
    id: 'new-client',
    group: 'Azioni',
    label: 'Nuovo cliente',
    type: 'navigate',
    path: '/apps/clients/new',
    requiredModule: 'clients',
    requiredPermission: 'clients.create',
    defaultKeys: ['c'],
  },
  {
    id: 'new-quote',
    group: 'Azioni',
    label: 'Nuovo preventivo',
    type: 'navigate',
    path: '/apps/quotes/new',
    requiredModule: 'quotes',
    requiredPermission: 'quotes.create',
    defaultKeys: ['q'],
  },
];

// Rileva se siamo su Mac, per mostrare ⌘/⌥ al posto di Ctrl/Alt.
export const isMacPlatform = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

// Converte un evento tastiera in un "passo" normalizzato ("mod+k", "g", "?").
// Restituisce null per i soli tasti modificatori (Shift/Ctrl/…), da ignorare.
export const eventToStep = (event) => {
  const key = event.key;
  if (!key || key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta') {
    return null;
  }

  const modifiers = [];
  if (event.metaKey || event.ctrlKey) {
    modifiers.push('mod');
  }
  if (event.altKey) {
    modifiers.push('alt');
  }

  const normalizedKey = key.length === 1 ? key.toLowerCase() : key.toLowerCase();
  return [...modifiers, normalizedKey].join('+');
};

// Un passo è un "chord" (funziona anche nei campi di testo) se ha un modificatore.
export const stepHasModifier = (step) =>
  step.startsWith('mod+') || step.startsWith('alt+') || step.includes('+mod') || step.includes('+alt');

// Una scorciatoia è un chord se è composta da un solo passo con modificatore.
export const keysAreChord = (keys) => keys.length === 1 && stepHasModifier(keys[0]);

export const keysEqual = (a, b) =>
  Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((step, i) => step === b[i]);

// Etichetta leggibile di un singolo token ("mod" → ⌘/Ctrl, "d" → D, "?" → ?).
export const tokenLabel = (token, isMac = isMacPlatform()) => {
  if (token === 'mod') {
    return isMac ? '⌘' : 'Ctrl';
  }
  if (token === 'alt') {
    return isMac ? '⌥' : 'Alt';
  }
  if (token === 'escape') {
    return 'Esc';
  }
  if (token === ' ') {
    return 'Spazio';
  }
  return token.length === 1 ? token.toUpperCase() : token;
};

// Scompone un passo nei suoi token ("mod+k" → ["mod", "k"]).
export const stepTokens = (step) => step.split('+');

// Rappresentazione testuale di una scorciatoia intera ("G poi D", "⌘ K").
export const formatKeys = (keys, isMac = isMacPlatform()) =>
  keys
    .map((step) => stepTokens(step).map((token) => tokenLabel(token, isMac)).join(' '))
    .join(' poi ');
