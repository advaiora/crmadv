import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useTheme } from '../../utils/theme-provider/theme-provider';
import { fetchWorkspaceAccess, hasModuleEnabled, hasPermission } from '../../utils/workspaceAccess';
import { COMMAND_PALETTE_TOGGLE_EVENT } from '../command-palette/CommandPalette';
import { eventToStep, keysEqual, stepHasModifier } from './shortcutCommands';
import { isCapturing } from './shortcutsStore';
import { useShortcuts } from './useShortcuts';
import ShortcutsHelp from './ShortcutsHelp';

// Evento pubblico per aprire l'elenco scorciatoie da qualunque punto (es. un pulsante).
export const SHORTCUTS_OPEN_HELP_EVENT = 'shortcuts:open-help';

// Tempo massimo tra due tasti di una sequenza (es. "g" poi "d").
const SEQUENCE_TIMEOUT_MS = 1200;

// Verifica se il fuoco è su un campo di testo: lì i tasti secchi non devono scattare.
const isTypingTarget = (target) => {
  if (!target || typeof target.tagName !== 'string') {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable === true;
};

const canRunCommand = (command, access) => {
  if (command.requiredModule && !hasModuleEnabled(access, command.requiredModule)) {
    return false;
  }
  if (command.requiredPermission && !hasPermission(access, command.requiredPermission)) {
    return false;
  }
  return true;
};

const ShortcutsManager = () => {
  const history = useHistory();
  const { toggleTheme } = useTheme();
  const { commands } = useShortcuts();
  const [access, setAccess] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);

  // Riferimenti "vivi" per il listener globale (evita di riagganciarlo a ogni render).
  const commandsRef = useRef(commands);
  const accessRef = useRef(access);
  const helpOpenRef = useRef(helpOpen);
  const bufferRef = useRef([]);
  const timerRef = useRef(null);

  // Sincronizza i ref dopo ogni render (i ref non vanno scritti durante il render).
  useEffect(() => {
    commandsRef.current = commands;
    accessRef.current = access;
    helpOpenRef.current = helpOpen;
  });

  // Permessi: caricati una volta, servono per non aprire pagine non accessibili.
  useEffect(() => {
    let cancelled = false;
    fetchWorkspaceAccess()
      .then((result) => {
        if (!cancelled) {
          setAccess(result);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const clearBuffer = useCallback(() => {
    bufferRef.current = [];
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runCommand = useCallback(
    (command) => {
      switch (command.type) {
        case 'search':
          window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_TOGGLE_EVENT));
          break;
        case 'help':
          setHelpOpen((current) => !current);
          break;
        case 'theme':
          toggleTheme();
          break;
        case 'navigate':
          if (command.path) {
            history.push(command.path);
          }
          break;
        default:
          break;
      }
    },
    [history, toggleTheme],
  );

  const closeHelp = useCallback(() => setHelpOpen(false), []);

  // Apertura dell'overlay via evento esterno.
  useEffect(() => {
    const onOpenHelp = () => setHelpOpen(true);
    window.addEventListener(SHORTCUTS_OPEN_HELP_EVENT, onOpenHelp);
    return () => window.removeEventListener(SHORTCUTS_OPEN_HELP_EVENT, onOpenHelp);
  }, []);

  // Listener globale: agganciato una sola volta, legge i dati "vivi" dai ref.
  useEffect(() => {
    const onKeyDown = (event) => {
      // Durante la registrazione di una nuova combinazione (pagina impostazioni)
      // il gestore resta muto.
      if (isCapturing()) {
        return;
      }

      const step = eventToStep(event);
      if (!step) {
        return;
      }

      const activeCommands = commandsRef.current.filter((command) =>
        canRunCommand(command, accessRef.current),
      );

      // Con l'overlay aperto gestiamo solo la sua chiusura (Esc o la scorciatoia di aiuto).
      if (helpOpenRef.current) {
        const helpCommand = activeCommands.find((command) => command.type === 'help');
        if (step === 'escape' || (helpCommand && keysEqual([step], helpCommand.keys))) {
          event.preventDefault();
          clearBuffer();
          setHelpOpen(false);
        }
        return;
      }

      const hasModifier = stepHasModifier(step);
      const typing = isTypingTarget(event.target);

      // Nei campi di testo passano solo i chord con modificatore (es. ⌘K).
      if (typing && !hasModifier) {
        clearBuffer();
        return;
      }

      // I chord con modificatore sono a passo singolo: non fanno parte di sequenze.
      const candidate = hasModifier ? [step] : [...bufferRef.current, step];

      const matched = activeCommands.find((command) => keysEqual(command.keys, candidate));
      if (matched) {
        event.preventDefault();
        clearBuffer();
        runCommand(matched);
        return;
      }

      // La combinazione parziale è l'inizio di una sequenza? In tal caso aspettiamo il tasto dopo.
      const isPrefix =
        !hasModifier
        && activeCommands.some(
          (command) =>
            command.keys.length > candidate.length
            && keysEqual(command.keys.slice(0, candidate.length), candidate),
        );

      if (isPrefix) {
        event.preventDefault();
        bufferRef.current = candidate;
        if (timerRef.current) {
          window.clearTimeout(timerRef.current);
        }
        timerRef.current = window.setTimeout(() => {
          bufferRef.current = [];
          timerRef.current = null;
        }, SEQUENCE_TIMEOUT_MS);
        return;
      }

      clearBuffer();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [clearBuffer, runCommand]);

  if (!helpOpen) {
    return null;
  }

  const visibleCommands = commands.filter((command) => canRunCommand(command, access));
  return <ShortcutsHelp commands={visibleCommands} onClose={closeHelp} />;
};

export default ShortcutsManager;
export { ShortcutsManager };
