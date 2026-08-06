import React from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getAgencyProject, getAgencyProjectWorkingContext } from "../../../modules/agency-os/data/agencyDataAdapter";
import AgencyPageShell from "../AgencyPageShell";
import AgencyDataSourceBadge from "../AgencyDataSourceBadge";
import AgencySourceReadinessPanel from "./AgencySourceReadinessPanel";

// Le schede "secondarie" che si vedono comunque, in ogni ambiente. Le altre
// restano visibili solo in sviluppo — `import.meta.env.DEV` e' un interruttore di
// compilazione, non un permesso: in produzione non le vede nessuno, nemmeno un
// Super Admin.
//
// "memory" e' entrata qui il 6/8/2026 (roadmap, decisione ②): delle quattro schede
// nascoste e' l'unica che dava qualcosa di suo — cosa sa l'AI del progetto e cosa
// ha gia' prodotto — e in un'area dove l'AI scrive al posto tuo, poterlo guardare
// e' una questione di fiducia.
//
// L'elenco sta in un posto solo apposta: prima le stesse due chiavi erano scritte
// a mano in tre punti diversi di questo file, e promuovere una scheda voleva dire
// ricordarsi di toccarli tutti e tre.
const ALWAYS_VISIBLE_SECONDARY = ["opportunities", "alerts", "memory"];

