import React from "react";
import { Alert, Badge } from "react-bootstrap";

const VARIANT_BY_STATUS = {
  missing: "danger",
  partial: "warning",
  ready: "success",
};

const LABEL_BY_STATUS = {
  missing: "Fonti da completare",
  partial: "Fonti parziali",
  ready: "Fonti pronte",
};

const AgencySourceReadinessPanel = ({ readiness, compact = false }) => {
  const status = readiness?.status || "missing";
  const variant = VARIANT_BY_STATUS[status] || "secondary";
  const summary = readiness?.summary || "Nessuna fonte cliente reale registrata.";
  const usedSources = Array.isArray(readiness?.usedSources) ? readiness.usedSources : [];

  if (compact && status === "ready") {
    return (
      <div className="small text-muted mb-3">
        <Badge bg={variant} className="me-2">{LABEL_BY_STATUS[status] || "Fonti"}</Badge>
        {summary}
      </div>
    );
  }

  return (
    <Alert variant={variant} className="py-2">
      <div className="d-flex flex-wrap align-items-center gap-2">
        <strong>Qualita delle fonti: {LABEL_BY_STATUS[status] || status}</strong>
        {usedSources.map((entry) => (
          <Badge key={entry} bg="light" text="dark" className="border">
            {entry}
          </Badge>
        ))}
      </div>
      <div className="small mt-1">
        {summary}
        {status === "missing" && " Gli output generati usano dati incompleti: completa Fonti/Materiali per maggiore precisione."}
        {status === "partial" && " Gli output sono bozze basate su dati incompleti."}
      </div>
    </Alert>
  );
};

export default AgencySourceReadinessPanel;
