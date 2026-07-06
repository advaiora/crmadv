import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useHistory } from 'react-router-dom';
import { FileText, FolderKanban, Search, Users } from 'lucide-react';
import { SidebarMenu } from '../../layout/Sidebar/SidebarMenu';
import { fetchWorkspaceAccess, hasModuleEnabled, hasPermission } from '../../utils/workspaceAccess';
import { listClients } from '../../modules/clients/ui/clientApi';
import { listQuotes } from '../../modules/quotes/api/quotesApi';
import { listProjects } from '../../modules/projects/api/projects.api';
import './command-palette.css';

export const COMMAND_PALETTE_OPEN_EVENT = 'command-palette:open';
export const COMMAND_PALETTE_TOGGLE_EVENT = 'command-palette:toggle';

const SEARCH_DEBOUNCE_MS = 250;
const ENTITY_PAGE_SIZE = 6;

// Normalizza per il confronto: minuscolo e senza accenti, così "città" trova "citta".
const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const canAccessEntry = (entry, access) => {
  if (entry.requiredModule && !hasModuleEnabled(access, entry.requiredModule)) {
    return false;
  }
  if (entry.requiredPermission && !hasPermission(access, entry.requiredPermission)) {
    return false;
  }
  return true;
};

// Appiattisce il menu laterale in destinazioni "vai a", rispettando i permessi:
// le voci con sottovoci diventano una riga per sottovoce (con l'icona del padre).
const buildNavItems = (access) => {
  const items = [];

  for (const group of SidebarMenu) {
    for (const entry of group.contents) {
      if (!canAccessEntry(entry, access)) {
        continue;
      }

      const groupLabel = group.group || 'Generale';

      if (Array.isArray(entry.childrens) && entry.childrens.length > 0) {
        for (const child of entry.childrens) {
          if (!canAccessEntry(child, access)) {
            continue;
          }
          items.push({
            id: `nav:${child.path}`,
            kind: 'nav',
            label: child.name,
            sub: entry.name,
            group: groupLabel,
            path: child.path,
            icon: entry.icon,
          });
        }
      } else if (entry.path) {
        items.push({
          id: `nav:${entry.path}`,
          kind: 'nav',
          label: entry.name,
          sub: null,
          group: groupLabel,
          path: entry.path,
          icon: entry.icon,
        });
      }
    }
  }

  return items;
};

const shortQuoteId = (id) => String(id || '').slice(0, 6).toUpperCase();

const formatQuoteTotal = (total, currency) => {
  const amount = Number(total);
  if (!Number.isFinite(amount)) {
    return '';
  }
  try {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: currency || 'EUR',
    }).format(amount);
  } catch (_error) {
    return `${amount} ${currency || 'EUR'}`;
  }
};

