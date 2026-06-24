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

const normalizeModuleSignals = (value) => {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.entries(value).reduce((accumulator, [key, entry]) => {
    if (!entry || typeof entry !== "object") {
      return accumulator;
    }

    accumulator[key] = {
      status: normalizeString(entry.status, "missing"),
      summary: normalizeString(entry.summary),
    };
    return accumulator;
  }, {});
};

const normalizeIssueList = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const title = normalizeString(entry.title).trim();
      if (!title) {
        return null;
      }

      return {
        key: normalizeString(entry.key, title.toLowerCase().replace(/\s+/g, "_")),
        title,
        summary: normalizeString(entry.summary),
        category: normalizeString(entry.category),
        priority: normalizeString(entry.priority, "medium"),
        module: normalizeString(entry.module),
        evidence: normalizeStringArray(entry.evidence),
        linkedFindingKey: normalizeString(entry.linkedFindingKey),
      };
    })
    .filter(Boolean);
};

export const createEmptyAgencyDiagnosisV1Input = (projectId = "") => ({
  projectId,
  workspaceId: "",
  projectName: "",
  projectStatus: null,
  projectPriority: null,
  projectType: {
    key: "marketing_full",
    label: "Marketing Full",
  },
  scopePurchased: [],
  activeModules: [],
  contextSummary: "",
  discovery: {
    sections: {
      businessContext: "",
      projectGoal: "",
      target: "",
      offer: "",
      brandCommunication: "",
      availableMaterials: "",
      technicalAspects: "",
      marketingAcquisition: "",
    },
    notes: "",
    brief: "",
    contextSummary: "",
    persisted: false,
    lastUpdatedAt: null,
  },
  web: {
    available: false,
    persisted: false,
    pageGoal: "",
    pageType: "",
    targetSummary: "",
    offerSummary: "",
    valueProp: "",
    ctaPrimary: "",
    trustElements: [],
    sectionPlanCount: 0,
    previewAvailable: false,
    lastGeneratedAt: null,
  },
  ads: {
    available: false,
    persisted: false,
    channelScope: "none",
    campaignGoal: "",
    offerAngle: "",
    google: {
      keywordSeedsCount: 0,
      landingRecommendation: "",
    },
    meta: {
      creativeAnglesCount: 0,
      assetRequestsCount: 0,
      primaryTextsCount: 0,
    },
    lastGeneratedAt: null,
  },
  report: {
    available: false,
    persisted: false,
    reportStatus: "draft",
    nextSteps: [],
    topAlertsCount: 0,
    topOpportunitiesCount: 0,
    topTasksCount: 0,
    updatedAt: null,
  },
  alerts: [],
  opportunities: [],
  tasks: [],
  dataSourceSummary: {
    dominantSource: "mock",
    hasDiscovery: false,
    hasWeb: false,
    hasAds: false,
    hasReport: false,
    hasAlerts: false,
    hasOpportunities: false,
    hasTasks: false,
  },
});

export const createEmptyAgencyDiagnosisV1Output = (projectId = "") => ({
  projectId,
  diagnosisStatus: "draft",
  evaluatedAt: null,
  diagnosisSummary: "",
  criticalFindings: [],
  probableCauses: [],
  gapAnalysis: [],
  recommendedActions: [],
  interventionPriority: "medium",
  confidenceLevel: "low",
  sourceSummary: {
    dominantSource: "mock",
    hasDiscovery: false,
    hasWeb: false,
    hasAds: false,
    hasReport: false,
    hasAlerts: false,
    hasOpportunities: false,
    hasTasks: false,
  },
  moduleSignals: {},
});

