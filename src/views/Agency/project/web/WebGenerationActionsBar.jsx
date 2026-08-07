import React from "react";
import { Button } from "react-bootstrap";
import AiCostEstimate from "../../AiCostEstimate";

// Barra in cima alla pagina Web: a sinistra quando si e' generato e salvato
// l'ultima volta, a destra le azioni. Le quattro azioni di dettaglio (struttura,
// copy, wireframe, preview) stanno sotto "Azioni avanzate" per non affollare la
// riga: l'uso normale e' "Genera con AI" oppure "Genera bozza base".
const WebGenerationActionsBar = ({
  lastGeneratedAt,
  lastUpdatedAt,
  estimate,
  aiConfigured,
  aiUnavailable,
  generatingAi,
  loading,
  saving,
  onGenerateAi,
  onGenerateBaseDraft,
  onGenerateStructure,
  onGenerateCopy,
  onGenerateWireframe,
  onGeneratePreview,
  onReload,
  onSave,
}) => (
  <div className="d-flex justify-content-between align-items-center mb-3">
    <div className="small text-muted">
      {lastGeneratedAt ? `Ultima generazione: ${lastGeneratedAt}` : "Nessuna generazione registrata."}
      {lastUpdatedAt && (
        <span className="d-block">Ultimo salvataggio: {lastUpdatedAt}</span>
      )}
    </div>
    <div className="d-flex flex-wrap gap-2 align-items-center">
      <AiCostEstimate estimate={estimate} aiConfigured={aiConfigured} />
      <Button
        type="button"
        size="sm"
        variant="primary"
        onClick={() => onGenerateAi()}
        disabled={generatingAi || aiUnavailable}
        title={aiUnavailable ? "AI non configurata lato server" : "Genera output Web con AI"}
      >
        {generatingAi
          ? "Generazione AI..."
          : <><i className="bi bi-stars me-1" aria-hidden="true" />Genera con AI</>}
      </Button>
      <Button type="button" size="sm" variant="outline-secondary" onClick={onGenerateBaseDraft}>
        Genera bozza base
      </Button>
      <details className="small">
        <summary className="btn btn-sm btn-outline-secondary">Azioni avanzate</summary>
        <div className="d-flex flex-wrap gap-2 mt-2">
          <Button type="button" size="sm" variant="outline-secondary" onClick={onGenerateStructure}>
            Struttura
          </Button>
          <Button type="button" size="sm" variant="outline-secondary" onClick={onGenerateCopy}>
            Copy base
          </Button>
          <Button type="button" size="sm" variant="outline-secondary" onClick={onGenerateWireframe}>
            Wireframe
          </Button>
          <Button type="button" size="sm" variant="outline-secondary" onClick={onGeneratePreview}>
            Preview
          </Button>
        </div>
      </details>
      <Button type="button" size="sm" variant="outline-primary" onClick={onReload} disabled={loading || saving}>
        Ricarica
      </Button>
      <Button type="button" size="sm" variant="primary" onClick={onSave} disabled={saving}>
        {saving ? "Salvataggio..." : "Salva Contenuti Web"}
      </Button>
    </div>
  </div>
);

export default WebGenerationActionsBar;
