import React from "react";
import { Badge, Button, Spinner } from "react-bootstrap";
import { SOURCE_STATUS_LABEL, STATUS_VARIANT } from "./assetsPageConstants";

// Barra in cima alla pagina Fonti e Materiali: da che punto siamo con le
// fonti, il riassunto scritto dal server, e i due pulsanti di ricarica e
// salvataggio.
const AssetsActionsBar = ({ status, summary, loading, saving, onReload, onSave }) => (
  <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
    <div>
      <Badge bg={STATUS_VARIANT[status] || "secondary"} className="mb-2">
        Qualita delle fonti: {SOURCE_STATUS_LABEL[status] || status}
      </Badge>
      <p className="mb-0 text-muted small">{summary}</p>
    </div>
    <div className="d-flex gap-2">
      <Button size="sm" variant="outline-secondary" onClick={onReload} disabled={loading || saving}>
        Ricarica
      </Button>
      <Button size="sm" variant="primary" onClick={onSave} disabled={saving}>
        {saving ? <><Spinner animation="border" size="sm" className="me-2" />Salvataggio...</> : "Aggiorna fonti"}
      </Button>
    </div>
  </div>
);

export default AssetsActionsBar;
