import * as Icons from "tabler-icons-react";

export const SidebarMenu = [
  {
    group: "",
    contents: [
      {
        name: "Dashboard",
        icon: <Icons.Template />,
        path: "/dashboard",
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
            name: "Lista Clienti",
            path: "/apps/clients",
            grp_name: "apps",
          },
          {
            name: "Nuovo Cliente",
            path: "/apps/clients/new",
            requiredPermission: "clients.create",
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
            name: "Crea Preventivo",
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
            name: "Asset Web",
            path: "/apps/web-assets",
            requiredPermission: "web.view",
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
            name: "Libreria Memo",
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
        name: "Email",
        icon: <Icons.Inbox />,
        path: "/apps/email",
        grp_name: "apps",
      },
      {
        id: "comm_chat",
        name: "Chat",
        icon: <Icons.MessageDots />,
        path: "/apps/chat",
        childrens: [
          {
            name: "Conversazioni",
            path: "/apps/chat/chats",
            grp_name: "apps",
          },
          {
            name: "Gruppi",
            path: "/apps/chat/chat-groups",
            grp_name: "apps",
          },
          {
            name: "Contatti Chat",
            path: "/apps/chat/chat-contact",
            grp_name: "apps",
          },
        ],
      },
      {
        id: "comm_chatbot",
        name: "Chatbot",
        icon: <Icons.MessageCircle />,
        path: "/apps/chat-bot",
        childrens: [
          {
            name: "Direct Message",
            path: "/apps/chat-bot/chatpopup",
            grp_name: "apps",
          },
          {
            name: "Assistente",
            path: "/apps/chat-bot/chatbot",
            grp_name: "apps",
          },
        ],
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
            name: "Branding Workspace",
            path: "/pages/workspace-branding",
            requiredModule: "branding",
            requiredPermission: "branding.manage",
            grp_name: "apps",
          },
        ],
      },
      {
        name: "Integrazioni",
        icon: <Icons.Code />,
        path: "/apps/integrations/all-apps",
        grp_name: "apps",
      },
    ],
  },
];
