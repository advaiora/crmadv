export type AgencyReportInput = {
  projectId: string;
  workspaceId: string;
  projectName: string;
  projectStatus: string | null;
  projectPriority: string | null;
  projectType: {
    key: string;
    label: string;
  } | null;
  scopePurchased: Array<{
    key: string;
    label: string;
    purchased: boolean;
  }>;
  activeModules: Array<{
    key: string;
    label: string;
    included: boolean;
    suggested: boolean;
    active: boolean;
  }>;
  discovery: {
    sections: {
      businessContext: string;
      projectGoal: string;
      target: string;
      offer: string;
      brandCommunication: string;
      availableMaterials: string;
      technicalAspects: string;
      marketingAcquisition: string;
    };
    notes: string;
    brief: string;
    contextSummary: string;
    persisted: boolean;
    lastUpdatedAt: string | null;
  };
  contextSummary: string;
  web: {
    available: boolean;
    persisted: boolean;
    pageGoal: string;
    pageType: string;
    targetSummary: string;
    offerSummary: string;
    valueProp: string;
    ctaPrimary: string;
    trustElements: string[];
    sectionPlanCount: number;
    previewAvailable: boolean;
    lastGeneratedAt: string | null;
  };
  ads: {
    available: boolean;
    persisted: boolean;
    channelScope: 'google' | 'meta' | 'both' | 'none';
    offerAngle: string;
    google: {
      keywordSeedsCount: number;
      landingRecommendation: string;
    };
    meta: {
      creativeAnglesCount: number;
      assetRequestsCount: number;
      primaryTextsCount: number;
    };
    lastGeneratedAt: string | null;
  };
  alerts: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    reason: string | null;
    origin: string;
  }>;
  opportunities: Array<{
    id: string;
    title: string;
    stage: string;
    estimatedValue: number;
    status: string;
    origin: string;
    category: string | null;
    type: string | null;
    rationale: string | null;
    priority: string | null;
    score: number | null;
    impactLevel: string | null;
    sourceModule: string | null;
    sourceSignalKey: string | null;
    dedupKey: string | null;
    suggestedService: string | null;
    lastEvaluatedAt: string | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    teamRole: string;
    priority: string;
    status: string;
    sourceType: string;
    origin: string;
  }>;
  dataSourceSummary: {
    dominantSource: 'db' | 'mock' | 'local_fallback' | 'mixed';
    hasDiscovery: boolean;
    hasWeb: boolean;
    hasAds: boolean;
    hasAlerts: boolean;
    hasOpportunities: boolean;
    hasTasks: boolean;
  };
};

export type AgencyReportOutput = {
  projectId: string;
  projectSnapshot: {
    projectName: string;
    projectTypeLabel: string;
    projectStatus: string;
    projectPriority: string | null;
    contextSummary: string;
    scopeSummary: string[];
    readinessStatus: string;
  };
  moduleStatus: Array<{
    key: string;
    label: string;
    included: boolean;
    suggested: boolean;
    active: boolean;
    status: string;
  }>;
  discoverySummary: {
    title: string;
    summary: string;
    highlights: string[];
    status: string;
  };
  webSummary: {
    title: string;
    summary: string;
    highlights: string[];
    status: string;
  };
  adsSummary: {
    title: string;
    summary: string;
    highlights: string[];
    status: string;
  };
  topAlerts: AgencyReportInput['alerts'];
  topOpportunities: AgencyReportInput['opportunities'];
  topTasks: AgencyReportInput['tasks'];
  nextSteps: string[];
  reportStatus: string;
  clientReport: {
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
      dominantSource: AgencyReportInput['dataSourceSummary']['dominantSource'];
      basedOnDiagnosis: boolean;
      basedOnInternalReport: boolean;
      basedOnWeb: boolean;
      basedOnAds: boolean;
    };
  };
  dataSourceSummary: AgencyReportInput['dataSourceSummary'];
  generatedAt: string | null;
  updatedAt: string | null;
};

const ALERT_SEVERITY_SCORE: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const PRIORITY_SCORE: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const TASK_STATUS_SCORE: Record<string, number> = {
  blocked: 5,
  in_progress: 4,
  review: 3,
  todo: 2,
  done: 1,
};

const pickTopAlerts = (items: AgencyReportInput['alerts']) => (
  [...items]
    .sort((left, right) => {
      const severityDelta = (ALERT_SEVERITY_SCORE[right.severity] || 0) - (ALERT_SEVERITY_SCORE[left.severity] || 0);
      if (severityDelta !== 0) {
        return severityDelta;
      }
      return left.title.localeCompare(right.title);
    })
    .slice(0, 3)
);

