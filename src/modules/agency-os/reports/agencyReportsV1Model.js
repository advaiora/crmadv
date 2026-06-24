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

const normalizeModuleStatus = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const key = normalizeString(entry?.key).trim();
      const label = normalizeString(entry?.label).trim();
      if (!key || !label) {
        return null;
      }

      return {
        key,
        label,
        included: Boolean(entry?.included),
        suggested: Boolean(entry?.suggested),
        active: Boolean(entry?.active),
        status: normalizeString(entry?.status, "inactive"),
      };
    })
    .filter(Boolean);
};

const normalizeSummaryBlock = (value) => {
  if (!value || typeof value !== "object") {
    return {
      title: "",
      summary: "",
      highlights: [],
      status: "missing",
    };
  }

  return {
    title: normalizeString(value.title),
    summary: normalizeString(value.summary),
    highlights: normalizeStringArray(value.highlights),
    status: normalizeString(value.status, "missing"),
  };
};

const normalizeOpportunityLikeList = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const title = normalizeString(entry?.title).trim();
      if (!title) {
        return null;
      }

      return {
        title,
        status: normalizeString(entry?.status, "suggested"),
        priority: normalizeString(entry?.priority, "medium"),
        score: Number.isFinite(Number(entry?.score)) ? Number(entry.score) : null,
        type: normalizeString(entry?.type),
        category: normalizeString(entry?.category),
        rationale: normalizeString(entry?.rationale),
        sourceModule: normalizeString(entry?.sourceModule),
        projectId: normalizeString(entry?.projectId),
      };
    })
    .filter(Boolean);
};

const normalizeTaskList = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const title = normalizeString(entry?.title).trim();
      if (!title) {
        return null;
      }

      return {
        title,
        status: normalizeString(entry?.status, "todo"),
        priority: normalizeString(entry?.priority, "medium"),
        teamRole: normalizeString(entry?.teamRole),
        sourceType: normalizeString(entry?.sourceType),
        projectId: normalizeString(entry?.projectId),
      };
    })
    .filter(Boolean);
};

const normalizeClientReport = (value) => {
  if (!value || typeof value !== "object") {
    return {
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
    };
  }

  return {
    clientReportStatus: normalizeString(value.clientReportStatus, "draft"),
    generatedAt: normalizeString(value.generatedAt) || null,
    updatedAt: normalizeString(value.updatedAt) || null,
    executiveSummary: normalizeString(value.executiveSummary),
    projectStatusSummary: normalizeString(value.projectStatusSummary),
    workCompletedSummary: normalizeStringArray(value.workCompletedSummary),
    keyFindings: normalizeStringArray(value.keyFindings),
    keyOpportunities: normalizeStringArray(value.keyOpportunities),
    nextStepsSummary: normalizeStringArray(value.nextStepsSummary),
    printableHtml: normalizeString(value.printableHtml),
    sourceSummary: {
      dominantSource: normalizeString(value.sourceSummary?.dominantSource, "mock"),
      basedOnDiagnosis: Boolean(value.sourceSummary?.basedOnDiagnosis),
      basedOnInternalReport: Boolean(value.sourceSummary?.basedOnInternalReport),
      basedOnWeb: Boolean(value.sourceSummary?.basedOnWeb),
      basedOnAds: Boolean(value.sourceSummary?.basedOnAds),
    },
  };
};

export const createEmptyAgencyReportV1Input = (projectId = "") => ({
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
    lastUpdatedAt: null,
  },
  web: {
    available: false,
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
    channelScope: "none",
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
  alerts: [],
  opportunities: [],
  tasks: [],
  dataSourceSummary: {
    dominantSource: "mock",
    hasDiscovery: false,
    hasWeb: false,
    hasAds: false,
    hasAlerts: false,
    hasOpportunities: false,
    hasTasks: false,
  },
});

