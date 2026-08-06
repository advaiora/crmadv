import React from "react";
import { Button, Badge } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import {
  getAgencyProject,
  getAgencyProjectDiagnosis,
  getAgencyProjectOverview,
  getAgencyProjectReport,
  getAgencyProjectTasks,
  getAgencyProjectWorkingContext,
} from "../../../modules/agency-os/data/agencyDataAdapter";
import { readAgencyDataMeta } from "../../../modules/agency-os/data/agencyDataSource";
import { visibleActiveModules } from "../../../modules/agency-os/brain/moduleVisibility";
import { sortAgencyOpportunities } from "../../../modules/agency-os/opportunities/opportunityPresentation";
import AgencyOpportunityList from "../opportunities/AgencyOpportunityList";
import AgencyProjectPageTemplate from "./AgencyProjectPageTemplate";

const SCOPE_LABEL_MAP = {
  website: "Sito web",
  landing_page: "Landing page",
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  seo: "SEO",
  reporting: "Reporting",
  diagnosis: "Diagnosis",
};

const SOURCE_STATUS_VARIANT = {
  missing: "danger",
  partial: "warning",
  ready: "success",
};

const SOURCE_STATUS_LABEL = {
  missing: "Fonti da completare",
  partial: "Fonti parziali",
  ready: "Fonti pronte",
};

const buildNextAction = (projectId, sourceReadiness, brain) => {
  const encodedProjectId = encodeURIComponent(projectId);
  if (sourceReadiness.status !== "ready") {
    return {
      title: "Completa Fonti/Materiali",
      description: "Aggiungi URL, note, file o competitor prima di usare gli output come base operativa.",
      to: `/agency/projects/${encodedProjectId}/assets`,
      label: "Completa fonti",
    };
  }
  if (!brain?.contextSummary) {
    return {
      title: "Rigenera brief da fonti",
      description: "Trasforma le fonti progetto in un brief operativo aggiornato.",
      to: `/agency/projects/${encodedProjectId}/discovery`,
      label: "Apri Discovery",
    };
  }
  return {
    title: "Crea un asset operativo",
    description: "Passa a Web o Ads per creare landing, pagine o campagne collegate alle fonti.",
    to: `/agency/projects/${encodedProjectId}/web`,
    label: "Crea landing",
  };
};

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

const OverviewCard = ({ title, children, action }) => (
  <div className="border rounded-3 p-3 h-100">
    <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
      <h6 className="mb-0">{title}</h6>
      {action || null}
    </div>
    {children}
  </div>
);

const ChecklistItem = ({ label, done, action }) => (
  <div className="d-flex align-items-start justify-content-between gap-2 border rounded-3 p-2">
    <div>
      <div className="small fw-semibold">{label}</div>
      <div className="small text-muted">{done ? "Pronto" : "Da completare"}</div>
    </div>
    {action}
  </div>
);