const pickTopOpportunities = (items: AgencyReportInput['opportunities']) => (
  [...items]
    .sort((left, right) => {
      const scoreDelta = (right.score || 0) - (left.score || 0);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      const priorityDelta = (PRIORITY_SCORE[right.priority || ''] || 0) - (PRIORITY_SCORE[left.priority || ''] || 0);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return left.title.localeCompare(right.title);
    })
    .slice(0, 3)
);

const pickTopTasks = (items: AgencyReportInput['tasks']) => (
  [...items]
    .filter((entry) => entry.status !== 'done')
    .sort((left, right) => {
      const priorityDelta = (PRIORITY_SCORE[right.priority] || 0) - (PRIORITY_SCORE[left.priority] || 0);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      const statusDelta = (TASK_STATUS_SCORE[right.status] || 0) - (TASK_STATUS_SCORE[left.status] || 0);
      if (statusDelta !== 0) {
        return statusDelta;
      }
      return left.title.localeCompare(right.title);
    })
    .slice(0, 3)
);

const buildModuleStatus = (input: AgencyReportInput): AgencyReportOutput['moduleStatus'] => (
  input.activeModules.map((entry) => ({
    ...entry,
    status: entry.active
      ? 'active'
      : entry.included
        ? 'included'
        : entry.suggested
          ? 'suggested'
          : 'inactive',
  }))
);

const summarizeDiscovery = (input: AgencyReportInput): AgencyReportOutput['discoverySummary'] => {
  const sections = input.discovery.sections;
  const highlights = [
    sections.projectGoal,
    sections.target,
    sections.offer,
    sections.technicalAspects,
  ].filter((entry) => entry.trim().length > 0).slice(0, 4);

  const status = input.discovery.persisted
    ? 'ready'
    : highlights.length > 0
      ? 'partial'
      : 'missing';

  return {
    title: 'Discovery',
    summary: input.discovery.contextSummary || input.contextSummary || 'Discovery non ancora consolidata.',
    highlights,
    status,
  };
};

const summarizeWeb = (input: AgencyReportInput): AgencyReportOutput['webSummary'] => {
  const highlights = [
    input.web.pageGoal,
    input.web.pageType,
    input.web.ctaPrimary,
    input.web.trustElements.length > 0 ? `${input.web.trustElements.length} trust element` : '',
  ].filter((entry) => entry.trim().length > 0).slice(0, 4);

  const status = input.web.persisted
    ? 'ready'
    : input.web.available
      ? 'partial'
      : 'missing';

  const summary = input.web.available
    ? `Web impostato come ${input.web.pageType || 'pagina'} con goal "${input.web.pageGoal || 'non definito'}".`
    : 'Modulo Web non ancora consolidato.';

  return {
    title: 'Web',
    summary,
    highlights,
    status,
  };
};

const summarizeAds = (input: AgencyReportInput): AgencyReportOutput['adsSummary'] => {
  const highlights = [
    input.ads.channelScope !== 'none' ? `Canale ${input.ads.channelScope}` : '',
    input.ads.offerAngle,
    input.ads.google.keywordSeedsCount > 0 ? `${input.ads.google.keywordSeedsCount} keyword seed` : '',
    input.ads.meta.creativeAnglesCount > 0 ? `${input.ads.meta.creativeAnglesCount} creative angle` : '',
  ].filter((entry) => entry.trim().length > 0).slice(0, 4);

  const status = input.ads.persisted
    ? 'ready'
    : input.ads.available
      ? 'partial'
      : 'missing';

  const summary = input.ads.available
    ? `Ads configurato su ${input.ads.channelScope} con offer angle "${input.ads.offerAngle || 'non definito'}".`
    : 'Modulo Ads non ancora consolidato.';

  return {
    title: 'Ads',
    summary,
    highlights,
    status,
  };
};

