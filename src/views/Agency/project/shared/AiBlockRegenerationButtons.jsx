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
}) => (
  <div className="d-flex flex-wrap gap-2">
    {blocks.map((block) => (
      <Button
        key={block.key}
        type="button"
        size="sm"
        variant="outline-primary"
        onClick={() => onGenerate(block.key)}
        disabled={Boolean(generatingKey) || disabled}
      >
        {generatingKey === block.key
          ? busyLabel
          : <><i className="bi bi-stars me-1" aria-hidden="true" />{block.label}</>}
      </Button>
    ))}
  </div>
);

export default AiBlockRegenerationButtons;
