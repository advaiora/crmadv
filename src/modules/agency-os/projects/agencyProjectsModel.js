export const AGENCY_PROJECT_TYPE_OPTIONS = [
  {
    key: "website",
    label: "Website",
    description: "Progetto orientato a sito, UX e conversione web.",
  },
  {
    key: "landing_page",
    label: "Landing Page",
    description: "Progetto focalizzato su landing page dedicata e conversione.",
  },
  {
    key: "marketing_full",
    label: "Marketing Full",
    description: "Progetto full-funnel con discovery, web, ads e reporting.",
  },
  {
    key: "google_ads",
    label: "Google Ads",
    description: "Progetto focalizzato su acquisizione paid search.",
  },
  {
    key: "meta_ads",
    label: "Meta Ads",
    description: "Progetto focalizzato su campagne Meta e creativita.",
  },
  {
    key: "google_meta_ads",
    label: "Google + Meta Ads",
    description: "Progetto performance su advertising Google e Meta.",
  },
  {
    key: "local_ads",
    label: "Local Ads",
    description: "Progetto advertising locale con focus su lead e store visit.",
  },
  {
    key: "ecommerce",
    label: "Ecommerce",
    description: "Progetto orientato a catalogo, conversione e supporto paid.",
  },
];

export const AGENCY_PROJECT_PRIORITY_OPTIONS = [
  { key: "low", label: "Bassa", value: "LOW" },
  { key: "medium", label: "Media", value: "MEDIUM" },
  { key: "high", label: "Alta", value: "HIGH" },
  { key: "urgent", label: "Urgente", value: "URGENT" },
];

export const AGENCY_PROJECT_SCOPE_OPTIONS = [
  { key: "website", label: "Sito web" },
  { key: "landing_page", label: "Landing page" },
  { key: "google_ads", label: "Google Ads" },
  { key: "meta_ads", label: "Meta Ads" },
  { key: "seo", label: "SEO" },
  { key: "reporting", label: "Report" },
  { key: "diagnosis", label: "Diagnosi" },
];

const PROJECT_TYPE_BY_KEY = new Map(
  AGENCY_PROJECT_TYPE_OPTIONS.map((entry) => [entry.key, entry]),
);

const EMPTY_SCOPE = Object.freeze({
  website: false,
  landing_page: false,
  google_ads: false,
  meta_ads: false,
  seo: false,
  reporting: false,
  diagnosis: false,
});

const SCOPE_ALIASES = {
  website: ["website", "web"],
  landing_page: ["landing_page", "landing"],
  google_ads: ["google_ads"],
  meta_ads: ["meta_ads"],
  seo: ["seo"],
  reporting: ["reporting"],
  diagnosis: ["diagnosis"],
};

const toBoolean = (value) => Boolean(value);

export const createEmptyAgencyProjectScope = () => ({ ...EMPTY_SCOPE });

export const normalizeAgencyProjectScope = (value) => {
  const result = createEmptyAgencyProjectScope();

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      const key = typeof entry?.key === "string" ? entry.key.trim().toLowerCase() : "";
      const purchased = Boolean(entry?.purchased);
      if (!key) {
        return;
      }

      Object.entries(SCOPE_ALIASES).forEach(([targetKey, aliases]) => {
        if (aliases.includes(key)) {
          result[targetKey] = purchased;
        }
      });

      if (key === "ads") {
        result.google_ads = purchased;
        result.meta_ads = purchased;
      }
    });

    return result;
  }

  if (value && typeof value === "object") {
    Object.keys(result).forEach((key) => {
      result[key] = toBoolean(value[key]);
    });
  }

  return result;
};

export const normalizeAgencyProjectType = (value) => {
  const key = typeof value === "string"
    ? value.trim()
    : typeof value?.key === "string"
      ? value.key.trim()
      : "";

  if (!key) {
    return null;
  }

  const existing = PROJECT_TYPE_BY_KEY.get(key);
  if (existing) {
    return existing;
  }

  return {
    key,
    label: typeof value?.label === "string" && value.label.trim() ? value.label.trim() : key,
    description: typeof value?.description === "string" ? value.description : "",
  };
};

