export type AgencyClientReportInput = {
  projectId: string;
  workspaceId: string;
  projectName: string;
  projectTypeLabel: string;
  projectStatus: string;
  projectPriority: string | null;
  contextSummary: string;
  scopeSummary: string[];
  report: {
    reportStatus: string;
    discoverySummary: {
      summary: string;
      highlights: string[];
      status: string;
    };
    webSummary: {
      summary: string;
      highlights: string[];
      status: string;
    };
    adsSummary: {
      summary: string;
      highlights: string[];
      status: string;
    };
    topAlerts: Array<{
      title: string;
      severity: string;
      reason: string | null;
      origin: string;
    }>;
    topOpportunities: Array<{
      title: string;
      priority: string | null;
      rationale: string | null;
      category: string | null;
      sourceModule: string | null;
    }>;
    topTasks: Array<{
      title: string;
      priority: string;
      teamRole: string;
      status: string;
    }>;
    nextSteps: string[];
    dataSourceSummary: {
      dominantSource: 'db' | 'mock' | 'local_fallback' | 'mixed';
    };
  };
  diagnosis: {
    diagnosisStatus: string;
    diagnosisSummary: string;
    criticalFindings: Array<{
      title: string;
      summary: string;
      priority: string;
      category: string;
    }>;
    recommendedActions: Array<{
      title: string;
      summary: string;
      priority: string;
      module: string;
    }>;
    interventionPriority: string;
    confidenceLevel: string;
  } | null;
  web: {
    available: boolean;
    pageGoal: string;
    pageType: string;
    ctaPrimary: string;
    trustElements: string[];
  };
  ads: {
    available: boolean;
    channelScope: 'google' | 'meta' | 'both' | 'none';
    offerAngle: string;
  };
};

export type AgencyClientReportOutput = {
  clientReportStatus: string;
  generatedAt: string | null;
  updatedAt: string | null;
  executiveSummary: string;
  projectStatusSummary: string;
  workCompletedSummary: string[];
  keyFindings: string[];
  keyOpportunities: string[];
  nextStepsSummary: string[];
  printableHtml: string;
  sourceSummary: {
    dominantSource: 'db' | 'mock' | 'local_fallback' | 'mixed';
    basedOnDiagnosis: boolean;
    basedOnInternalReport: boolean;
    basedOnWeb: boolean;
    basedOnAds: boolean;
  };
};

const normalizeString = (value: unknown, fallback = '') => (
  typeof value === 'string' ? value : fallback
);

const normalizeStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const normalizeSourceSummary = (
  value: unknown,
  fallback: AgencyClientReportOutput['sourceSummary'],
): AgencyClientReportOutput['sourceSummary'] => {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const candidate = value as Record<string, unknown>;
  return {
    dominantSource: normalizeString(candidate.dominantSource, fallback.dominantSource) as AgencyClientReportOutput['sourceSummary']['dominantSource'],
    basedOnDiagnosis: typeof candidate.basedOnDiagnosis === 'boolean' ? candidate.basedOnDiagnosis : fallback.basedOnDiagnosis,
    basedOnInternalReport: typeof candidate.basedOnInternalReport === 'boolean' ? candidate.basedOnInternalReport : fallback.basedOnInternalReport,
    basedOnWeb: typeof candidate.basedOnWeb === 'boolean' ? candidate.basedOnWeb : fallback.basedOnWeb,
    basedOnAds: typeof candidate.basedOnAds === 'boolean' ? candidate.basedOnAds : fallback.basedOnAds,
  };
};

const pickKeyFindings = (input: AgencyClientReportInput) => {
  const findings = [
    ...(input.diagnosis?.criticalFindings || []).map((entry) => entry.summary || entry.title),
    ...input.report.topAlerts.map((entry) => entry.reason || `${entry.title} da presidiare con attenzione.`),
  ].map((entry) => entry.trim()).filter(Boolean);

  return Array.from(new Set(findings)).slice(0, 4);
};

const pickWorkCompleted = (input: AgencyClientReportInput) => {
  const items = [
    input.report.discoverySummary.status !== 'missing' ? 'Impostazione strategica e discovery iniziale consolidate.' : '',
    input.web.available ? `Modulo Web impostato con focus su ${input.web.pageType || 'pagina'} e obiettivo ${input.web.pageGoal || 'da definire'}.` : '',
    input.ads.available ? `Modulo Ads configurato sul canale ${input.ads.channelScope} con primo assetto operativo.` : '',
    input.report.discoverySummary.highlights[0] ? `Contesto e messaggio prioritario sintetizzati per il progetto.` : '',
  ].map((entry) => entry.trim()).filter(Boolean);

  return Array.from(new Set(items)).slice(0, 4);
};

const pickOpportunities = (input: AgencyClientReportInput) => {
  const items = [
    ...input.report.topOpportunities.map((entry) => entry.rationale || entry.title),
    ...(input.diagnosis?.recommendedActions || []).map((entry) => entry.title),
  ].map((entry) => entry.trim()).filter(Boolean);

  return Array.from(new Set(items)).slice(0, 4);
};

const pickNextSteps = (input: AgencyClientReportInput) => {
  const steps = [
    ...(input.diagnosis?.recommendedActions || []).map((entry) => entry.title),
    ...input.report.nextSteps,
  ].map((entry) => entry.trim()).filter(Boolean);

  return Array.from(new Set(steps)).slice(0, 5);
};