export const buildAgencyReportNextSteps = (input: AgencyReportInput, output: Pick<AgencyReportOutput, 'topAlerts' | 'topOpportunities' | 'topTasks'>) => {
  const steps: string[] = [];
  const hasDiscoveryGoal = input.discovery.sections.projectGoal.trim().length > 0;
  const hasDiscoveryOffer = input.discovery.sections.offer.trim().length > 0;
  const hasDiscoveryTarget = input.discovery.sections.target.trim().length > 0;
  const hasTrackingAlert = output.topAlerts.some((entry) => entry.title.toLowerCase().includes('tracking'));
  const hasLandingOpportunity = output.topOpportunities.some((entry) => (entry.category || '').toLowerCase() === 'landing');
  const hasCriticalAlert = output.topAlerts.some((entry) => entry.severity === 'critical');

  if (!input.discovery.persisted || !hasDiscoveryGoal || !hasDiscoveryOffer || !hasDiscoveryTarget) {
    steps.push('Completare Discovery con obiettivo, target e offerta prima di consolidare il report.');
  }

  if (input.ads.available && !input.web.persisted) {
    steps.push('Completare landing dedicata o pagina di conversione prima del lancio Ads.');
  }

  if (hasTrackingAlert) {
    steps.push('Definire tracking ed eventi di conversione prima di validare il report.');
  }

  if (hasLandingOpportunity) {
    steps.push('Valutare opportunita landing ad alta priorita e confermare perimetro operativo.');
  }

  if (input.ads.available && input.ads.meta.assetRequestsCount > 0) {
    steps.push('Preparare asset creativi e approvazioni per il canale Meta.');
  }

  if (input.web.available && input.web.trustElements.length === 0) {
    steps.push('Raccogliere prove sociali o trust element per rafforzare la pagina.');
  }

  if (input.web.available && !input.web.ctaPrimary.trim()) {
    steps.push('Definire una CTA primaria chiara prima di condividere la snapshot al team.');
  }

  if (input.web.available && !input.web.previewAvailable) {
    steps.push('Generare preview Web aggiornata per allineare copy, struttura e CTA.');
  }

  if (input.ads.available && !input.ads.offerAngle.trim()) {
    steps.push('Chiarire offer angle e messaggio principale prima del setup campagne.');
  }

  if (hasCriticalAlert) {
    steps.push('Risolgere prima gli alert critici aperti per evitare blocchi operativi.');
  }

  output.topTasks.forEach((task) => {
    if (steps.length >= 5) {
      return;
    }

    steps.push(`Chiudere task prioritario: ${task.title}.`);
  });

  return Array.from(new Set(steps)).slice(0, 5);
};

export const buildAgencyReportSnapshot = (input: AgencyReportInput): AgencyReportOutput => {
  const topAlerts = pickTopAlerts(input.alerts);
  const topOpportunities = pickTopOpportunities(input.opportunities);
  const topTasks = pickTopTasks(input.tasks);
  const moduleStatus = buildModuleStatus(input);
  const discoverySummary = summarizeDiscovery(input);
  const webSummary = summarizeWeb(input);
  const adsSummary = summarizeAds(input);
  const readyBlocks = [discoverySummary, webSummary, adsSummary].filter((entry) => entry.status === 'ready').length;
  const reportStatus = readyBlocks >= 2
    ? 'ready'
    : readyBlocks === 1
      ? 'partial'
      : 'draft';
  const nextSteps = buildAgencyReportNextSteps(input, {
    topAlerts,
    topOpportunities,
    topTasks,
  });
  const generatedAt = new Date().toISOString();

  return {
    projectId: input.projectId,
    projectSnapshot: {
      projectName: input.projectName,
      projectTypeLabel: input.projectType?.label || 'Marketing Full',
      projectStatus: input.projectStatus || reportStatus,
      projectPriority: input.projectPriority,
      contextSummary: input.contextSummary || discoverySummary.summary,
      scopeSummary: input.scopePurchased
        .filter((entry) => entry.purchased)
        .map((entry) => entry.label),
      readinessStatus: reportStatus,
    },
    moduleStatus,
    discoverySummary,
    webSummary,
    adsSummary,
    topAlerts,
    topOpportunities,
    topTasks,
    nextSteps,
    reportStatus,
    clientReport: {
      clientReportStatus: 'draft',
      generatedAt: null,
      updatedAt: null,
      executiveSummary: '',
      projectStatusSummary: '',
      workCompletedSummary: [],
      keyFindings: [],
      keyOpportunities: [],
      nextStepsSummary: [],
      printableHtml: '',
      sourceSummary: {
        dominantSource: input.dataSourceSummary.dominantSource,
        basedOnDiagnosis: false,
        basedOnInternalReport: true,
        basedOnWeb: input.web.available,
        basedOnAds: input.ads.available,
      },
    },
    dataSourceSummary: input.dataSourceSummary,
    generatedAt,
    updatedAt: generatedAt,
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

const normalizeModuleStatusArray = (value: unknown): AgencyReportOutput['moduleStatus'] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const candidate = entry as Record<string, unknown>;
      const key = normalizeString(candidate.key).trim();
      const label = normalizeString(candidate.label).trim();
      if (!key || !label) {
        return null;
      }

      return {
        key,
        label,
        included: Boolean(candidate.included),
        suggested: Boolean(candidate.suggested),
        active: Boolean(candidate.active),
        status: normalizeString(candidate.status, 'inactive'),
      };
    })
    .filter((entry): entry is AgencyReportOutput['moduleStatus'][number] => entry !== null);
};