const AgencyProjectOverviewPage = () => {
  const { projectId } = useParams();
  const [project, setProject] = React.useState(null);
  const [brain, setBrain] = React.useState(null);
  const [diagnosis, setDiagnosis] = React.useState(null);
  const [report, setReport] = React.useState(null);
  const [tasks, setTasks] = React.useState([]);
  const [workingContext, setWorkingContext] = React.useState(null);
  const [dataMeta, setDataMeta] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  const topOpportunities = React.useMemo(
    () => sortAgencyOpportunities(brain?.suggestedOpportunities || []).slice(0, 3),
    [brain],
  );

  const topAlerts = Array.isArray(brain?.suggestedAlerts) ? brain.suggestedAlerts.slice(0, 3) : [];
  const activeModules = visibleActiveModules(project?.activeModules);
  const purchasedScope = Object.entries(project?.scopePurchased || {})
    .filter(([, purchased]) => Boolean(purchased))
    .map(([key]) => SCOPE_LABEL_MAP[key] || key);
  const sourceReadiness = project?.sourceReadiness || {
    status: "missing",
    summary: "Nessuna fonte cliente reale registrata.",
    usedSources: [],
    isFallbackOnly: true,
  };
  const nextAction = buildNextAction(projectId, sourceReadiness, brain);

  React.useEffect(() => {
    let isCancelled = false;
    setLoading(true);

    Promise.all([
      getAgencyProject(projectId),
      getAgencyProjectOverview(projectId),
      getAgencyProjectDiagnosis(projectId).catch(() => null),
      getAgencyProjectReport(projectId).catch(() => null),
      getAgencyProjectTasks(projectId).catch(() => []),
      getAgencyProjectWorkingContext(projectId).catch(() => null),
    ])
      .then(([nextProject, nextBrain, nextDiagnosis, nextReport, nextTasks, nextWorkingContext]) => {
        if (!isCancelled) {
          setProject(nextProject);
          setBrain(nextBrain);
          setDiagnosis(nextDiagnosis);
          setReport(nextReport);
          setTasks(Array.isArray(nextTasks) ? nextTasks : []);
          setWorkingContext(nextWorkingContext);
          setDataMeta(readAgencyDataMeta(nextProject?.id ? nextProject : nextBrain));
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [projectId]);

  if (loading || !brain || !project) {
    return (
      <AgencyProjectPageTemplate
        title="Panoramica"
        subtitle="Panoramica operativa del progetto."
        dataMeta={dataMeta}
      >
        <p className="mb-0 text-muted small">Caricamento overview progetto...</p>
      </AgencyProjectPageTemplate>
    );
  }

  return (
    <AgencyProjectPageTemplate
      title="Panoramica"
      subtitle="Stato, prossima azione, checklist e segnali principali del progetto."
      dataMeta={dataMeta}
      project={project}
    >
      <div className="row g-3 mt-1">
        <div className="col-12">
          {sourceReadiness.status !== "ready" && (
            <div className={`alert alert-${SOURCE_STATUS_VARIANT[sourceReadiness.status] || "warning"} py-2 mb-3`}>
              <strong>{SOURCE_STATUS_LABEL[sourceReadiness.status] || "Qualita fonti"}.</strong>{" "}
              {sourceReadiness.summary}
            </div>
          )}
          <OverviewCard
            title="Prossima azione consigliata"
            action={(
              <Button as={Link} to={nextAction.to} size="sm" variant="primary">
                {nextAction.label}
              </Button>
            )}
          >
            <div className="fw-semibold mb-1">{nextAction.title}</div>
            <p className="mb-0 text-muted">{nextAction.description}</p>
          </OverviewCard>
        </div>

        <div className="col-12">
          <OverviewCard title="Qualita progetto">
            <div className="row g-2">
              <div className="col-md-4">
                <div className="small text-muted">Fonti</div>
                <div className="fw-semibold">{SOURCE_STATUS_LABEL[sourceReadiness.status] || "Da verificare"}</div>
              </div>
              <div className="col-md-4">
                <div className="small text-muted">Confidence globale</div>
                <div className="fw-semibold">
                  {workingContext?.confidence?.sourceQuality || (sourceReadiness.status === "ready" ? "buona" : sourceReadiness.status === "partial" ? "media" : "bassa")}
                </div>
              </div>
              <div className="col-md-4">
                <div className="small text-muted">Cosa manca</div>
                <div className="fw-semibold">
                  {Array.isArray(workingContext?.missingCriticalInfo) && workingContext.missingCriticalInfo.length > 0
                    ? `${workingContext.missingCriticalInfo.length} punti da completare`
                    : "Nessun blocco critico"}
                </div>
              </div>
            </div>
            {Array.isArray(workingContext?.missingCriticalInfo) && workingContext.missingCriticalInfo.length > 0 && (
              <ul className="small text-muted mt-2 mb-0">
                {workingContext.missingCriticalInfo.slice(0, 4).map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            )}
          </OverviewCard>
        </div>

        <div className="col-12">
          <OverviewCard title="Azioni rapide">
            <div className="d-flex flex-wrap gap-2">
              <Button as={Link} to={`/agency/projects/${encodeURIComponent(projectId)}/assets`} size="sm" variant="primary">
                Aggiungi fonti
              </Button>
              <Button as={Link} to={`/agency/projects/${encodeURIComponent(projectId)}/discovery`} size="sm" variant="outline-primary">
                Rigenera brief
              </Button>
              <Button as={Link} to={`/agency/projects/${encodeURIComponent(projectId)}/web`} size="sm" variant="outline-primary">
                Crea landing
              </Button>
              <Button as={Link} to={`/agency/projects/${encodeURIComponent(projectId)}/ads`} size="sm" variant="outline-primary">
                Crea campagna
              </Button>
              <Button as={Link} to={`/agency/projects/${encodeURIComponent(projectId)}/reports/client`} size="sm" variant="outline-primary">
                Genera report cliente
              </Button>
            </div>
          </OverviewCard>
        </div>

        <div className="col-12 col-xl-5">
          <OverviewCard title="Checklist progetto">
            <div className="d-flex flex-column gap-2">
              <ChecklistItem
                label="Fonti progetto"
                done={sourceReadiness.status === "ready"}
                action={<Button as={Link} to={`/agency/projects/${encodeURIComponent(projectId)}/assets`} size="sm" variant="outline-secondary">Apri</Button>}
              />
              <ChecklistItem
                label="Discovery"
                done={Boolean(brain?.contextSummary)}
                action={<Button as={Link} to={`/agency/projects/${encodeURIComponent(projectId)}/discovery`} size="sm" variant="outline-secondary">Apri</Button>}
              />
              <ChecklistItem
                label="Web"
                done={Boolean(report?.output?.webSummary?.status === "ready" || report?.input?.web?.available)}
                action={<Button as={Link} to={`/agency/projects/${encodeURIComponent(projectId)}/web`} size="sm" variant="outline-secondary">Apri</Button>}
              />
              <ChecklistItem
                label="Ads"
                done={Boolean(report?.output?.adsSummary?.status === "ready" || report?.input?.ads?.available)}
                action={<Button as={Link} to={`/agency/projects/${encodeURIComponent(projectId)}/ads`} size="sm" variant="outline-secondary">Apri</Button>}
              />
              <ChecklistItem
                label="Report cliente"
                done={Boolean(report?.output?.clientReport?.generatedAt)}
                action={<Button as={Link} to={`/agency/projects/${encodeURIComponent(projectId)}/reports/client`} size="sm" variant="outline-secondary">Apri</Button>}
              />
            </div>
          </OverviewCard>
        </div>

        <div className="col-12 col-xl-7">
          <OverviewCard
            title="Stato progetto"
            action={(
              <span className="small text-muted">
                Aggiornato: {formatDateTime(project.updatedAt)}
              </span>
            )}
          >
            <div className="d-flex flex-wrap gap-2 mb-2">
              <Badge bg="light" text="dark" className="border">
                {project.projectType?.label || "Tipo non definito"}
              </Badge>
              <Badge bg="light" text="dark" className="border">
                Stato: {project.statusAgency}
              </Badge>
              <Badge bg="light" text="dark" className="border">
                Priorita: {project.priorityAgency}
              </Badge>
            </div>
            <div className="small text-muted mb-1">
              Cliente: <strong>{project.clientName || "Non assegnato"}</strong>
            </div>
            <p className="mb-0 text-muted">
              {project.goal || "Goal non ancora definito."}
            </p>
          </OverviewCard>
        </div>

        <div className="col-12 col-xl-6">
          <OverviewCard
            title="Fonti usate"
            action={(
              <Button as={Link} to={`/agency/projects/${encodeURIComponent(projectId)}/assets`} size="sm" variant="outline-secondary">
                Completa fonti
              </Button>
            )}
          >
            <Badge bg={SOURCE_STATUS_VARIANT[sourceReadiness.status] || "secondary"} className="mb-2">
              {SOURCE_STATUS_LABEL[sourceReadiness.status] || sourceReadiness.status}
            </Badge>
            <p className="small text-muted mb-2">{sourceReadiness.summary}</p>
            <div className="d-flex flex-wrap gap-2">
              {(sourceReadiness.usedSources || []).map((entry) => (
                <Badge key={entry} bg="light" text="dark" className="border">
                  {entry}
                </Badge>
              ))}
              {(!sourceReadiness.usedSources || sourceReadiness.usedSources.length === 0) && (
                <span className="small text-muted">Nessuna fonte cliente reale registrata.</span>
              )}
            </div>
          </OverviewCard>
        </div>

        <div className="col-12 col-xl-6">
          <OverviewCard title="Sintesi contesto">
            <p className="mb-0 text-muted">{brain.contextSummary || "Context summary non disponibile."}</p>
          </OverviewCard>
        </div>

        <div className="col-12 col-xl-6">
          <OverviewCard title="Scope acquistato">
            {purchasedScope.length > 0 ? (
              <div className="d-flex flex-wrap gap-2">
                {purchasedScope.map((entry) => (
                  <Badge key={entry} bg="light" text="dark" className="border">
                    {entry}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="mb-0 text-muted small">Nessuno scope acquistato impostato.</p>
            )}
          </OverviewCard>
        </div>

        <div className="col-12 col-xl-6">
          <OverviewCard title="Moduli attivi">
            <div className="small fw-semibold mb-2">{activeModules.length} moduli attivi</div>
            <div className="d-flex flex-wrap gap-2">
              {activeModules.map((entry) => (
                <Badge key={entry.key} bg="light" text="dark" className="border">
                  {entry.label}
                </Badge>
              ))}
              {activeModules.length === 0 && (
                <span className="small text-muted">Nessun modulo attivo ancora sincronizzato.</span>
              )}
            </div>
          </OverviewCard>
        </div>

        <div className="col-12 col-xl-6">
          <OverviewCard title="Task">
            <div className="small text-muted mb-2">
              Task totali: {tasks.length} - Aperti: {tasks.filter((entry) => entry.status !== "done").length}
            </div>
            <ul className="mb-0 small">
              {tasks.slice(0, 3).map((entry) => (
                <li key={entry.id}>
                  {entry.title} - {entry.teamRole} - {entry.priority}
                </li>
              ))}
              {tasks.length === 0 && <li className="text-muted">Nessun task ancora disponibile.</li>}
            </ul>
          </OverviewCard>
        </div>

        <div className="col-12 col-xl-6">
          <OverviewCard title="Top alert">
            <div className="d-flex flex-column gap-2">
              {topAlerts.map((entry) => (
                <div key={entry.id} className="border rounded-2 p-2">
                  <div className="fw-semibold small">{entry.title}</div>
                  <div className="small text-muted">
                    Priorita: {entry.severity} - Stato: {entry.status}
                  </div>
                </div>
              ))}
              {topAlerts.length === 0 && (
                <p className="mb-0 text-muted small">Nessun alert prioritario.</p>
              )}
            </div>
          </OverviewCard>
        </div>

        <div className="col-12 col-xl-6">
          <OverviewCard title="Top opportunita">
            <AgencyOpportunityList
              opportunities={topOpportunities}
              emptyMessage="Nessuna opportunita disponibile."
              groupBy="none"
            />
          </OverviewCard>
        </div>

        <div className="col-12 col-xl-4">
          <OverviewCard
            title="Da risolvere"
            action={(
              <Button as={Link} to={`/agency/projects/${encodeURIComponent(projectId)}/alerts`} size="sm" variant="outline-secondary">
                Apri
              </Button>
            )}
          >
            <p className="mb-1 text-muted small">
              {diagnosis?.output?.diagnosisSummary || "Analisi dei punti deboli non ancora generata."}
            </p>
            <div className="small text-muted">
              Priorita: {diagnosis?.output?.interventionPriority || "Non disponibile"} - Confidence: {diagnosis?.output?.confidenceLevel || "Non disponibile"}
            </div>
          </OverviewCard>
        </div>

        <div className="col-12 col-xl-4">
          <OverviewCard
            title="Report"
            action={(
              <Button as={Link} to={`/agency/projects/${encodeURIComponent(projectId)}/reports/client?vista=tecnica`} size="sm" variant="outline-secondary">
                Apri
              </Button>
            )}
          >
            <p className="mb-1 text-muted small">
              Stato: {report?.output?.reportStatus || "draft"}
            </p>
            <div className="small text-muted">
              Alert top: {report?.output?.topAlerts?.length || 0} - Opportunita: {report?.output?.topOpportunities?.length || 0}
            </div>
          </OverviewCard>
        </div>

        <div className="col-12 col-xl-4">
          <OverviewCard title="Prossimi passi">
            <p className="small text-muted mb-2">
              Usa le azioni rapide in alto per avanzare nel workflow. I dettagli tecnici restano nei moduli dedicati.
            </p>
            <Button as={Link} to={`/agency/projects/${encodeURIComponent(projectId)}/tasks`} size="sm" variant="outline-primary">
              Apri task
            </Button>
          </OverviewCard>
        </div>
      </div>
    </AgencyProjectPageTemplate>
  );
};

export default AgencyProjectOverviewPage;