export const createEmptyAgencyReportV1Output = (projectId = "") => ({
  projectId,
  projectSnapshot: {
    projectName: "",
    projectTypeLabel: "",
    projectStatus: "draft",
    projectPriority: null,
    contextSummary: "",
    scopeSummary: [],
    readinessStatus: "draft",
  },
  moduleStatus: [],
  discoverySummary: {
    title: "Discovery",
    summary: "",
    highlights: [],
    status: "missing",
  },
  webSummary: {
    title: "Web",
    summary: "",
    highlights: [],
    status: "missing",
  },
  adsSummary: {
    title: "Ads",
    summary: "",
    highlights: [],
    status: "missing",
  },
  topAlerts: [],
  topOpportunities: [],
  topTasks: [],
  nextSteps: [],
  reportStatus: "draft",
  clientReport: {
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
  },
  dataSourceSummary: {
    dominantSource: "mock",
    hasDiscovery: false,
    hasWeb: false,
    hasAds: false,
    hasAlerts: false,
    hasOpportunities: false,
    hasTasks: false,
  },
  generatedAt: null,
  updatedAt: null,
});

export const normalizeAgencyReportV1Input = (input, projectId = "") => {
  const base = createEmptyAgencyReportV1Input(projectId);
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
    contextSummary: normalizeString(input.contextSummary, base.contextSummary),
    alerts: Array.isArray(input.alerts) ? input.alerts : [],
    opportunities: normalizeOpportunityLikeList(input.opportunities),
    tasks: normalizeTaskList(input.tasks),
    dataSourceSummary: {
      dominantSource: normalizeString(input.dataSourceSummary?.dominantSource, base.dataSourceSummary.dominantSource),
      hasDiscovery: Boolean(input.dataSourceSummary?.hasDiscovery),
      hasWeb: Boolean(input.dataSourceSummary?.hasWeb),
      hasAds: Boolean(input.dataSourceSummary?.hasAds),
      hasAlerts: Boolean(input.dataSourceSummary?.hasAlerts),
      hasOpportunities: Boolean(input.dataSourceSummary?.hasOpportunities),
      hasTasks: Boolean(input.dataSourceSummary?.hasTasks),
    },
  };
};

export const normalizeAgencyReportV1Output = (input, projectId = "") => {
  const base = createEmptyAgencyReportV1Output(projectId);
  if (!input || typeof input !== "object") {
    return base;
  }

  return {
    ...base,
    ...input,
    projectId: normalizeString(input.projectId, base.projectId),
    projectSnapshot: {
      projectName: normalizeString(input.projectSnapshot?.projectName),
      projectTypeLabel: normalizeString(input.projectSnapshot?.projectTypeLabel),
      projectStatus: normalizeString(input.projectSnapshot?.projectStatus, base.projectSnapshot.projectStatus),
      projectPriority: normalizeString(input.projectSnapshot?.projectPriority) || null,
      contextSummary: normalizeString(input.projectSnapshot?.contextSummary),
      scopeSummary: normalizeStringArray(input.projectSnapshot?.scopeSummary),
      readinessStatus: normalizeString(input.projectSnapshot?.readinessStatus, base.projectSnapshot.readinessStatus),
    },
    moduleStatus: normalizeModuleStatus(input.moduleStatus),
    discoverySummary: normalizeSummaryBlock(input.discoverySummary),
    webSummary: normalizeSummaryBlock(input.webSummary),
    adsSummary: normalizeSummaryBlock(input.adsSummary),
    topAlerts: Array.isArray(input.topAlerts) ? input.topAlerts : [],
    topOpportunities: normalizeOpportunityLikeList(input.topOpportunities),
    topTasks: normalizeTaskList(input.topTasks),
    nextSteps: normalizeStringArray(input.nextSteps),
    reportStatus: normalizeString(input.reportStatus, base.reportStatus),
    clientReport: normalizeClientReport(input.clientReport),
    dataSourceSummary: {
      dominantSource: normalizeString(input.dataSourceSummary?.dominantSource, base.dataSourceSummary.dominantSource),
      hasDiscovery: Boolean(input.dataSourceSummary?.hasDiscovery),
      hasWeb: Boolean(input.dataSourceSummary?.hasWeb),
      hasAds: Boolean(input.dataSourceSummary?.hasAds),
      hasAlerts: Boolean(input.dataSourceSummary?.hasAlerts),
      hasOpportunities: Boolean(input.dataSourceSummary?.hasOpportunities),
      hasTasks: Boolean(input.dataSourceSummary?.hasTasks),
    },
    generatedAt: normalizeString(input.generatedAt) || null,
    updatedAt: normalizeString(input.updatedAt) || null,
  };
};