export const normalizeAgencyProjectSources = (value) => {
  const source = value && typeof value === "object" ? value : {};
  const optionalString = (nextValue) => (typeof nextValue === "string" && nextValue.trim() ? nextValue.trim() : undefined);
  const legacyWebsiteUrl = typeof source.websiteUrl === "string" ? source.websiteUrl.trim() : "";
  const explicitPrimaryUrl = typeof source.primaryWebsiteUrl === "string" ? source.primaryWebsiteUrl.trim() : "";
  const knownUrlTypes = new Set(["website", "landing", "service_page", "instagram", "facebook", "linkedin", "youtube", "tiktok", "google_business", "other"]);
  const inferUrlType = (url) => {
    const lowered = String(url || "").toLowerCase();
    if (lowered.includes("instagram.com")) return "instagram";
    if (lowered.includes("facebook.com") || lowered.includes("fb.com")) return "facebook";
    if (lowered.includes("linkedin.com")) return "linkedin";
    if (lowered.includes("youtube.com") || lowered.includes("youtu.be")) return "youtube";
    if (lowered.includes("tiktok.com")) return "tiktok";
    if (lowered.includes("google.com/maps") || lowered.includes("business.google.com")) return "google_business";
    return "other";
  };
  const defaultUrlLabel = (type) => ({
    website: "Sito principale",
    landing: "Landing",
    service_page: "Pagina servizio",
    instagram: "Instagram",
    facebook: "Facebook",
    linkedin: "LinkedIn",
    youtube: "YouTube",
    tiktok: "TikTok",
    google_business: "Google Business Profile",
    other: "Link utile",
  }[type] || "Link utile");
  const urls = (Array.isArray(source.urls) ? source.urls : [])
    .map((entry) => {
      const url = typeof entry?.url === "string" ? entry.url.trim() : "";
      if (!url) return null;
      const type = knownUrlTypes.has(entry?.type) ? entry.type : inferUrlType(url);
      return {
        id: typeof entry?.id === "string" && entry.id.trim() ? entry.id.trim() : `${url}-${Date.now()}`,
        label: typeof entry?.label === "string" && entry.label.trim() ? entry.label.trim() : defaultUrlLabel(type),
        type,
        url,
        status: entry?.status === "ignored" ? "ignored" : "active",
        notes: typeof entry?.notes === "string" ? entry.notes.trim() : "",
        addedAt: optionalString(entry?.addedAt),
      };
    })
    .filter(Boolean);
  if ((legacyWebsiteUrl || explicitPrimaryUrl) && !urls.some((entry) => entry.url === (legacyWebsiteUrl || explicitPrimaryUrl))) {
    urls.unshift({
      id: "url_primary_legacy",
      label: "Sito principale",
      type: "website",
      url: legacyWebsiteUrl || explicitPrimaryUrl,
      status: "active",
      notes: "",
      addedAt: undefined,
    });
  }
  const activeUrls = urls.filter((entry) => entry.status === "active");
  const primaryWebsiteUrl = explicitPrimaryUrl && activeUrls.some((entry) => entry.url === explicitPrimaryUrl)
    ? explicitPrimaryUrl
    : legacyWebsiteUrl || activeUrls.find((entry) => entry.type === "website")?.url || activeUrls.find((entry) => entry.type === "landing")?.url || activeUrls[0]?.url || "";
  const websiteUrl = primaryWebsiteUrl;
  const competitorUrls = Array.isArray(source.competitorUrls)
    ? source.competitorUrls.filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim())
    : [];
  const competitors = Array.isArray(source.competitors)
    ? source.competitors
      .map((entry) => {
        const url = typeof entry?.url === "string" ? entry.url.trim() : "";
        if (!url) {
          return null;
        }

        return {
          id: typeof entry?.id === "string" && entry.id.trim() ? entry.id.trim() : `${url}-${Date.now()}`,
          name: typeof entry?.name === "string" && entry.name.trim() ? entry.name.trim() : url,
          url,
          source: ["manual", "auto_search", "ai_search", "mock", "imported"].includes(entry?.source) ? entry.source : "manual",
          status: ["suggested", "confirmed", "rejected"].includes(entry?.status) ? entry.status : "confirmed",
          reason: typeof entry?.reason === "string" ? entry.reason : "",
          addedAt: optionalString(entry?.addedAt),
        };
      })
      .filter(Boolean)
    : [];
  const uploadedFiles = Array.isArray(source.uploadedFiles)
    ? source.uploadedFiles
      .map((entry) => {
        const name = typeof entry?.name === "string" ? entry.name.trim() : "";
        if (!name) {
          return null;
        }

        return {
          id: typeof entry?.id === "string" && entry.id.trim() ? entry.id.trim() : `${name}-${Date.now()}`,
          name,
          originalName: optionalString(entry?.originalName),
          type: typeof entry?.type === "string" ? entry.type : "",
          mimeType: optionalString(entry?.mimeType),
          size: Number.isFinite(Number(entry?.size)) ? Number(entry.size) : 0,
          extension: optionalString(entry?.extension),
          storagePath: optionalString(entry?.storagePath),
          status: ["uploaded", "parsed", "partial", "failed", "metadata_only"].includes(entry?.status) ? entry.status : "metadata_only",
          source: typeof entry?.source === "string" ? entry.source : "manual_upload",
          notes: typeof entry?.notes === "string" ? entry.notes : "",
          uploadedAt: optionalString(entry?.uploadedAt),
          parseStatus: ["not_parsed", "parsed", "partial", "failed", "unsupported"].includes(entry?.parseStatus) ? entry.parseStatus : undefined,
          extractedTextPreview: optionalString(entry?.extractedTextPreview),
          extractedTextLength: Number.isFinite(Number(entry?.extractedTextLength)) && Number(entry.extractedTextLength) > 0 ? Number(entry.extractedTextLength) : undefined,
          extractedTextHash: optionalString(entry?.extractedTextHash),
          parsedAt: optionalString(entry?.parsedAt),
          parseErrorCode: optionalString(entry?.parseErrorCode),
          parseError: optionalString(entry?.parseError),
          manualText: optionalString(entry?.manualText),
          markedUseful: typeof entry?.markedUseful === "boolean" ? entry.markedUseful : false,
        };
      })
      .filter(Boolean)
    : [];
  const manualNotes = typeof source.manualNotes === "string" ? source.manualNotes.trim() : "";
  const activeCompetitorsCount = competitors.filter((entry) => entry.status !== "rejected").length || competitorUrls.length;
  const sourceStatus = ["missing", "partial", "ready"].includes(source.sourceStatus)
    ? source.sourceStatus
    : (websiteUrl || manualNotes.length >= 80) && (uploadedFiles.length > 0 || activeCompetitorsCount > 0 || manualNotes.length >= 200)
      ? "ready"
      : websiteUrl || manualNotes || uploadedFiles.length > 0 || activeCompetitorsCount > 0
        ? "partial"
        : "missing";
  const sourceSummary = typeof source.sourceSummary === "string" && source.sourceSummary.trim()
    ? source.sourceSummary.trim()
    : sourceStatus === "missing"
      ? "Nessuna fonte cliente reale registrata."
      : "Fonti progetto registrate.";

  return {
    websiteUrl,
    primaryWebsiteUrl,
    urls,
    competitorUrls,
    competitors,
    uploadedFiles,
    manualNotes,
    sourceType: typeof source.sourceType === "string" ? source.sourceType : "manual_project_sources",
    sourceStatus,
    sourceSummary,
    lastSourceUpdateAt: optionalString(source.lastSourceUpdateAt),
    sourceQuality: typeof source.sourceQuality === "string" ? source.sourceQuality : sourceStatus,
    missingSourceWarnings: Array.isArray(source.missingSourceWarnings)
      ? source.missingSourceWarnings.filter((entry) => typeof entry === "string" && entry.trim())
      : [],
    usedSources: Array.isArray(source.usedSources)
      ? source.usedSources.filter((entry) => typeof entry === "string" && entry.trim())
      : [],
    unreadableFiles: Array.isArray(source.unreadableFiles)
      ? source.unreadableFiles.filter((entry) => typeof entry === "string" && entry.trim())
      : [],
  };
};

