import React from "react";
import { Badge, Button } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import { getAgencyProjectWorkingContext } from "../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../modules/agency-os/data/agencyDataSource";
import AgencyProjectPageTemplate from "./AgencyProjectPageTemplate";

const formatDateTime = (value) => {
  if (!value) {
    return "Non disponibile";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Non disponibile";
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

const formatCost = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "Non stimato";
  }
  return `$${numericValue.toFixed(4)}`;
};

const collectAiHistory = (context) => {
  const entries = [];
  const addEntries = (moduleLabel, history) => {
    if (!Array.isArray(history)) {
      return;
    }
    history.forEach((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return;
      }
      entries.push({
        id: `${moduleLabel}-${entry.generatedAt || index}`,
        moduleLabel,
        functionName: entry.functionName || entry.operation || entry.cacheKey || "Generazione",
        mode: entry.mode || entry.status || "Completata",
        model: entry.model || "Non indicato",
        cacheHit: Boolean(entry.cacheHit),
        estimatedCostUsd: entry.estimatedCostUsd,
        estimatedInputTokens: entry.estimatedInputTokens,
        estimatedOutputTokens: entry.estimatedOutputTokens,
        durationMs: entry.durationMs,
        generatedAt: entry.generatedAt || entry.completedAt || null,
      });
    });
  };

  addEntries("Brief", context?.discovery?.aiHistory);
  addEntries("Contenuti Web", context?.web?.output?.aiHistory);
  addEntries("Campagne ADS", context?.ads?.output?.aiHistory);

  return entries.sort((a, b) => String(b.generatedAt || "").localeCompare(String(a.generatedAt || "")));
};

