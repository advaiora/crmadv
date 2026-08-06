import React from "react";
import {
  formatReportLabel,
  getReportBadgeClass,
} from "../../../../modules/agency-os/reports/reportPresentation";

// Le due liste dell'analisi AI, estratte dalla vecchia pagina Diagnosis il 5/8/2026
// (dov'erano componenti locali non esportati) quando quei contenuti sono stati
// spostati dentro la scheda "Da risolvere".

export const IssueList = ({ items, emptyLabel }) => {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="mb-0 small text-muted">{emptyLabel}</p>;
  }

  return (
    <div className="d-flex flex-column gap-2">
      {items.map((entry) => (
        <div key={entry.key || entry.title} className="border rounded-3 p-2">
          <div className="d-flex align-items-start justify-content-between gap-2">
            <div>
              <div className="small fw-semibold">{entry.title}</div>
              <div className="small text-muted mt-1">{entry.summary}</div>
            </div>
            <div className="d-flex flex-column align-items-end gap-1">
              <span className={`badge ${getReportBadgeClass("priority", entry.priority)}`}>
                {formatReportLabel(entry.priority)}
              </span>
              <span className="badge text-bg-light border">{formatReportLabel(entry.module)}</span>
            </div>
          </div>
          <div className="small text-muted mt-1">
            Categoria: {formatReportLabel(entry.category)}
          </div>
          {Array.isArray(entry.evidence) && entry.evidence.length > 0 && (
            <div className="small text-muted mt-1">Evidenze: {entry.evidence.join(" | ")}</div>
          )}
        </div>
      ))}
    </div>
  );
};

export const ModuleSignalList = ({ signals }) => {
  const entries = Object.entries(signals || {});
  if (entries.length === 0) {
    return <p className="mb-0 small text-muted">Nessun segnale modulo disponibile.</p>;
  }

  return (
    <div className="d-flex flex-column gap-2">
      {entries.map(([key, value]) => (
        <div key={key} className="border rounded-3 p-2">
          <div className="d-flex align-items-start justify-content-between gap-2">
            <div className="small fw-semibold">{formatReportLabel(key)}</div>
            <span className={`badge ${getReportBadgeClass("reportStatus", value?.status)}`}>
              {formatReportLabel(value?.status)}
            </span>
          </div>
          <div className="small text-muted mt-1">{value?.summary || "Nessuna sintesi disponibile."}</div>
        </div>
      ))}
    </div>
  );
};
