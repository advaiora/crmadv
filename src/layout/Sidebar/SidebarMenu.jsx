import * as Icons from "tabler-icons-react";

export const SidebarMenu = [
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
        name: "Agency",
        icon: <Icons.Briefcase />,
        path: "/agency/projects",
        requiredModule: "projects",
        requiredPermission: "projects.view",
        childrens: [
          {
            name: "Progetti Agency",
            path: "/agency/projects",
            requiredPermission: "projects.view",
            grp_name: "apps",
          },
          {
            name: "Alert",
            path: "/agency/alerts",
            requiredPermission: "dashboard.view",
            grp_name: "apps",
          },
          {
            name: "Opportunita",
            path: "/agency/opportunities",
            requiredPermission: "projects.view",
            grp_name: "apps",
          },
          {
            name: "Report",
            path: "/agency/reports",
            requiredPermission: "dashboard.view",
            grp_name: "apps",
          },
          {
            name: "Impostazioni Agency",
            path: "/agency/settings",
            requiredPermission: "modules.manage",
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
        name: "Web Assets",
        icon: <Icons.Code />,
        path: "/apps/web-assets",
        requiredModule: "web",
        requiredPermission: "web.view",
        childrens: [
          {
            name: "Web Asset Management",
            path: "/apps/web-assets",
            requiredPermission: "web.view",
            grp_name: "apps",
          },
        ],
      },
      {
        id: "crm_vault",
        name: "Vault",
        icon: <Icons.Lock />,
        path: "/apps/vault",
        requiredModule: "vault",
        requiredPermission: "vault.view_list",
        childrens: [
          {
            name: "Vault",
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
        name: "Progetti",
        icon: <Icons.LayoutKanban />,
        path: "/projects",
        requiredModule: "projects",
        requiredPermission: "projects.view",
        childrens: [
          {
            name: "Board",
            path: "/projects",
            grp_name: "apps",
          },

          {
            name: "Impostazioni Pipeline",
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
    group: "Piattaforma",
    contents: [
      {
        id: "platform_console",
        name: "Console piattaforma",
        icon: <Icons.World />,
        path: "/settings/platform-console",
        requirePlatformAdmin: true,
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