const AgencyProjectMemoryPage = () => {
  const { projectId } = useParams();
  const [context, setContext] = React.useState(null);
  const [dataMeta, setDataMeta] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const loadContext = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextContext = await getAgencyProjectWorkingContext(projectId);
      setContext(nextContext);
      setDataMeta(readAgencyDataMeta(nextContext));
    } catch (_error) {
      setError("Memoria progetto non disponibile. Riprova o verifica lo stato del server.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const aiHistory = React.useMemo(() => collectAiHistory(context), [context]);
  const missingCriticalInfo = Array.isArray(context?.missingCriticalInfo) ? context.missingCriticalInfo : [];
  const unreadableFiles = Array.isArray(context?.sources?.unreadableFiles) ? context.sources.unreadableFiles : [];
  const usedSources = Array.isArray(context?.sourceReadiness?.usedSources) ? context.sourceReadiness.usedSources : [];

  return (
    <AgencyProjectPageTemplate
      title="Memoria"
      subtitle="Contesto unico usato dai moduli AI del progetto e storico sintetico delle generazioni."
      dataMeta={dataMeta}
    >
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div className="small text-muted">
          {loading ? "Caricamento memoria..." : "Contesto di lavoro del progetto aggiornato dal server."}
        </div>
        <Button type="button" size="sm" variant="outline-primary" onClick={loadContext} disabled={loading}>
          Aggiorna memoria
        </Button>
      </div>

      {error && <div className="alert alert-warning py-2" role="alert">{error}</div>}

      {!loading && !context && !error && (
        <div className="border rounded-3 p-3 agency-tile">
          <h6 className="mb-1">Memoria non ancora disponibile</h6>
          <p className="mb-2 text-muted small">
            Aggiungi fonti o rigenera il Brief per creare un contesto operativo riutilizzabile.
          </p>
          <Button as={Link} to={`/agency/projects/${encodeURIComponent(projectId)}/assets`} size="sm" variant="primary">
            Aggiungi fonti
          </Button>
        </div>
      )}

      {context && (
        <div className="row g-3">
          <div className="col-12 col-xl-4">
            <div className="border rounded-3 p-3 h-100 agency-tile">
              <h6 className="mb-2">Qualita contesto</h6>
              <div className="d-flex flex-wrap gap-2 mb-2">
                <Badge bg={context?.confidence?.isFallbackOnly ? "danger" : "success"}>
                  {context?.confidence?.isFallbackOnly ? "Dati incompleti" : "Fonti disponibili"}
                </Badge>
                <Badge bg="light" text="dark" className="border">
                  {context?.confidence?.sourceQuality || "Qualita non calcolata"}
                </Badge>
              </div>
              <p className="small text-muted mb-0">
                {context?.sourceReadiness?.summary || "Sintesi fonti non disponibile."}
              </p>
            </div>
          </div>

          <div className="col-12 col-xl-4">
            <div className="border rounded-3 p-3 h-100 agency-tile">
              <h6 className="mb-2">Fonti usate</h6>
              <div className="d-flex flex-wrap gap-2">
                {usedSources.map((entry) => (
                  <Badge key={entry} bg="light" text="dark" className="border">{entry}</Badge>
                ))}
                {usedSources.length === 0 && (
                  <span className="small text-muted">Nessuna fonte reale registrata.</span>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-4">
            <div className="border rounded-3 p-3 h-100 agency-tile">
              <h6 className="mb-2">Cosa manca</h6>
              {missingCriticalInfo.length > 0 ? (
                <ul className="small mb-0">
                  {missingCriticalInfo.slice(0, 5).map((entry) => <li key={entry}>{entry}</li>)}
                </ul>
              ) : (
                <p className="small text-muted mb-0">Nessun blocco critico rilevato nel contesto corrente.</p>
              )}
            </div>
          </div>

          <div className="col-12 col-xl-6">
            <div className="border rounded-3 p-3 h-100 agency-tile">
              <h6 className="mb-2">Brief nel contesto</h6>
              <p className="small text-muted mb-2">
                {context.discovery?.contextSummary || "Brief non ancora sintetizzato."}
              </p>
              <Button as={Link} to={`/agency/projects/${encodeURIComponent(projectId)}/discovery`} size="sm" variant="outline-primary">
                Apri il Brief
              </Button>
            </div>
          </div>

          <div className="col-12 col-xl-6">
            <div className="border rounded-3 p-3 h-100 agency-tile">
              <h6 className="mb-2">File non letti</h6>
              {unreadableFiles.length > 0 ? (
                <ul className="small mb-2">
                  {unreadableFiles.slice(0, 6).map((entry) => <li key={entry}>{entry}</li>)}
                </ul>
              ) : (
                <p className="small text-muted mb-2">Nessun file segnalato come non leggibile.</p>
              )}
              <Button as={Link} to={`/agency/projects/${encodeURIComponent(projectId)}/assets`} size="sm" variant="outline-secondary">
                Gestisci materiali
              </Button>
            </div>
          </div>

          <div className="col-12">
            <div className="border rounded-3 p-3 agency-tile">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <div>
                  <h6 className="mb-0">Storico AI</h6>
                  <div className="small text-muted">
                    Storico sintetico: nessun prompt o API key viene mostrato in questa pagina.
                  </div>
                </div>
                <Badge bg="light" text="dark" className="border">{aiHistory.length} generazioni</Badge>
              </div>

              {aiHistory.length === 0 ? (
                <p className="small text-muted mb-0">
                  Nessuna generazione AI registrata. Usa Brief, Contenuti Web o Campagne ADS per produrre il primo output.
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Modulo</th>
                        <th>Funzione</th>
                        <th>Cache</th>
                        <th>Modello</th>
                        <th>Token stimati</th>
                        <th>Costo</th>
                        <th>Durata</th>
                        <th>Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiHistory.map((entry) => (
                        <tr key={entry.id}>
                          <td>{entry.moduleLabel}</td>
                          <td>{entry.functionName}</td>
                          <td>{entry.cacheHit ? "Riusata" : "Nuova"}</td>
                          <td>{entry.model}</td>
                          <td>
                            {(Number(entry.estimatedInputTokens) || 0) + (Number(entry.estimatedOutputTokens) || 0)}
                          </td>
                          <td>{formatCost(entry.estimatedCostUsd)}</td>
                          <td>{Number(entry.durationMs) ? `${Math.round(Number(entry.durationMs) / 1000)}s` : "Non stimata"}</td>
                          <td>{formatDateTime(entry.generatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AgencyProjectPageTemplate>
  );
};

export default AgencyProjectMemoryPage;