export const normalizeAgencySourceReadiness = (value, sources = null) => {
  const normalizedSources = sources || normalizeAgencyProjectSources(null);
  const source = value && typeof value === "object" ? value : {};
  const status = ["missing", "partial", "ready"].includes(source.status)
    ? source.status
    : normalizedSources.sourceStatus;

  return {
    status,
    summary: typeof source.summary === "string" && source.summary.trim()
      ? source.summary.trim()
      : normalizedSources.sourceSummary,
    usedSources: Array.isArray(source.usedSources)
      ? source.usedSources.filter((entry) => typeof entry === "string" && entry.trim())
      : [],
    isFallbackOnly: typeof source.isFallbackOnly === "boolean" ? source.isFallbackOnly : status === "missing",
    lastSourceUpdateAt: typeof source.lastSourceUpdateAt === "string"
      ? source.lastSourceUpdateAt
      : normalizedSources.lastSourceUpdateAt,
  };
};

export const normalizeAgencyProject = (value, fallbackSource = "mock") => {
  const projectType = normalizeAgencyProjectType(value?.projectType);
  const activeModules = Array.isArray(value?.activeModules)
    ? value.activeModules
      .map((entry) => {
        const key = typeof entry?.key === "string"
          ? entry.key.trim()
          : typeof entry?.moduleKey === "string"
            ? entry.moduleKey.trim()
            : "";
        if (!key) {
          return null;
        }

        return {
          key,
          label: typeof entry?.label === "string"
            ? entry.label
            : typeof entry?.moduleLabel === "string"
              ? entry.moduleLabel
              : key,
          included: Boolean(entry?.included),
          suggested: Boolean(entry?.suggested),
          active: Boolean(entry?.active),
        };
      })
      .filter(Boolean)
    : [];

  const dataReadiness = value?.dataReadiness && typeof value.dataReadiness === "object"
    ? {
        hasMemory: Boolean(value.dataReadiness.hasMemory),
        hasDiscovery: Boolean(value.dataReadiness.hasDiscovery),
        hasWeb: Boolean(value.dataReadiness.hasWeb),
        hasAds: Boolean(value.dataReadiness.hasAds),
        hasReports: Boolean(value.dataReadiness.hasReports),
        hasDiagnosis: Boolean(value.dataReadiness.hasDiagnosis),
      }
    : {
        hasMemory: false,
        hasDiscovery: false,
        hasWeb: false,
        hasAds: false,
        hasReports: false,
        hasDiagnosis: false,
      };

  const sources = normalizeAgencyProjectSources(value?.sources);
  const sourceReadiness = normalizeAgencySourceReadiness(value?.sourceReadiness, sources);

  return {
    id: typeof value?.id === "string" ? value.id : "",
    name: typeof value?.name === "string" ? value.name : "",
    clientId: typeof value?.clientId === "string" ? value.clientId : null,
    clientName: typeof value?.clientName === "string" ? value.clientName : null,
    projectType,
    goal: typeof value?.goal === "string" ? value.goal : "",
    scopePurchased: normalizeAgencyProjectScope(value?.scopePurchased),
    statusAgency: typeof value?.statusAgency === "string" ? value.statusAgency.toLowerCase() : "discovery",
    priorityAgency: typeof value?.priorityAgency === "string" ? value.priorityAgency.toLowerCase() : "medium",
    activeModules,
    createdAt: typeof value?.createdAt === "string" ? value.createdAt : null,
    updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : null,
    source: typeof value?.source === "string" ? value.source : fallbackSource,
    sources,
    sourceReadiness,
    dataReadiness,
  };
};

export const normalizeAgencyProjectList = (value, fallbackSource = "mock") => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeAgencyProject(entry, fallbackSource))
    .filter((entry) => entry.id && entry.name);
};
