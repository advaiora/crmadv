import React from "react";
import { Badge } from "react-bootstrap";

// Badge discreto con la stima di costo di un pulsante AI (V4 — cost control).
// Mostra un range indicativo in USD accanto al pulsante. Non compare se l'AI non
// è configurata (in quel caso la generazione è rule-based, gratuita) o se la
// stima non è disponibile. Il range si affina da solo: "indicativo" finché non
// c'è storico, poi "basato su N usi".

const formatUsd = (value) => {
  const n = Number(value || 0);
  // Costi molto piccoli: mostra abbastanza cifre da non collassare a $0.00.
  return `$${n < 0.1 ? n.toFixed(4) : n.toFixed(2)}`;
};

const AiCostEstimate = ({ estimate, aiConfigured, className }) => {
  if (!aiConfigured || !estimate) {
    return null;
  }

  const { minUsd, maxUsd, basis, sampleSize } = estimate;
  const range =
    minUsd === maxUsd ? `~${formatUsd(minUsd)}` : `~${formatUsd(minUsd)}–${formatUsd(maxUsd)}`;
  const tooltip =
    basis === "history"
      ? `Stima basata su ${sampleSize} us${sampleSize === 1 ? "o" : "i"} recent${sampleSize === 1 ? "e" : "i"} di questa azione.`
      : "Stima indicativa: si affinerà con l'uso di questa azione.";

  return (
    <Badge
      bg="light"
      text="secondary"
      className={`fw-normal border${className ? ` ${className}` : ""}`}
      title={tooltip}
      role="note"
    >
      <span className="text-muted me-1">Costo stimato</span>
      {range}
      {basis !== "history" && <span className="text-muted ms-1">(indicativo)</span>}
    </Badge>
  );
};

export default AiCostEstimate;
