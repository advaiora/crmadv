import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useHistory } from 'react-router-dom';
import { SHORTCUT_GROUPS, isMacPlatform, stepTokens, tokenLabel } from './shortcutCommands';
import './shortcuts.css';

// Chip visivi per una scorciatoia: token in <kbd>, "poi" tra i passi di una sequenza.
const KeysBadge = ({ keys }) => {
  const isMac = isMacPlatform();
  return (
    <span className="sc-keys">
      {keys.map((step, stepIndex) => (
        <React.Fragment key={`${step}-${stepIndex}`}>
          {stepIndex > 0 && <span className="sc-then">poi</span>}
          <span className="sc-chord">
            {stepTokens(step).map((token, tokenIndex) => (
              <kbd className="sc-kbd" key={`${token}-${tokenIndex}`}>
                {tokenLabel(token, isMac)}
              </kbd>
            ))}
          </span>
        </React.Fragment>
      ))}
    </span>
  );
};

const ShortcutsHelp = ({ commands, onClose }) => {
  const history = useHistory();

  // Blocca lo scroll di fondo mentre l'overlay è aperto.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const groups = SHORTCUT_GROUPS.map((group) => ({
    label: group,
    items: commands.filter((command) => command.group === group),
  })).filter((group) => group.items.length > 0);

  const goToSettings = () => {
    onClose();
    history.push('/settings/shortcuts');
  };

  return createPortal(
    <div
      className="sc-overlay"
      role="button"
      tabIndex={-1}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="sc-panel" role="dialog" aria-modal="true" aria-label="Scorciatoie da tastiera">
        <div className="sc-header">
          <h2 className="sc-title">Scorciatoie da tastiera</h2>
          <button type="button" className="sc-close" onClick={onClose} aria-label="Chiudi">
            Esc
          </button>
        </div>

        <div className="sc-body">
          {groups.map((group) => (
            <div className="sc-group" key={group.label}>
              <div className="sc-group-label">{group.label}</div>
              {group.items.map((command) => (
                <div className="sc-row" key={command.id}>
                  <span className="sc-row-label">{command.label}</span>
                  <KeysBadge keys={command.keys} />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="sc-footer">
          <span>
            Premi <kbd className="sc-kbd">?</kbd> per riaprire questo elenco
          </span>
          <button type="button" className="sc-link" onClick={goToSettings}>
            Personalizza
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ShortcutsHelp;
export { KeysBadge };
