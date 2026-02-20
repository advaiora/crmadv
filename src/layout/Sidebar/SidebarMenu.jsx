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
        path: "/apps/invoices",
        childrens: [
          {
            name: "Elenco Preventivi",
            path: "/apps/invoices/invoice-list",
            grp_name: "apps",
          },
          {
            name: "Crea Preventivo",
            path: "/apps/invoices/create-invoice",
            grp_name: "apps",
          },
          {
            name: "Template Preventivi",
            path: "/apps/invoices/invoice-templates",
            grp_name: "apps",
          },
          {
            name: "Anteprima Preventivo",
            path: "/apps/invoices/invoice-preview",
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
        name: "Calendario",
        icon: <Icons.CalendarTime />,
        path: "/apps/calendar",
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
