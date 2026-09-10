// Funzioni pure di formattazione per TopNav.jsx, estratte per tenerlo sotto le
// 500 righe (regola dimensione file del 5/8/2026): niente stato, niente hook,
// solo trasformazioni di dati in etichette per lo schermo.

const ACTION_LABELS = {
  'me.view': 'Profilo e permessi visualizzati',
  'quotes.email.send': 'Email preventivo inviata',
  'quotes.email.resend': 'Email preventivo reinviata',
  'quotes.create': 'Preventivo creato',
  'quotes.update': 'Preventivo aggiornato',
  'quotes.delete': 'Preventivo eliminato',
  'clients.create': 'Cliente creato',
  'clients.update': 'Cliente aggiornato',
  'clients.delete': 'Cliente eliminato',
  'vault.create': 'Credenziale creata',
  'vault.edit': 'Credenziale aggiornata',
  'vault.delete': 'Credenziale eliminata',
  'vault.reveal': 'Credenziale visualizzata',
  'vault.reveal_denied': 'Visualizzazione credenziale negata',
  'roles.assign': 'Ruolo assegnato',
  'roles.update': 'Ruolo aggiornato',
  'roles.create': 'Ruolo creato',
  'roles.delete': 'Ruolo eliminato',
  'modules.enable': 'Modulo attivato',
  'modules.disable': 'Modulo disattivato',
  'branding.update': 'Branding workspace aggiornato',
};

export const prettifyAction = (action) => {
  if (!action || typeof action !== 'string') {
    return 'Attivita registrata';
  }

  return ACTION_LABELS[action] || action.replaceAll('.', ' ');
};

export const formatActivityTime = (isoDate) => {
  if (!isoDate) {
    return '';
  }

  const parsedDate = new Date(isoDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  return parsedDate.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const buildInitials = (value) => {
  if (!value || typeof value !== 'string') {
    return 'U';
  }

  const words = value
    .trim()
    .split(' ')
    .filter(Boolean);

  if (words.length === 0) {
    return 'U';
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

export const resolveMobilePageTitle = (pathname) => {
  if (!pathname || pathname === '/') {
    return 'Dashboard';
  }

  if (pathname.startsWith('/dashboard')) return 'Dashboard';
  if (pathname.startsWith('/agency')) return 'Produzione AI';
  if (pathname.startsWith('/apps/clients')) return 'Clienti';
  if (pathname.startsWith('/projects')) return 'Progetti';
  if (pathname.startsWith('/apps/quotes')) return 'Preventivi';
  if (pathname.startsWith('/apps/team')) return 'Team';
  if (pathname.startsWith('/apps/email')) return 'Messaggi';
  if (pathname.startsWith('/apps/calendar')) return 'Calendario';
  if (pathname.startsWith('/apps/vault')) return 'Credenziali';
  if (pathname.startsWith('/apps/web-assets')) return 'Siti in gestione';
  if (pathname.startsWith('/audit')) return 'Audit';
  if (pathname.startsWith('/pages/profile')) return 'Profilo';
  if (pathname.startsWith('/settings')) return 'Impostazioni';

  return 'CRM';
};
