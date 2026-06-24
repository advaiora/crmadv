export const AGENCY_ADS_CHANNEL_SCOPES = [
  "google",
  "meta",
  "both",
];

export const AGENCY_ADS_CAMPAIGN_GOALS = [
  "lead_generation",
  "sales",
  "traffic",
  "awareness",
];

export const createEmptyAgencyAdsV1Input = (projectId = "") => ({
  projectId,
  projectType: {
    key: "marketing_full",
    label: "Marketing Full",
    description: "",
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
    contextSummary: "",
    lastUpdatedAt: null,
  },
  memorySummary: {
    keyDecisions: [],
    nextActions: [],
    knownRisks: [],
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
    landingRecommendationBase: "",
    lastGeneratedAt: null,
  },
  alerts: [],
  opportunities: [],
});

export const createEmptyAgencyAdsV1Output = (projectId = "") => ({
  projectId,
  channelScope: "both",
  campaignGoal: "lead_generation",
  targetingSummary: "",
  offerAngle: "",
  messageHooks: [],
  adCopyBlocks: {
    google: [],
    meta: [],
  },
  assetRequests: [],
  launchChecklist: [],
  notes: "",
  googleAds: {
    campaignType: "",
    campaignStructure: [],
    adGroups: [],
    keywordSeeds: [],
    negativeSeeds: [],
    rsaIdeas: [],
    extensionsIdeas: [],
    landingRecommendation: "",
  },
  metaAds: {
    campaignAngle: "",
    audienceIdeas: [],
    creativeAngles: [],
    hooks: [],
    primaryTexts: [],
    headlines: [],
    ctaIdeas: [],
    assetRequests: [],
  },
  adsProjects: [],
  lastGeneratedAt: null,
});

const normalizeString = (value, fallback = "") => (
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

const normalizeBoolean = (value) => Boolean(value);

const normalizeScopePurchased = (value) => {
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
        purchased: normalizeBoolean(entry?.purchased),
      };
    })
    .filter(Boolean);
};

const normalizeActiveModules = (value) => {
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
        included: normalizeBoolean(entry?.included),
        suggested: normalizeBoolean(entry?.suggested),
        active: normalizeBoolean(entry?.active),
      };
    })
    .filter(Boolean);
};

const normalizeDiscoverySections = (value, fallback) => {
  if (!value || typeof value !== "object") {
    return { ...fallback.discovery.sections };
  }

  return {
    businessContext: normalizeString(value.businessContext, fallback.discovery.sections.businessContext),
    projectGoal: normalizeString(value.projectGoal, fallback.discovery.sections.projectGoal),
    target: normalizeString(value.target, fallback.discovery.sections.target),
    offer: normalizeString(value.offer, fallback.discovery.sections.offer),
    brandCommunication: normalizeString(value.brandCommunication, fallback.discovery.sections.brandCommunication),
    availableMaterials: normalizeString(value.availableMaterials, fallback.discovery.sections.availableMaterials),
    technicalAspects: normalizeString(value.technicalAspects, fallback.discovery.sections.technicalAspects),
    marketingAcquisition: normalizeString(value.marketingAcquisition, fallback.discovery.sections.marketingAcquisition),
  };
};

const normalizeAlerts = (value) => {
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
        severity: normalizeString(entry?.severity, "medium"),
        status: normalizeString(entry?.status, "suggested"),
        origin: normalizeString(entry?.origin, "unknown"),
      };
    })
    .filter(Boolean);
};

const normalizeOpportunities = (value) => {
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
        stage: normalizeString(entry?.stage, "Identificata"),
        status: normalizeString(entry?.status, "suggested"),
        origin: normalizeString(entry?.origin, "unknown"),
      };
    })
    .filter(Boolean);
};

export const normalizeAgencyAdsV1Input = (input, projectId = "") => {
  const base = createEmptyAgencyAdsV1Input(projectId);
  if (!input || typeof input !== "object") {
    return base;
  }

  const projectType = input.projectType && typeof input.projectType === "object"
    ? {
        key: normalizeString(input.projectType.key, base.projectType.key).trim() || base.projectType.key,
        label: normalizeString(input.projectType.label, base.projectType.label).trim() || base.projectType.label,
        description: normalizeString(input.projectType.description, base.projectType.description),
      }
    : base.projectType;

  return {
    projectId: normalizeString(input.projectId, base.projectId).trim() || base.projectId,
    projectType,
    scopePurchased: normalizeScopePurchased(input.scopePurchased),
    activeModules: normalizeActiveModules(input.activeModules),
    contextSummary: normalizeString(input.contextSummary, base.contextSummary),
    discovery: {
      sections: normalizeDiscoverySections(input.discovery?.sections, base),
      notes: normalizeString(input.discovery?.notes, base.discovery.notes),
      contextSummary: normalizeString(input.discovery?.contextSummary, base.discovery.contextSummary),
      lastUpdatedAt: typeof input.discovery?.lastUpdatedAt === "string"
        ? input.discovery.lastUpdatedAt
        : base.discovery.lastUpdatedAt,
    },
    memorySummary: {
      keyDecisions: normalizeStringArray(input.memorySummary?.keyDecisions),
      nextActions: normalizeStringArray(input.memorySummary?.nextActions),
      knownRisks: normalizeStringArray(input.memorySummary?.knownRisks),
      lastUpdatedAt: typeof input.memorySummary?.lastUpdatedAt === "string"
        ? input.memorySummary.lastUpdatedAt
        : base.memorySummary.lastUpdatedAt,
    },
    web: {
      available: normalizeBoolean(input.web?.available),
      pageGoal: normalizeString(input.web?.pageGoal, base.web.pageGoal),
      pageType: normalizeString(input.web?.pageType, base.web.pageType),
      targetSummary: normalizeString(input.web?.targetSummary, base.web.targetSummary),
      offerSummary: normalizeString(input.web?.offerSummary, base.web.offerSummary),
      valueProp: normalizeString(input.web?.valueProp, base.web.valueProp),
      ctaPrimary: normalizeString(input.web?.ctaPrimary, base.web.ctaPrimary),
      trustElements: normalizeStringArray(input.web?.trustElements),
      landingRecommendationBase: normalizeString(
        input.web?.landingRecommendationBase,
        base.web.landingRecommendationBase,
      ),
      lastGeneratedAt: typeof input.web?.lastGeneratedAt === "string"
        ? input.web.lastGeneratedAt
        : base.web.lastGeneratedAt,
    },
    alerts: normalizeAlerts(input.alerts),
    opportunities: normalizeOpportunities(input.opportunities),
  };
};

