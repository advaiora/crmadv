// Navigazione suggerita dall'AI (Fase 6, spec sez. "Navigazione assistita").
//
// L'AI puo' SUGGERIRE di portare l'utente in un'area del CRM, ma MAI di iniziativa:
// solo come bottone da cliccare. Qui vive la mappa delle aree (unica fonte di verita'
// lato server), la sezione di prompt che la descrive al modello, e il parser che
// estrae i suggerimenti dalla risposta.
//
// Perche' un formato a token e non function-calling: i tre rami del motore
// (Anthropic /v1/messages, OpenAI /v1/responses, fallback chat/completions) usano
// completamento a testo puro, senza tool use. Si chiede quindi al modello di
// aggiungere, in fondo, righe `[[vai:<chiave>]]` con SOLO le chiavi dell'elenco.
//
// I suggerimenti NON si persistono (nessuna colonna): sono CTA una tantum legate a
// una singola risposta. Si restituiscono nella risposta di invio e si mostrano
// subito sotto la bolla; riaprendo la sessione non tornano, ed e' corretto — una
// vecchia proposta "vuoi andare qui?" non ha senso giorni dopo.

export type ChatNavArea = {
  key: string;
  label: string;
  route: string;
  description: string;
  // Un'area e' proposta solo se l'utente puo' accedervi: modulo acceso E permesso
  // presente. Assenti = sempre disponibile (nessun gate).
  module?: string;
  permission?: string;
};

export type ChatNavSuggestion = {
  key: string;
  label: string;
  route: string;
};

// Mappa curata delle destinazioni sensate da una chat di lavoro. Non ogni foglia del
// menu: solo le aree su cui "andare a fare qualcosa" ha senso come seguito di una
// risposta. Le rotte sono quelle reali del menu (src/layout/Sidebar/SidebarMenu.jsx);
// il server gia' conosce rotte di frontend altrove (es. dashboard.repository href).
export const CHAT_NAV_AREAS: ChatNavArea[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    route: '/dashboard',
    description: 'Panoramica del lavoro: progetti assegnati, scadenze, attivita recente.',
    module: 'dashboard',
    permission: 'dashboard.view',
  },
  {
    key: 'progetti-agency',
    label: 'Produzione AI',
    route: '/agency/projects',
    description: 'Schede progetto su cui si lavora con l\'AI: Brief, Fonti indicizzate, contenuti e campagne.',
    module: 'projects',
    permission: 'projects.view',
  },
  {
    key: 'board-progetti',
    label: 'Bacheca',
    route: '/projects',
    description: 'Bacheca operativa della Pipeline: i progetti per stato di avanzamento.',
    module: 'projects',
    permission: 'projects.view',
  },
  {
    key: 'alert',
    label: 'Da risolvere',
    route: '/agency/alerts',
    description: 'Cosa sistemare nei progetti prima di generare contenuti o consegnare al cliente.',
    module: 'projects',
    permission: 'dashboard.view',
  },
  {
    key: 'opportunita',
    label: 'Opportunita',
    route: '/agency/opportunities',
    description: 'Opportunita di upsell e nuove attivita rilevate sui progetti.',
    module: 'projects',
    permission: 'projects.view',
  },
  {
    key: 'report',
    label: 'Report',
    route: '/agency/reports',
    description: 'Report e rendicontazione dei progetti dell\'agenzia.',
    module: 'projects',
    permission: 'dashboard.view',
  },
  {
    key: 'impostazioni-agency',
    label: 'Impostazioni AI',
    route: '/agency/settings',
    description: 'Configurazione dell\'area Produzione AI, incluse le chiavi dei provider AI.',
    module: 'projects',
    permission: 'modules.manage',
  },
  {
    key: 'clienti',
    label: 'Clienti',
    route: '/apps/clients',
    description: 'Anagrafica clienti: schede, campi personalizzati, integrazioni.',
    module: 'clients',
    permission: 'clients.view',
  },
  {
    key: 'preventivi',
    label: 'Preventivi',
    route: '/apps/quotes',
    description: 'Elenco e gestione dei preventivi, template e notifiche.',
    module: 'quotes',
    permission: 'quotes.view',
  },
  {
    key: 'memo-operativi',
    label: 'Memo Operativi',
    route: '/checklists/templates',
    description: 'Checklist e memo operativi ricorrenti per i progetti.',
    module: 'checklists',
    permission: 'checklists.view',
  },
  {
    key: 'calendario',
    label: 'Calendario',
    route: '/apps/calendar',
    description: 'Calendario di appuntamenti e scadenze.',
    module: 'calendar',
    permission: 'calendar.view',
  },
  {
    key: 'messaggi',
    label: 'Messaggi',
    route: '/apps/email',
    description: 'Messaggistica interna fra colleghi (la casella).',
    module: 'messages',
    permission: 'messages.view',
  },
  {
    key: 'team',
    label: 'Team',
    route: '/apps/team',
    description: 'Gestione del team e dei membri del workspace.',
    module: 'team',
    permission: 'team.view',
  },
  {
    key: 'web-assets',
    label: 'Siti in gestione',
    route: '/apps/web-assets',
    description: 'I siti dei clienti in carico all\'agenzia: versioni, stato di salute, SEO.',
    module: 'web',
    permission: 'web.view',
  },
  {
    key: 'vault',
    label: 'Credenziali',
    route: '/apps/vault',
    description: 'Gli accessi dei clienti custoditi in cassaforte: username, password, URL.',
    module: 'vault',
    permission: 'vault.view_list',
  },
];

