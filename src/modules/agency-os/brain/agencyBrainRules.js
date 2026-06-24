import {
  getMockContextSummary,
  getMockMemorySummary,
  getMockProjectType,
  getMockScopePurchased,
  listMockAgencyAlerts,
  listMockAgencyOpportunities,
} from "../mock";

const ADS_PROJECT_TYPES = new Set(["google_ads", "meta_ads", "google_meta_ads"]);
const WEBSITE_PROJECT_TYPES = new Set(["website", "marketing_full"]);

const getPurchasedFlag = (scopeItems, key) => {
  const entry = scopeItems.find((item) => item.key === key);
  return Boolean(entry?.purchased);
};

const normalizeProjectType = (projectType) => {
  if (!projectType || typeof projectType !== "object") {
    return null;
  }

  const key = typeof projectType.key === "string" ? projectType.key.trim() : "";
  const label = typeof projectType.label === "string" ? projectType.label.trim() : "";
  if (!key || !label) {
    return null;
  }

  return {
    key,
    label,
    description: typeof projectType.description === "string" ? projectType.description : "",
  };
};

const normalizeScopePurchased = (scopePurchased) => {
  if (!Array.isArray(scopePurchased)) {
    return null;
  }

  const normalized = scopePurchased
    .map((entry) => {
      const key = typeof entry?.key === "string" ? entry.key.trim() : "";
      const label = typeof entry?.label === "string" ? entry.label.trim() : "";
      if (!key || !label) {
        return null;
      }
      return {
        key,
        label,
        purchased: Boolean(entry?.purchased),
      };
    })
    .filter(Boolean);

  return normalized.length > 0 ? normalized : null;
};

const normalizeMemorySummary = (memorySummary, fallbackProjectId) => {
  if (!memorySummary || typeof memorySummary !== "object") {
    return null;
  }

  const keyDecisions = Array.isArray(memorySummary.keyDecisions)
    ? memorySummary.keyDecisions.filter((entry) => typeof entry === "string" && entry.trim())
    : [];
  const nextActions = Array.isArray(memorySummary.nextActions)
    ? memorySummary.nextActions.filter((entry) => typeof entry === "string" && entry.trim())
    : [];
  const knownRisks = Array.isArray(memorySummary.knownRisks)
    ? memorySummary.knownRisks.filter((entry) => typeof entry === "string" && entry.trim())
    : [];

  return {
    projectId: typeof memorySummary.projectId === "string" && memorySummary.projectId.trim()
      ? memorySummary.projectId.trim()
      : fallbackProjectId,
    lastUpdatedAt: typeof memorySummary.lastUpdatedAt === "string" && memorySummary.lastUpdatedAt.trim()
      ? memorySummary.lastUpdatedAt
      : new Date().toISOString(),
    keyDecisions,
    nextActions,
    knownRisks,
  };
};

const normalizeActiveModulesSeed = (activeModules) => {
  if (!Array.isArray(activeModules)) {
    return null;
  }

  const normalized = activeModules
    .map((entry) => {
      const key = typeof entry?.key === "string"
        ? entry.key.trim()
        : typeof entry?.moduleKey === "string"
          ? entry.moduleKey.trim()
          : "";
      if (!key) {
        return null;
      }

      const label = typeof entry?.label === "string"
        ? entry.label
        : typeof entry?.moduleLabel === "string"
          ? entry.moduleLabel
          : key;

      return {
        key,
        label,
        included: Boolean(entry?.included),
        suggested: Boolean(entry?.suggested),
        active: Boolean(entry?.active),
      };
    })
    .filter(Boolean);

  return normalized;
};

const normalizeAlertSeed = (alerts) => {
  if (!Array.isArray(alerts)) {
    return null;
  }

  const normalized = alerts
    .map((entry, index) => {
      const title = typeof entry?.title === "string" ? entry.title.trim() : "";
      if (!title) {
        return null;
      }
      return {
        id: typeof entry?.id === "string" && entry.id.trim() ? entry.id : `seed-alert-${index + 1}`,
        title,
        severity: typeof entry?.severity === "string" ? entry.severity.toLowerCase() : "medium",
        status: typeof entry?.status === "string" ? entry.status.toLowerCase() : "open",
        projectId: typeof entry?.projectId === "string" ? entry.projectId : "N/A",
        origin: typeof entry?.origin === "string"
          ? entry.origin
          : typeof entry?.source === "string"
            ? entry.source
            : "seed",
      };
    })
    .filter(Boolean);

  return normalized;
};

