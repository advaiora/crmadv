export type ModuleCatalogEntry = {
  key: string;
  name: string;
  isCore: boolean;
  description: string;
};

export type PermissionCatalogEntry = {
  key: string;
  moduleKey: string;
  description: string;
};

export const SYSTEM_ROLE_NAME = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  manager: 'Manager',
  operativo: 'Operativo',
  viewer: 'Viewer',
} as const;

export const REGISTRABLE_WORKSPACE_ROLE_NAMES = [
  SYSTEM_ROLE_NAME.admin,
  SYSTEM_ROLE_NAME.manager,
  SYSTEM_ROLE_NAME.operativo,
  SYSTEM_ROLE_NAME.viewer,
] as const;

export type WorkspaceSystemRoleName =
  (typeof SYSTEM_ROLE_NAME)[keyof typeof SYSTEM_ROLE_NAME];

export const TEAM_MODULE_KEY = 'team';
export const DASHBOARD_MODULE_KEY = 'dashboard';
export const MESSAGES_MODULE_KEY = 'messages';

// Il modulo dell'area "Produzione AI" (7/8/2026, fase A2 del re-naming). Prima non
// esisteva: le sue ~90 rotte — Brief, Fonti, Contenuti Web, Ads, Report, Alert,
// Opportunita', Task, Performance — giravano tutte sui permessi di 'projects', cioe'
// quelli della Pipeline. Conseguenze: far generare un contenuto all'AI (che SPENDE)
// chiedeva lo stesso permesso di rinominare una scheda nel kanban, e non si poteva
// dare a un ruolo la Pipeline senza dargli anche la Produzione AI.
//   La chiave resta in inglese come le altre quindici: la fase B decidera' in blocco
//   se e come italianizzarle. Il nome che l'utente legge e' gia' italiano.
export const AI_PRODUCTION_MODULE_KEY = 'ai_production';

// I cinque permessi dell'area. La separazione che conta e' 'generate': e' l'unica
// azione che consuma il budget AI dell'agenzia, ed e' lo stesso principio gia'
// applicato alla chat (view separato da use).
export const AI_PRODUCTION_PERMISSIONS = {
  view: 'ai_production.view',
  edit: 'ai_production.edit',
  generate: 'ai_production.generate',
  manageSettings: 'ai_production.manage_settings',
  manageBudget: 'ai_production.manage_budget',
} as const;

export type AiProductionPermissionKey =
  (typeof AI_PRODUCTION_PERMISSIONS)[keyof typeof AI_PRODUCTION_PERMISSIONS];

// Permessi della Chat AI (15/7/2026). Prima la chat girava tutta su 'projects.view':
// inviare un messaggio — che SPENDE SOLDI — chiedeva lo stesso permesso della sola
// lettura, e nessun ruolo poteva moderare un gruppo altrui. Modellati sul precedente
// di 'messages' (view/send), che e' lo stesso problema: consultare != scrivere.
// Stavano sotto il modulo 'projects' per ripiego, "perche' l'area Agency non ha un
// modulo suo": dal 7/8/2026 ce l'ha, e sono passati sotto quello (vedi il catalogo).
export const CHAT_PERMISSIONS = {
  view: 'chat.view',
  use: 'chat.use',
  moderate: 'chat.moderate',
} as const;

export type ChatPermissionKey = (typeof CHAT_PERMISSIONS)[keyof typeof CHAT_PERMISSIONS];

export const TEAM_PERMISSIONS = {
  view: 'team.view',
  invite: 'team.invite',
  edit: 'team.edit',
  deactivate: 'team.deactivate',
  rolesAssign: 'team.roles_assign',
} as const;

export const DASHBOARD_PERMISSIONS = {
  view: 'dashboard.view',
} as const;

export type TeamPermissionKey =
  (typeof TEAM_PERMISSIONS)[keyof typeof TEAM_PERMISSIONS];
export type DashboardPermissionKey =
  (typeof DASHBOARD_PERMISSIONS)[keyof typeof DASHBOARD_PERMISSIONS];