const normalizeChecklistItems = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => {
      const label = normalizeString(entry?.label).trim();
      if (!label) {
        return null;
      }

      return {
        key: normalizeString(entry?.key, `check_${index + 1}`).trim() || `check_${index + 1}`,
        label,
        channel: normalizeString(entry?.channel, "shared"),
        status: normalizeString(entry?.status, "pending"),
      };
    })
    .filter(Boolean);
};

const normalizeAdGroups = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const name = normalizeString(entry?.name).trim();
      if (!name) {
        return null;
      }

      return {
        name,
        intent: normalizeString(entry?.intent),
        keywords: normalizeStringArray(entry?.keywords),
      };
    })
    .filter(Boolean);
};

const normalizeRsaIdeas = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => ({
      headlines: normalizeStringArray(entry?.headlines),
      descriptions: normalizeStringArray(entry?.descriptions),
    }))
    .filter((entry) => entry.headlines.length > 0 || entry.descriptions.length > 0);
};

export const normalizeAgencyAdsV1Output = (input, projectId = "") => {
  const base = createEmptyAgencyAdsV1Output(projectId);
  if (!input || typeof input !== "object") {
    return base;
  }

  const next = {
    ...base,
    ...input,
  };

  next.projectId = normalizeString(next.projectId, base.projectId);
  next.channelScope = AGENCY_ADS_CHANNEL_SCOPES.includes(next.channelScope)
    ? next.channelScope
    : base.channelScope;
  next.campaignGoal = AGENCY_ADS_CAMPAIGN_GOALS.includes(next.campaignGoal)
    ? next.campaignGoal
    : base.campaignGoal;
  next.targetingSummary = normalizeString(next.targetingSummary, base.targetingSummary);
  next.offerAngle = normalizeString(next.offerAngle, base.offerAngle);
  next.messageHooks = normalizeStringArray(next.messageHooks);
  next.assetRequests = normalizeStringArray(next.assetRequests);
  next.notes = normalizeString(next.notes, base.notes);
  next.adsProjects = Array.isArray(next.adsProjects)
    ? next.adsProjects.filter((entry) => entry && typeof entry === "object")
    : [];
  next.lastGeneratedAt = typeof next.lastGeneratedAt === "string" ? next.lastGeneratedAt : null;
  next.launchChecklist = normalizeChecklistItems(next.launchChecklist);

  const adCopyBlocks = next.adCopyBlocks && typeof next.adCopyBlocks === "object"
    ? next.adCopyBlocks
    : base.adCopyBlocks;
  next.adCopyBlocks = {
    google: normalizeStringArray(adCopyBlocks.google),
    meta: normalizeStringArray(adCopyBlocks.meta),
  };

  const googleAds = next.googleAds && typeof next.googleAds === "object"
    ? next.googleAds
    : base.googleAds;
  next.googleAds = {
    campaignType: normalizeString(googleAds.campaignType, base.googleAds.campaignType),
    campaignStructure: normalizeStringArray(googleAds.campaignStructure),
    adGroups: normalizeAdGroups(googleAds.adGroups),
    keywordSeeds: normalizeStringArray(googleAds.keywordSeeds),
    negativeSeeds: normalizeStringArray(googleAds.negativeSeeds),
    rsaIdeas: normalizeRsaIdeas(googleAds.rsaIdeas),
    extensionsIdeas: normalizeStringArray(googleAds.extensionsIdeas),
    landingRecommendation: normalizeString(
      googleAds.landingRecommendation,
      base.googleAds.landingRecommendation,
    ),
  };

  const metaAds = next.metaAds && typeof next.metaAds === "object"
    ? next.metaAds
    : base.metaAds;
  next.metaAds = {
    campaignAngle: normalizeString(metaAds.campaignAngle, base.metaAds.campaignAngle),
    audienceIdeas: normalizeStringArray(metaAds.audienceIdeas),
    creativeAngles: normalizeStringArray(metaAds.creativeAngles),
    hooks: normalizeStringArray(metaAds.hooks),
    primaryTexts: normalizeStringArray(metaAds.primaryTexts),
    headlines: normalizeStringArray(metaAds.headlines),
    ctaIdeas: normalizeStringArray(metaAds.ctaIdeas),
    assetRequests: normalizeStringArray(metaAds.assetRequests),
  };

  return next;
};
