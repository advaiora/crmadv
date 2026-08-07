import React from "react";
import { Button } from "react-bootstrap";
import AiCostEstimate from "../../AiCostEstimate";
import AiBlockRegenerationButtons from "../shared/AiBlockRegenerationButtons";
import { formatDateTime } from "./adsFormatDateTime";
import { ADS_AI_ASSET_BLOCKS } from "./adsPageConstants";

// Barra in cima alla pagina Ads. Le azioni AI stanno sotto una linguetta
// ("Rigenera asset AI") mentre le bozze base sono in chiaro: e' l'opposto
// della pagina Web, dove sotto la linguetta ci sono le azioni base.
const AdsGenerationActionsBar = ({
  lastGeneratedAt,
  lastUpdatedAt,
  loading,
  saving,
  generatingAssetKey,
  aiUnavailable,
  estimate,
  aiConfigured,
  onGenerateGoogle,
  onGenerateMeta,
  onGenerateOperational,
  onRegenerateAll,
  onGenerateAsset,
  onReload,
  onSave,
}) => (
  <div className="d-flex justify-content-between align-items-center mb-3">
    <div className="small text-muted">
      {lastGeneratedAt
        ? `Ultima generazione: ${formatDateTime(lastGeneratedAt)}`
        : "Nessuna generazione registrata."}
      {lastUpdatedAt && (
        <span className="d-block">Ultimo salvataggio: {formatDateTime(lastUpdatedAt)}</span>
      )}
    </div>
    <div className="d-flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline-secondary" onClick={onGenerateGoogle}>
        Genera Google Ads
      </Button>
      <Button type="button" size="sm" variant="outline-secondary" onClick={onGenerateMeta}>
        Genera Meta Ads
      </Button>
      <Button type="button" size="sm" variant="outline-secondary" onClick={onGenerateOperational}>
        Genera checklist
      </Button>
      <Button type="button" size="sm" variant="outline-secondary" onClick={onRegenerateAll}>
        Rigenerazione controllata
      </Button>
      <details className="small">
        <summary className="btn btn-sm btn-outline-primary">
          <i className="bi bi-stars me-1" aria-hidden="true" />Rigenera asset AI
        </summary>
        <div className="mt-2">
          <AiCostEstimate estimate={estimate} aiConfigured={aiConfigured} />
        </div>
        <AiBlockRegenerationButtons
          blocks={ADS_AI_ASSET_BLOCKS}
          generatingKey={generatingAssetKey}
          onGenerate={onGenerateAsset}
          disabled={aiUnavailable}
          withIcon={false}
          className="d-flex flex-wrap gap-2 mt-2"
        />
      </details>
      <Button type="button" size="sm" variant="outline-primary" onClick={onReload} disabled={loading || saving}>
        Ricarica
      </Button>
      <Button type="button" size="sm" variant="primary" onClick={onSave} disabled={saving}>
        {saving ? "Salvataggio..." : "Salva Campagne ADS"}
      </Button>
    </div>
  </div>
);

export default AdsGenerationActionsBar;