// Filtra la mappa alle aree su cui l'utente puo' davvero andare: cosi' il modello non
// propone porte chiuse. Gating uguale al menu: modulo acceso E permesso presente
// (assenti = nessun vincolo).
export const resolveAccessibleNavAreas = (
  enabledModules: string[],
  permissions: string[],
): ChatNavArea[] => {
  const modules = new Set(enabledModules);
  const perms = new Set(permissions);
  return CHAT_NAV_AREAS.filter((area) => {
    if (area.module && !modules.has(area.module)) return false;
    if (area.permission && !perms.has(area.permission)) return false;
    return true;
  });
};

// Sezione da appendere al system prompt: elenca le aree accessibili e spiega COME e
// QUANDO suggerirle. Vuota (stringa vuota) se non c'e' nessuna area: senza opzioni non
// si insegna al modello un formato che non potrebbe mai usare.
export const buildNavPromptSection = (areas: ChatNavArea[]): string => {
  if (areas.length === 0) {
    return '';
  }
  const list = areas.map((area) => `- ${area.key}: ${area.label} — ${area.description}`).join('\n');
  return [
    '',
    '--- NAVIGAZIONE SUGGERITA ---',
    'Puoi proporre all\'utente di spostarsi in un\'area del CRM, ma SOLO come suggerimento:',
    'non dai mai per scontato che ci vada. Se — e solo se — è davvero utile al seguito della',
    'conversazione, aggiungi in FONDO alla risposta una riga per ogni area suggerita, nel',
    'formato ESATTO:',
    '[[vai:CHIAVE]]',
    'Usa esclusivamente le chiavi di questo elenco (mai inventarne, mai altre righe su quelle',
    'linee). Al massimo 3 suggerimenti, i più pertinenti. Se nessuna area è utile, non',
    'aggiungere nulla: la maggior parte delle risposte non ha suggerimenti di navigazione.',
    'Aree disponibili:',
    list,
    '--- FINE NAVIGAZIONE SUGGERITA ---',
  ].join('\n');
};

// Token che il modello aggiunge: [[vai:chiave]]. Tollerante su spazi e maiuscole.
const NAV_TOKEN_REGEX = /\[\[\s*vai\s*:\s*([a-z0-9-]+)\s*\]\]/gi;

const MAX_SUGGESTIONS = 3;

// Estrae i suggerimenti dalla risposta e li TOGLIE dal testo mostrato/salvato: nel DB
// resta la sola prosa, pulita. Tiene solo le chiavi note e accessibili (le `areas`
// gia' filtrate per permessi), senza duplicati, fino a MAX_SUGGESTIONS.
export const parseNavSuggestions = (
  rawText: string,
  areas: ChatNavArea[],
): { text: string; suggestions: ChatNavSuggestion[] } => {
  const byKey = new Map(areas.map((area) => [area.key.toLowerCase(), area]));
  const seen = new Set<string>();
  const suggestions: ChatNavSuggestion[] = [];

  let match: RegExpExecArray | null;
  NAV_TOKEN_REGEX.lastIndex = 0;
  while ((match = NAV_TOKEN_REGEX.exec(rawText)) !== null) {
    const key = match[1].toLowerCase();
    const area = byKey.get(key);
    if (!area || seen.has(key) || suggestions.length >= MAX_SUGGESTIONS) {
      continue;
    }
    seen.add(key);
    suggestions.push({ key: area.key, label: area.label, route: area.route });
  }

  // Via i token dal testo, poi ripulisce le righe e gli spazi rimasti in coda.
  const text = rawText.replace(NAV_TOKEN_REGEX, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { text, suggestions };
};