const normalizeOpportunitySeed = (opportunities) => {
  if (!Array.isArray(opportunities)) {
    return null;
  }

  const normalized = opportunities
    .map((entry, index) => {
      const title = typeof entry?.title === "string" ? entry.title.trim() : "";
      if (!title) {
        return null;
      }
      return {
        id: typeof entry?.id === "string" && entry.id.trim() ? entry.id : `seed-opportunity-${index + 1}`,
        title,
        stage: typeof entry?.stage === "string" && entry.stage.trim() ? entry.stage : "Identificata",
        estimatedValue: Number.isFinite(Number(entry?.estimatedValue)) ? Number(entry.estimatedValue) : 0,
        status: typeof entry?.status === "string" && entry.status.trim() ? entry.status.toLowerCase() : "suggested",
        category: typeof entry?.category === "string" && entry.category.trim() ? entry.category.trim() : null,
        type: typeof entry?.type === "string" && entry.type.trim() ? entry.type.trim() : null,
        rationale: typeof entry?.rationale === "string" && entry.rationale.trim() ? entry.rationale.trim() : null,
        priority: typeof entry?.priority === "string" && entry.priority.trim() ? entry.priority.toLowerCase() : null,
        score: Number.isFinite(Number(entry?.score)) ? Number(entry.score) : null,
        impactLevel: typeof entry?.impactLevel === "string" && entry.impactLevel.trim()
          ? entry.impactLevel.toLowerCase()
          : null,
        sourceModule: typeof entry?.sourceModule === "string" && entry.sourceModule.trim()
          ? entry.sourceModule.trim()
          : null,
        sourceSignalKey: typeof entry?.sourceSignalKey === "string" && entry.sourceSignalKey.trim()
          ? entry.sourceSignalKey.trim()
          : null,
        dedupKey: typeof entry?.dedupKey === "string" && entry.dedupKey.trim() ? entry.dedupKey.trim() : null,
        suggestedService: typeof entry?.suggestedService === "string" && entry.suggestedService.trim()
          ? entry.suggestedService.trim()
          : null,
        lastEvaluatedAt: typeof entry?.lastEvaluatedAt === "string" && entry.lastEvaluatedAt.trim()
          ? entry.lastEvaluatedAt
          : null,
        projectId: typeof entry?.projectId === "string" ? entry.projectId : "N/A",
        origin: typeof entry?.origin === "string"
          ? entry.origin
          : typeof entry?.source === "string"
            ? entry.source
            : "seed",
      };
    })
    .filter(Boolean);

  return normalized;
};

const buildRuleBasedActiveModules = (projectType, scopePurchased) => {
  const adsPurchased = getPurchasedFlag(scopePurchased, "ads");
  const webPurchased = getPurchasedFlag(scopePurchased, "web");
  const landingPurchased = getPurchasedFlag(scopePurchased, "landing");
  const reportingPurchased = getPurchasedFlag(scopePurchased, "reporting");

  const isAdsProject = ADS_PROJECT_TYPES.has(projectType?.key);
  const isWebsiteProject = WEBSITE_PROJECT_TYPES.has(projectType?.key);
  const webIncluded = webPurchased || landingPurchased;
  const adsIncluded = adsPurchased;
  const assetsIncluded = webIncluded || adsIncluded;

  const normalizeModuleState = (entry) => {
    if (entry.included) {
      return {
        ...entry,
        suggested: false,
        active: true,
      };
    }

    return entry;
  };

  return [
    {
      key: "discovery",
      label: "Discovery",
      included: true,
      suggested: false,
      active: true,
    },
    {
      key: "brain",
      label: "Agency Brain",
      included: true,
      suggested: false,
      active: true,
    },
    {
      key: "web",
      label: "Web",
      included: webIncluded,
      suggested: isWebsiteProject && !webIncluded,
      active: webIncluded || isWebsiteProject,
    },
    {
      key: "ads",
      label: "Ads",
      included: adsIncluded,
      suggested: isAdsProject && !adsIncluded,
      active: adsIncluded || isAdsProject,
    },
    {
      key: "reports",
      label: "Reports",
      included: reportingPurchased,
      suggested: !reportingPurchased,
      active: reportingPurchased,
    },
    {
      key: "opportunities",
      label: "Opportunita",
      included: false,
      suggested: true,
      active: true,
    },
    {
      key: "memory",
      label: "Memory",
      included: true,
      suggested: false,
      active: true,
    },
    {
      key: "assets",
      label: "Assets",
      included: assetsIncluded,
      suggested: (isWebsiteProject || isAdsProject) && !assetsIncluded,
      active: assetsIncluded || isWebsiteProject || isAdsProject,
    },
    {
      key: "tasks",
      label: "Tasks",
      included: true,
      suggested: false,
      active: true,
    },
  ].map(normalizeModuleState);
};