export type PermissionSelection =
  | 'all'
  | readonly string[]
  | { mode: 'all_except'; exclude: readonly string[] };

export type SystemRoleDefinition = {
  name: WorkspaceSystemRoleName;
  description: string;
  isSuperadmin: boolean;
  userRole: string;
  permissions: PermissionSelection;
};

// ⚠️ 'name' e 'description' NON sono nomi interni: la pagina "Ruoli e permessi" e la
// pagina "Gestione moduli" li stampano tali e quali. Vanno quindi scritti come li
// leggerebbe chi lavora in agenzia, e — regola della fase A2 — devono dire ESATTAMENTE
// il nome che quella voce ha nel menu: se il menu dice "Credenziali", qui non si scrive
// "Vault". Dove il termine inglese e' quello vero del mestiere (SEO, Ads, Brief) resta
// inglese: allineare non vuol dire tradurre tutto.
export const SYSTEM_MODULE_CATALOG: readonly ModuleCatalogEntry[] = [
  { key: 'modules', name: 'Moduli', isCore: true, description: 'Accendere e spegnere i moduli del workspace' },
  // "Branding" resta inglese: e' il termine del mestiere, ed e' gia' il nome della
  // pagina e della voce nel profilo. Tradurlo qui creerebbe due nomi per la stessa cosa.
  { key: 'branding', name: 'Branding', isCore: true, description: 'Logo, colori e nome del workspace' },
  { key: 'audit', name: 'Audit', isCore: true, description: 'Registro di chi ha fatto cosa e quando' },
  { key: DASHBOARD_MODULE_KEY, name: 'Dashboard', isCore: true, description: 'Panoramica operativa del workspace' },
  { key: TEAM_MODULE_KEY, name: 'Team', isCore: false, description: 'Persone del workspace, inviti e ruoli' },
  { key: 'departments', name: 'Reparti', isCore: false, description: "Reparti dell'agenzia e assegnazione delle persone" },
  { key: 'clients', name: 'Clienti', isCore: false, description: "Anagrafica dei clienti dell'agenzia" },
  { key: 'projects', name: 'Pipeline', isCore: false, description: 'Bacheca operativa dei progetti per stato di avanzamento' },
  {
    key: AI_PRODUCTION_MODULE_KEY,
    name: 'Produzione AI',
    isCore: false,
    description: "Area di produzione assistita dall'AI: Brief, Fonti, Contenuti Web, Ads, Report, Performance e chat AI",
  },
  { key: 'checklists', name: 'Memo Operativi', isCore: false, description: 'Modelli di controllo e loro svolgimento sui progetti' },
  { key: 'calendar', name: 'Calendario', isCore: false, description: 'Appuntamenti e scadenze' },
  { key: 'quotes', name: 'Preventivi', isCore: false, description: "Preventivi ai clienti, dai modelli all'invio" },
  { key: 'web', name: 'Siti in gestione', isCore: false, description: "Siti dei clienti in carico all'agenzia: versioni, pubblicazione, stato di salute" },
  { key: 'vault', name: 'Credenziali', isCore: false, description: 'Cassaforte degli accessi dei clienti: username, password, URL' },
  { key: 'seo', name: 'SEO', isCore: false, description: 'Scansione e report SEO dei siti in gestione' },
  { key: MESSAGES_MODULE_KEY, name: 'Messaggi', isCore: false, description: 'Messaggistica interna fra le persone del workspace' },
] as const;