const CommandPalette = () => {
  const history = useHistory();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [access, setAccess] = useState(null);
  const [entity, setEntity] = useState({ clients: [], quotes: [], projects: [], loading: false });

  const inputRef = useRef(null);
  const listRef = useRef(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setEntity({ clients: [], quotes: [], projects: [], loading: false });
  }, []);

  // Apertura via eventi: il gestore scorciatoie possiede la combinazione da tastiera
  // (Cmd/Ctrl+K di default, rimappabile) e ci apre/chiude tramite questi eventi.
  useEffect(() => {
    const onOpenEvent = () => setOpen(true);
    const onToggleEvent = () => setOpen((current) => !current);

    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpenEvent);
    window.addEventListener(COMMAND_PALETTE_TOGGLE_EVENT, onToggleEvent);
    return () => {
      window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpenEvent);
      window.removeEventListener(COMMAND_PALETTE_TOGGLE_EVENT, onToggleEvent);
    };
  }, []);

  // Permessi: caricati alla prima apertura (nessuna richiesta per chi non la usa).
  useEffect(() => {
    if (open && !access) {
      fetchWorkspaceAccess().then(setAccess).catch(() => {});
    }
  }, [open, access]);

  // Focus input + blocco scroll di fondo mentre è aperta.
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    setActiveIndex(0);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  const canSearchClients = hasModuleEnabled(access, 'clients') && hasPermission(access, 'clients.view');
  const canSearchQuotes = hasModuleEnabled(access, 'quotes') && hasPermission(access, 'quotes.view');
  const canSearchProjects = hasModuleEnabled(access, 'projects') && hasPermission(access, 'projects.view');

  // Ricerca entità con debounce, ignorando le risposte scadute.
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setEntity({ clients: [], quotes: [], projects: [], loading: false });
      return undefined;
    }

    let cancelled = false;
    setEntity((current) => ({ ...current, loading: true }));

    const timer = window.setTimeout(async () => {
      const clientsTask = canSearchClients
        ? listClients({ query: trimmed, pageSize: ENTITY_PAGE_SIZE })
            .then((result) => (Array.isArray(result?.items) ? result.items : []))
            .catch(() => [])
        : Promise.resolve([]);
      const quotesTask = canSearchQuotes
        ? listQuotes({ q: trimmed, pageSize: ENTITY_PAGE_SIZE })
            .then((result) => (Array.isArray(result?.items) ? result.items : []))
            .catch(() => [])
        : Promise.resolve([]);
      const projectsTask = canSearchProjects
        ? listProjects({ query: trimmed })
            .then((items) => (Array.isArray(items) ? items.slice(0, ENTITY_PAGE_SIZE) : []))
            .catch(() => [])
        : Promise.resolve([]);

      const [clients, quotes, projects] = await Promise.all([clientsTask, quotesTask, projectsTask]);
      if (!cancelled) {
        setEntity({ clients, quotes, projects, loading: false });
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open, canSearchClients, canSearchQuotes, canSearchProjects]);

  const navItems = useMemo(() => buildNavItems(access), [access]);

  // Costruisce le sezioni visibili in base alla query.
  const sections = useMemo(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      const byGroup = new Map();
      for (const item of navItems) {
        if (!byGroup.has(item.group)) {
          byGroup.set(item.group, []);
        }
        byGroup.get(item.group).push(item);
      }
      return Array.from(byGroup.entries()).map(([label, items]) => ({ key: label, label, items }));
    }

    const needle = normalize(trimmed);
    const navMatches = navItems
      .filter((item) => normalize(`${item.label} ${item.sub || ''}`).includes(needle))
      .slice(0, 8);

    const result = [];
    if (navMatches.length > 0) {
      result.push({ key: 'nav', label: 'Vai a', items: navMatches });
    }

    if (entity.clients.length > 0) {
      result.push({
        key: 'clients',
        label: 'Clienti',
        items: entity.clients.map((client) => ({
          id: `client:${client.id}`,
          kind: 'client',
          label: client.name || 'Cliente senza nome',
          sub: client.email || (client.type === 'company' ? 'Azienda' : 'Persona'),
          path: `/apps/clients/${client.id}`,
          icon: <Users size={16} />,
        })),
      });
    }

    if (entity.quotes.length > 0) {
      result.push({
        key: 'quotes',
        label: 'Preventivi',
        items: entity.quotes.map((quote) => ({
          id: `quote:${quote.id}`,
          kind: 'quote',
          label: `#${shortQuoteId(quote.id)} · ${quote?.client?.name || 'Cliente'}`,
          sub: [quote.status, formatQuoteTotal(quote.total, quote.currency)].filter(Boolean).join(' · '),
          path: `/apps/quotes/${quote.id}`,
          icon: <FileText size={16} />,
        })),
      });
    }

    if (entity.projects.length > 0) {
      result.push({
        key: 'projects',
        label: 'Progetti',
        items: entity.projects.map((project) => ({
          id: `project:${project.id}`,
          kind: 'project',
          label: project.name || 'Progetto senza nome',
          sub: [project.categoryName || project.stage?.name, project.clientName].filter(Boolean).join(' · '),
          path: `/projects/${project.id}`,
          icon: <FolderKanban size={16} />,
        })),
      });
    }

    return result;
  }, [query, navItems, entity]);

  // Lista piatta selezionabile: l'ordine segue quello di rendering.
  const flatItems = useMemo(() => sections.flatMap((section) => section.items), [sections]);

  useEffect(() => {
    setActiveIndex((current) => (current >= flatItems.length ? 0 : current));
  }, [flatItems.length]);

  const goTo = useCallback(
    (item) => {
      if (!item) {
        return;
      }
      close();
      history.push(item.path);
    },
    [close, history],
  );

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (flatItems.length ? (current + 1) % flatItems.length : 0));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (flatItems.length ? (current - 1 + flatItems.length) % flatItems.length : 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      goTo(flatItems[activeIndex]);
    }
  };

  // Tiene visibile la riga selezionata durante la navigazione da tastiera.
  useEffect(() => {
    if (!open || !listRef.current) {
      return;
    }
    const activeNode = listRef.current.querySelector('.cmdk-item.is-active');
    activeNode?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  if (!open) {
    return null;
  }

  const trimmedQuery = query.trim();
  const showEmpty = trimmedQuery.length >= 2 && !entity.loading && flatItems.length === 0;

  let runningIndex = -1;

  return createPortal(
    <div
      className="cmdk-overlay"
      role="button"
      tabIndex={-1}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      }}
    >
      <div className="cmdk-panel" role="dialog" aria-modal="true" aria-label="Ricerca rapida">
        <div className="cmdk-search">
          <span className="cmdk-search-icon">
            <Search size={18} />
          </span>
          <input
            ref={inputRef}
            className="cmdk-input"
            type="text"
            placeholder="Cerca clienti, preventivi, progetti o vai a una pagina..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Cerca"
          />
          <span className="cmdk-kbd">Esc</span>
        </div>

        <div className="cmdk-results" ref={listRef}>
          {sections.map((section) => (
            <div key={section.key}>
              <div className="cmdk-group-label">{section.label}</div>
              {section.items.map((item) => {
                runningIndex += 1;
                const index = runningIndex;
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`cmdk-item${index === activeIndex ? ' is-active' : ''}`}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => goTo(item)}
                  >
                    <span className="cmdk-item-icon">{item.icon}</span>
                    <span className="cmdk-item-body">
                      <span className="cmdk-item-label">{item.label}</span>
                      {item.sub && <span className="cmdk-item-sub">{item.sub}</span>}
                    </span>
                    {item.kind === 'nav' && <span className="cmdk-item-hint">Vai</span>}
                  </button>
                );
              })}
            </div>
          ))}

          {entity.loading && <div className="cmdk-loading">Ricerca in corso...</div>}
          {showEmpty && <div className="cmdk-empty">Nessun risultato per &ldquo;{trimmedQuery}&rdquo;.</div>}
        </div>

        <div className="cmdk-footer">
          <span className="cmdk-footer-hint">
            <span className="cmdk-footer-key">↑</span>
            <span className="cmdk-footer-key">↓</span>
            Naviga
          </span>
          <span className="cmdk-footer-hint">
            <span className="cmdk-footer-key">↵</span>
            Apri
          </span>
          <span className="cmdk-footer-hint">
            <span className="cmdk-footer-key">Esc</span>
            Chiudi
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// Pulsante-scorciatoia per la barra superiore: apre la palette via evento,
// così la barra non deve conoscere lo stato interno del componente.
export const CommandPaletteTrigger = () => {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <button
      type="button"
      className="cmdk-trigger"
      onClick={() => window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_OPEN_EVENT))}
      aria-label="Apri ricerca rapida"
      title="Ricerca rapida"
    >
      <Search size={15} />
      <span className="cmdk-trigger-label d-none d-md-inline">Cerca</span>
      <span className="cmdk-trigger-kbd">{isMac ? '⌘K' : 'Ctrl K'}</span>
    </button>
  );
};

export default CommandPalette;