export const normalizeAgencyDiagnosisV1Input = (input, projectId = "") => {
  const base = createEmptyAgencyDiagnosisV1Input(projectId);
  if (!input || typeof input !== "object") {
    return base;
  }

  return {
    ...base,
    ...input,
    projectId: normalizeString(input.projectId, base.projectId),
    workspaceId: normalizeString(input.workspaceId, base.workspaceId),
    projectName: normalizeString(input.projectName, base.projectName),
    projectStatus: normalizeString(input.projectStatus) || null,
    projectPriority: normalizeString(input.projectPriority) || null,
    projectType: input.projectType && typeof input.projectType === "object"
      ? {
          key: normalizeString(input.projectType.key, base.projectType.key),
          label: normalizeString(input.projectType.label, base.projectType.label),
        }
      : base.projectType,
    scopePurchased: Array.isArray(input.scopePurchased) ? input.scopePurchased : base.scopePurchased,
    activeModules: Array.isArray(input.activeModules) ? input.activeModules : base.activeModules,
    contextSummary: normalizeString(input.contextSummary, base.contextSummary),
    discovery: input.discovery && typeof input.discovery === "object"
      ? {
          sections: input.discovery.sections && typeof input.discovery.sections === "object"
            ? {
                businessContext: normalizeString(input.discovery.sections.businessContext),
                projectGoal: normalizeString(input.discovery.sections.projectGoal),
                target: normalizeString(input.discovery.sections.target),
                offer: normalizeString(input.discovery.sections.offer),
                brandCommunication: normalizeString(input.discovery.sections.brandCommunication),
                availableMaterials: normalizeString(input.discovery.sections.availableMaterials),
                technicalAspects: normalizeString(input.discovery.sections.technicalAspects),
                marketingAcquisition: normalizeString(input.discovery.sections.marketingAcquisition),
              }
            : base.discovery.sections,
          notes: normalizeString(input.discovery.notes),
          brief: normalizeString(input.discovery.brief),
          contextSummary: normalizeString(input.discovery.contextSummary),
          persisted: Boolean(input.discovery.persisted),
          lastUpdatedAt: normalizeString(input.discovery.lastUpdatedAt) || null,
        }
      : base.discovery,
    web: input.web && typeof input.web === "object"
      ? {
          available: Boolean(input.web.available),
          persisted: Boolean(input.web.persisted),
          pageGoal: normalizeString(input.web.pageGoal),
          pageType: normalizeString(input.web.pageType),
          targetSummary: normalizeString(input.web.targetSummary),
          offerSummary: normalizeString(input.web.offerSummary),
          valueProp: normalizeString(input.web.valueProp),
          ctaPrimary: normalizeString(input.web.ctaPrimary),
          trustElements: normalizeStringArray(input.web.trustElements),
          sectionPlanCount: Number.isFinite(Number(input.web.sectionPlanCount)) ? Number(input.web.sectionPlanCount) : 0,
          previewAvailable: Boolean(input.web.previewAvailable),
          lastGeneratedAt: normalizeString(input.web.lastGeneratedAt) || null,
        }
      : base.web,
    ads: input.ads && typeof input.ads === "object"
      ? {
          available: Boolean(input.ads.available),
          persisted: Boolean(input.ads.persisted),
          channelScope: normalizeString(input.ads.channelScope, "none"),
          campaignGoal: normalizeString(input.ads.campaignGoal),
          offerAngle: normalizeString(input.ads.offerAngle),
          google: input.ads.google && typeof input.ads.google === "object"
            ? {
                keywordSeedsCount: Number.isFinite(Number(input.ads.google.keywordSeedsCount)) ? Number(input.ads.google.keywordSeedsCount) : 0,
                landingRecommendation: normalizeString(input.ads.google.landingRecommendation),
              }
            : base.ads.google,
          meta: input.ads.meta && typeof input.ads.meta === "object"
            ? {
                creativeAnglesCount: Number.isFinite(Number(input.ads.meta.creativeAnglesCount)) ? Number(input.ads.meta.creativeAnglesCount) : 0,
                assetRequestsCount: Number.isFinite(Number(input.ads.meta.assetRequestsCount)) ? Number(input.ads.meta.assetRequestsCount) : 0,
                primaryTextsCount: Number.isFinite(Number(input.ads.meta.primaryTextsCount)) ? Number(input.ads.meta.primaryTextsCount) : 0,
              }
            : base.ads.meta,
          lastGeneratedAt: normalizeString(input.ads.lastGeneratedAt) || null,
        }
      : base.ads,
    report: input.report && typeof input.report === "object"
      ? {
          available: Boolean(input.report.available),
          persisted: Boolean(input.report.persisted),
          reportStatus: normalizeString(input.report.reportStatus, base.report.reportStatus),
          nextSteps: normalizeStringArray(input.report.nextSteps),
          topAlertsCount: Number.isFinite(Number(input.report.topAlertsCount)) ? Number(input.report.topAlertsCount) : 0,
          topOpportunitiesCount: Number.isFinite(Number(input.report.topOpportunitiesCount)) ? Number(input.report.topOpportunitiesCount) : 0,
          topTasksCount: Number.isFinite(Number(input.report.topTasksCount)) ? Number(input.report.topTasksCount) : 0,
          updatedAt: normalizeString(input.report.updatedAt) || null,
        }
      : base.report,
    alerts: Array.isArray(input.alerts) ? input.alerts : [],
    opportunities: Array.isArray(input.opportunities) ? input.opportunities : [],
    tasks: Array.isArray(input.tasks) ? input.tasks : [],
    dataSourceSummary: {
      dominantSource: normalizeString(input.dataSourceSummary?.dominantSource, base.dataSourceSummary.dominantSource),
      hasDiscovery: Boolean(input.dataSourceSummary?.hasDiscovery),
      hasWeb: Boolean(input.dataSourceSummary?.hasWeb),
      hasAds: Boolean(input.dataSourceSummary?.hasAds),
      hasReport: Boolean(input.dataSourceSummary?.hasReport),
      hasAlerts: Boolean(input.dataSourceSummary?.hasAlerts),
      hasOpportunities: Boolean(input.dataSourceSummary?.hasOpportunities),
      hasTasks: Boolean(input.dataSourceSummary?.hasTasks),
    },
  };
};

