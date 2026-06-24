export const AGENCY_WEB_PAGE_TYPES = [
  "landing",
  "website",
  "homepage",
  "service_page",
  "ecommerce_lite",
];

export const createEmptyAgencyWebV1Input = (projectId = "") => ({
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
});

export const createEmptyAgencyWebV1Output = (projectId = "") => ({
  projectId,
  pageGoal: "",
  pageType: "landing",
  targetSummary: "",
  offerSummary: "",
  valueProp: "",
  sectionPlan: [],
  copyBlocks: {
    headline: "",
    subheadline: "",
    intro: "",
    benefits: [],
    objectionHandling: "",
  },
  faqItems: [],
  ctaSet: {
    primary: "",
    secondary: "",
    final: "",
  },
  trustElements: [],
  wireframe: {
    mode: "text",
    blocks: [],
  },
  previewHtmlBase: "",
  webProjects: [],
  lastGeneratedAt: null,
});

export const normalizeAgencyWebV1Output = (input, projectId = "") => {
  const base = createEmptyAgencyWebV1Output(projectId);
  if (!input || typeof input !== "object") {
    return base;
  }

  const next = {
    ...base,
    ...input,
  };

  next.pageType = AGENCY_WEB_PAGE_TYPES.includes(next.pageType)
    ? next.pageType
    : base.pageType;

  if (!Array.isArray(next.sectionPlan)) {
    next.sectionPlan = [];
  }

  if (!next.copyBlocks || typeof next.copyBlocks !== "object") {
    next.copyBlocks = { ...base.copyBlocks };
  } else {
    next.copyBlocks = {
      ...base.copyBlocks,
      ...next.copyBlocks,
      benefits: Array.isArray(next.copyBlocks.benefits) ? next.copyBlocks.benefits : [],
    };
  }

  next.faqItems = Array.isArray(next.faqItems) ? next.faqItems : [];

  if (!next.ctaSet || typeof next.ctaSet !== "object") {
    next.ctaSet = { ...base.ctaSet };
  } else {
    next.ctaSet = {
      ...base.ctaSet,
      ...next.ctaSet,
    };
  }

  next.trustElements = Array.isArray(next.trustElements) ? next.trustElements : [];

  if (!next.wireframe || typeof next.wireframe !== "object") {
    next.wireframe = { ...base.wireframe };
  } else {
    next.wireframe = {
      mode: next.wireframe.mode === "visual" ? "visual" : "text",
      blocks: Array.isArray(next.wireframe.blocks) ? next.wireframe.blocks : [],
    };
  }

  next.previewHtmlBase = typeof next.previewHtmlBase === "string" ? next.previewHtmlBase : "";
  next.webProjects = Array.isArray(next.webProjects)
    ? next.webProjects.filter((entry) => entry && typeof entry === "object")
    : [];
  next.lastGeneratedAt = typeof next.lastGeneratedAt === "string" ? next.lastGeneratedAt : null;

  return next;
};

const normalizeScopePurchased = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
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
};

const normalizeActiveModules = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const key = typeof entry?.key === "string" ? entry.key.trim() : "";
      const label = typeof entry?.label === "string" ? entry.label.trim() : "";
      if (!key || !label) {
        return null;
      }
      return {
        key,
        label,
        included: Boolean(entry?.included),
        suggested: Boolean(entry?.suggested),
        active: Boolean(entry?.active),
      };
    })
    .filter(Boolean);
};

const normalizeDiscoverySections = (value, base) => {
  if (!value || typeof value !== "object") {
    return { ...base.discovery.sections };
  }

  return {
    businessContext: typeof value.businessContext === "string" ? value.businessContext : base.discovery.sections.businessContext,
    projectGoal: typeof value.projectGoal === "string" ? value.projectGoal : base.discovery.sections.projectGoal,
    target: typeof value.target === "string" ? value.target : base.discovery.sections.target,
    offer: typeof value.offer === "string" ? value.offer : base.discovery.sections.offer,
    brandCommunication: typeof value.brandCommunication === "string" ? value.brandCommunication : base.discovery.sections.brandCommunication,
    availableMaterials: typeof value.availableMaterials === "string" ? value.availableMaterials : base.discovery.sections.availableMaterials,
    technicalAspects: typeof value.technicalAspects === "string" ? value.technicalAspects : base.discovery.sections.technicalAspects,
    marketingAcquisition: typeof value.marketingAcquisition === "string" ? value.marketingAcquisition : base.discovery.sections.marketingAcquisition,
  };
};

const normalizeStringArray = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

export const normalizeAgencyWebV1Input = (input, projectId = "") => {
  const base = createEmptyAgencyWebV1Input(projectId);
  if (!input || typeof input !== "object") {
    return base;
  }

  const projectType = input.projectType && typeof input.projectType === "object"
    ? {
      key: typeof input.projectType.key === "string" && input.projectType.key.trim()
        ? input.projectType.key.trim()
        : base.projectType.key,
      label: typeof input.projectType.label === "string" && input.projectType.label.trim()
        ? input.projectType.label.trim()
        : base.projectType.label,
      description: typeof input.projectType.description === "string" ? input.projectType.description : base.projectType.description,
    }
    : base.projectType;

  return {
    projectId: typeof input.projectId === "string" && input.projectId.trim()
      ? input.projectId.trim()
      : base.projectId,
    projectType,
    scopePurchased: normalizeScopePurchased(input.scopePurchased),
    activeModules: normalizeActiveModules(input.activeModules),
    contextSummary: typeof input.contextSummary === "string" ? input.contextSummary : base.contextSummary,
    discovery: {
      sections: normalizeDiscoverySections(input.discovery?.sections, base),
      notes: typeof input.discovery?.notes === "string" ? input.discovery.notes : base.discovery.notes,
      contextSummary: typeof input.discovery?.contextSummary === "string"
        ? input.discovery.contextSummary
        : base.discovery.contextSummary,
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
  };
};