const AgencyProjectPageTemplate = ({ title, subtitle, dataMeta, project: projectOverride, children }) => {
  const { projectId } = useParams();
  const location = useLocation();
  const [project, setProject] = React.useState(projectOverride || null);
  const [workingContext, setWorkingContext] = React.useState(null);
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "-";
  const projectRootPath = normalizedProjectId === "-"
    ? "/agency/projects"
    : `/agency/projects/${encodeURIComponent(normalizedProjectId)}`;
  const projectOverviewPath = normalizedProjectId === "-"
    ? "/agency/projects"
    : `${projectRootPath}/overview`;
  const workspaceSections = [
    { key: "overview", label: "Overview", path: projectOverviewPath, group: "primary" },
    { key: "assets", label: "Fonti", path: `${projectRootPath}/assets`, group: "primary" },
    { key: "discovery", label: "Discovery", path: `${projectRootPath}/discovery`, group: "primary" },
    // Niente scheda "Chat" (tolta il 15/7/2026, spec 4-ter §3): la chat del progetto
    // vive nel popup, che si espande a tutto schermo ed e' raggiungibile da ogni
    // pagina — non solo da dentro il progetto. Partecipanti, azzeramento e
    // scioglimento del gruppo sono stati spostati li' prima di togliere la scheda.
    { key: "web", label: "Web", path: `${projectRootPath}/web`, group: "primary" },
    { key: "ads", label: "Ads", path: `${projectRootPath}/ads`, group: "primary" },
    { key: "performance", label: "Performance", path: `${projectRootPath}/performance`, group: "primary" },
    { key: "reports-client", label: "Report", path: `${projectRootPath}/reports/client`, group: "primary" },
    { key: "tasks", label: "Task", path: `${projectRootPath}/tasks`, group: "primary" },
    { key: "opportunities", label: "Opportunita", path: `${projectRootPath}/opportunities`, group: "secondary" },
    { key: "alerts", label: "Alert", path: `${projectRootPath}/alerts`, group: "secondary" },
    // Tolte il 6/8/2026 "Diagnosis", "Reports tecnici" e "Brain": le prime due sono
    // confluite dentro "Alert" e "Report", la terza non aggiungeva nulla alla
    // Panoramica. Le loro rotte esistono ancora come rimandi (RouteList.jsx).
    { key: "memory", label: "Memory", path: `${projectRootPath}/memory`, group: "secondary" },
  ];

  React.useEffect(() => {
    let cancelled = false;

    if (projectOverride) {
      setProject(projectOverride);
      if (normalizedProjectId !== "-") {
        getAgencyProjectWorkingContext(normalizedProjectId)
          .then((nextWorkingContext) => {
            if (!cancelled) {
              setWorkingContext(nextWorkingContext);
            }
          })
          .catch(() => {
            if (!cancelled) {
              setWorkingContext(null);
            }
          });
      }
      return () => {
        cancelled = true;
      };
    }

    if (normalizedProjectId === "-") {
      setProject(null);
      return () => {
        cancelled = true;
      };
    }

    Promise.all([
      getAgencyProject(normalizedProjectId),
      getAgencyProjectWorkingContext(normalizedProjectId).catch(() => null),
    ])
      .then(([nextProject, nextWorkingContext]) => {
        if (!cancelled) {
          setProject(nextProject);
          setWorkingContext(nextWorkingContext);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProject(null);
          setWorkingContext(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedProjectId, projectOverride]);

  const projectDisplayName = project?.name?.trim() || `Progetto ${normalizedProjectId}`;
  const projectClientLabel = project?.clientName?.trim() || workingContext?.client?.name?.trim() || "";
  const sourceStatus = project?.sourceReadiness?.status || "missing";
  const sourceLabel = sourceStatus === "ready"
    ? "Fonti pronte"
    : sourceStatus === "partial"
      ? "Fonti parziali"
      : "Fonti da completare";
  const sourceBadgeClass = sourceStatus === "ready"
    ? "text-bg-success"
    : sourceStatus === "partial"
      ? "text-bg-warning"
      : "text-bg-danger";
  const visibleWorkspaceSections = workspaceSections.filter((entry) => {
    if (entry.group !== "secondary") {
      return true;
    }
    if (ALWAYS_VISIBLE_SECONDARY.includes(entry.key)) {
      return true;
    }
    return import.meta.env.DEV;
  });
  const activeSection = visibleWorkspaceSections.find((entry) => {
    const isOverviewAliasActive = entry.key === "overview"
      && (location.pathname === projectOverviewPath || location.pathname === projectRootPath);
    return location.pathname === entry.path || isOverviewAliasActive;
  });
  const primaryAction = sourceStatus !== "ready"
    ? { label: "Completa fonti", path: `${projectRootPath}/assets` }
    : activeSection?.key === "discovery"
      ? { label: "Rigenera brief", path: `${projectRootPath}/discovery` }
      : activeSection?.key === "ads"
        ? { label: "Crea campagna", path: `${projectRootPath}/ads` }
        : activeSection?.key === "reports-client"
          ? { label: "Genera report", path: `${projectRootPath}/reports/client` }
      : { label: "Crea landing", path: `${projectRootPath}/web` };
  const confidenceLabel = workingContext?.confidence?.sourceQuality
    ? `Confidence: ${workingContext.confidence.sourceQuality}`
    : sourceStatus === "ready"
      ? "Confidence: buona"
      : sourceStatus === "partial"
        ? "Confidence: media"
        : "Confidence: bassa";
  const renderNavigationLink = (entry) => {
    const isOverviewAliasActive = entry.key === "overview"
      && (location.pathname === projectOverviewPath || location.pathname === projectRootPath);
    const isActive = location.pathname === entry.path || isOverviewAliasActive;
    return (
      <Link
        key={entry.key}
        to={entry.path}
        className={`btn btn-sm ${isActive ? "btn-primary" : "btn-outline-secondary"}`}
      >
        {entry.label}
      </Link>
    );
  };

  return (
    <AgencyPageShell
      title={title}
      subtitle={subtitle}
      dataMeta={dataMeta}
      breadcrumbs={[
        { label: "Produzione AI", to: "/agency/projects" },
        ...(projectClientLabel ? [{ label: projectClientLabel, to: "/apps/clients" }] : []),
        { label: projectDisplayName, to: projectOverviewPath },
        { label: title },
      ]}
    >
      <div className="agency-project-header p-3 mb-3">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
              <h5 className="mb-0">{projectDisplayName}</h5>
              <span className={`badge ${sourceBadgeClass}`}>{sourceLabel}</span>
              {project?.statusAgency && (
                <span className="badge text-bg-light border">Stato: {project.statusAgency}</span>
              )}
              <span className="badge text-bg-light border">{confidenceLabel}</span>
            </div>
            <div className="small text-muted">
              {projectClientLabel ? `Cliente: ${projectClientLabel}` : "Cliente non assegnato"}
              {activeSection?.label ? ` | Sezione: ${activeSection.label}` : ""}
              <AgencyDataSourceBadge meta={dataMeta} />
            </div>
          </div>
          <Link to={primaryAction.path} className="btn btn-sm btn-primary">
            {primaryAction.label}
          </Link>
        </div>
      </div>

      <div className="mb-3">
        <div className="d-flex flex-wrap gap-2 mb-2">
          {workspaceSections.filter((entry) => entry.group === "primary").map(renderNavigationLink)}
          {visibleWorkspaceSections
            .filter((entry) => entry.group === "secondary" && ALWAYS_VISIBLE_SECONDARY.includes(entry.key))
            .map(renderNavigationLink)}
        </div>
        {/* Qui stava il pieghevole "Diagnosi e strumenti tecnici". E' sparito il
            6/8/2026 insieme alle tre schede che conteneva: senza di loro non
            aveva piu' niente da mostrare, e un blocco che non si disegna mai e'
            solo codice che il prossimo non osa toccare. */}
      </div>

      {project?.sourceReadiness && location.pathname !== `${projectRootPath}/assets` && (
        <AgencySourceReadinessPanel readiness={project.sourceReadiness} compact />
      )}
      {children || (
        <p className="mb-0 text-muted">
          Sezione non ancora configurata.
        </p>
      )}
    </AgencyPageShell>
  );
};

export default AgencyProjectPageTemplate;