const buildRuleBasedAlerts = (projectType, scopePurchased) => {
  const alerts = [];
  const seoPurchased = getPurchasedFlag(scopePurchased, "seo");
  const trackingPurchased = getPurchasedFlag(scopePurchased, "tracking");

  if (ADS_PROJECT_TYPES.has(projectType?.key)) {
    alerts.push({
      id: "brain-alr-competitor-analysis",
      title: "Competitor analysis consigliata prima di scalare le campagne.",
      severity: "high",
      status: "suggested",
      projectId: "N/A",
      origin: "rule_generated",
    });
  }

  if (!trackingPurchased) {
    alerts.push({
      id: "brain-alr-tracking-gap",
      title: "Tracking incompleto: consigliato setup eventi e conversioni.",
      severity: "medium",
      status: "suggested",
      projectId: "N/A",
      origin: "rule_generated",
    });
  }

  if (projectType?.key === "website" && !seoPurchased) {
    alerts.push({
      id: "brain-alr-website-seo",
      title: "SEO baseline consigliata per evitare dipendenza dal traffico paid.",
      severity: "medium",
      status: "suggested",
      projectId: "N/A",
      origin: "rule_generated",
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "brain-alr-routine-review",
      title: "Pianificare revisione KPI settimanale del progetto.",
      severity: "low",
      status: "suggested",
      projectId: "N/A",
      origin: "rule_generated",
    });
  }

  return alerts;
};

const buildRuleBasedOpportunities = (projectType, scopePurchased) => {
  const opportunities = [];
  const landingPurchased = getPurchasedFlag(scopePurchased, "landing");
  const seoPurchased = getPurchasedFlag(scopePurchased, "seo");
  const trackingPurchased = getPurchasedFlag(scopePurchased, "tracking");

  if (ADS_PROJECT_TYPES.has(projectType?.key) && !landingPurchased) {
    opportunities.push({
      id: "brain-opp-landing-dedicata",
      title: "Landing dedicata consigliata",
      stage: "Identificata",
      estimatedValue: 1600,
      projectId: "N/A",
      origin: "rule_generated",
    });
  }

  if (projectType?.key === "website" && !seoPurchased) {
    opportunities.push({
      id: "brain-opp-seo-website",
      title: "Pacchetto SEO consigliato per il nuovo sito",
      stage: "Proposta",
      estimatedValue: 1400,
      projectId: "N/A",
      origin: "rule_generated",
    });
  }

  if (projectType?.key === "website" && !trackingPurchased) {
    opportunities.push({
      id: "brain-opp-tracking-website",
      title: "Setup tracking conversioni consigliato",
      stage: "Identificata",
      estimatedValue: 900,
      projectId: "N/A",
      origin: "rule_generated",
    });
  }

  if (opportunities.length === 0) {
    opportunities.push({
      id: "brain-opp-cro-sprint",
      title: "Sprint CRO su pagine ad alto traffico",
      stage: "Proposta",
      estimatedValue: 1300,
      projectId: "N/A",
      origin: "rule_generated",
    });
  }

  return opportunities;
};

const mergeEntriesByTitle = (baseEntries, suggestedEntries) => {
  const merged = [];
  const seenTitles = new Set();

  [...baseEntries, ...suggestedEntries].forEach((entry) => {
    const titleKey = String(entry?.title || entry?.id || "").toLowerCase();
    if (!titleKey || seenTitles.has(titleKey)) {
      return;
    }
    seenTitles.add(titleKey);
    merged.push(entry);
  });

  return merged;
};

export const buildAgencyBrainResult = (projectId, seed = {}) => {
  const normalizedProjectId = typeof projectId === "string" ? projectId.trim() : "";
  const projectType = normalizeProjectType(seed.projectType) || getMockProjectType(normalizedProjectId);
  const scopePurchased = normalizeScopePurchased(seed.scopePurchased) || getMockScopePurchased(normalizedProjectId);
  const memorySummary = normalizeMemorySummary(seed.memorySummary, normalizedProjectId || "N/A")
    || getMockMemorySummary(normalizedProjectId);
  const activeModules = normalizeActiveModulesSeed(seed.activeModules)
    ?? buildRuleBasedActiveModules(projectType, scopePurchased);

  const mockAlerts = normalizeAlertSeed(seed.alerts) || listMockAgencyAlerts(normalizedProjectId);
  const mockOpportunities = normalizeOpportunitySeed(seed.opportunities) || listMockAgencyOpportunities(normalizedProjectId);
  const hasPersistedOpportunitySeed = Array.isArray(mockOpportunities) && mockOpportunities.length > 0;

  const ruleBasedAlerts = buildRuleBasedAlerts(projectType, scopePurchased);
  const ruleBasedOpportunities = buildRuleBasedOpportunities(projectType, scopePurchased);

  const suggestedAlerts = mergeEntriesByTitle(mockAlerts, ruleBasedAlerts);
  const suggestedOpportunities = hasPersistedOpportunitySeed
    ? mockOpportunities
    : mergeEntriesByTitle(mockOpportunities, ruleBasedOpportunities);

  const contextSummary = typeof seed.contextSummary === "string" && seed.contextSummary.trim()
    ? seed.contextSummary
    : getMockContextSummary({
      projectType,
      scopePurchased,
      activeModules,
      alerts: suggestedAlerts,
      opportunities: suggestedOpportunities,
    });

  return {
    projectId: normalizedProjectId || "N/A",
    projectType,
    scopePurchased,
    memorySummary,
    activeModules,
    suggestedAlerts,
    suggestedOpportunities,
    contextSummary,
  };
};
