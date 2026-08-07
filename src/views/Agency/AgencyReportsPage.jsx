import React from "react";
import { Form } from "react-bootstrap";
import { Link, useHistory } from "react-router-dom";
import { rowActivationProps } from "../../utils/rowActivation";
import { getAgencyWorkspaceReports } from "../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../modules/agency-os/data/agencyDataSource";
import {
  collectReportFilterValues,
  filterAgencyReports,
  formatReportLabel,
  getReportBadgeClass,
  sortAgencyReports,
} from "../../modules/agency-os/reports/reportPresentation";
import AgencyPageShell from "./AgencyPageShell";

const formatDateTime = (value) => {
  if (!value) {
    return "N/A";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("it-IT");
};

const AgencyReportsPage = () => {
  const history = useHistory();
  const [reports, setReports] = React.useState([]);
  const [dataMeta, setDataMeta] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [projectStatusFilter, setProjectStatusFilter] = React.useState("all");
  const [projectTypeFilter, setProjectTypeFilter] = React.useState("all");
  const [updatedFilter, setUpdatedFilter] = React.useState("all");

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getAgencyWorkspaceReports()
      .then((entries) => {
        if (!cancelled) {
          setReports(Array.isArray(entries) ? entries : []);
          setDataMeta(readAgencyDataMeta(entries));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const projectStatusOptions = React.useMemo(() => {
    return collectReportFilterValues(reports, "projectStatus");
  }, [reports]);

  const projectTypeOptions = React.useMemo(() => {
    return collectReportFilterValues(reports, "projectTypeLabel");
  }, [reports]);

  const filteredReports = React.useMemo(() => {
    const filtered = filterAgencyReports(reports, {
      projectStatus: projectStatusFilter === "all" ? null : projectStatusFilter,
      projectTypeLabel: projectTypeFilter === "all" ? null : projectTypeFilter,
      updatedBucket: updatedFilter === "all" ? null : updatedFilter,
    });

    return sortAgencyReports(filtered);
  }, [reports, projectStatusFilter, projectTypeFilter, updatedFilter]);

  const summary = React.useMemo(() => {
    return {
      total: filteredReports.length,
      ready: filteredReports.filter((entry) => entry.reportStatus === "ready").length,
      partial: filteredReports.filter((entry) => entry.reportStatus === "partial").length,
      persisted: filteredReports.filter((entry) => entry.persisted).length,
      clientReady: filteredReports.filter((entry) => entry.hasClientReport).length,
    };
  }, [filteredReports]);

  return (
    <AgencyPageShell
      title="Report"
      subtitle="Lo stato dei report di tutti i progetti, con le criticita principali e i filtri per trovarli."
      dataMeta={dataMeta}
      breadcrumbs={[
        { label: "Produzione AI", to: "/agency/projects" },
        { label: "Report" },
      ]}
    >
      <div className="row g-2 mb-3">
        <div className="col-sm-6 col-xl-3">
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Report visibili</div>
            <div className="fs-4 fw-semibold">{summary.total}</div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Ready</div>
            <div className="fs-4 fw-semibold">{summary.ready}</div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Partial</div>
            <div className="fs-4 fw-semibold">{summary.partial}</div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Persistiti</div>
            <div className="fs-4 fw-semibold">{summary.persisted}</div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="border rounded-3 p-3 h-100">
            <div className="small text-muted">Report cliente</div>
            <div className="fs-4 fw-semibold">{summary.clientReady}</div>
          </div>
        </div>
      </div>

      <div className="d-flex flex-wrap gap-2 align-items-end mb-3">
        <div>
          <Form.Label className="small mb-1">Stato progetto</Form.Label>
          <Form.Select size="sm" value={projectStatusFilter} onChange={(event) => setProjectStatusFilter(event.target.value)}>
            <option value="all">Tutti gli stati</option>
            {projectStatusOptions.map((entry) => (
              <option key={entry} value={entry}>{formatReportLabel(entry)}</option>
            ))}
          </Form.Select>
        </div>

        <div>
          <Form.Label className="small mb-1">Tipo progetto</Form.Label>
          <Form.Select size="sm" value={projectTypeFilter} onChange={(event) => setProjectTypeFilter(event.target.value)}>
            <option value="all">Tutti i tipi</option>
            {projectTypeOptions.map((entry) => (
              <option key={entry} value={entry}>{formatReportLabel(entry)}</option>
            ))}
          </Form.Select>
        </div>

        <div>
          <Form.Label className="small mb-1">Aggiornamento</Form.Label>
          <Form.Select size="sm" value={updatedFilter} onChange={(event) => setUpdatedFilter(event.target.value)}>
            <option value="all">Tutti</option>
            <option value="updated">Con snapshot salvata</option>
            <option value="stale">Senza snapshot salvata</option>
          </Form.Select>
        </div>
      </div>

      <div className="d-flex flex-column gap-3">
        {loading && (
          <p className="mb-0 text-muted small">Caricamento report globali...</p>
        )}

        {!loading && filteredReports.length === 0 && (
          <p className="mb-0 text-muted small">Nessun report disponibile con i filtri attuali.</p>
        )}

        {!loading && filteredReports.map((entry) => (
          <div
            key={entry.projectId}
            className="border rounded-3 p-3 row-clickable row-clickable-hover"
            aria-label={`Vai al report di ${entry.projectName}`}
            {...rowActivationProps(() =>
              history.push(`/agency/projects/${encodeURIComponent(entry.projectId)}/reports/client`),
            )}
          >
            <div className="d-flex flex-column gap-2">
              <div className="d-flex flex-wrap align-items-start justify-content-between gap-2">
                <div>
                  <div className="fw-semibold">{entry.projectName}</div>
                  <div className="small text-muted">
                    Tipo: {entry.projectTypeLabel} | Stato progetto: {formatReportLabel(entry.projectStatus)} | Priorita: {formatReportLabel(entry.projectPriority)}
                  </div>
                </div>
                <div className="d-flex flex-wrap gap-1">
                  <span className={`badge ${getReportBadgeClass("reportStatus", entry.reportStatus)}`}>
                    Report {formatReportLabel(entry.reportStatus)}
                  </span>
                  <span className={`badge ${getReportBadgeClass("projectStatus", entry.projectStatus)}`}>
                    {formatReportLabel(entry.projectStatus)}
                  </span>
                  <span className="badge text-bg-light border">
                    {entry.persisted ? "Persistito" : "Runtime"}
                  </span>
                  <span className={`badge ${entry.hasClientReport ? "text-bg-success" : "text-bg-light border"}`}>
                    {entry.hasClientReport ? "Cliente pronto" : "Cliente assente"}
                  </span>
                </div>
              </div>

              <div className="small text-muted d-flex flex-wrap gap-3">
                <span>Aggiornato: {formatDateTime(entry.updatedAt)}</span>
                <span>Alert: {entry.topAlerts?.length || 0}</span>
                <span>Opp: {entry.topOpportunities?.length || 0}</span>
                <span>Task: {entry.topTasks?.length || 0}</span>
                <span>Origine dati: {formatReportLabel(entry.dataSourceSummary?.dominantSource)}</span>
                {entry.hasClientReport && (
                  <span>Cliente: {formatDateTime(entry.clientReportUpdatedAt)}</span>
                )}
              </div>

              {(Array.isArray(entry.nextSteps) && entry.nextSteps.length > 0) && (
                <div className="small">
                  <strong>Next step:</strong> {entry.nextSteps[0]}
                </div>
              )}

              <div className="small text-muted">
                Top criticita: {(entry.topAlerts || []).map((item) => item.title).slice(0, 2).join(" | ") || "Nessuna criticita prioritaria"}
              </div>

              <div>
                <Link to={`/agency/projects/${encodeURIComponent(entry.projectId)}/reports/client?vista=tecnica`}>
                  Vai al report progetto
                </Link>
                {" | "}
                <Link to={`/agency/projects/${encodeURIComponent(entry.projectId)}/reports/client`}>
                  Vai al report cliente
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AgencyPageShell>
  );
};

export default AgencyReportsPage;
