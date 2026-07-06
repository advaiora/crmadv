import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Card } from 'react-bootstrap';
import { KeysBadge } from '../../components/shortcuts/ShortcutsHelp';
import {
  SHORTCUT_GROUPS,
  eventToStep,
  formatKeys,
  stepHasModifier,
} from '../../components/shortcuts/shortcutCommands';
import { findConflict, setCapturing } from '../../components/shortcuts/shortcutsStore';
import { useShortcuts } from '../../components/shortcuts/useShortcuts';
import '../../components/shortcuts/shortcuts.css';

// Dopo l'ultimo tasto secco aspettiamo un attimo per capire se è una sequenza
// (es. "g" poi "d") oppure una scorciatoia a tasto singolo (es. "c").
const SEQUENCE_CAPTURE_MS = 650;

const ShortcutsSettings = () => {
  const { commands, setBinding, resetBinding, resetAllBindings } = useShortcuts();
  const [editingId, setEditingId] = useState(null);
  const [pending, setPending] = useState([]);
  const [conflict, setConflict] = useState(null);

  // Ref "vivi" per il listener di registrazione (evita closure stantie).
  const editingIdRef = useRef(null);
  const pendingRef = useRef([]);
  const timerRef = useRef(null);

  // Sincronizza i ref dopo il render (i ref non vanno scritti durante il render).
  useEffect(() => {
    editingIdRef.current = editingId;
    pendingRef.current = pending;
  });

  const stopEditing = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setCapturing(false);
    setEditingId(null);
    setPending([]);
  }, []);

  const commit = useCallback(
    (keys) => {
      const id = editingIdRef.current;
      if (!id) {
        return;
      }
      const existing = findConflict(id, keys);
      if (existing) {
        // Conflitto: non salviamo, mostriamo da chi è già usata e restiamo in ascolto.
        setConflict({ keys, command: existing });
        setPending([]);
        pendingRef.current = [];
        return;
      }
      setBinding(id, keys);
      stopEditing();
    },
    [setBinding, stopEditing],
  );

  const startEditing = useCallback((id) => {
    setConflict(null);
    setPending([]);
    pendingRef.current = [];
    setEditingId(id);
    setCapturing(true);
  }, []);

  // Listener di registrazione attivo solo mentre si modifica una riga.
  useEffect(() => {
    if (!editingId) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        stopEditing();
        return;
      }

      const step = eventToStep(event);
      if (!step) {
        return; // solo modificatori premuti: aspettiamo il tasto vero
      }

      event.preventDefault();
      event.stopPropagation();
      setConflict(null);

      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      // Chord con modificatore → scorciatoia a passo singolo, salvata subito.
      if (stepHasModifier(step)) {
        commit([step]);
        return;
      }

      // Tasto secco: potrebbe essere una sequenza. Accumuliamo fino a 2 passi.
      const next = [...pendingRef.current, step];
      pendingRef.current = next;
      setPending(next);

      if (next.length >= 2) {
        commit(next);
        return;
      }

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        commit(pendingRef.current);
      }, SEQUENCE_CAPTURE_MS);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [editingId, commit, stopEditing]);

  // Pulizia se il componente viene smontato durante una registrazione.
  useEffect(() => () => setCapturing(false), []);

  const anyCustom = commands.some((command) => command.isCustom);

  const groups = SHORTCUT_GROUPS.map((group) => ({
    label: group,
    items: commands.filter((command) => command.group === group),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="container-fluid py-4">
      <div className="hk-pg-header pb-3 d-flex flex-wrap justify-content-between align-items-end gap-2">
        <div>
          <h1 className="pg-title mb-1">Scorciatoie da tastiera</h1>
          <p className="text-muted mb-0">
            Personalizza le combinazioni. Premi <kbd className="sc-kbd">?</kbd> ovunque per
            rivedere l&apos;elenco. Le scelte restano su questo dispositivo.
          </p>
        </div>
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={resetAllBindings}
          disabled={!anyCustom}
        >
          Ripristina tutte
        </Button>
      </div>

      <Card className="card-border">
        <Card.Body>
          {groups.map((group) => (
            <div className="mb-4" key={group.label}>
              <div className="sc-group-label px-0">{group.label}</div>
              {group.items.map((command) => {
                const isEditing = editingId === command.id;
                const showConflict = isEditing && conflict;
                return (
                  <div className="sc-settings-row" key={command.id}>
                    <span className="sc-settings-label">{command.label}</span>
                    <div className="sc-settings-controls">
                      {isEditing ? (
                        <span
                          className={`sc-capture-hint${showConflict ? ' is-conflict' : ''}`}
                        >
                          {showConflict
                            ? `«${formatKeys(conflict.keys)}» è già di "${conflict.command.label}". Riprova.`
                            : pending.length > 0
                              ? `${formatKeys(pending)}…`
                              : 'Premi la combinazione… (Esc annulla)'}
                        </span>
                      ) : (
                        <KeysBadge keys={command.keys} />
                      )}

                      {isEditing ? (
                        <Button variant="outline-secondary" size="sm" onClick={stopEditing}>
                          Annulla
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => startEditing(command.id)}
                          >
                            Modifica
                          </Button>
                          {command.isCustom && (
                            <Button
                              variant="link"
                              size="sm"
                              className="text-muted p-0 px-1"
                              onClick={() => resetBinding(command.id)}
                            >
                              Ripristina
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </Card.Body>
      </Card>
    </div>
  );
};

export default ShortcutsSettings;
