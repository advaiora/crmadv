import * as Icons from "tabler-icons-react";

export const SidebarMenu = [
  // ⚠️ Questo gruppo NON si disegna nella sidebar (deciso il 5/8/2026): il suo
  // ingresso e' l'icona nella barra superiore (TopNav), perche' e' l'unica area
  // che sta FUORI da ogni workspace e si usa di rado — non merita il primo posto
  // del menu. La voce pero' resta qui, e non va cancellata: la ricerca rapida
  // (Ctrl+K) costruisce le sue destinazioni leggendo QUESTO array, quindi
  // toglierla la farebbe sparire anche da li', cioe' dall'unica via testuale per
  // raggiungere l'area. L'esclusione dal disegno sta in Sidebar.jsx.
  // Il nome e' lungo apposta: nella sidebar non si legge (la voce non si disegna),
  // ma rende l'area trovabile cercando "workspace", "consumi" o "AI" e non solo
  // "piattaforma". ⚠️ Non allungarlo oltre: la ricerca rapida questo nome lo MOSTRA
  // come testo della riga, quindi e' una riga visibile, non una semplice chiave.
  {
    group: "Piattaforma",
    contents: [
      {
        id: "platform_console",
        name: "Piattaforma — workspace e consumi AI",
        icon: <Icons.World />,
        path: "/settings/platform-console",
        requirePlatformAdmin: true,
        grp_name: "apps",
      },
    ],
  },
  {
    group: "",
    contents: [
      {
        name: "Dashboard",
        icon: <Icons.Template />,
        path: "/dashboard",
        requiredModule: "dashboard",
        requiredPermission: "dashboard.view",
      },
      {
        id: "main_agency",
        name: "Produzione AI",
        icon: <Icons.Briefcase />,
        path: "/agency/projects",
        // Dal 7/8/2026 l'area ha un modulo e permessi suoi: prima usava quelli
        // della Pipeline, che e' un'altra cosa. Le due voci qui sotto chiedevano
        // 'dashboard.view' mentre il server chiedeva 'projects.view': con i ruoli
        // di sistema non si vedeva (i due permessi viaggiano insieme), ma un ruolo
        // personalizzato con la sola Dashboard vedeva il link e prendeva un 403.
        requiredModule: "ai_production",
        requiredPermission: "ai_production.view",
        childrens: [
          {
            name: "Progetti",
            path: "/agency/projects",
            requiredPermission: "ai_production.view",
            grp_name: "apps",
          },
          {
            // Stesso nome della scheda dentro il progetto: sono la stessa cosa a
            // due ampiezze diverse (tutti i progetti / uno solo), quindi si
            // rinominano insieme (roadmap, decisione ①).
            name: "Da risolvere",
            path: "/agency/alerts",
            requiredPermission: "ai_production.view",
            grp_name: "apps",
          },
          {
            name: "Opportunita",
            path: "/agency/opportunities",
            requiredPermission: "ai_production.view",
            grp_name: "apps",
          },
          {
            name: "Report",
            path: "/agency/reports",
            requiredPermission: "ai_production.view",
            grp_name: "apps",
          },
          {
            // Chiedeva 'modules.manage', cioe' il permesso di accendere e spegnere
            // i moduli del workspace: un altro prestito. Ora chiede i permessi delle
            // azioni che la pagina fa davvero — basta averne uno, perche' i pannelli
            // dentro sono due e seguono permessi diversi (provider e chiavi da una
            // parte, consumi e tetti di spesa dall'altra).
            name: "Impostazioni AI",
            path: "/agency/settings",
            requiredPermission: [
              "ai_production.manage_settings",
              "ai_production.manage_budget",
            ],
            grp_name: "apps",
          },
        ],
      },
    ],
  },
  {
    group: "CRM",
    contents: [
      {
        id: "crm_clients",
        name: "Clienti",
        icon: <Icons.Users />,
        path: "/apps/clients",
        requiredModule: "clients",
        requiredPermission: "clients.view",
        childrens: [
          {
            name: "Clienti",
            path: "/apps/clients",
            grp_name: "apps",
          },
          {
            name: "Nuovo Cliente",
            path: "/apps/clients/new",
            requiredPermission: "clients.create",
            grp_name: "apps",
          },
          {
            name: "Campi personalizzati",
            path: "/apps/clients/custom-fields",
            requiredPermission: "clients.edit",
            grp_name: "apps",
          },
          {
            name: "Integrazioni",
            path: "/apps/clients/integrations",
            requiredPermission: "clients.edit",
            grp_name: "apps",
          },
        ],
      },
      {
        id: "crm_team",
        name: "Team",
        icon: <Icons.Shield />,
        path: "/apps/team",
        requiredModule: "team",
        requiredPermission: "team.view",
        childrens: [
          {
            name: "Team",
            path: "/apps/team",
            requiredPermission: "team.view",
            grp_name: "apps",
          },
        ],
      },
      {
        id: "crm_quotes",
        name: "Preventivi",
        icon: <Icons.FileInvoice />,
        path: "/apps/quotes",
        requiredModule: "quotes",
        requiredPermission: "quotes.view",
        childrens: [
          {
            name: "Elenco Preventivi",
            path: "/apps/quotes",
            requiredPermission: "quotes.view",
            grp_name: "apps",
          },
          {
            name: "Nuovo Preventivo",
            path: "/apps/quotes/new",
            requiredPermission: "quotes.create",
            grp_name: "apps",
          },
          {
            name: "Template Preventivi",
            path: "/apps/quotes/templates",
            requiredPermission: "quotes.manage_templates",
            grp_name: "apps",
          },
          {
            name: "Notifiche Preventivi",
            path: "/apps/quotes/notifications",
            requiredPermission: "quotes.manage_templates",
            grp_name: "apps",
          },
        ],
      },
      {
        id: "crm_web_assets",
        name: "Siti in gestione",
        icon: <Icons.Code />,
        path: "/apps/web-assets",
        requiredModule: "web",
        requiredPermission: "web.view",
        childrens: [
          {
            name: "Siti in gestione",
            path: "/apps/web-assets",
            requiredPermission: "web.view",
            grp_name: "apps",
          },
        ],
      },
      {
        id: "crm_vault",
        name: "Credenziali",
        icon: <Icons.Lock />,
        path: "/apps/vault",
        requiredModule: "vault",
        requiredPermission: "vault.view_list",
        childrens: [
          {
            name: "Credenziali",
            path: "/apps/vault",
            requiredPermission: "vault.view_list",
            grp_name: "apps",
          },
        ],
      },
    ],
  },
  {
    group: "Operativita",
    contents: [
      {
        id: "ops_projects",
        name: "Pipeline",
        icon: <Icons.LayoutKanban />,
        path: "/projects",
        requiredModule: "projects",
        requiredPermission: "projects.view",
        childrens: [
          {
            name: "Bacheca",
            path: "/projects",
            grp_name: "apps",
          },

          {
            name: "Impostazioni",
            path: "/projects/settings/pipeline",
            requiredPermission: "projects.edit",
            grp_name: "apps",
          },
        ],
      },
      {
        id: "ops_checklists",
        name: "Memo Operativi",
        icon: <Icons.ListDetails />,
        path: "/checklists/templates",
        requiredModule: "checklists",
        requiredPermission: "checklists.view",
        childrens: [
          {
            name: "Memo Operativi",
            path: "/checklists/templates",
            requiredPermission: "checklists.view",
            grp_name: "apps",
          },
        ],
      },
      {
        id: "ops_calendar",
        name: "Calendario",
        icon: <Icons.CalendarTime />,
        path: "/apps/calendar",
        requiredModule: "calendar",
        requiredPermission: "calendar.view",
        grp_name: "apps",
      },
    ],
  },
  {
    group: "Comunicazioni",
    contents: [
      {
        id: "comm_messaging",
        name: "Messaggi",
        icon: <Icons.Inbox />,
        path: "/apps/email",
        requiredModule: "messages",
        requiredPermission: "messages.view",
        grp_name: "apps",
      },
    ],
  },
  {
    group: "Sicurezza",
    contents: [
      {
        id: "security_roles",
        name: "Ruoli e permessi",
        icon: <Icons.LockAccess />,
        path: "/settings/roles",
        requiredPermission: "roles.view",
        grp_name: "apps",
      },
      {
        id: "security_departments",
        name: "Reparti",
        icon: <Icons.BuildingCommunity />,
        path: "/settings/departments",
        requiredPermission: "departments.view",
        grp_name: "apps",
      },
      {
        id: "security_audit",
        name: "Audit",
        icon: <Icons.History />,
        path: "/audit",
        requiredModule: "audit",
        requiredPermission: "audit.view",
        grp_name: "apps",
      },
    ],
  },
  {
    group: "Account",
    contents: [
      {
        id: "account_profile",
        name: "Profilo",
        icon: <Icons.UserSearch />,
        path: "/pages",
        childrens: [
          {
            name: "Il Mio Profilo",
            path: "/pages/profile",
            grp_name: "apps",
          },
          {
            name: "Modifica Profilo",
            path: "/pages/edit-profile",
            grp_name: "apps",
          },
          {
            name: "Impostazioni Account",
            path: "/pages/account",
            grp_name: "apps",
          },
          {
            name: "Scorciatoie",
            path: "/settings/shortcuts",
            grp_name: "apps",
          },
          {
            name: "Branding Workspace",
            path: "/pages/workspace-branding",
            requiredModule: "branding",
            requiredPermission: "branding.manage",
            grp_name: "apps",
          },
          {
            name: "Gestione Moduli",
            path: "/settings/modules",
            requiredModule: "modules",
            requiredPermission: "modules.manage",
            grp_name: "apps",
          },
          {
            name: "Server di posta",
            path: "/settings/mail-server",
            requiredModule: "mail",
            requiredPermission: "mail.manage",
            grp_name: "apps",
          },
          {
            name: "Theme Preview",
            path: "/settings/theme-preview",
            grp_name: "apps",
          },
          {
            name: "Responsive QA",
            path: "/settings/responsive-qa",
            grp_name: "apps",
          },
        ],
      },
    ],
  },
];