const normalizeSummaryBlock = (value: unknown, fallbackTitle: string): AgencyReportOutput['discoverySummary'] => {
  if (!value || typeof value !== 'object') {
    return {
      title: fallbackTitle,
      summary: '',
      highlights: [],
      status: 'missing',
    };
  }

  const candidate = value as Record<string, unknown>;
  return {
    title: normalizeString(candidate.title, fallbackTitle),
    summary: normalizeString(candidate.summary),
    highlights: normalizeStringArray(candidate.highlights),
    status: normalizeString(candidate.status, 'missing'),
  };
};

const normalizeClientReport = (
  value: unknown,
  fallback: AgencyReportOutput['clientReport'],
): AgencyReportOutput['clientReport'] => {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const candidate = value as Record<string, unknown>;
  const sourceSummaryCandidate = candidate.sourceSummary && typeof candidate.sourceSummary === 'object'
    ? candidate.sourceSummary as Record<string, unknown>
    : {};

  return {
    clientReportStatus: normalizeString(candidate.clientReportStatus, fallback.clientReportStatus),
    generatedAt: normalizeString(candidate.generatedAt) || fallback.generatedAt,
    updatedAt: normalizeString(candidate.updatedAt) || fallback.updatedAt,
    executiveSummary: normalizeString(candidate.executiveSummary),
    projectStatusSummary: normalizeString(candidate.projectStatusSummary),
    workCompletedSummary: normalizeStringArray(candidate.workCompletedSummary),
    keyFindings: normalizeStringArray(candidate.keyFindings),
    keyOpportunities: normalizeStringArray(candidate.keyOpportunities),
    nextStepsSummary: normalizeStringArray(candidate.nextStepsSummary),
    printableHtml: normalizeString(candidate.printableHtml),
    sourceSummary: {
      dominantSource: (
        normalizeString(sourceSummaryCandidate.dominantSource, fallback.sourceSummary.dominantSource)
      ) as AgencyReportOutput['clientReport']['sourceSummary']['dominantSource'],
      basedOnDiagnosis: typeof sourceSummaryCandidate.basedOnDiagnosis === 'boolean'
        ? sourceSummaryCandidate.basedOnDiagnosis
        : fallback.sourceSummary.basedOnDiagnosis,
      basedOnInternalReport: typeof sourceSummaryCandidate.basedOnInternalReport === 'boolean'
        ? sourceSummaryCandidate.basedOnInternalReport
        : fallback.sourceSummary.basedOnInternalReport,
      basedOnWeb: typeof sourceSummaryCandidate.basedOnWeb === 'boolean'
        ? sourceSummaryCandidate.basedOnWeb
        : fallback.sourceSummary.basedOnWeb,
      basedOnAds: typeof sourceSummaryCandidate.basedOnAds === 'boolean'
        ? sourceSummaryCandidate.basedOnAds
        : fallback.sourceSummary.basedOnAds,
    },
  };
};

const normalizeTopAlerts = (value: unknown): AgencyReportOutput['topAlerts'] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const candidate = entry as Record<string, unknown>;
      const title = normalizeString(candidate.title).trim();
      if (!title) {
        return null;
      }

      return {
        id: normalizeString(candidate.id),
        title,
        severity: normalizeString(candidate.severity, 'medium'),
        status: normalizeString(candidate.status, 'open'),
        reason: normalizeString(candidate.reason) || null,
        origin: normalizeString(candidate.origin, 'unknown'),
      };
    })
    .filter((entry): entry is AgencyReportOutput['topAlerts'][number] => entry !== null);
};

const normalizeTopOpportunities = (value: unknown): AgencyReportOutput['topOpportunities'] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const candidate = entry as Record<string, unknown>;
      const title = normalizeString(candidate.title).trim();
      if (!title) {
        return null;
      }

      return {
        id: normalizeString(candidate.id),
        title,
        stage: normalizeString(candidate.stage, 'Identificata'),
        estimatedValue: Number.isFinite(Number(candidate.estimatedValue)) ? Number(candidate.estimatedValue) : 0,
        status: normalizeString(candidate.status, 'suggested'),
        origin: normalizeString(candidate.origin, 'unknown'),
        category: normalizeString(candidate.category) || null,
        type: normalizeString(candidate.type) || null,
        rationale: normalizeString(candidate.rationale) || null,
        priority: normalizeString(candidate.priority) || null,
        score: Number.isFinite(Number(candidate.score)) ? Number(candidate.score) : null,
        impactLevel: normalizeString(candidate.impactLevel) || null,
        sourceModule: normalizeString(candidate.sourceModule) || null,
        sourceSignalKey: normalizeString(candidate.sourceSignalKey) || null,
        dedupKey: normalizeString(candidate.dedupKey) || null,
        suggestedService: normalizeString(candidate.suggestedService) || null,
        lastEvaluatedAt: normalizeString(candidate.lastEvaluatedAt) || null,
      };
    })
    .filter((entry): entry is AgencyReportOutput['topOpportunities'][number] => entry !== null);
};

