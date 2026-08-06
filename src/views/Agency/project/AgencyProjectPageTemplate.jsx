import React from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getAgencyProject, getAgencyProjectWorkingContext } from "../../../modules/agency-os/data/agencyDataAdapter";
import AgencyPageShell from "../AgencyPageShell";
import AgencyDataSourceBadge from "../AgencyDataSourceBadge";
import AgencySourceReadinessPanel from "./AgencySourceReadinessPanel";
import { EMPTY_SIGNAL_LABEL, SIGNAL_TONE, buildSectionSignals, describeSignal } from "./projectSignals";

// I tre gruppi che formano la catena del lavoro. Il quarto (le priorita') sta
// staccato sotto e non fa parte della catena: vedi il commento sulle schede.
const SECTION_GROUPS = [
  { key: "conoscenza", title: "Conoscenza" },
  { key: "produzione", title: "Produzione" },
  { key: "risultati", title: "Risultati" },
];

const PRIORITY_GROUP = { key: "priorita", title: "Priorita" };

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
  // Le schede sono raggruppate per quello che ci fai dentro, non per importanza
  // tecnica (roadmap, decisione ③). I primi tre gruppi sono una catena e si
  // leggono da sinistra a destra nell'ordine vero del lavoro — prepari, produci,
  // misuri e consegni. Il quarto sta staccato perche' non e' una fase da
  // attraversare: e' quello che il sistema ti segnala mentre lavori.
  //
  // Niente scheda "Chat" (tolta il 15/7/2026, spec 4-ter §3): la chat del progetto
  // vive nel popup, che si espande a tutto schermo ed e' raggiungibile da ogni
  // pagina — non solo da dentro il progetto. Partecipanti, azzeramento e
  // scioglimento del gruppo sono stati spostati li' prima di togliere la scheda.
  //
  // Tolte il 6/8/2026 "Diagnosis", "Reports tecnici" e "Brain": le prime due sono
  // confluite dentro "Da risolvere" e "Report", la terza non aggiungeva nulla alla
  // Panoramica. Le loro rotte esistono ancora come rimandi (RouteList.jsx).
  const workspaceSections = [
    { key: "overview", label: "Panoramica", path: projectOverviewPath, group: "overview" },

    { key: "assets", label: "Fonti", path: `${projectRootPath}/assets`, group: "conoscenza" },
    // `chainedToPrevious` disegna una freccetta fra Fonti e Brief: e' l'unico
    // legame reale della barra (senza fonti pronte il brief si blocca, e c'e' gia'
    // un semaforo che lo dice). Incatenare anche gli altri comunicherebbe un
    // obbligo che non esiste — Contenuti Web e Campagne ADS sono paralleli.
    { key: "discovery", label: "Brief", path: `${projectRootPath}/discovery`, group: "conoscenza", chainedToPrevious: true },
    { key: "memory", label: "Memoria", path: `${projectRootPath}/memory`, group: "conoscenza" },

    { key: "web", label: "Contenuti Web", path: `${projectRootPath}/web`, group: "produzione" },
    { key: "ads", label: "Campagne ADS", path: `${projectRootPath}/ads`, group: "produzione" },

    // Report sta con Performance, non con la produzione: si nutre di quei numeri.
    { key: "performance", label: "Performance", path: `${projectRootPath}/performance`, group: "risultati" },
    { key: "reports-client", label: "Report", path: `${projectRootPath}/reports/client`, group: "risultati" },

    { key: "alerts", label: "Da risolvere", path: `${projectRootPath}/alerts`, group: "priorita" },
    { key: "tasks", label: "Task", path: `${projectRootPath}/tasks`, group: "priorita" },
    { key: "opportunities", label: "Opportunita", path: `${projectRootPath}/opportunities`, group: "priorita" },
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
  // ⚠️ La scheda accesa si decide guardando SOLO il percorso, mai la coda
  // dell'indirizzo: e' cio' che permette a "Report" di ospitare due viste
  // (`?vista=tecnica`) restando accesa. C'e' un test che lo impedisce di rompere.
  // Prima questa stessa condizione era scritta due volte, qui e nel disegno del
  // link: bastava correggerne una per far divergere le due.
  const isSectionActive = (entry) => {
    const isOverviewAliasActive = entry.key === "overview"
      && (location.pathname === projectOverviewPath || location.pathname === projectRootPath);
    return location.pathname === entry.path || isOverviewAliasActive;
  };
  const activeSection = workspaceSections.find(isSectionActive);
  // La Panoramica sta sopra tutte e larga: e' il punto di ingresso del progetto,
  // non una scheda in fila con le altre.
  const overviewSection = workspaceSections.find((entry) => entry.group === "overview");
  // I pallini sulle voci di "Priorita". Il contesto di lavoro lo carichiamo gia'
  // per la testata: contiene le tre liste, quindi non costa nessuna chiamata in piu'.
  const sectionSignals = React.useMemo(() => buildSectionSignals(workingContext), [workingContext]);
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
  // Le schede non attive sono neutre tenui, non bottoni con il contorno grigio:
  // un outline spento su undici pulsanti disegnerebbe undici scatole che
  // competono con i dati (design-linguaggio-apple-web.md §6.1 e §7.1). Un solo
  // accento per vista: ce l'ha la scheda accesa.
  const renderNavigationLink = (entry) => {
    const isActive = isSectionActive(entry);
    // Il pallino esiste solo sulle tre voci di "Priorita", e c'e' SEMPRE: acceso
    // se qualcosa aspetta, spento altrimenti. Cosi' l'assenza di segnale si legge
    // come "non c'e' niente" invece che come "qui non e' previsto niente", e la
    // barra non si sposta quando un segnale si accende.
    const hasDot = Boolean(SIGNAL_TONE[entry.key]);
    const signalCount = sectionSignals[entry.key] || 0;
    const signalText = signalCount > 0
      ? describeSignal(entry.key, signalCount)
      : EMPTY_SIGNAL_LABEL[entry.key];
    return (
      <Link
        key={entry.key}
        to={entry.path}
        className={`agency-project-tab${isActive ? " is-active" : ""}`}
        aria-current={isActive ? "page" : undefined}
        // Il testo sta sulla voce intera, non sul pallino: un bersaglio da 7px
        // col mouse non lo si prende.
        title={hasDot ? signalText : undefined}
      >
        {entry.label}
        {hasDot && (
          <>
            <span
              className={`agency-project-tab-dot ${signalCount > 0
                ? `agency-project-tab-dot-${SIGNAL_TONE[entry.key]}`
                : "agency-project-tab-dot-off"}`}
              aria-hidden="true"
            />
            {/* Un pallino colorato comunica con il solo colore: chi non li
                distingue, o usa un lettore di schermo, deve sentirlo detto. */}
            {signalCount > 0 && <span className="visually-hidden">{`, ${signalText}`}</span>}
          </>
        )}
      </Link>
    );
  };

  const renderGroup = (group) => (
    <div key={group.key} className={`agency-project-tabs-group agency-project-tabs-group-${group.key}`}>
      <div className="agency-project-tabs-heading">{group.title}</div>
      <div className="agency-project-tabs-row">
        {workspaceSections
          .filter((entry) => entry.group === group.key)
          .map((entry) => (entry.chainedToPrevious
            ? (
              <React.Fragment key={entry.key}>
                <span className="agency-project-tabs-arrow" aria-hidden="true">→</span>
                {renderNavigationLink(entry)}
              </React.Fragment>
            )
            : renderNavigationLink(entry)))}
      </div>
    </div>
  );

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

      {/* Qui stava una fila piatta di undici pulsanti, piu' un pieghevole
          "Diagnosi e strumenti tecnici" che nascondeva le schede di sviluppo.
          Riscritta il 6/8/2026 (roadmap, decisione ③): la fila non diceva ne'
          l'ordine ne' la natura delle cose. */}
      <nav className="agency-project-tabs mb-3" aria-label="Sezioni del progetto">
        {overviewSection && (
          <Link
            to={overviewSection.path}
            className={`agency-project-tab agency-project-tab-wide${isSectionActive(overviewSection) ? " is-active" : ""}`}
            aria-current={isSectionActive(overviewSection) ? "page" : undefined}
          >
            {overviewSection.label}
          </Link>
        )}

        <div className="agency-project-tabs-chain">
          {SECTION_GROUPS.map(renderGroup)}
        </div>

        {/* Staccato dai tre di sopra con lo spazio, non con una linea: non e' una
            fase della catena, e' quello che il sistema ti segnala mentre lavori. */}
        <div className="agency-project-tabs-signals">
          {renderGroup(PRIORITY_GROUP)}
        </div>
      </nav>

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
