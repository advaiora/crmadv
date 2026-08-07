import { hasModuleEnabled, hasPermission, isPlatformAdmin } from '../../utils/workspaceAccess';

// Funzioni condivise per la navigazione (sidebar + barra di tab dei moduli).
// Estratte da Sidebar.jsx così la sidebar e la barra di sottoschede in-pagina
// usano esattamente la stessa logica di attivazione/permessi.

export const isExternalPath = (path) => typeof path === 'string' && /^https?:\/\//i.test(path);

export const isPathActive = (currentPath, targetPath) => {
  if (!targetPath || isExternalPath(targetPath)) {
    return false;
  }

  if (currentPath === targetPath) {
    return true;
  }

  return currentPath.startsWith(`${targetPath}/`);
};

/* Evidenziazione delle sottovoci: NavLink senza `exact` considera attivo ogni
   link il cui percorso è un PREFISSO della pagina corrente, quindi
   "/apps/quotes" (Elenco) restava evidenziato anche su "/apps/quotes/new" o
   "/apps/quotes/templates". Qui la sottovoce è attiva solo sul suo percorso
   esatto o su un suo sotto-percorso NON coperto da una voce sorella più
   specifica (così "/apps/quotes/123" accende comunque l'Elenco). */
export const buildChildIsActive = (childPath, siblings = []) => (match, location) => {
  const currentPath = location.pathname;

  if (currentPath === childPath) {
    return true;
  }

  if (!childPath || !currentPath.startsWith(`${childPath}/`)) {
    return false;
  }

  return !siblings.some((sibling) => (
    sibling.path &&
    sibling.path !== childPath &&
    (currentPath === sibling.path || currentPath.startsWith(`${sibling.path}/`))
  ));
};

export const hasActivePath = (items, currentPath) => {
  if (!Array.isArray(items) || items.length === 0) {
    return false;
  }

  return items.some((item) => (
    isPathActive(currentPath, item.path) ||
    (Array.isArray(item.childrens) && hasActivePath(item.childrens, currentPath))
  ));
};

export const canRenderMenuEntry = (entry, access) => {
  if (entry.requirePlatformAdmin && !isPlatformAdmin(access)) {
    return false;
  }

  if (entry.requiredModule && !hasModuleEnabled(access, entry.requiredModule)) {
    return false;
  }

  // Un elenco significa "basta uno di questi", non "servono tutti": lo usa la voce
  // Impostazioni AI, che apre una pagina con due pannelli governati da due permessi
  // diversi (impostazioni e budget). Chi ne ha uno solo deve poterci arrivare.
  if (Array.isArray(entry.requiredPermission)) {
    if (!entry.requiredPermission.some((key) => hasPermission(access, key))) {
      return false;
    }
    return true;
  }

  if (entry.requiredPermission && !hasPermission(access, entry.requiredPermission)) {
    return false;
  }

  return true;
};

export const filterMenuEntries = (entries, access) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  return entries.reduce((accumulator, entry) => {
    if (!canRenderMenuEntry(entry, access)) {
      return accumulator;
    }

    const nextEntry = { ...entry };
    if (Array.isArray(entry.childrens)) {
      const filteredChildren = filterMenuEntries(entry.childrens, access);
      if (filteredChildren.length === 0) {
        if (!entry.path) {
          return accumulator;
        }

        delete nextEntry.childrens;
      } else {
        nextEntry.childrens = filteredChildren;
      }
    }

    accumulator.push(nextEntry);
    return accumulator;
  }, []);
};

// Percorso di destinazione della voce principale nella sidebar. Se la voce ha
// sottoschede, punta alla PRIMA sottoscheda reale (non al "contenitore", che
// potrebbe non essere una rotta valida: es. "Profilo" → /pages non esiste, ma
// /pages/profile sì). Altrimenti usa il percorso proprio della voce.
export const resolveMenuLinkPath = (menu) => {
  if (Array.isArray(menu.childrens) && menu.childrens.length > 0) {
    const firstUsable = menu.childrens.find((child) => child.path && !isExternalPath(child.path));
    if (firstUsable) {
      return firstUsable.path;
    }
  }
  return menu.path;
};

// Trova il modulo (voce principale) attivo per il percorso corrente, con le sue
// sottoschede già filtrate per permessi/moduli. Ritorna null se il percorso non
// appartiene a un modulo con sottoschede visibili.
export const findActiveModuleWithTabs = (menuGroups, currentPath) => {
  for (const group of menuGroups) {
    for (const menu of group.contents) {
      if (!Array.isArray(menu.childrens) || menu.childrens.length === 0) {
        continue;
      }

      const matches = isPathActive(currentPath, menu.path) || hasActivePath(menu.childrens, currentPath);
      if (matches) {
        return menu;
      }
    }
  }

  return null;
};