const normalizeTopTasks = (value: unknown): AgencyReportOutput['topTasks'] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const candidate = entry as Record<string, unknown>;
      const title = normalizeString(candidate.title).trim();
      if (!title) {
        return null;
      }

      return {
        id: normalizeString(candidate.id),
        title,
        description: normalizeString(candidate.description) || null,
        teamRole: normalizeString(candidate.teamRole),
        priority: normalizeString(candidate.priority, 'medium'),
        status: normalizeString(candidate.status, 'todo'),
        sourceType: normalizeString(candidate.sourceType, 'manual'),
        origin: normalizeString(candidate.origin, 'unknown'),
      };
    })
    .filter((entry): entry is AgencyReportOutput['topTasks'][number] => entry !== null);
};

export const normalizeAgencyReportOutputFromJson = (
  value: unknown,
  fallback: AgencyReportOutput,
): AgencyReportOutput => {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const candidate = value as Record<string, unknown>;
  const projectSnapshotCandidate = candidate.projectSnapshot && typeof candidate.projectSnapshot === 'object'
    ? candidate.projectSnapshot as Record<string, unknown>
    : {};
  const dataSourceSummaryCandidate = candidate.dataSourceSummary && typeof candidate.dataSourceSummary === 'object'
    ? candidate.dataSourceSummary as Record<string, unknown>
    : {};

  return {
    ...fallback,
    projectSnapshot: {
      projectName: normalizeString(projectSnapshotCandidate.projectName, fallback.projectSnapshot.projectName),
      projectTypeLabel: normalizeString(projectSnapshotCandidate.projectTypeLabel, fallback.projectSnapshot.projectTypeLabel),
      projectStatus: normalizeString(projectSnapshotCandidate.projectStatus, fallback.projectSnapshot.projectStatus),
      projectPriority: normalizeString(projectSnapshotCandidate.projectPriority) || fallback.projectSnapshot.projectPriority,
      contextSummary: normalizeString(projectSnapshotCandidate.contextSummary, fallback.projectSnapshot.contextSummary),
      scopeSummary: normalizeStringArray(projectSnapshotCandidate.scopeSummary),
      readinessStatus: normalizeString(projectSnapshotCandidate.readinessStatus, fallback.projectSnapshot.readinessStatus),
    },
    moduleStatus: normalizeModuleStatusArray(candidate.moduleStatus),
    discoverySummary: normalizeSummaryBlock(candidate.discoverySummary, 'Discovery'),
    webSummary: normalizeSummaryBlock(candidate.webSummary, 'Web'),
    adsSummary: normalizeSummaryBlock(candidate.adsSummary, 'Ads'),
    topAlerts: normalizeTopAlerts(candidate.topAlerts),
    topOpportunities: normalizeTopOpportunities(candidate.topOpportunities),
    topTasks: normalizeTopTasks(candidate.topTasks),
    nextSteps: normalizeStringArray(candidate.nextSteps),
    reportStatus: normalizeString(candidate.reportStatus, fallback.reportStatus),
    clientReport: normalizeClientReport(candidate.clientReport, fallback.clientReport),
    dataSourceSummary: {
      dominantSource: (
        normalizeString(dataSourceSummaryCandidate.dominantSource, fallback.dataSourceSummary.dominantSource)
      ) as AgencyReportOutput['dataSourceSummary']['dominantSource'],
      hasDiscovery: Boolean(dataSourceSummaryCandidate.hasDiscovery),
      hasWeb: Boolean(dataSourceSummaryCandidate.hasWeb),
      hasAds: Boolean(dataSourceSummaryCandidate.hasAds),
      hasAlerts: Boolean(dataSourceSummaryCandidate.hasAlerts),
      hasOpportunities: Boolean(dataSourceSummaryCandidate.hasOpportunities),
      hasTasks: Boolean(dataSourceSummaryCandidate.hasTasks),
    },
    generatedAt: normalizeString(candidate.generatedAt) || fallback.generatedAt,
    updatedAt: normalizeString(candidate.updatedAt) || fallback.updatedAt,
  };
};