export const SYSTEM_PERMISSION_CATALOG: readonly PermissionCatalogEntry[] = [
  { key: 'modules.manage', moduleKey: 'modules', description: 'Accendere e spegnere i moduli del workspace' },
  { key: 'branding.manage', moduleKey: 'branding', description: 'Modificare logo, colori e nome del workspace' },
  { key: 'audit.view', moduleKey: 'audit', description: 'Consultare il registro di chi ha fatto cosa e quando' },
  { key: DASHBOARD_PERMISSIONS.view, moduleKey: DASHBOARD_MODULE_KEY, description: 'Vedere la Dashboard operativa' },

  // Permessi storici sulla gestione dei ruoli: restano perche' le rotte li usano.
  { key: 'roles.view', moduleKey: TEAM_MODULE_KEY, description: 'Vedere i ruoli del workspace e i loro permessi' },
  { key: 'roles.manage', moduleKey: TEAM_MODULE_KEY, description: 'Creare, modificare ed ELIMINARE i ruoli, e cambiare i loro permessi' },
  // ⚠️ Questa e team.roles_assign si somigliano ma governano due strade diverse:
  // qui la pagina "Ruoli e permessi", la' la scheda della persona nel Team. Le
  // descrizioni devono dire DA DOVE si agisce, o chi concede l'una credendo di
  // concedere l'altra si ritrova un 403 senza capire perche'.
  { key: 'roles.assign', moduleKey: TEAM_MODULE_KEY, description: 'Assegnare i ruoli dalla pagina Ruoli e permessi' },

  { key: TEAM_PERMISSIONS.view, moduleKey: TEAM_MODULE_KEY, description: 'Vedere le persone del team' },
  { key: TEAM_PERMISSIONS.invite, moduleKey: TEAM_MODULE_KEY, description: 'Invitare nuove persone nel workspace' },
  { key: TEAM_PERMISSIONS.edit, moduleKey: TEAM_MODULE_KEY, description: 'Modificare i dati delle persone del team' },
  { key: TEAM_PERMISSIONS.deactivate, moduleKey: TEAM_MODULE_KEY, description: 'Disattivare una persona del team' },
  { key: TEAM_PERMISSIONS.rolesAssign, moduleKey: TEAM_MODULE_KEY, description: 'Cambiare il ruolo di una persona del team' },

  { key: 'departments.view', moduleKey: 'departments', description: 'Vedere i reparti' },
  { key: 'departments.manage', moduleKey: 'departments', description: 'Creare, modificare ed eliminare reparti' },
  { key: 'departments.assign', moduleKey: 'departments', description: 'Assegnare le persone ai reparti' },

  { key: 'clients.view', moduleKey: 'clients', description: 'Vedere i clienti' },
  { key: 'clients.create', moduleKey: 'clients', description: 'Creare clienti' },
  { key: 'clients.edit', moduleKey: 'clients', description: 'Modificare i clienti' },
  { key: 'clients.delete', moduleKey: 'clients', description: 'Eliminare clienti' },
  { key: 'projects.view', moduleKey: 'projects', description: 'Vedere i progetti della Pipeline' },
  { key: 'projects.view_all', moduleKey: 'projects', description: "Vedere TUTTI i progetti del workspace, anche quelli di altri reparti o non assegnati" },
  { key: 'projects.create', moduleKey: 'projects', description: 'Creare progetti' },
  { key: 'projects.edit', moduleKey: 'projects', description: 'Modificare i progetti' },
  { key: 'projects.delete', moduleKey: 'projects', description: 'Eliminare progetti' },
  { key: 'projects.move_stage', moduleKey: 'projects', description: 'Spostare un progetto fra le colonne della bacheca' },
  { key: 'checklists.view', moduleKey: 'checklists', description: 'Vedere i memo operativi' },
  { key: 'checklists.manage_templates', moduleKey: 'checklists', description: 'Creare, modificare e archiviare i modelli di memo' },
  // ⚠️ Le tre chiavi che seguono NON sono controllate da nessuna rotta: le mutazioni
  // sui modelli passano tutte da manage_templates. Restano nel catalogo per non
  // toglierle a chi le ha, ma oggi non governano niente (annotato in roadmap).
  { key: 'checklists.create', moduleKey: 'checklists', description: 'Creare modelli di memo (in disuso: vale manage_templates)' },
  { key: 'checklists.edit', moduleKey: 'checklists', description: 'Modificare modelli di memo (in disuso: vale manage_templates)' },
  { key: 'checklists.delete', moduleKey: 'checklists', description: 'Archiviare modelli di memo (in disuso: vale manage_templates)' },
  { key: 'checklists.complete_item', moduleKey: 'checklists', description: 'Spuntare le voci di un memo in corso' },
  { key: 'checklists.assign', moduleKey: 'checklists', description: 'Assegnare le voci di un memo alle persone' },
  { key: 'checklists.override_gate', moduleKey: 'checklists', description: 'Far avanzare un progetto anche con un memo non completato' },
  { key: 'calendar.view', moduleKey: 'calendar', description: 'Vedere gli appuntamenti' },
  { key: 'calendar.create', moduleKey: 'calendar', description: 'Creare appuntamenti' },
  { key: 'calendar.edit', moduleKey: 'calendar', description: 'Modificare gli appuntamenti' },
  { key: 'calendar.delete', moduleKey: 'calendar', description: 'Eliminare appuntamenti' },
  { key: 'quotes.view', moduleKey: 'quotes', description: 'Vedere i preventivi' },
  { key: 'quotes.create', moduleKey: 'quotes', description: 'Creare preventivi' },
  { key: 'quotes.edit', moduleKey: 'quotes', description: 'Modificare i preventivi' },
  { key: 'quotes.delete', moduleKey: 'quotes', description: 'Eliminare preventivi' },
  { key: 'quotes.send', moduleKey: 'quotes', description: 'Inviare un preventivo al cliente' },
  { key: 'quotes.accept', moduleKey: 'quotes', description: 'Registrare che il cliente ha accettato un preventivo' },
  { key: 'quotes.manage_templates', moduleKey: 'quotes', description: 'Gestire i modelli di preventivo' },
  { key: 'web.view', moduleKey: 'web', description: 'Vedere i siti in gestione' },
  { key: 'web.create', moduleKey: 'web', description: 'Aggiungere un sito in gestione' },
  { key: 'web.edit', moduleKey: 'web', description: 'Modificare i siti in gestione' },
  { key: 'web.delete', moduleKey: 'web', description: 'Eliminare un sito in gestione' },
  { key: 'web.publish', moduleKey: 'web', description: 'Pubblicare un sito' },
  { key: 'web.unpublish', moduleKey: 'web', description: 'Togliere un sito dalla pubblicazione' },
  { key: 'web.version.create', moduleKey: 'web', description: 'Salvare una nuova versione di un sito' },
  { key: 'web.version.rollback', moduleKey: 'web', description: 'Riportare un sito a una versione precedente' },
  { key: 'vault.view_list', moduleKey: 'vault', description: "Vedere l'elenco delle credenziali (senza le password)" },
  { key: 'vault.create', moduleKey: 'vault', description: 'Aggiungere credenziali' },
  { key: 'vault.edit', moduleKey: 'vault', description: 'Modificare le credenziali' },
  { key: 'vault.reveal', moduleKey: 'vault', description: 'Mostrare in chiaro le password salvate: il permesso piu delicato del CRM' },
  { key: 'vault.delete', moduleKey: 'vault', description: 'Eliminare credenziali' },
  { key: 'vault.manage_settings', moduleKey: 'vault', description: 'Gestire le impostazioni della cassaforte' },
  { key: 'seo.view', moduleKey: 'seo', description: 'Consultare i report SEO di un sito' },
  { key: 'seo.run_scan', moduleKey: 'seo', description: 'Lanciare una scansione SEO' },
  // ⚠️ Le due che seguono non sono ancora controllate da nessuna rotta: esportazione
  // e impostazioni SEO non esistono come funzioni (previste piu avanti, vedi roadmap).
  { key: 'seo.export', moduleKey: 'seo', description: 'Esportare i report SEO (funzione non ancora disponibile)' },
  { key: 'seo.manage_settings', moduleKey: 'seo', description: 'Gestire le impostazioni SEO (funzione non ancora disponibile)' },
  { key: 'messages.view', moduleKey: MESSAGES_MODULE_KEY, description: 'Leggere i messaggi interni' },
  { key: 'messages.send', moduleKey: MESSAGES_MODULE_KEY, description: 'Scrivere messaggi interni' },

  { key: AI_PRODUCTION_PERMISSIONS.view, moduleKey: AI_PRODUCTION_MODULE_KEY, description: 'Vedere i progetti di Produzione AI e i loro contenuti' },
  { key: AI_PRODUCTION_PERMISSIONS.edit, moduleKey: AI_PRODUCTION_MODULE_KEY, description: 'Creare e modificare progetti, contenuti, report e dati di performance' },
  { key: AI_PRODUCTION_PERMISSIONS.generate, moduleKey: AI_PRODUCTION_MODULE_KEY, description: "Far generare contenuti all'AI: consuma il budget AI dell'agenzia" },
  { key: AI_PRODUCTION_PERMISSIONS.manageSettings, moduleKey: AI_PRODUCTION_MODULE_KEY, description: 'Gestire le impostazioni AI: provider, chiavi, modelli e tipi di progetto' },
  { key: AI_PRODUCTION_PERMISSIONS.manageBudget, moduleKey: AI_PRODUCTION_MODULE_KEY, description: 'Gestire i budget AI e consultare il rendiconto dei consumi' },

  { key: CHAT_PERMISSIONS.view, moduleKey: AI_PRODUCTION_MODULE_KEY, description: 'Leggere le chat AI di cui si fa parte, e il loro storico' },
  { key: CHAT_PERMISSIONS.use, moduleKey: AI_PRODUCTION_MODULE_KEY, description: 'Scrivere nella chat AI: inviare (consuma budget), invitare, allegare, azzerare' },
  { key: CHAT_PERMISSIONS.moderate, moduleKey: AI_PRODUCTION_MODULE_KEY, description: 'Moderare i gruppi di chat altrui: togliere persone e sciogliere il gruppo, senza leggerne i messaggi' },
] as const;

