import React from "react";
import { Button } from "react-bootstrap";

// Riga di pulsanti per rigenerare con AI una singola parte dell'output, invece
// di tutto: costa meno token ed e' piu' veloce. Mentre un blocco e' in corso
// tutti i pulsanti sono disabilitati, cosi' non partono due generazioni insieme.
// Fuori resta la cornice (titolo, descrizione, stima di costo), che Web e Ads
// impaginano in modo diverso.
const AiBlockRegenerationButtons = ({
  blocks,
  generatingKey,
  onGenerate,
  disabled = false,
  busyLabel = "Rigenerazione...",
  // L'icona a stelline sta sul singolo pulsante nella pagina Web, mentre in
  // Ads sta gia' sulla linguetta che apre il gruppo: ripeterla su ogni
  // pulsante la renderebbe rumore.
  withIcon = true,
  className = "d-flex flex-wrap gap-2",
}) => (
  <div className={className}>
    {blocks.map((block) => (
      <Button
        key={block.key}
        type="button"
        size="sm"
        variant="outline-primary"
        onClick={() => onGenerate(block.key)}
        disabled={Boolean(generatingKey) || disabled}
      >
        {generatingKey === block.key && busyLabel}
        {generatingKey !== block.key && withIcon && <i className="bi bi-stars me-1" aria-hidden="true" />}
        {generatingKey !== block.key && block.label}
      </Button>
    ))}
  </div>
);

export default AiBlockRegenerationButtons;
