const EMPTY_STRING = "";

const normalizeString = (value, fallback = EMPTY_STRING) => (
  typeof value === "string" ? value : fallback
);

const normalizeStringArray = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

export const createEmptyAgencyClientReportV1Input = (projectId = "") => ({
  projectId,
  workspaceId: "",
  projectName: "",
  projectTypeLabel: "",
  projectStatus: "draft",
  projectPriority: null,
  contextSummary: "",
  scopeSummary: [],
  report: {
    reportStatus: "draft",
    discoverySummary: { summary: "", highlights: [], status: "missing" },
    webSummary: { summary: "", highlights: [], status: "missing" },
    adsSummary: { summary: "", highlights: [], status: "missing" },
    topAlerts: [],
    topOpportunities: [],
    topTasks: [],
    nextSteps: [],
    dataSourceSummary: { dominantSource: "mock" },
  },
  diagnosis: null,
  web: {
    available: false,
    pageGoal: "",
    pageType: "",
    ctaPrimary: "",
    trustElements: [],
  },
  ads: {
    available: false,
    channelScope: "none",
    offerAngle: "",
  },
});

export const createEmptyAgencyClientReportV1Output = () => ({
  clientReportStatus: "draft",
  generatedAt: null,
  updatedAt: null,
  executiveSummary: "",
  projectStatusSummary: "",
  workCompletedSummary: [],
  keyFindings: [],
  keyOpportunities: [],
  nextStepsSummary: [],
  printableHtml: "",
  sourceSummary: {
    dominantSource: "mock",
    basedOnDiagnosis: false,
    basedOnInternalReport: false,
    basedOnWeb: false,
    basedOnAds: false,
  },
});

export const normalizeAgencyClientReportV1Input = (input, projectId = "") => {
  const base = createEmptyAgencyClientReportV1Input(projectId);
  if (!input || typeof input !== "object") {
    return base;
  }

  return {
    ...base,
    ...input,
    projectId: normalizeString(input.projectId, base.projectId),
    workspaceId: normalizeString(input.workspaceId, base.workspaceId),
    projectName: normalizeString(input.projectName, base.projectName),
    projectTypeLabel: normalizeString(input.projectTypeLabel, base.projectTypeLabel),
    projectStatus: normalizeString(input.projectStatus, base.projectStatus),
    projectPriority: normalizeString(input.projectPriority) || null,
    contextSummary: normalizeString(input.contextSummary, base.contextSummary),
    scopeSummary: normalizeStringArray(input.scopeSummary),
    report: input.report && typeof input.report === "object"
      ? {
          reportStatus: normalizeString(input.report.reportStatus, base.report.reportStatus),
          discoverySummary: {
            summary: normalizeString(input.report.discoverySummary?.summary),
            highlights: normalizeStringArray(input.report.discoverySummary?.highlights),
            status: normalizeString(input.report.discoverySummary?.status, "missing"),
          },
          webSummary: {
            summary: normalizeString(input.report.webSummary?.summary),
            highlights: normalizeStringArray(input.report.webSummary?.highlights),
            status: normalizeString(input.report.webSummary?.status, "missing"),
          },
          adsSummary: {
            summary: normalizeString(input.report.adsSummary?.summary),
            highlights: normalizeStringArray(input.report.adsSummary?.highlights),
            status: normalizeString(input.report.adsSummary?.status, "missing"),
          },
          topAlerts: Array.isArray(input.report.topAlerts) ? input.report.topAlerts : [],
          topOpportunities: Array.isArray(input.report.topOpportunities) ? input.report.topOpportunities : [],
          topTasks: Array.isArray(input.report.topTasks) ? input.report.topTasks : [],
          nextSteps: normalizeStringArray(input.report.nextSteps),
          dataSourceSummary: {
            dominantSource: normalizeString(input.report.dataSourceSummary?.dominantSource, "mock"),
          },
        }
      : base.report,
    diagnosis: input.diagnosis && typeof input.diagnosis === "object"
      ? {
          diagnosisStatus: normalizeString(input.diagnosis.diagnosisStatus, "draft"),
          diagnosisSummary: normalizeString(input.diagnosis.diagnosisSummary),
          criticalFindings: Array.isArray(input.diagnosis.criticalFindings) ? input.diagnosis.criticalFindings : [],
          recommendedActions: Array.isArray(input.diagnosis.recommendedActions) ? input.diagnosis.recommendedActions : [],
          interventionPriority: normalizeString(input.diagnosis.interventionPriority, "medium"),
          confidenceLevel: normalizeString(input.diagnosis.confidenceLevel, "low"),
        }
      : null,
    web: input.web && typeof input.web === "object"
      ? {
          available: Boolean(input.web.available),
          pageGoal: normalizeString(input.web.pageGoal),
          pageType: normalizeString(input.web.pageType),
          ctaPrimary: normalizeString(input.web.ctaPrimary),
          trustElements: normalizeStringArray(input.web.trustElements),
        }
      : base.web,
    ads: input.ads && typeof input.ads === "object"
      ? {
          available: Boolean(input.ads.available),
          channelScope: normalizeString(input.ads.channelScope, "none"),
          offerAngle: normalizeString(input.ads.offerAngle),
        }
      : base.ads,
  };
};

export const normalizeAgencyClientReportV1Output = (input) => {
  const base = createEmptyAgencyClientReportV1Output();
  if (!input || typeof input !== "object") {
    return base;
  }

  return {
    ...base,
    ...input,
    clientReportStatus: normalizeString(input.clientReportStatus, base.clientReportStatus),
    generatedAt: normalizeString(input.generatedAt) || null,
    updatedAt: normalizeString(input.updatedAt) || null,
    executiveSummary: normalizeString(input.executiveSummary),
    projectStatusSummary: normalizeString(input.projectStatusSummary),
    workCompletedSummary: normalizeStringArray(input.workCompletedSummary),
    keyFindings: normalizeStringArray(input.keyFindings),
    keyOpportunities: normalizeStringArray(input.keyOpportunities),
    nextStepsSummary: normalizeStringArray(input.nextStepsSummary),
    printableHtml: normalizeString(input.printableHtml),
    sourceSummary: {
      dominantSource: normalizeString(input.sourceSummary?.dominantSource, base.sourceSummary.dominantSource),
      basedOnDiagnosis: Boolean(input.sourceSummary?.basedOnDiagnosis),
      basedOnInternalReport: Boolean(input.sourceSummary?.basedOnInternalReport),
      basedOnWeb: Boolean(input.sourceSummary?.basedOnWeb),
      basedOnAds: Boolean(input.sourceSummary?.basedOnAds),
    },
  };
};