// ⚠️ I NOMI dei ruoli non si toccano, nemmeno 'Viewer' che e' inglese: `name` e' la
// chiave con cui il bootstrap fa l'upsert (`workspaceId_name`), quindi rinominarne uno
// non lo rinomina — ne crea un secondo e lascia il primo orfano, con le persone ancora
// attaccate a quello vecchio. Se un giorno si vorranno italianizzare, servira' una
// migrazione dedicata. Le DESCRIZIONI invece sono solo testo mostrato, e sono in
// italiano dal 7/8/2026.
export const SYSTEM_ROLE_DEFINITIONS: readonly SystemRoleDefinition[] = [
  {
    name: SYSTEM_ROLE_NAME.superadmin,
    description: 'Controllo completo del workspace, dei permessi e della spesa AI',
    isSuperadmin: true,
    userRole: 'superadmin',
    permissions: 'all',
  },
  {
    name: SYSTEM_ROLE_NAME.admin,
    description: 'Amministra il workspace, tranne moduli, ruoli e spesa AI',
    isSuperadmin: false,
    userRole: 'admin',
    // Superadmin is the only role that can manage modules and role/permission assignments.
    permissions: {
      mode: 'all_except',
      exclude: [
        'modules.manage',
        'roles.view',
        'roles.manage',
        'roles.assign',
        TEAM_PERMISSIONS.rolesAssign,
        // Prevent legacy broad grant if this permission exists in older databases.
        'team.manage',
        // Impostazioni AI e budget restano al solo Superadmin, com'e' sempre stato:
        // prima del 7/8/2026 quelle rotte non passavano dal catalogo ma da un
        // controllo scritto a mano sul NOME del ruolo ('superadmin'). Ora sono
        // permessi veri — assegnabili a un ruolo personalizzato — ma l'Admin non
        // li eredita, o l'aggiunta al catalogo sarebbe un allargamento silenzioso.
        // Stessa logica di 'modules.manage' qui sopra: configurazione di workspace.
        AI_PRODUCTION_PERMISSIONS.manageSettings,
        AI_PRODUCTION_PERMISSIONS.manageBudget,
      ],
    },
  },
  {
    name: SYSTEM_ROLE_NAME.manager,
    description: 'Guida il lavoro operativo: progetti, memo, preventivi, siti e Produzione AI',
    isSuperadmin: false,
    userRole: 'manager',
    permissions: [
      TEAM_PERMISSIONS.view,
      TEAM_PERMISSIONS.invite,
      TEAM_PERMISSIONS.edit,
      DASHBOARD_PERMISSIONS.view,
      'departments.view',
      'clients.view',
      'clients.create',
      'clients.edit',
      'projects.view',
      'projects.view_all',
      'projects.create',
      'projects.edit',
      'projects.move_stage',
      'checklists.view',
      'checklists.manage_templates',
      'checklists.complete_item',
      'checklists.assign',
      'checklists.override_gate',
      'calendar.view',
      'calendar.create',
      'calendar.edit',
      'calendar.delete',
      'quotes.view',
      'quotes.create',
      'quotes.edit',
      'quotes.send',
      'web.view',
      'web.create',
      'web.edit',
      'web.delete',
      'web.publish',
      'web.unpublish',
      'web.version.create',
      'web.version.rollback',
      // SEO: fino al 7/8/2026 queste due azioni ricadevano su web.view e web.edit,
      // che il Manager ha entrambe. Assegnarle qui tiene il comportamento identico
      // ora che le rotte chiedono i permessi veri.
      'seo.view',
      'seo.run_scan',
      'messages.view',
      'messages.send',
      // Produzione AI: il Manager ci lavora, quindi vede, modifica e fa generare.
      // Corrisponde a cio' che poteva gia' fare quando l'area girava sui permessi
      // della Pipeline (aveva projects.view/create/edit): nessun allargamento.
      // Impostazioni e budget no: quelli restano al Superadmin.
      AI_PRODUCTION_PERMISSIONS.view,
      AI_PRODUCTION_PERMISSIONS.edit,
      AI_PRODUCTION_PERMISSIONS.generate,
      // Il manager usa la chat, ma non modera i gruppi altrui: quella resta
      // ad Admin/Superadmin (che la prendono da 'all'/'all_except').
      CHAT_PERMISSIONS.view,
      CHAT_PERMISSIONS.use,
    ],
  },
  {
    name: SYSTEM_ROLE_NAME.operativo,
    description: 'Lavora sui progetti con permessi di modifica limitati',
    isSuperadmin: false,
    userRole: 'operativo',
    permissions: [
      TEAM_PERMISSIONS.view,
      DASHBOARD_PERMISSIONS.view,
      'departments.view',
      'clients.view',
      'clients.edit',
      'projects.view',
      'checklists.view',
      'checklists.complete_item',
      'checklists.assign',
      'calendar.view',
      'calendar.create',
      'calendar.edit',
      'quotes.view',
      'web.view',
      // Leggere i report SEO seguiva web.view, che l'Operativo ha; lanciare una
      // scansione no (serviva web.edit). Resta cosi'.
      'seo.view',
      'messages.view',
      'messages.send',
      // Solo lettura sulla Produzione AI: e' esattamente cio' che l'Operativo
      // poteva fare finora (aveva projects.view ma non projects.edit, e le rotte
      // di modifica e generazione chiedono edit). Se un domani si vuole che
      // l'Operativo generi — cioe' spenda budget — e' una decisione da prendere
      // apposta, non un effetto collaterale di questo riordino.
      AI_PRODUCTION_PERMISSIONS.view,
      CHAT_PERMISSIONS.view,
      CHAT_PERMISSIONS.use,
    ],
  },
  {
    name: SYSTEM_ROLE_NAME.viewer,
    description: 'Sola lettura: consulta senza modificare niente',
    isSuperadmin: false,
    userRole: 'viewer',
    permissions: [
      TEAM_PERMISSIONS.view,
      DASHBOARD_PERMISSIONS.view,
      'departments.view',
      'clients.view',
      'projects.view',
      'checklists.view',
      'calendar.view',
      'quotes.view',
      'web.view',
      'seo.view',
      'audit.view',
      'messages.view',
      AI_PRODUCTION_PERMISSIONS.view,
      // Il Viewer e' in sola lettura: consulta le chat di cui fa parte ma non
      // scrive e non spende (niente chat.use). E' il punto della separazione.
      CHAT_PERMISSIONS.view,
    ],
  },
] as const;
