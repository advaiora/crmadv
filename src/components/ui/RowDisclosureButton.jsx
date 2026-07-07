import React from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * Bottone "linguetta" (chevron) per aprire/chiudere i dettagli di una riga in una
 * lista/tabella. Generico e riusabile su piu' viste. Ferma la propagazione del
 * click cosi' non innesca eventuali onClick della riga (es. navigazione).
 *
 * Props:
 * - expanded: boolean
 * - onToggle: () => void
 * - controlsId: string  (id del pannello, per aria-controls)
 * - label: string       (descrizione dell'entita', per aria-label)
 */
const RowDisclosureButton = ({ expanded = false, onToggle, controlsId, label = '' }) => (
  <button
    type="button"
    className="ui-row-disclosure"
    onClick={(event) => {
      event.stopPropagation();
      onToggle?.();
    }}
    aria-expanded={expanded}
    aria-controls={controlsId}
    aria-label={expanded ? `Nascondi dettagli ${label}`.trim() : `Mostra dettagli ${label}`.trim()}
  >
    <ChevronRight size={16} />
  </button>
);

export default RowDisclosureButton;