export const normalizeAgencyDiagnosisV1Output = (output, projectId = "") => {
  const base = createEmptyAgencyDiagnosisV1Output(projectId);
  if (!output || typeof output !== "object") {
    return base;
  }

  return {
    ...base,
    ...output,
    projectId: normalizeString(output.projectId, base.projectId),
    diagnosisStatus: normalizeString(output.diagnosisStatus, base.diagnosisStatus),
    evaluatedAt: normalizeString(output.evaluatedAt) || null,
    diagnosisSummary: normalizeString(output.diagnosisSummary),
    criticalFindings: normalizeIssueList(output.criticalFindings),
    probableCauses: normalizeIssueList(output.probableCauses),
    gapAnalysis: normalizeIssueList(output.gapAnalysis),
    recommendedActions: normalizeIssueList(output.recommendedActions),
    interventionPriority: normalizeString(output.interventionPriority, base.interventionPriority),
    confidenceLevel: normalizeString(output.confidenceLevel, base.confidenceLevel),
    sourceSummary: {
      dominantSource: normalizeString(output.sourceSummary?.dominantSource, base.sourceSummary.dominantSource),
      hasDiscovery: Boolean(output.sourceSummary?.hasDiscovery),
      hasWeb: Boolean(output.sourceSummary?.hasWeb),
      hasAds: Boolean(output.sourceSummary?.hasAds),
      hasReport: Boolean(output.sourceSummary?.hasReport),
      hasAlerts: Boolean(output.sourceSummary?.hasAlerts),
      hasOpportunities: Boolean(output.sourceSummary?.hasOpportunities),
      hasTasks: Boolean(output.sourceSummary?.hasTasks),
    },
    moduleSignals: normalizeModuleSignals(output.moduleSignals),
  };
};