const buildExecutiveSummary = (input: AgencyClientReportInput) => {
  if (input.diagnosis?.criticalFindings?.length) {
    return `Il progetto ${input.projectName} sta avanzando con basi operative gia impostate, ma richiede ancora alcuni interventi prioritari per consolidare efficacia e misurabilita.`;
  }

  if (input.report.reportStatus === 'ready') {
    return `Il progetto ${input.projectName} presenta uno stato operativo ordinato, con impostazioni principali gia definite e una base solida per i prossimi step.`;
  }

  return `Il progetto ${input.projectName} ha gia una struttura operativa avviata e sta consolidando i principali elementi necessari per l'esecuzione.`;
};

const buildProjectStatusSummary = (input: AgencyClientReportInput) => {
  const scope = input.scopeSummary.length > 0 ? input.scopeSummary.join(', ') : 'perimetro in definizione';
  const readiness = input.report.reportStatus === 'ready'
    ? 'stato complessivamente pronto'
    : input.report.reportStatus === 'partial'
      ? 'stato in consolidamento'
      : 'stato ancora iniziale';

  return `Tipo progetto: ${input.projectTypeLabel}. Scope attuale: ${scope}. Il progetto risulta in ${readiness}.`;
};

const buildPrintableHtml = (input: AgencyClientReportInput, output: Omit<AgencyClientReportOutput, 'printableHtml'>) => {
  const list = (items: string[]) => items.length > 0
    ? `<ul>${items.map((entry) => `<li>${entry}</li>`).join('')}</ul>`
    : '<p>Nessun elemento disponibile.</p>';

  return [
    '<article class="agency-client-report">',
    `<header><h1>Report Cliente - ${input.projectName}</h1><p>${output.projectStatusSummary}</p></header>`,
    `<section><h2>Executive Summary</h2><p>${output.executiveSummary}</p></section>`,
    `<section><h2>Attivita impostate</h2>${list(output.workCompletedSummary)}</section>`,
    `<section><h2>Elementi da presidiare</h2>${list(output.keyFindings)}</section>`,
    `<section><h2>Opportunita di miglioramento</h2>${list(output.keyOpportunities)}</section>`,
    `<section><h2>Prossimi step</h2>${list(output.nextStepsSummary)}</section>`,
    '<footer><p>Snapshot cliente generata dal workspace Agency AI OS.</p></footer>',
    '</article>',
  ].join('');
};

export const buildAgencyClientReportSnapshot = (input: AgencyClientReportInput): AgencyClientReportOutput => {
  const generatedAt = new Date().toISOString();
  const executiveSummary = buildExecutiveSummary(input);
  const projectStatusSummary = buildProjectStatusSummary(input);
  const workCompletedSummary = pickWorkCompleted(input);
  const keyFindings = pickKeyFindings(input);
  const keyOpportunities = pickOpportunities(input);
  const nextStepsSummary = pickNextSteps(input);
  const clientReportStatus = keyFindings.length > 0 ? 'needs_review' : 'ready';
  const sourceSummary = {
    dominantSource: input.report.dataSourceSummary.dominantSource,
    basedOnDiagnosis: Boolean(input.diagnosis),
    basedOnInternalReport: true,
    basedOnWeb: input.web.available,
    basedOnAds: input.ads.available,
  };

  const partialOutput = {
    clientReportStatus,
    generatedAt,
    updatedAt: generatedAt,
    executiveSummary,
    projectStatusSummary,
    workCompletedSummary,
    keyFindings,
    keyOpportunities,
    nextStepsSummary,
    sourceSummary,
  };

  return {
    ...partialOutput,
    printableHtml: buildPrintableHtml(input, partialOutput),
  };
};

export const normalizeAgencyClientReportOutputFromJson = (
  value: unknown,
  fallback: AgencyClientReportOutput,
): AgencyClientReportOutput => {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const candidate = value as Record<string, unknown>;
  const partialOutput = {
    clientReportStatus: normalizeString(candidate.clientReportStatus, fallback.clientReportStatus),
    generatedAt: normalizeString(candidate.generatedAt) || fallback.generatedAt,
    updatedAt: normalizeString(candidate.updatedAt) || fallback.updatedAt,
    executiveSummary: normalizeString(candidate.executiveSummary, fallback.executiveSummary),
    projectStatusSummary: normalizeString(candidate.projectStatusSummary, fallback.projectStatusSummary),
    workCompletedSummary: normalizeStringArray(candidate.workCompletedSummary),
    keyFindings: normalizeStringArray(candidate.keyFindings),
    keyOpportunities: normalizeStringArray(candidate.keyOpportunities),
    nextStepsSummary: normalizeStringArray(candidate.nextStepsSummary),
    sourceSummary: normalizeSourceSummary(candidate.sourceSummary, fallback.sourceSummary),
  };

  return {
    ...fallback,
    ...partialOutput,
    printableHtml: normalizeString(candidate.printableHtml) || buildPrintableHtml({
      projectId: '',
      workspaceId: '',
      projectName: '',
      projectTypeLabel: '',
      projectStatus: '',
      projectPriority: null,
      contextSummary: '',
      scopeSummary: [],
      report: {
        reportStatus: '',
        discoverySummary: { summary: '', highlights: [], status: '' },
        webSummary: { summary: '', highlights: [], status: '' },
        adsSummary: { summary: '', highlights: [], status: '' },
        topAlerts: [],
        topOpportunities: [],
        topTasks: [],
        nextSteps: [],
        dataSourceSummary: { dominantSource: partialOutput.sourceSummary.dominantSource },
      },
      diagnosis: null,
      web: { available: partialOutput.sourceSummary.basedOnWeb, pageGoal: '', pageType: '', ctaPrimary: '', trustElements: [] },
      ads: { available: partialOutput.sourceSummary.basedOnAds, channelScope: 'none', offerAngle: '' },
    }, partialOutput),
  };
};
