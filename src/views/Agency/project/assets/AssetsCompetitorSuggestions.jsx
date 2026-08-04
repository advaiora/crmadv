import React from "react";
import { Badge, Button } from "react-bootstrap";
import { deriveNameFromUrl } from "./assetsFormatters";

// I competitor proposti dalla ricerca online. Sono proposte, non fonti: si
// aggiungono al progetto solo quando qualcuno le conferma una per una.
const AssetsCompetitorSuggestions = ({ suggestions, onConfirm }) => {
  if (!suggestions?.length) {
    return null;
  }

  return (
    <div className="border rounded p-3 mb-3 agency-tile">
      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
        <div>
          <div className="fw-semibold small">Suggerimenti trovati online</div>
          <div className="small text-muted">Conferma solo i competitor pertinenti: verranno aggiunti alle fonti progetto.</div>
        </div>
        <Badge bg="info">Ricerca AI</Badge>
      </div>
      <div className="d-grid gap-2">
        {suggestions.map((suggestion) => (
          <div key={suggestion.id || suggestion.url} className="d-flex flex-column flex-md-row justify-content-between gap-2 border rounded p-2 agency-tile">
            <div>
              <div className="fw-semibold small">{suggestion.name || deriveNameFromUrl(suggestion.url)}</div>
              <a className="small" href={suggestion.url} target="_blank" rel="noreferrer">{suggestion.url}</a>
              {suggestion.reason && <div className="small text-muted mt-1">{suggestion.reason}</div>}
              {typeof suggestion.confidence === "number" && (
                <div className="small text-muted">Affidabilita suggerimento: {Math.round(suggestion.confidence * 100)}%</div>
              )}
            </div>
            <div className="d-flex align-items-start gap-2">
              <Button size="sm" variant="outline-success" onClick={() => onConfirm(suggestion)}>
                Conferma
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AssetsCompetitorSuggestions;
