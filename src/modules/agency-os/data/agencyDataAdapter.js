import { buildAgencyBrainResult } from "../brain/agencyBrainRules";
import {
  createAgencyProject as createAgencyProjectApi,
  fetchAgencyProject,
  fetchAgencyProjects,
  fetchAgencyProjectAlerts,
  fetchAgencyProjectAds,
  fetchAgencyProjectDiagnosis,
  fetchAgencyProjectDiagnosisInput,
  fetchAgencyProjectClientReport,
  fetchAgencyProjectClientReportInput,
  fetchAgencyProjectWeb,
  fetchAgencyProjectDiscovery,
  regenerateAgencyProjectDiscoveryFromSources as regenerateAgencyProjectDiscoveryFromSourcesApi,
  regenerateAgencyProjectDiscoverySectionFromSources as regenerateAgencyProjectDiscoverySectionFromSourcesApi,
  generateAgencyProjectDiscoveryFromSources as generateAgencyProjectDiscoveryFromSourcesApi,
  generateAgencyProjectDiscoverySection as generateAgencyProjectDiscoverySectionApi,
  fetchAgencyProjectSources,
  fetchAgencyProjectBrainSeed,
  fetchAgencyProjectWorkingContext,
  fetchAgencyProjectReport,
  fetchAgencyProjectReportInput,
  fetchAgencyProjectOpportunityInput,
  fetchAgencyProjectOpportunities,
  fetchAgencyProjectTasks,
  fetchAgencyProjectOverviewSeed,
  fetchAgencyWorkspaceAlerts,
  fetchAgencyWorkspaceOpportunities,
  fetchAgencyWorkspaceReports,
  syncAgencyProjectAlerts,
  syncAgencyProjectOpportunities,
  syncAgencyProjectTasks,
  saveAgencyProjectAds as saveAgencyProjectAdsApi,
  saveAgencyProjectClientReport as saveAgencyProjectClientReportApi,
  saveAgencyProjectDiagnosis as saveAgencyProjectDiagnosisApi,
  saveAgencyProjectReport as saveAgencyProjectReportApi,
  saveAgencyProjectWeb as saveAgencyProjectWebApi,
  generateAgencyWebProjectWithAi as generateAgencyWebProjectWithAiApi,
  generateAgencyWebBlockWithAi as generateAgencyWebBlockWithAiApi,
  generateAgencyAdsAssetWithAi as generateAgencyAdsAssetWithAiApi,
  saveAgencyProjectDiscovery as saveAgencyProjectDiscoveryApi,
  saveAgencyProjectSources as saveAgencyProjectSourcesApi,
  uploadAgencyProjectSourceFile as uploadAgencyProjectSourceFileApi,
  deleteAgencyProjectSourceFile as deleteAgencyProjectSourceFileApi,
  fetchAgencyProjectSourceFileBlob as fetchAgencyProjectSourceFileBlobApi,
  searchAgencyProjectCompetitors as searchAgencyProjectCompetitorsApi,
  fetchAgencyCompetitorSearchSettings as fetchAgencyCompetitorSearchSettingsApi,
  fetchAgencyAiStatus as fetchAgencyAiStatusApi,
  fetchAgencyRuntimeSettings as fetchAgencyRuntimeSettingsApi,
  updateAgencyRuntimeSettings as updateAgencyRuntimeSettingsApi,
  fetchAgencyAiUsage as fetchAgencyAiUsageApi,
  // Le funzioni della chat sono uscite da qui il 15/7/2026 (spec 4-ter §3): erano
  // servite solo alla scheda Chat estesa del progetto, che non esiste piu'. Il popup
  // parla direttamente con agency.api, che e' l'unico strato di cui ha bisogno.
  fetchAgencyAiEstimates as fetchAgencyAiEstimatesApi,
  fetchAgencyAiBudgets as fetchAgencyAiBudgetsApi,
  updateAgencyAiBudgets as updateAgencyAiBudgetsApi,
} from "../api/agency.api";
import {
  getMockMemorySummary,
  listMockAgencyAlerts,
  listMockAgencyOpportunities,
} from "../mock";
import {
  AGENCY_DATA_SOURCE,
  attachAgencyDataMeta,
  readAgencyDataMeta,
} from "./agencyDataSource";
import {
  createEmptyAgencyAdsV1Input,
  createEmptyAgencyAdsV1Output,
  normalizeAgencyAdsV1Input,
  normalizeAgencyAdsV1Output,
} from "../ads/agencyAdsV1Model";
import {
  createEmptyAgencyWebV1Input,
  createEmptyAgencyWebV1Output,
  normalizeAgencyWebV1Input,
  normalizeAgencyWebV1Output,
} from "../web/agencyWebV1Model";
import {
  createEmptyAgencyReportV1Input,
  createEmptyAgencyReportV1Output,
  normalizeAgencyReportV1Input,
  normalizeAgencyReportV1Output,
} from "../reports/agencyReportsV1Model";
import {
  createEmptyAgencyClientReportV1Input,
  createEmptyAgencyClientReportV1Output,
  normalizeAgencyClientReportV1Input,
  normalizeAgencyClientReportV1Output,
} from "../reports/agencyClientReportV1Model";
import {
  createEmptyAgencyDiagnosisV1Input,
  createEmptyAgencyDiagnosisV1Output,
  normalizeAgencyDiagnosisV1Input,
  normalizeAgencyDiagnosisV1Output,
} from "../diagnosis/agencyDiagnosisV1Model";
import {
  normalizeAgencyProject,
  normalizeAgencyProjectList,
  normalizeAgencyProjectSources,
} from "../projects/agencyProjectsModel";

const DEFAULT_DISCOVERY_SECTIONS = {
  businessContext: "Agenzia in crescita con forte dipendenza dal canale paid.",
  projectGoal: "Aumentare lead qualificati mantenendo CAC sostenibile.",
  target: "PMI italiane nel settore servizi con team marketing snello.",
  offer: "Pacchetto gestione funnel + performance marketing trimestrale.",
  brandCommunication: "Tone pragmatico, orientato ai risultati e trasparente.",
  availableMaterials: "Brand deck, landing v1, storici campagne, case study.",
  technicalAspects: "CMS WordPress, GA4 attivo, tracciamento da validare.",
  marketingAcquisition: "Google Ads attivo, Meta da rilanciare, email base.",
};
const DISCOVERY_LOCAL_STORAGE_PREFIX = "agency-os.discovery.";
const ADS_LOCAL_STORAGE_PREFIX = "agency-os.ads.";
const WEB_LOCAL_STORAGE_PREFIX = "agency-os.web.";
const REPORTS_LOCAL_STORAGE_PREFIX = "agency-os.reports.";
const CLIENT_REPORT_LOCAL_STORAGE_PREFIX = "agency-os.client-report.";
const DIAGNOSIS_LOCAL_STORAGE_PREFIX = "agency-os.diagnosis.";
const PROJECTS_LOCAL_STORAGE_KEY = "agency-os.projects";
const IS_DEV_RUNTIME = Boolean(import.meta?.env?.DEV);

const withDataSource = (payload, source, reason = "") => {
  return attachAgencyDataMeta(payload, {
    source,
    reason,
  });
};

const logAgencyDataEvent = (message, details) => {
  if (!IS_DEV_RUNTIME) {
    return;
  }

  if (details) {
    console.info(`[AgencyDataAdapter] ${message}`, details);
    return;
  }

  console.info(`[AgencyDataAdapter] ${message}`);
};

const isHardApiFailure = (error) => {
  const status = Number(error?.status);
  return status === 400 || status === 401 || status === 403;
};

const inferRemoteListSource = (entries) => {
  const hasFallbackIds = Array.isArray(entries) && entries.some((entry) => (
    typeof entry?.id === "string" && entry.id.startsWith("fallback-")
  ));

  return hasFallbackIds ? AGENCY_DATA_SOURCE.LOCAL_FALLBACK : AGENCY_DATA_SOURCE.DB;
};

const getWebStorageKey = (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "default";
  return `${WEB_LOCAL_STORAGE_PREFIX}${normalizedProjectId}`;
};

const readWebFromStorage = (projectId) => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getWebStorageKey(projectId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      output: normalizeAgencyWebV1Output(parsed.output, projectId),
      input: normalizeAgencyWebV1Input(parsed.input, projectId),
      persisted: Boolean(parsed.persisted),
      lastUpdatedAt: typeof parsed.lastUpdatedAt === "string" ? parsed.lastUpdatedAt : null,
    };
  } catch (_error) {
    return null;
  }
};

const writeWebToStorage = (projectId, value) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getWebStorageKey(projectId), JSON.stringify(value));
  } catch (_error) {
    // Ignore storage errors.
  }
};

const getAdsStorageKey = (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "default";
  return `${ADS_LOCAL_STORAGE_PREFIX}${normalizedProjectId}`;
};

const readAdsFromStorage = (projectId) => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getAdsStorageKey(projectId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      output: normalizeAgencyAdsV1Output(parsed.output, projectId),
      input: normalizeAgencyAdsV1Input(parsed.input, projectId),
      persisted: Boolean(parsed.persisted),
      lastUpdatedAt: typeof parsed.lastUpdatedAt === "string" ? parsed.lastUpdatedAt : null,
    };
  } catch (_error) {
    return null;
  }
};

const writeAdsToStorage = (projectId, value) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getAdsStorageKey(projectId), JSON.stringify(value));
  } catch (_error) {
    // Ignore storage errors.
  }
};

const getReportsStorageKey = (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "default";
  return `${REPORTS_LOCAL_STORAGE_PREFIX}${normalizedProjectId}`;
};

const readReportsFromStorage = (projectId) => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getReportsStorageKey(projectId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      output: normalizeAgencyReportV1Output(parsed.output, projectId),
      input: normalizeAgencyReportV1Input(parsed.input, projectId),
      persisted: Boolean(parsed.persisted),
      lastUpdatedAt: typeof parsed.lastUpdatedAt === "string" ? parsed.lastUpdatedAt : null,
    };
  } catch (_error) {
    return null;
  }
};

const writeReportsToStorage = (projectId, value) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getReportsStorageKey(projectId), JSON.stringify(value));
  } catch (_error) {
    // Ignore storage errors.
  }
};

const getClientReportStorageKey = (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "default";
  return `${CLIENT_REPORT_LOCAL_STORAGE_PREFIX}${normalizedProjectId}`;
};

const readClientReportFromStorage = (projectId) => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getClientReportStorageKey(projectId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      output: normalizeAgencyClientReportV1Output(parsed.output),
      input: normalizeAgencyClientReportV1Input(parsed.input, projectId),
      persisted: Boolean(parsed.persisted),
      lastUpdatedAt: typeof parsed.lastUpdatedAt === "string" ? parsed.lastUpdatedAt : null,
    };
  } catch (_error) {
    return null;
  }
};

const writeClientReportToStorage = (projectId, value) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getClientReportStorageKey(projectId), JSON.stringify(value));
  } catch (_error) {
    // Ignore storage errors.
  }
};

const getDiagnosisStorageKey = (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "default";
  return `${DIAGNOSIS_LOCAL_STORAGE_PREFIX}${normalizedProjectId}`;
};

const readDiagnosisFromStorage = (projectId) => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getDiagnosisStorageKey(projectId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      output: normalizeAgencyDiagnosisV1Output(parsed.output, projectId),
      input: normalizeAgencyDiagnosisV1Input(parsed.input, projectId),
      persisted: Boolean(parsed.persisted),
      lastUpdatedAt: typeof parsed.lastUpdatedAt === "string" ? parsed.lastUpdatedAt : null,
    };
  } catch (_error) {
    return null;
  }
};

const writeDiagnosisToStorage = (projectId, value) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getDiagnosisStorageKey(projectId), JSON.stringify(value));
  } catch (_error) {
    // Ignore storage errors.
  }
};

const readProjectsFromStorage = () => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(PROJECTS_LOCAL_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return normalizeAgencyProjectList(parsed, AGENCY_DATA_SOURCE.LOCAL_FALLBACK);
  } catch (_error) {
    return [];
  }
};

const writeProjectsToStorage = (projects) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(PROJECTS_LOCAL_STORAGE_KEY, JSON.stringify(projects));
  } catch (_error) {
    // Ignore storage errors.
  }
};

const readAllReportsFromStorage = () => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return Object.keys(window.localStorage)
      .filter((key) => key.startsWith(REPORTS_LOCAL_STORAGE_PREFIX))
      .map((key) => {
        const projectId = key.slice(REPORTS_LOCAL_STORAGE_PREFIX.length);
        return normalizeReportPayload(readReportsFromStorage(projectId), projectId);
      })
      .filter((entry) => entry?.output?.projectId || entry?.input?.projectId);
  } catch (_error) {
    return [];
  }
};

const normalizeWebPayload = (source, projectId, fallbackInput = null) => {
  const safeFallbackInput = fallbackInput || createEmptyAgencyWebV1Input(projectId);
  if (!source || typeof source !== "object") {
    return {
      output: createEmptyAgencyWebV1Output(projectId),
      input: safeFallbackInput,
      persisted: false,
      lastUpdatedAt: null,
    };
  }

  const rawOutput = source.output || source.web || source;
  const rawInput = source.input || fallbackInput;

  return {
    output: normalizeAgencyWebV1Output(rawOutput, projectId),
    input: normalizeAgencyWebV1Input(rawInput, projectId),
    persisted: Boolean(source.persisted),
    lastUpdatedAt: typeof source.lastUpdatedAt === "string" ? source.lastUpdatedAt : null,
  };
};

const normalizeAdsPayload = (source, projectId, fallbackInput = null) => {
  const safeFallbackInput = fallbackInput || createEmptyAgencyAdsV1Input(projectId);
  if (!source || typeof source !== "object") {
    return {
      output: createEmptyAgencyAdsV1Output(projectId),
      input: safeFallbackInput,
      persisted: false,
      lastUpdatedAt: null,
    };
  }

  const rawOutput = source.output || source.ads || source;
  const rawInput = source.input || fallbackInput;

  return {
    output: normalizeAgencyAdsV1Output(rawOutput, projectId),
    input: normalizeAgencyAdsV1Input(rawInput, projectId),
    persisted: Boolean(source.persisted),
    lastUpdatedAt: typeof source.lastUpdatedAt === "string" ? source.lastUpdatedAt : null,
  };
};

const normalizeReportPayload = (source, projectId, fallbackInput = null) => {
  const safeFallbackInput = fallbackInput || createEmptyAgencyReportV1Input(projectId);
  if (!source || typeof source !== "object") {
    return {
      output: createEmptyAgencyReportV1Output(projectId),
      input: safeFallbackInput,
      persisted: false,
      lastUpdatedAt: null,
    };
  }

  const rawOutput = source.output || source.report || source;
  const rawInput = source.input || fallbackInput;

  return {
    output: normalizeAgencyReportV1Output(rawOutput, projectId),
    input: normalizeAgencyReportV1Input(rawInput, projectId),
    persisted: Boolean(source.persisted),
    lastUpdatedAt: typeof source.lastUpdatedAt === "string" ? source.lastUpdatedAt : null,
  };
};

const normalizeClientReportPayload = (source, projectId, fallbackInput = null) => {
  const safeFallbackInput = fallbackInput || createEmptyAgencyClientReportV1Input(projectId);
  if (!source || typeof source !== "object") {
    return {
      output: createEmptyAgencyClientReportV1Output(),
      input: safeFallbackInput,
      persisted: false,
      lastUpdatedAt: null,
    };
  }

  const rawOutput = source.output || source.clientReport || source;
  const rawInput = source.input || fallbackInput;

  return {
    output: normalizeAgencyClientReportV1Output(rawOutput),
    input: normalizeAgencyClientReportV1Input(rawInput, projectId),
    persisted: Boolean(source.persisted),
    lastUpdatedAt: typeof source.lastUpdatedAt === "string" ? source.lastUpdatedAt : null,
  };
};

const normalizeDiagnosisPayload = (source, projectId, fallbackInput = null) => {
  const safeFallbackInput = fallbackInput || createEmptyAgencyDiagnosisV1Input(projectId);
  if (!source || typeof source !== "object") {
    return {
      output: createEmptyAgencyDiagnosisV1Output(projectId),
      input: safeFallbackInput,
      persisted: false,
      lastUpdatedAt: null,
    };
  }

  const rawOutput = source.output || source.diagnosis || source;
  const rawInput = source.input || fallbackInput;

  return {
    output: normalizeAgencyDiagnosisV1Output(rawOutput, projectId),
    input: normalizeAgencyDiagnosisV1Input(rawInput, projectId),
    persisted: Boolean(source.persisted),
    lastUpdatedAt: typeof source.lastUpdatedAt === "string" ? source.lastUpdatedAt : null,
  };
};

const chooseDominantSource = (sources) => {
  if (!Array.isArray(sources) || sources.length === 0) {
    return AGENCY_DATA_SOURCE.MOCK;
  }

  if (sources.every((entry) => entry === AGENCY_DATA_SOURCE.DB)) {
    return AGENCY_DATA_SOURCE.DB;
  }

  if (sources.some((entry) => entry === AGENCY_DATA_SOURCE.LOCAL_FALLBACK)) {
    return AGENCY_DATA_SOURCE.LOCAL_FALLBACK;
  }

  if (sources.some((entry) => entry === AGENCY_DATA_SOURCE.MOCK)) {
    return AGENCY_DATA_SOURCE.MOCK;
  }

  return AGENCY_DATA_SOURCE.MOCK;
};

const buildDiscoveryBrief = (sections, notes) => {
  return [
    `Contesto: ${sections.businessContext}`,
    `Obiettivo: ${sections.projectGoal}`,
    `Target: ${sections.target}`,
    `Offerta: ${sections.offer}`,
    `Marketing: ${sections.marketingAcquisition}`,
    `Note operative: ${notes || "Nessuna nota aggiuntiva."}`,
  ].join("\n");
};

const buildDiscoveryContextSummary = (sections) => {
  const completedSections = Object.values(sections).filter((value) => String(value || "").trim()).length;
  return `Discovery aggiornata. Sezioni completate: ${completedSections}/8. Obiettivo: ${sections.projectGoal || "da definire"}.`;
};

const normalizeDiscoverySections = (sections) => {
  if (!sections || typeof sections !== "object") {
    return { ...DEFAULT_DISCOVERY_SECTIONS };
  }

  return {
    businessContext: typeof sections.businessContext === "string" ? sections.businessContext : DEFAULT_DISCOVERY_SECTIONS.businessContext,
    projectGoal: typeof sections.projectGoal === "string" ? sections.projectGoal : DEFAULT_DISCOVERY_SECTIONS.projectGoal,
    target: typeof sections.target === "string" ? sections.target : DEFAULT_DISCOVERY_SECTIONS.target,
    offer: typeof sections.offer === "string" ? sections.offer : DEFAULT_DISCOVERY_SECTIONS.offer,
    brandCommunication: typeof sections.brandCommunication === "string" ? sections.brandCommunication : DEFAULT_DISCOVERY_SECTIONS.brandCommunication,
    availableMaterials: typeof sections.availableMaterials === "string" ? sections.availableMaterials : DEFAULT_DISCOVERY_SECTIONS.availableMaterials,
    technicalAspects: typeof sections.technicalAspects === "string" ? sections.technicalAspects : DEFAULT_DISCOVERY_SECTIONS.technicalAspects,
    marketingAcquisition: typeof sections.marketingAcquisition === "string" ? sections.marketingAcquisition : DEFAULT_DISCOVERY_SECTIONS.marketingAcquisition,
  };
};

const normalizeDiscoveryResponse = (source) => {
  if (!source || typeof source !== "object") {
    return null;
  }

  const sections = normalizeDiscoverySections(source.sections);
  const notes = typeof source.notes === "string" ? source.notes : "";
  const brief = typeof source.brief === "string" && source.brief.trim()
    ? source.brief
    : buildDiscoveryBrief(sections, notes);
  const contextSummary = typeof source.contextSummary === "string" && source.contextSummary.trim()
    ? source.contextSummary
    : buildDiscoveryContextSummary(sections);

  return {
    sections,
    notes,
    brief,
    contextSummary,
    persisted: Boolean(source.persisted),
    lastUpdatedAt: typeof source.lastUpdatedAt === "string" ? source.lastUpdatedAt : null,
    sourceReliability: typeof source.sourceReliability === "string" ? source.sourceReliability : "",
    usedSources: Array.isArray(source.usedSources)
      ? source.usedSources.filter((entry) => typeof entry === "string" && entry.trim())
      : [],
    sectionSources: source.sectionSources && typeof source.sectionSources === "object" ? source.sectionSources : {},
    confidenceBySection: source.confidenceBySection && typeof source.confidenceBySection === "object"
      ? source.confidenceBySection
      : {},
    aiHistory: Array.isArray(source.aiHistory)
      ? source.aiHistory.filter((entry) => entry && typeof entry === "object")
      : [],
    missingWarnings: Array.isArray(source.missingWarnings)
      ? source.missingWarnings.filter((entry) => typeof entry === "string" && entry.trim())
      : [],
  };
};

const getDiscoveryStorageKey = (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "default";
  return `${DISCOVERY_LOCAL_STORAGE_PREFIX}${normalizedProjectId}`;
};

const readDiscoveryFromStorage = (projectId) => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getDiscoveryStorageKey(projectId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return normalizeDiscoveryResponse(parsed);
  } catch (_error) {
    return null;
  }
};

const writeDiscoveryToStorage = (projectId, value) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getDiscoveryStorageKey(projectId), JSON.stringify(value));
  } catch (_error) {
    // Ignore storage errors and keep UX functional.
  }
};

const toBrainSeed = (source) => {
  if (!source || typeof source !== "object") {
    return null;
  }

  return {
    projectType: source.projectType,
    scopePurchased: source.scopePurchased,
    activeModules: source.activeModules,
    alerts: source.alerts,
    opportunities: source.opportunities,
    memorySummary: source.memorySummary,
    contextSummary: source.contextSummary,
  };
};

const normalizeAlertList = (alerts) => {
  if (!Array.isArray(alerts)) {
    return null;
  }

  return alerts
    .map((entry, index) => {
      const title = typeof entry?.title === "string" ? entry.title.trim() : "";
      if (!title) {
        return null;
      }

      return {
        id: typeof entry?.id === "string" && entry.id.trim() ? entry.id : `alert-${index + 1}`,
        title,
        severity: typeof entry?.severity === "string" ? entry.severity.toLowerCase() : "medium",
        status: typeof entry?.status === "string" ? entry.status.toLowerCase() : "open",
        reason: typeof entry?.reason === "string" ? entry.reason : null,
        projectId: typeof entry?.projectId === "string" ? entry.projectId : "N/A",
        origin: typeof entry?.origin === "string"
          ? entry.origin
          : typeof entry?.source === "string"
            ? entry.source
            : "unknown",
      };
    })
    .filter(Boolean);
};

const normalizeOpportunityList = (opportunities) => {
  if (!Array.isArray(opportunities)) {
    return null;
  }

  return opportunities
    .map((entry, index) => {
      const title = typeof entry?.title === "string" ? entry.title.trim() : "";
      if (!title) {
        return null;
      }

      return {
        id: typeof entry?.id === "string" && entry.id.trim() ? entry.id : `opportunity-${index + 1}`,
        title,
        stage: typeof entry?.stage === "string" && entry.stage.trim() ? entry.stage : "Identificata",
        estimatedValue: Number.isFinite(Number(entry?.estimatedValue)) ? Number(entry.estimatedValue) : 0,
        status: typeof entry?.status === "string" ? entry.status.toLowerCase() : "suggested",
        category: typeof entry?.category === "string" && entry.category.trim() ? entry.category.trim() : null,
        type: typeof entry?.type === "string" && entry.type.trim() ? entry.type.trim() : null,
        rationale: typeof entry?.rationale === "string" && entry.rationale.trim() ? entry.rationale.trim() : null,
        priority: typeof entry?.priority === "string" && entry.priority.trim() ? entry.priority.toLowerCase() : null,
        score: Number.isFinite(Number(entry?.score)) ? Number(entry.score) : null,
        impactLevel: typeof entry?.impactLevel === "string" && entry.impactLevel.trim() ? entry.impactLevel.toLowerCase() : null,
        sourceModule: typeof entry?.sourceModule === "string" && entry.sourceModule.trim() ? entry.sourceModule.trim() : null,
        sourceSignalKey: typeof entry?.sourceSignalKey === "string" && entry.sourceSignalKey.trim() ? entry.sourceSignalKey.trim() : null,
        dedupKey: typeof entry?.dedupKey === "string" && entry.dedupKey.trim() ? entry.dedupKey.trim() : null,
        suggestedService: typeof entry?.suggestedService === "string" && entry.suggestedService.trim() ? entry.suggestedService.trim() : null,
        lastEvaluatedAt: typeof entry?.lastEvaluatedAt === "string" && entry.lastEvaluatedAt.trim()
          ? entry.lastEvaluatedAt
          : null,
        projectId: typeof entry?.projectId === "string" ? entry.projectId : "N/A",
        origin: typeof entry?.origin === "string"
          ? entry.origin
          : typeof entry?.source === "string"
            ? entry.source
            : "unknown",
      };
    })
    .filter(Boolean);
};

const normalizeTaskList = (tasks) => {
  if (!Array.isArray(tasks)) {
    return null;
  }

  return tasks
    .map((entry, index) => {
      const title = typeof entry?.title === "string" ? entry.title.trim() : "";
      if (!title) {
        return null;
      }

      return {
        id: typeof entry?.id === "string" && entry.id.trim() ? entry.id : `task-${index + 1}`,
        projectId: typeof entry?.projectId === "string" ? entry.projectId : "N/A",
        title,
        description: typeof entry?.description === "string" ? entry.description : null,
        teamRole: typeof entry?.teamRole === "string" ? entry.teamRole : "marketing_strategy_pm",
        priority: typeof entry?.priority === "string" ? entry.priority.toLowerCase() : "medium",
        status: typeof entry?.status === "string" ? entry.status.toLowerCase() : "todo",
        sourceType: typeof entry?.sourceType === "string" ? entry.sourceType : "manual",
        dependsOnTaskId: typeof entry?.dependsOnTaskId === "string" ? entry.dependsOnTaskId : null,
        origin: typeof entry?.origin === "string"
          ? entry.origin
          : typeof entry?.sourceType === "string"
            ? entry.sourceType
            : "unknown",
      };
    })
    .filter(Boolean);
};

const buildFallbackTaskList = (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "N/A";

  return [
    {
      id: `fallback-task-${normalizedProjectId}-1`,
      projectId: normalizedProjectId,
      title: "Allineare roadmap operativa e milestone progetto",
      description: "Task fallback in assenza di persistenza Agency.",
      teamRole: "marketing_strategy_pm",
      priority: "high",
      status: "todo",
      sourceType: "rule_v1",
      dependsOnTaskId: null,
      origin: "local_fallback",
    },
    {
      id: `fallback-task-${normalizedProjectId}-2`,
      projectId: normalizedProjectId,
      title: "Impostare piano campagne ads sprint 1",
      description: "Task fallback di avvio per area Ads.",
      teamRole: "ads_specialist",
      priority: "medium",
      status: "todo",
      sourceType: "rule_v1",
      dependsOnTaskId: null,
      origin: "local_fallback",
    },
  ];
};

export const getAgencyProjects = async () => {
  try {
    const remoteProjects = await fetchAgencyProjects();
    const normalizedProjects = normalizeAgencyProjectList(remoteProjects, AGENCY_DATA_SOURCE.DB);
    writeProjectsToStorage(normalizedProjects);
    return withDataSource(normalizedProjects, AGENCY_DATA_SOURCE.DB);
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Agency projects remote fetch failed. Trying local fallback.", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  const cachedProjects = readProjectsFromStorage();
  if (cachedProjects.length > 0) {
    return withDataSource(
      cachedProjects,
      AGENCY_DATA_SOURCE.LOCAL_FALLBACK,
      "Using browser localStorage cache for Agency projects.",
    );
  }

  return withDataSource(
    [],
    AGENCY_DATA_SOURCE.MOCK,
    "No Agency projects available yet.",
  );
};

export const getAgencyProject = async (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "";

  if (!normalizedProjectId) {
    return withDataSource(
      normalizeAgencyProject(null, AGENCY_DATA_SOURCE.MOCK),
      AGENCY_DATA_SOURCE.MOCK,
      "Missing projectId. Using empty Agency project payload.",
    );
  }

  try {
    const remoteProject = await fetchAgencyProject(normalizedProjectId);
    const normalizedProject = normalizeAgencyProject(remoteProject, AGENCY_DATA_SOURCE.DB);
    const cachedProjects = readProjectsFromStorage();
    const nextProjects = [
      normalizedProject,
      ...cachedProjects.filter((entry) => entry.id !== normalizedProject.id),
    ];
    writeProjectsToStorage(nextProjects);
    return withDataSource(normalizedProject, AGENCY_DATA_SOURCE.DB);
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Agency project remote fetch failed. Trying local fallback.", {
      projectId: normalizedProjectId,
    });
  }

  const cachedProject = readProjectsFromStorage().find((entry) => entry.id === normalizedProjectId);
  if (cachedProject) {
    return withDataSource(
      cachedProject,
      AGENCY_DATA_SOURCE.LOCAL_FALLBACK,
      "Using browser localStorage cache for Agency project.",
    );
  }

  return withDataSource(
    normalizeAgencyProject({ id: normalizedProjectId }, AGENCY_DATA_SOURCE.MOCK),
    AGENCY_DATA_SOURCE.MOCK,
    "Agency project not available. Returning empty payload.",
  );
};

export const createAgencyProject = async (payload) => {
  const remoteProject = await createAgencyProjectApi(payload);
  const normalizedProject = normalizeAgencyProject(remoteProject, AGENCY_DATA_SOURCE.DB);
  const cachedProjects = readProjectsFromStorage();
  const nextProjects = [
    normalizedProject,
    ...cachedProjects.filter((entry) => entry.id !== normalizedProject.id),
  ];
  writeProjectsToStorage(nextProjects);
  return withDataSource(normalizedProject, AGENCY_DATA_SOURCE.DB);
};

export const getAgencyProjectOverview = async (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : null;
  if (!normalizedProjectId) {
    return withDataSource(
      buildAgencyBrainResult(projectId),
      AGENCY_DATA_SOURCE.MOCK,
      "Missing projectId. Using local mock defaults.",
    );
  }

  try {
    const source = await fetchAgencyProjectOverviewSeed(normalizedProjectId);
    const seed = toBrainSeed(source);
    if (seed) {
      return withDataSource(
        buildAgencyBrainResult(normalizedProjectId, seed),
        AGENCY_DATA_SOURCE.DB,
      );
    }
    logAgencyDataEvent("Overview remote payload empty, switching to mock.", {
      projectId: normalizedProjectId,
    });
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Overview remote fetch failed, switching to mock.", {
      projectId: normalizedProjectId,
    });
  }

  logAgencyDataEvent("Overview resolved with mock source.", {
    projectId: normalizedProjectId,
  });
  return withDataSource(
    buildAgencyBrainResult(normalizedProjectId),
    AGENCY_DATA_SOURCE.MOCK,
    "Remote overview unavailable. Falling back to mock seed.",
  );
};

export const getAgencyProjectBrain = async (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : null;
  if (!normalizedProjectId) {
    return withDataSource(
      buildAgencyBrainResult(projectId),
      AGENCY_DATA_SOURCE.MOCK,
      "Missing projectId. Using local mock defaults.",
    );
  }

  try {
    const source = await fetchAgencyProjectBrainSeed(normalizedProjectId);
    const seed = toBrainSeed(source);
    if (seed) {
      return withDataSource(
        buildAgencyBrainResult(normalizedProjectId, seed),
        AGENCY_DATA_SOURCE.DB,
      );
    }
    logAgencyDataEvent("Brain remote payload empty, switching to mock.", {
      projectId: normalizedProjectId,
    });
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Brain remote fetch failed, switching to mock.", {
      projectId: normalizedProjectId,
    });
  }

  logAgencyDataEvent("Brain resolved with mock source.", {
    projectId: normalizedProjectId,
  });
  return withDataSource(
    buildAgencyBrainResult(normalizedProjectId),
    AGENCY_DATA_SOURCE.MOCK,
    "Remote brain unavailable. Falling back to mock seed.",
  );
};

export const getAgencyProjectWorkingContext = async (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : null;

  if (!normalizedProjectId) {
    return withDataSource(
      null,
      AGENCY_DATA_SOURCE.LOCAL_FALLBACK,
      "Missing projectId. Working context unavailable.",
    );
  }

  try {
    const remoteContext = await fetchAgencyProjectWorkingContext(normalizedProjectId);
    if (remoteContext) {
      return withDataSource(remoteContext, AGENCY_DATA_SOURCE.DB);
    }
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Working context remote fetch failed.", {
      projectId: normalizedProjectId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  return withDataSource(
    null,
    AGENCY_DATA_SOURCE.LOCAL_FALLBACK,
    "Working context unavailable. Individual module data remains available.",
  );
};

export const getAgencyProjectDiscovery = async (projectId) => {
  try {
    const remoteDiscovery = await fetchAgencyProjectDiscovery(projectId);
    const normalizedRemoteDiscovery = normalizeDiscoveryResponse(remoteDiscovery);
    if (normalizedRemoteDiscovery) {
      writeDiscoveryToStorage(projectId, normalizedRemoteDiscovery);
      return withDataSource(normalizedRemoteDiscovery, AGENCY_DATA_SOURCE.DB);
    }
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Discovery remote fetch failed. Trying local fallbacks.", {
      projectId,
    });
  }

  const cachedDiscovery = readDiscoveryFromStorage(projectId);
  if (cachedDiscovery) {
    logAgencyDataEvent("Discovery loaded from localStorage fallback.", {
      projectId,
    });
    return withDataSource(
      cachedDiscovery,
      AGENCY_DATA_SOURCE.LOCAL_FALLBACK,
      "Using browser localStorage cache.",
    );
  }

  const notes = "Allineare stakeholder entro fine settimana.";
  const sections = { ...DEFAULT_DISCOVERY_SECTIONS };
  logAgencyDataEvent("Discovery loaded from static local fallback.", {
    projectId,
  });
  return withDataSource({
    sections,
    notes,
    brief: buildDiscoveryBrief(sections, notes),
    contextSummary: buildDiscoveryContextSummary(sections),
    persisted: false,
    lastUpdatedAt: null,
  }, AGENCY_DATA_SOURCE.LOCAL_FALLBACK, "Using static local discovery defaults.");
};

export const getAgencyProjectSources = async (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "";

  if (!normalizedProjectId) {
    return withDataSource(
      normalizeAgencyProjectSources(null),
      AGENCY_DATA_SOURCE.MOCK,
      "Missing projectId. Using empty sources payload.",
    );
  }

  try {
    const remoteSources = await fetchAgencyProjectSources(normalizedProjectId);
    return withDataSource(
      normalizeAgencyProjectSources(remoteSources),
      AGENCY_DATA_SOURCE.DB,
    );
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Sources fetch failed. Returning empty source fallback.", {
      projectId: normalizedProjectId,
    });
  }

  return withDataSource(
    normalizeAgencyProjectSources(null),
    AGENCY_DATA_SOURCE.MOCK,
    "No project sources available.",
  );
};

export const saveAgencyProjectSources = async (projectId, payload) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "";
  const normalizedPayload = normalizeAgencyProjectSources(payload);

  if (!normalizedProjectId) {
    return withDataSource(
      normalizedPayload,
      AGENCY_DATA_SOURCE.MOCK,
      "Missing projectId. Sources kept in memory only.",
    );
  }

  const remoteSources = await saveAgencyProjectSourcesApi(normalizedProjectId, normalizedPayload);
  return withDataSource(
    normalizeAgencyProjectSources(remoteSources),
    AGENCY_DATA_SOURCE.DB,
  );
};

export const uploadAgencyProjectSourceFile = async (projectId, file) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "";

  if (!normalizedProjectId || !file) {
    return withDataSource(
      null,
      AGENCY_DATA_SOURCE.MOCK,
      "Missing projectId or file. Upload not executed.",
    );
  }

  const uploadedFile = await uploadAgencyProjectSourceFileApi(normalizedProjectId, file);
  return withDataSource(uploadedFile, AGENCY_DATA_SOURCE.DB);
};

export const deleteAgencyProjectSourceFile = async (projectId, fileId) => {
  const remoteSources = await deleteAgencyProjectSourceFileApi(projectId, fileId);
  return withDataSource(
    normalizeAgencyProjectSources(remoteSources),
    AGENCY_DATA_SOURCE.DB,
  );
};

export const fetchAgencyProjectSourceFileBlob = async (projectId, fileId, options = {}) => {
  return fetchAgencyProjectSourceFileBlobApi(projectId, fileId, options);
};

export const searchAgencyProjectCompetitors = async (projectId, options = {}) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "";

  if (!normalizedProjectId) {
    return withDataSource(
      {
        provider: "none",
        providerStatus: "not_configured",
        realSearch: false,
        suggestions: [],
        message: "Ricerca automatica non configurata. Inserisci competitor manualmente o configura un provider in Impostazioni AI.",
      },
      AGENCY_DATA_SOURCE.MOCK,
    );
  }

  const result = await searchAgencyProjectCompetitorsApi(normalizedProjectId, options);
  return withDataSource(result, AGENCY_DATA_SOURCE.DB);
};

export const saveAgencyProjectDiscovery = async (projectId, payload) => {
  const sections = normalizeDiscoverySections(payload?.sections);
  const notes = typeof payload?.notes === "string" ? payload.notes : "";
  const fallbackPayload = {
    sections,
    notes,
    brief: buildDiscoveryBrief(sections, notes),
    contextSummary: buildDiscoveryContextSummary(sections),
    persisted: false,
    lastUpdatedAt: new Date().toISOString(),
  };

  try {
    const remoteDiscovery = await saveAgencyProjectDiscoveryApi(projectId, {
      sections,
      notes,
    });
    const normalizedRemoteDiscovery = normalizeDiscoveryResponse(remoteDiscovery);
    if (normalizedRemoteDiscovery) {
      writeDiscoveryToStorage(projectId, normalizedRemoteDiscovery);
      return withDataSource(normalizedRemoteDiscovery, AGENCY_DATA_SOURCE.DB);
    }
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Discovery remote save failed. Persisting to localStorage fallback.", {
      projectId,
    });
  }

  writeDiscoveryToStorage(projectId, fallbackPayload);
  return withDataSource(
    fallbackPayload,
    AGENCY_DATA_SOURCE.LOCAL_FALLBACK,
    "Remote save unavailable. Persisted in browser localStorage.",
  );
};

export const getAgencyProjectAlerts = async (projectId) => {
  if (projectId) {
    try {
      const persistedProjectAlerts = normalizeAlertList(await fetchAgencyProjectAlerts(projectId));
      if (persistedProjectAlerts && persistedProjectAlerts.length > 0) {
        return withDataSource(persistedProjectAlerts, inferRemoteListSource(persistedProjectAlerts));
      }
      if (persistedProjectAlerts) {
        const syncedAlerts = normalizeAlertList(await syncAgencyProjectAlerts(projectId));
        if (syncedAlerts) {
          return withDataSource(syncedAlerts, inferRemoteListSource(syncedAlerts));
        }
      }
    } catch (error) {
      if (isHardApiFailure(error)) {
        throw error;
      }
      logAgencyDataEvent("Alerts project read/sync failed. Falling back to mock alerts.", {
        projectId,
      });
    }
  } else {
    try {
      const persistedWorkspaceAlerts = normalizeAlertList(await fetchAgencyWorkspaceAlerts());
      if (persistedWorkspaceAlerts) {
        return withDataSource(persistedWorkspaceAlerts, inferRemoteListSource(persistedWorkspaceAlerts));
      }
    } catch (error) {
      if (isHardApiFailure(error)) {
        throw error;
      }
      logAgencyDataEvent("Workspace alerts read failed. Falling back to mock alerts.");
    }
  }

  logAgencyDataEvent("Alerts resolved with mock source.", {
    projectId: projectId || null,
  });
  return withDataSource(
    listMockAgencyAlerts(projectId).map((entry) => ({
      ...entry,
      origin: "mock_generated",
    })),
    AGENCY_DATA_SOURCE.MOCK,
    "Remote alerts unavailable. Using isolated Agency mocks.",
  );
};

export const getAgencyProjectOpportunities = async (projectId) => {
  if (projectId) {
    try {
      const persistedProjectOpportunities = normalizeOpportunityList(await fetchAgencyProjectOpportunities(projectId));
      if (persistedProjectOpportunities && persistedProjectOpportunities.length > 0) {
        return withDataSource(persistedProjectOpportunities, inferRemoteListSource(persistedProjectOpportunities));
      }
      if (persistedProjectOpportunities) {
        const syncedOpportunities = normalizeOpportunityList(await syncAgencyProjectOpportunities(projectId));
        if (syncedOpportunities) {
          return withDataSource(syncedOpportunities, inferRemoteListSource(syncedOpportunities));
        }
      }
    } catch (error) {
      if (isHardApiFailure(error)) {
        throw error;
      }
      logAgencyDataEvent("Opportunities project read/sync failed. Falling back to mock opportunities.", {
        projectId,
      });
    }
  } else {
    try {
      const persistedWorkspaceOpportunities = normalizeOpportunityList(await fetchAgencyWorkspaceOpportunities());
      if (persistedWorkspaceOpportunities) {
        return withDataSource(persistedWorkspaceOpportunities, inferRemoteListSource(persistedWorkspaceOpportunities));
      }
    } catch (error) {
      if (isHardApiFailure(error)) {
        throw error;
      }
      logAgencyDataEvent("Workspace opportunities read failed. Falling back to mock opportunities.");
    }
  }

  logAgencyDataEvent("Opportunities resolved with mock source.", {
    projectId: projectId || null,
  });
  return withDataSource(
    listMockAgencyOpportunities(projectId).map((entry) => ({
      ...entry,
      origin: "mock_generated",
    })),
    AGENCY_DATA_SOURCE.MOCK,
    "Remote opportunities unavailable. Using isolated Agency mocks.",
  );
};

export const buildAgencyOpportunityInput = async (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "";

  if (!normalizedProjectId) {
    return withDataSource({
      projectId: "",
      workspaceId: "",
      projectType: { key: "marketing_full", label: "Marketing Full" },
      scopePurchased: [],
      activeModules: [],
      contextSummary: "",
      discovery: {
        sections: { ...DEFAULT_DISCOVERY_SECTIONS },
        notes: "",
        brief: buildDiscoveryBrief(DEFAULT_DISCOVERY_SECTIONS, ""),
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
      tasks: [],
      dataCompleteness: {
        hasProjectType: false,
        hasDiscovery: false,
        hasOffer: false,
        hasTarget: false,
        hasContextSummary: false,
        hasWebOutput: false,
        hasAdsOutput: false,
        hasAlerts: false,
        hasTasks: false,
      },
    }, AGENCY_DATA_SOURCE.MOCK, "Missing projectId. Using opportunity input defaults.");
  }

  try {
    const remoteInput = await fetchAgencyProjectOpportunityInput(normalizedProjectId);
    if (remoteInput) {
      return withDataSource(remoteInput, AGENCY_DATA_SOURCE.DB);
    }
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Opportunity input remote fetch failed. Building local fallback composition.", {
      projectId: normalizedProjectId,
    });
  }

  const [overview, discovery, web, ads, alerts, tasks] = await Promise.all([
    getAgencyProjectOverview(normalizedProjectId),
    getAgencyProjectDiscovery(normalizedProjectId),
    getAgencyProjectWeb(normalizedProjectId),
    getAgencyProjectAds(normalizedProjectId),
    getAgencyProjectAlerts(normalizedProjectId),
    getAgencyProjectTasks(normalizedProjectId),
  ]);
  const overviewMeta = readAgencyDataMeta(overview);
  const discoveryMeta = readAgencyDataMeta(discovery);
  const webMeta = readAgencyDataMeta(web);
  const adsMeta = readAgencyDataMeta(ads);
  const alertsMeta = readAgencyDataMeta(alerts);
  const tasksMeta = readAgencyDataMeta(tasks);
  const webOutput = web?.output || null;
  const adsOutput = ads?.output || null;
  const contextSummary = overview?.contextSummary || discovery?.contextSummary || "";

  return withDataSource({
    projectId: normalizedProjectId,
    workspaceId: "",
    projectName: normalizedProjectId,
    projectStatus: null,
    projectPriority: null,
    projectType: overview?.projectType
      ? { key: overview.projectType.key, label: overview.projectType.label }
      : { key: "marketing_full", label: "Marketing Full" },
    scopePurchased: overview?.scopePurchased || [],
    activeModules: overview?.activeModules || [],
    contextSummary,
    discovery: {
      sections: discovery?.sections || { ...DEFAULT_DISCOVERY_SECTIONS },
      notes: discovery?.notes || "",
      brief: discovery?.brief || buildDiscoveryBrief(discovery?.sections || { ...DEFAULT_DISCOVERY_SECTIONS }, discovery?.notes || ""),
      contextSummary: discovery?.contextSummary || "",
      lastUpdatedAt: discovery?.lastUpdatedAt || null,
    },
    web: {
      available: Boolean(web?.persisted || webOutput?.lastGeneratedAt),
      pageGoal: webOutput?.pageGoal || "",
      pageType: webOutput?.pageType || "",
      targetSummary: webOutput?.targetSummary || "",
      offerSummary: webOutput?.offerSummary || "",
      valueProp: webOutput?.valueProp || "",
      ctaPrimary: webOutput?.ctaSet?.primary || "",
      trustElements: webOutput?.trustElements || [],
      sectionPlanCount: Array.isArray(webOutput?.sectionPlan) ? webOutput.sectionPlan.length : 0,
      previewAvailable: typeof webOutput?.previewHtmlBase === "string" && webOutput.previewHtmlBase.trim().length > 0,
      lastGeneratedAt: webOutput?.lastGeneratedAt || null,
    },
    ads: {
      available: Boolean(ads?.persisted || adsOutput?.lastGeneratedAt),
      channelScope: adsOutput?.channelScope || "none",
      offerAngle: adsOutput?.offerAngle || "",
      google: {
        keywordSeedsCount: Array.isArray(adsOutput?.googleAds?.keywordSeeds) ? adsOutput.googleAds.keywordSeeds.length : 0,
        landingRecommendation: adsOutput?.googleAds?.landingRecommendation || "",
      },
      meta: {
        creativeAnglesCount: Array.isArray(adsOutput?.metaAds?.creativeAngles) ? adsOutput.metaAds.creativeAngles.length : 0,
        assetRequestsCount: Array.isArray(adsOutput?.metaAds?.assetRequests) ? adsOutput.metaAds.assetRequests.length : 0,
        primaryTextsCount: Array.isArray(adsOutput?.metaAds?.primaryTexts) ? adsOutput.metaAds.primaryTexts.length : 0,
      },
      lastGeneratedAt: adsOutput?.lastGeneratedAt || null,
    },
    alerts: Array.isArray(alerts) ? alerts : [],
    tasks: Array.isArray(tasks) ? tasks : [],
    dataCompleteness: {
      hasProjectType: Boolean(overview?.projectType?.key),
      hasDiscovery: Boolean(discovery?.persisted || discovery?.lastUpdatedAt),
      hasOffer: Boolean(discovery?.sections?.offer),
      hasTarget: Boolean(discovery?.sections?.target),
      hasContextSummary: Boolean(contextSummary),
      hasWebOutput: Boolean(web?.persisted || webOutput?.lastGeneratedAt),
      hasAdsOutput: Boolean(ads?.persisted || adsOutput?.lastGeneratedAt),
      hasAlerts: Array.isArray(alerts) && alerts.length > 0,
      hasTasks: Array.isArray(tasks) && tasks.length > 0,
    },
  }, chooseDominantSource([
    overviewMeta.source,
    discoveryMeta.source,
    webMeta.source,
    adsMeta.source,
    alertsMeta.source,
    tasksMeta.source,
  ]), "Composed from Agency overview/discovery/web/ads/alerts/tasks.");
};

export const regenerateAgencyProjectDiscoveryFromSources = async (projectId) => {
  const remoteDiscovery = await regenerateAgencyProjectDiscoveryFromSourcesApi(projectId);
  const normalizedRemoteDiscovery = normalizeDiscoveryResponse(remoteDiscovery);
  if (normalizedRemoteDiscovery) {
    writeDiscoveryToStorage(projectId, normalizedRemoteDiscovery);
    return withDataSource(normalizedRemoteDiscovery, AGENCY_DATA_SOURCE.DB);
  }

  return withDataSource(
    null,
    AGENCY_DATA_SOURCE.MOCK,
    "Discovery regeneration did not return a payload.",
  );
};

export const regenerateAgencyProjectDiscoverySectionFromSources = async (projectId, sectionKey) => {
  const remoteDiscovery = await regenerateAgencyProjectDiscoverySectionFromSourcesApi(projectId, sectionKey);
  const normalizedRemoteDiscovery = normalizeDiscoveryResponse(remoteDiscovery);
  if (normalizedRemoteDiscovery) {
    writeDiscoveryToStorage(projectId, normalizedRemoteDiscovery);
    return withDataSource(normalizedRemoteDiscovery, AGENCY_DATA_SOURCE.DB);
  }

  return withDataSource(
    null,
    AGENCY_DATA_SOURCE.MOCK,
    "Discovery section regeneration did not return a payload.",
  );
};

export const generateAgencyProjectDiscoveryFromSources = async (projectId) => {
  const remoteDiscovery = await generateAgencyProjectDiscoveryFromSourcesApi(projectId);
  const normalizedRemoteDiscovery = normalizeDiscoveryResponse(remoteDiscovery);
  if (normalizedRemoteDiscovery) {
    const enriched = {
      ...normalizedRemoteDiscovery,
      aiGeneration: remoteDiscovery?.aiGeneration || null,
    };
    writeDiscoveryToStorage(projectId, enriched);
    return withDataSource(enriched, AGENCY_DATA_SOURCE.DB);
  }

  return withDataSource(
    null,
    AGENCY_DATA_SOURCE.MOCK,
    "Discovery AI generation did not return a payload.",
  );
};

export const generateAgencyProjectDiscoverySection = async (projectId, sectionKey) => {
  const remoteDiscovery = await generateAgencyProjectDiscoverySectionApi(projectId, sectionKey);
  const normalizedRemoteDiscovery = normalizeDiscoveryResponse(remoteDiscovery);
  if (normalizedRemoteDiscovery) {
    const enriched = {
      ...normalizedRemoteDiscovery,
      aiGeneration: remoteDiscovery?.aiGeneration || null,
    };
    writeDiscoveryToStorage(projectId, enriched);
    return withDataSource(enriched, AGENCY_DATA_SOURCE.DB);
  }

  return withDataSource(
    null,
    AGENCY_DATA_SOURCE.MOCK,
    "Discovery section AI generation did not return a payload.",
  );
};

export const getAgencyCompetitorSearchSettings = async () => {
  const result = await fetchAgencyCompetitorSearchSettingsApi();
  return withDataSource(result || {
    status: "not_configured",
    provider: "none",
    enabled: false,
    message: "Ricerca competitor non configurata.",
  }, AGENCY_DATA_SOURCE.DB);
};

export const getAgencyAiStatus = async () => {
  const result = await fetchAgencyAiStatusApi();
  return withDataSource(result || {
    status: "not_configured",
    configured: false,
    provider: "none",
    message: "AI non configurata. Il sistema usa generatori rule-based dichiarati.",
  }, AGENCY_DATA_SOURCE.DB);
};

export const getAgencyRuntimeSettings = async () => {
  const result = await fetchAgencyRuntimeSettingsApi();
  return withDataSource(result || {
    canManage: false,
    storageReady: false,
    ai: {
      enabled: false,
      provider: "none",
      model: "",
      configured: false,
      apiKeyConfigured: false,
      message: "Impostazioni runtime non disponibili.",
    },
    competitorSearch: {
      enabled: false,
      provider: "none",
      status: "not_configured",
      message: "Ricerca competitor non configurata.",
    },
  }, AGENCY_DATA_SOURCE.DB);
};

export const saveAgencyRuntimeSettings = async (payload) => {
  const result = await updateAgencyRuntimeSettingsApi(payload);
  return withDataSource(result || null, AGENCY_DATA_SOURCE.DB);
};

export const getAgencyAiUsage = async (options = {}) => {
  const result = await fetchAgencyAiUsageApi(options);
  return withDataSource(
    result || {
      windowDays: options.days ?? 30,
      totals: { calls: 0, costUsd: 0, inputTokens: 0, outputTokens: 0 },
      perUser: [],
      perFunction: [],
      perProject: [],
      recent: [],
      options: { users: [], models: [], functions: [], projects: [] },
    },
    AGENCY_DATA_SOURCE.DB,
  );
};

export const getAgencyAiEstimates = async () => {
  const result = await fetchAgencyAiEstimatesApi();
  return withDataSource(
    result || { aiConfigured: false, provider: "none", estimates: [] },
    AGENCY_DATA_SOURCE.DB,
  );
};

export const getAgencyAiBudgets = async () => {
  const result = await fetchAgencyAiBudgetsApi();
  return withDataSource(result || { defaultDailyLimitUsd: 0, members: [] }, AGENCY_DATA_SOURCE.DB);
};

export const saveAgencyAiBudgets = async (payload) => {
  const result = await updateAgencyAiBudgetsApi(payload);
  return withDataSource(result || null, AGENCY_DATA_SOURCE.DB);
};

export const buildAgencyAdsInput = async (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "";

  if (!normalizedProjectId) {
    return withDataSource(
      createEmptyAgencyAdsV1Input(projectId || ""),
      AGENCY_DATA_SOURCE.MOCK,
      "Missing projectId. Using Ads input defaults.",
    );
  }

  const [overview, brain, discovery, web] = await Promise.all([
    getAgencyProjectOverview(normalizedProjectId),
    getAgencyProjectBrain(normalizedProjectId),
    getAgencyProjectDiscovery(normalizedProjectId),
    getAgencyProjectWeb(normalizedProjectId),
  ]);
  const overviewMeta = readAgencyDataMeta(overview);
  const brainMeta = readAgencyDataMeta(brain);
  const discoveryMeta = readAgencyDataMeta(discovery);
  const webMeta = readAgencyDataMeta(web);
  const webPayload = web?.output || {};

  const normalizedInput = normalizeAgencyAdsV1Input({
    projectId: normalizedProjectId,
    projectType: overview?.projectType || brain?.projectType,
    scopePurchased: overview?.scopePurchased || brain?.scopePurchased || [],
    activeModules: overview?.activeModules || brain?.activeModules || [],
    contextSummary: overview?.contextSummary || brain?.contextSummary || discovery?.contextSummary || "",
    discovery: {
      sections: discovery?.sections || {},
      notes: discovery?.notes || "",
      contextSummary: discovery?.contextSummary || "",
      lastUpdatedAt: discovery?.lastUpdatedAt || null,
    },
    memorySummary: overview?.memorySummary || brain?.memorySummary || {},
    web: {
      available: Boolean(web?.persisted || webMeta.source !== AGENCY_DATA_SOURCE.MOCK || webPayload?.lastGeneratedAt),
      pageGoal: webPayload?.pageGoal || "",
      pageType: webPayload?.pageType || "",
      targetSummary: webPayload?.targetSummary || "",
      offerSummary: webPayload?.offerSummary || "",
      valueProp: webPayload?.valueProp || "",
      ctaPrimary: webPayload?.ctaSet?.primary || "",
      trustElements: webPayload?.trustElements || [],
      landingRecommendationBase: webPayload?.pageType === "landing"
        ? "Landing dedicata gia presente nel modulo Web."
        : "Valutare landing dedicata per sostenere le campagne.",
      lastGeneratedAt: webPayload?.lastGeneratedAt || null,
    },
    alerts: Array.isArray(overview?.alerts)
      ? overview.alerts.map((entry) => ({
        title: entry?.title || "",
        severity: entry?.severity || "",
        status: entry?.status || "",
        origin: entry?.origin || "overview",
      }))
      : [],
    opportunities: Array.isArray(overview?.opportunities)
      ? overview.opportunities.map((entry) => ({
        id: entry?.id || "",
        title: entry?.title || "",
        stage: entry?.stage || "",
        status: entry?.status || "",
        estimatedValue: Number.isFinite(Number(entry?.estimatedValue)) ? Number(entry.estimatedValue) : 0,
        category: entry?.category || null,
        type: entry?.type || null,
        rationale: entry?.rationale || null,
        priority: entry?.priority || null,
        score: Number.isFinite(Number(entry?.score)) ? Number(entry.score) : null,
        impactLevel: entry?.impactLevel || null,
        sourceModule: entry?.sourceModule || null,
        sourceSignalKey: entry?.sourceSignalKey || null,
        dedupKey: entry?.dedupKey || null,
        suggestedService: entry?.suggestedService || null,
        lastEvaluatedAt: entry?.lastEvaluatedAt || null,
        projectId: entry?.projectId || normalizedProjectId,
        origin: entry?.origin || "overview",
      }))
      : [],
  }, normalizedProjectId);

  return withDataSource(
    normalizedInput,
    chooseDominantSource([overviewMeta.source, brainMeta.source, discoveryMeta.source, webMeta.source]),
    "Composed from overview/brain/discovery/web sources.",
  );
};

export const buildAgencyWebInput = async (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "";

  if (!normalizedProjectId) {
    return withDataSource(
      createEmptyAgencyWebV1Input(projectId || ""),
      AGENCY_DATA_SOURCE.MOCK,
      "Missing projectId. Using Web input defaults.",
    );
  }

  const [overview, brain, discovery] = await Promise.all([
    getAgencyProjectOverview(normalizedProjectId),
    getAgencyProjectBrain(normalizedProjectId),
    getAgencyProjectDiscovery(normalizedProjectId),
  ]);
  const overviewMeta = readAgencyDataMeta(overview);
  const brainMeta = readAgencyDataMeta(brain);
  const discoveryMeta = readAgencyDataMeta(discovery);

  const normalizedInput = normalizeAgencyWebV1Input({
    projectId: normalizedProjectId,
    projectType: overview?.projectType || brain?.projectType,
    scopePurchased: overview?.scopePurchased || brain?.scopePurchased || [],
    activeModules: overview?.activeModules || brain?.activeModules || [],
    contextSummary: overview?.contextSummary || brain?.contextSummary || discovery?.contextSummary || "",
    discovery: {
      sections: discovery?.sections || {},
      notes: discovery?.notes || "",
      contextSummary: discovery?.contextSummary || "",
      lastUpdatedAt: discovery?.lastUpdatedAt || null,
    },
    memorySummary: overview?.memorySummary || brain?.memorySummary || {},
  }, normalizedProjectId);

  return withDataSource(
    normalizedInput,
    chooseDominantSource([overviewMeta.source, brainMeta.source, discoveryMeta.source]),
    "Composed from overview/brain/discovery sources.",
  );
};

export const getAgencyProjectWeb = async (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "";
  const fallbackInput = await buildAgencyWebInput(normalizedProjectId);

  if (!normalizedProjectId) {
    return withDataSource(
      normalizeWebPayload(null, projectId || "", fallbackInput),
      AGENCY_DATA_SOURCE.MOCK,
      "Missing projectId. Using empty Web payload.",
    );
  }

  try {
    const remoteWeb = await fetchAgencyProjectWeb(normalizedProjectId);
    const normalizedRemoteWeb = normalizeWebPayload(remoteWeb, normalizedProjectId, fallbackInput);
    writeWebToStorage(normalizedProjectId, normalizedRemoteWeb);
    return withDataSource(normalizedRemoteWeb, AGENCY_DATA_SOURCE.DB);
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Web remote fetch failed. Trying local fallback.", {
      projectId: normalizedProjectId,
    });
  }

  const cachedWeb = readWebFromStorage(normalizedProjectId);
  if (cachedWeb) {
    return withDataSource(
      normalizeWebPayload(cachedWeb, normalizedProjectId, fallbackInput),
      AGENCY_DATA_SOURCE.LOCAL_FALLBACK,
      "Using browser localStorage cache.",
    );
  }

  return withDataSource(
    normalizeWebPayload(null, normalizedProjectId, fallbackInput),
    AGENCY_DATA_SOURCE.MOCK,
    "No persisted Web payload available. Using empty defaults.",
  );
};

export const getAgencyProjectAds = async (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "";
  const fallbackInput = await buildAgencyAdsInput(normalizedProjectId);

  if (!normalizedProjectId) {
    return withDataSource(
      normalizeAdsPayload(null, projectId || "", fallbackInput),
      AGENCY_DATA_SOURCE.MOCK,
      "Missing projectId. Using empty Ads payload.",
    );
  }

  try {
    const remoteAds = await fetchAgencyProjectAds(normalizedProjectId);
    const normalizedRemoteAds = normalizeAdsPayload(remoteAds, normalizedProjectId, fallbackInput);
    writeAdsToStorage(normalizedProjectId, normalizedRemoteAds);
    return withDataSource(normalizedRemoteAds, AGENCY_DATA_SOURCE.DB);
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Ads remote fetch failed. Trying local fallback.", {
      projectId: normalizedProjectId,
    });
  }

  const cachedAds = readAdsFromStorage(normalizedProjectId);
  if (cachedAds) {
    return withDataSource(
      normalizeAdsPayload(cachedAds, normalizedProjectId, fallbackInput),
      AGENCY_DATA_SOURCE.LOCAL_FALLBACK,
      "Using browser localStorage cache.",
    );
  }

  return withDataSource(
    normalizeAdsPayload(null, normalizedProjectId, fallbackInput),
    AGENCY_DATA_SOURCE.MOCK,
    "No persisted Ads payload available. Using empty defaults.",
  );
};

export const saveAgencyProjectWeb = async (projectId, payload) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "";
  const fallbackInput = await buildAgencyWebInput(normalizedProjectId);
  const fallbackPayload = normalizeWebPayload({
    projectId: normalizedProjectId,
    output: normalizeAgencyWebV1Output(payload?.output || payload, normalizedProjectId),
    input: fallbackInput,
    persisted: false,
    lastUpdatedAt: new Date().toISOString(),
  }, normalizedProjectId, fallbackInput);

  if (!normalizedProjectId) {
    return withDataSource(
      fallbackPayload,
      AGENCY_DATA_SOURCE.MOCK,
      "Missing projectId. Web payload kept local only.",
    );
  }

  try {
    const remoteWeb = await saveAgencyProjectWebApi(normalizedProjectId, {
      output: fallbackPayload.output,
    });
    const normalizedRemoteWeb = normalizeWebPayload(remoteWeb, normalizedProjectId, fallbackInput);
    writeWebToStorage(normalizedProjectId, normalizedRemoteWeb);
    return withDataSource(normalizedRemoteWeb, AGENCY_DATA_SOURCE.DB);
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Web remote save failed. Persisting to localStorage fallback.", {
      projectId: normalizedProjectId,
    });
  }

  writeWebToStorage(normalizedProjectId, fallbackPayload);
  return withDataSource(
    fallbackPayload,
    AGENCY_DATA_SOURCE.LOCAL_FALLBACK,
    "Remote save unavailable. Persisted in browser localStorage.",
  );
};

export const generateAgencyWebProjectWithAi = async (projectId, webProjectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "";
  const fallbackInput = await buildAgencyWebInput(normalizedProjectId);
  if (!normalizedProjectId || !webProjectId) {
    return withDataSource(
      normalizeWebPayload(null, normalizedProjectId, fallbackInput),
      AGENCY_DATA_SOURCE.MOCK,
      "Project o pagina Web mancanti. Generazione AI non eseguita.",
    );
  }

  const remoteWeb = await generateAgencyWebProjectWithAiApi(normalizedProjectId, webProjectId);
  const normalizedRemoteWeb = normalizeWebPayload(remoteWeb, normalizedProjectId, fallbackInput);
  const enriched = {
    ...normalizedRemoteWeb,
    aiGeneration: remoteWeb?.aiGeneration || null,
  };
  writeWebToStorage(normalizedProjectId, enriched);
  return withDataSource(enriched, AGENCY_DATA_SOURCE.DB);
};

export const generateAgencyWebBlockWithAi = async (projectId, webProjectId, blockKey) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "";
  const fallbackInput = await buildAgencyWebInput(normalizedProjectId);
  if (!normalizedProjectId || !webProjectId || !blockKey) {
    return withDataSource(
      normalizeWebPayload(null, normalizedProjectId, fallbackInput),
      AGENCY_DATA_SOURCE.MOCK,
      "Pagina o blocco Web mancanti. Rigenerazione AI non eseguita.",
    );
  }

  const remoteWeb = await generateAgencyWebBlockWithAiApi(normalizedProjectId, webProjectId, blockKey);
  const normalizedRemoteWeb = normalizeWebPayload(remoteWeb, normalizedProjectId, fallbackInput);
  const enriched = {
    ...normalizedRemoteWeb,
    aiGeneration: remoteWeb?.aiGeneration || null,
  };
  writeWebToStorage(normalizedProjectId, enriched);
  return withDataSource(enriched, AGENCY_DATA_SOURCE.DB);
};

export const saveAgencyProjectAds = async (projectId, payload) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "";
  const fallbackInput = await buildAgencyAdsInput(normalizedProjectId);
  const fallbackPayload = normalizeAdsPayload({
    projectId: normalizedProjectId,
    output: normalizeAgencyAdsV1Output(payload?.output || payload, normalizedProjectId),
    input: fallbackInput,
    persisted: false,
    lastUpdatedAt: new Date().toISOString(),
  }, normalizedProjectId, fallbackInput);

  if (!normalizedProjectId) {
    return withDataSource(
      fallbackPayload,
      AGENCY_DATA_SOURCE.MOCK,
      "Missing projectId. Ads payload kept local only.",
    );
  }

  try {
    const remoteAds = await saveAgencyProjectAdsApi(normalizedProjectId, {
      output: fallbackPayload.output,
    });
    const normalizedRemoteAds = normalizeAdsPayload(remoteAds, normalizedProjectId, fallbackInput);
    writeAdsToStorage(normalizedProjectId, normalizedRemoteAds);
    return withDataSource(normalizedRemoteAds, AGENCY_DATA_SOURCE.DB);
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Ads remote save failed. Persisting to localStorage fallback.", {
      projectId: normalizedProjectId,
    });
  }

  writeAdsToStorage(normalizedProjectId, fallbackPayload);
  return withDataSource(
    fallbackPayload,
    AGENCY_DATA_SOURCE.LOCAL_FALLBACK,
    "Remote save unavailable. Persisted in browser localStorage.",
  );
};

export const generateAgencyAdsAssetWithAi = async (projectId, assetKey) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "";
  const fallbackInput = await buildAgencyAdsInput(normalizedProjectId);
  if (!normalizedProjectId || !assetKey) {
    return withDataSource(
      normalizeAdsPayload(null, normalizedProjectId, fallbackInput),
      AGENCY_DATA_SOURCE.MOCK,
      "Asset Ads mancante. Rigenerazione AI non eseguita.",
    );
  }

  const remoteAds = await generateAgencyAdsAssetWithAiApi(normalizedProjectId, assetKey);
  const normalizedRemoteAds = normalizeAdsPayload(remoteAds, normalizedProjectId, fallbackInput);
  const enriched = {
    ...normalizedRemoteAds,
    aiGeneration: remoteAds?.aiGeneration || null,
  };
  writeAdsToStorage(normalizedProjectId, enriched);
  return withDataSource(enriched, AGENCY_DATA_SOURCE.DB);
};

export const buildAgencyReportInput = async (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "";

  if (!normalizedProjectId) {
    return withDataSource(
      createEmptyAgencyReportV1Input(projectId || ""),
      AGENCY_DATA_SOURCE.MOCK,
      "Missing projectId. Using Reporting input defaults.",
    );
  }

  try {
    const remoteInput = await fetchAgencyProjectReportInput(normalizedProjectId);
    if (remoteInput) {
      return withDataSource(
        normalizeAgencyReportV1Input(remoteInput, normalizedProjectId),
        AGENCY_DATA_SOURCE.DB,
      );
    }
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Reporting input fetch failed. Composing input from Agency modules.", {
      projectId: normalizedProjectId,
    });
  }

  const [overview, discovery, web, ads, alerts, opportunities, tasks] = await Promise.all([
    getAgencyProjectOverview(normalizedProjectId),
    getAgencyProjectDiscovery(normalizedProjectId),
    getAgencyProjectWeb(normalizedProjectId),
    getAgencyProjectAds(normalizedProjectId),
    getAgencyProjectAlerts(normalizedProjectId),
    getAgencyProjectOpportunities(normalizedProjectId),
    getAgencyProjectTasks(normalizedProjectId),
  ]);
  const overviewMeta = readAgencyDataMeta(overview);
  const discoveryMeta = readAgencyDataMeta(discovery);
  const webMeta = readAgencyDataMeta(web);
  const adsMeta = readAgencyDataMeta(ads);
  const alertsMeta = readAgencyDataMeta(alerts);
  const opportunitiesMeta = readAgencyDataMeta(opportunities);
  const tasksMeta = readAgencyDataMeta(tasks);

  return withDataSource({
    projectId: normalizedProjectId,
    workspaceId: "",
    projectType: overview?.projectType
      ? { key: overview.projectType.key, label: overview.projectType.label }
      : { key: "marketing_full", label: "Marketing Full" },
    scopePurchased: overview?.scopePurchased || [],
    activeModules: overview?.activeModules || [],
    contextSummary: overview?.contextSummary || discovery?.contextSummary || "",
    discovery: {
      sections: discovery?.sections || { ...DEFAULT_DISCOVERY_SECTIONS },
      notes: discovery?.notes || "",
      brief: discovery?.brief || "",
      contextSummary: discovery?.contextSummary || "",
      lastUpdatedAt: discovery?.lastUpdatedAt || null,
    },
    web: {
      available: Boolean(web?.persisted || web?.output?.lastGeneratedAt),
      pageGoal: web?.output?.pageGoal || "",
      pageType: web?.output?.pageType || "",
      targetSummary: web?.output?.targetSummary || "",
      offerSummary: web?.output?.offerSummary || "",
      valueProp: web?.output?.valueProp || "",
      ctaPrimary: web?.output?.ctaSet?.primary || "",
      trustElements: web?.output?.trustElements || [],
      sectionPlanCount: Array.isArray(web?.output?.sectionPlan) ? web.output.sectionPlan.length : 0,
      previewAvailable: typeof web?.output?.previewHtmlBase === "string" && web.output.previewHtmlBase.trim().length > 0,
      lastGeneratedAt: web?.output?.lastGeneratedAt || null,
    },
    ads: {
      available: Boolean(ads?.persisted || ads?.output?.lastGeneratedAt),
      channelScope: ads?.output?.channelScope || "none",
      offerAngle: ads?.output?.offerAngle || "",
      google: {
        keywordSeedsCount: Array.isArray(ads?.output?.googleAds?.keywordSeeds) ? ads.output.googleAds.keywordSeeds.length : 0,
        landingRecommendation: ads?.output?.googleAds?.landingRecommendation || "",
      },
      meta: {
        creativeAnglesCount: Array.isArray(ads?.output?.metaAds?.creativeAngles) ? ads.output.metaAds.creativeAngles.length : 0,
        assetRequestsCount: Array.isArray(ads?.output?.metaAds?.assetRequests) ? ads.output.metaAds.assetRequests.length : 0,
        primaryTextsCount: Array.isArray(ads?.output?.metaAds?.primaryTexts) ? ads.output.metaAds.primaryTexts.length : 0,
      },
      lastGeneratedAt: ads?.output?.lastGeneratedAt || null,
    },
    alerts: Array.isArray(alerts) ? alerts : [],
    opportunities: Array.isArray(opportunities) ? opportunities : [],
    tasks: Array.isArray(tasks) ? tasks : [],
    dataSourceSummary: {
      dominantSource: chooseDominantSource([
        overviewMeta.source,
        discoveryMeta.source,
        webMeta.source,
        adsMeta.source,
        alertsMeta.source,
        opportunitiesMeta.source,
        tasksMeta.source,
      ]),
      hasDiscovery: Boolean(discovery?.contextSummary),
      hasWeb: Boolean(web?.persisted || web?.output?.lastGeneratedAt),
      hasAds: Boolean(ads?.persisted || ads?.output?.lastGeneratedAt),
      hasAlerts: Array.isArray(alerts) && alerts.length > 0,
      hasOpportunities: Array.isArray(opportunities) && opportunities.length > 0,
      hasTasks: Array.isArray(tasks) && tasks.length > 0,
    },
  }, chooseDominantSource([
    overviewMeta.source,
    discoveryMeta.source,
    webMeta.source,
    adsMeta.source,
    alertsMeta.source,
    opportunitiesMeta.source,
    tasksMeta.source,
  ]), "Composed from overview/discovery/web/ads/alerts/opportunities/tasks.");
};

export const getAgencyProjectReport = async (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "";
  const fallbackInput = await buildAgencyReportInput(normalizedProjectId);

  if (!normalizedProjectId) {
    return withDataSource(
      normalizeReportPayload(null, projectId || "", fallbackInput),
      AGENCY_DATA_SOURCE.MOCK,
      "Missing projectId. Using empty Report payload.",
    );
  }

  try {
    const remoteReport = await fetchAgencyProjectReport(normalizedProjectId);
    const normalizedRemoteReport = normalizeReportPayload(remoteReport, normalizedProjectId, fallbackInput);
    writeReportsToStorage(normalizedProjectId, normalizedRemoteReport);
    return withDataSource(normalizedRemoteReport, AGENCY_DATA_SOURCE.DB);
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Report remote fetch failed. Trying local fallback.", {
      projectId: normalizedProjectId,
    });
  }

  const cachedReport = readReportsFromStorage(normalizedProjectId);
  if (cachedReport) {
    return withDataSource(
      normalizeReportPayload(cachedReport, normalizedProjectId, fallbackInput),
      AGENCY_DATA_SOURCE.LOCAL_FALLBACK,
      "Using browser localStorage cache.",
    );
  }

  return withDataSource(
    normalizeReportPayload(null, normalizedProjectId, fallbackInput),
    AGENCY_DATA_SOURCE.MOCK,
    "No persisted Report payload available. Using empty defaults.",
  );
};

export const saveAgencyProjectReport = async (projectId, payload) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "";
  const fallbackInput = await buildAgencyReportInput(normalizedProjectId);
  const fallbackPayload = normalizeReportPayload({
    projectId: normalizedProjectId,
    output: normalizeAgencyReportV1Output(payload?.output || payload, normalizedProjectId),
    input: fallbackInput,
    persisted: false,
    lastUpdatedAt: new Date().toISOString(),
  }, normalizedProjectId, fallbackInput);

  if (!normalizedProjectId) {
    return withDataSource(
      fallbackPayload,
      AGENCY_DATA_SOURCE.MOCK,
      "Missing projectId. Report payload kept local only.",
    );
  }

  try {
    const remoteReport = await saveAgencyProjectReportApi(normalizedProjectId, {
      output: fallbackPayload.output,
    });
    const normalizedRemoteReport = normalizeReportPayload(remoteReport, normalizedProjectId, fallbackInput);
    writeReportsToStorage(normalizedProjectId, normalizedRemoteReport);
    return withDataSource(normalizedRemoteReport, AGENCY_DATA_SOURCE.DB);
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Report remote save failed. Persisting to localStorage fallback.", {
      projectId: normalizedProjectId,
    });
  }

  writeReportsToStorage(normalizedProjectId, fallbackPayload);
  return withDataSource(
    fallbackPayload,
    AGENCY_DATA_SOURCE.LOCAL_FALLBACK,
    "Remote save unavailable. Persisted in browser localStorage.",
  );
};

export const buildAgencyClientReportInput = async (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "";

  if (!normalizedProjectId) {
    return withDataSource(
      createEmptyAgencyClientReportV1Input(projectId || ""),
      AGENCY_DATA_SOURCE.MOCK,
      "Missing projectId. Using Client Report input defaults.",
    );
  }

  try {
    const remoteInput = await fetchAgencyProjectClientReportInput(normalizedProjectId);
    if (remoteInput) {
      return withDataSource(
        normalizeAgencyClientReportV1Input(remoteInput, normalizedProjectId),
        AGENCY_DATA_SOURCE.DB,
      );
    }
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Client Report input fetch failed. Composing input from internal report and diagnosis.", {
      projectId: normalizedProjectId,
    });
  }

  const [report, diagnosis] = await Promise.all([
    getAgencyProjectReport(normalizedProjectId),
    getAgencyProjectDiagnosis(normalizedProjectId),
  ]);
  const reportMeta = readAgencyDataMeta(report);
  const diagnosisMeta = readAgencyDataMeta(diagnosis);

  return withDataSource({
    projectId: normalizedProjectId,
    workspaceId: report?.input?.workspaceId || "",
    projectName: report?.output?.projectSnapshot?.projectName || normalizedProjectId,
    projectTypeLabel: report?.output?.projectSnapshot?.projectTypeLabel || "Marketing Full",
    projectStatus: report?.output?.projectSnapshot?.projectStatus || "draft",
    projectPriority: report?.output?.projectSnapshot?.projectPriority || null,
    contextSummary: report?.output?.projectSnapshot?.contextSummary || report?.input?.contextSummary || "",
    scopeSummary: Array.isArray(report?.output?.projectSnapshot?.scopeSummary) ? report.output.projectSnapshot.scopeSummary : [],
    report: {
      reportStatus: report?.output?.reportStatus || "draft",
      discoverySummary: report?.output?.discoverySummary || { summary: "", highlights: [], status: "missing" },
      webSummary: report?.output?.webSummary || { summary: "", highlights: [], status: "missing" },
      adsSummary: report?.output?.adsSummary || { summary: "", highlights: [], status: "missing" },
      topAlerts: Array.isArray(report?.output?.topAlerts) ? report.output.topAlerts : [],
      topOpportunities: Array.isArray(report?.output?.topOpportunities) ? report.output.topOpportunities : [],
      topTasks: Array.isArray(report?.output?.topTasks) ? report.output.topTasks : [],
      nextSteps: Array.isArray(report?.output?.nextSteps) ? report.output.nextSteps : [],
      dataSourceSummary: {
        dominantSource: report?.output?.dataSourceSummary?.dominantSource || "mock",
      },
    },
    diagnosis: diagnosis?.output
      ? {
          diagnosisStatus: diagnosis.output.diagnosisStatus,
          diagnosisSummary: diagnosis.output.diagnosisSummary,
          criticalFindings: Array.isArray(diagnosis.output.criticalFindings) ? diagnosis.output.criticalFindings : [],
          recommendedActions: Array.isArray(diagnosis.output.recommendedActions) ? diagnosis.output.recommendedActions : [],
          interventionPriority: diagnosis.output.interventionPriority || "medium",
          confidenceLevel: diagnosis.output.confidenceLevel || "low",
        }
      : null,
    web: {
      available: Boolean(report?.input?.web?.available),
      pageGoal: report?.input?.web?.pageGoal || "",
      pageType: report?.input?.web?.pageType || "",
      ctaPrimary: report?.input?.web?.ctaPrimary || "",
      trustElements: Array.isArray(report?.input?.web?.trustElements) ? report.input.web.trustElements : [],
    },
    ads: {
      available: Boolean(report?.input?.ads?.available),
      channelScope: report?.input?.ads?.channelScope || "none",
      offerAngle: report?.input?.ads?.offerAngle || "",
    },
  }, chooseDominantSource([reportMeta.source, diagnosisMeta.source]), "Composed from internal report and diagnosis.");
};

export const getAgencyProjectClientReport = async (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "";
  const fallbackInput = await buildAgencyClientReportInput(normalizedProjectId);

  if (!normalizedProjectId) {
    return withDataSource(
      normalizeClientReportPayload(null, projectId || "", fallbackInput),
      AGENCY_DATA_SOURCE.MOCK,
      "Missing projectId. Using empty Client Report payload.",
    );
  }

  try {
    const remotePayload = await fetchAgencyProjectClientReport(normalizedProjectId);
    const normalizedRemotePayload = normalizeClientReportPayload(remotePayload, normalizedProjectId, fallbackInput);
    writeClientReportToStorage(normalizedProjectId, normalizedRemotePayload);
    return withDataSource(normalizedRemotePayload, AGENCY_DATA_SOURCE.DB);
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Client Report remote fetch failed. Trying local fallback.", {
      projectId: normalizedProjectId,
    });
  }

  const cachedPayload = readClientReportFromStorage(normalizedProjectId);
  if (cachedPayload) {
    return withDataSource(
      normalizeClientReportPayload(cachedPayload, normalizedProjectId, fallbackInput),
      AGENCY_DATA_SOURCE.LOCAL_FALLBACK,
      "Using browser localStorage cache.",
    );
  }

  return withDataSource(
    normalizeClientReportPayload(null, normalizedProjectId, fallbackInput),
    AGENCY_DATA_SOURCE.MOCK,
    "No persisted Client Report payload available. Using empty defaults.",
  );
};

export const saveAgencyProjectClientReport = async (projectId, payload) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "";
  const fallbackInput = await buildAgencyClientReportInput(normalizedProjectId);
  const fallbackPayload = normalizeClientReportPayload({
    projectId: normalizedProjectId,
    output: normalizeAgencyClientReportV1Output(payload?.output || payload),
    input: fallbackInput,
    persisted: false,
    lastUpdatedAt: new Date().toISOString(),
  }, normalizedProjectId, fallbackInput);

  if (!normalizedProjectId) {
    return withDataSource(
      fallbackPayload,
      AGENCY_DATA_SOURCE.MOCK,
      "Missing projectId. Client Report payload kept local only.",
    );
  }

  try {
    const remotePayload = await saveAgencyProjectClientReportApi(normalizedProjectId, {
      output: fallbackPayload.output,
    });
    const normalizedRemotePayload = normalizeClientReportPayload(remotePayload, normalizedProjectId, fallbackInput);
    writeClientReportToStorage(normalizedProjectId, normalizedRemotePayload);
    return withDataSource(normalizedRemotePayload, AGENCY_DATA_SOURCE.DB);
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Client Report remote save failed. Persisting to localStorage fallback.", {
      projectId: normalizedProjectId,
    });
  }

  writeClientReportToStorage(normalizedProjectId, fallbackPayload);
  return withDataSource(
    fallbackPayload,
    AGENCY_DATA_SOURCE.LOCAL_FALLBACK,
    "Remote save unavailable. Persisted in browser localStorage.",
  );
};

export const buildAgencyDiagnosisInput = async (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "";

  if (!normalizedProjectId) {
    return withDataSource(
      createEmptyAgencyDiagnosisV1Input(projectId || ""),
      AGENCY_DATA_SOURCE.MOCK,
      "Missing projectId. Using Diagnosis input defaults.",
    );
  }

  try {
    const remoteInput = await fetchAgencyProjectDiagnosisInput(normalizedProjectId);
    if (remoteInput) {
      return withDataSource(
        normalizeAgencyDiagnosisV1Input(remoteInput, normalizedProjectId),
        AGENCY_DATA_SOURCE.DB,
      );
    }
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Diagnosis input fetch failed. Composing input from Agency modules.", {
      projectId: normalizedProjectId,
    });
  }

  const [overview, discovery, web, ads, report, alerts, opportunities, tasks] = await Promise.all([
    getAgencyProjectOverview(normalizedProjectId),
    getAgencyProjectDiscovery(normalizedProjectId),
    getAgencyProjectWeb(normalizedProjectId),
    getAgencyProjectAds(normalizedProjectId),
    getAgencyProjectReport(normalizedProjectId),
    getAgencyProjectAlerts(normalizedProjectId),
    getAgencyProjectOpportunities(normalizedProjectId),
    getAgencyProjectTasks(normalizedProjectId),
  ]);
  const overviewMeta = readAgencyDataMeta(overview);
  const discoveryMeta = readAgencyDataMeta(discovery);
  const webMeta = readAgencyDataMeta(web);
  const adsMeta = readAgencyDataMeta(ads);
  const reportMeta = readAgencyDataMeta(report);
  const alertsMeta = readAgencyDataMeta(alerts);
  const opportunitiesMeta = readAgencyDataMeta(opportunities);
  const tasksMeta = readAgencyDataMeta(tasks);

  return withDataSource({
    projectId: normalizedProjectId,
    workspaceId: "",
    projectName: report?.output?.projectSnapshot?.projectName || normalizedProjectId,
    projectStatus: report?.output?.projectSnapshot?.projectStatus || null,
    projectPriority: report?.output?.projectSnapshot?.projectPriority || null,
    projectType: overview?.projectType
      ? { key: overview.projectType.key, label: overview.projectType.label }
      : { key: "marketing_full", label: "Marketing Full" },
    scopePurchased: overview?.scopePurchased || [],
    activeModules: overview?.activeModules || [],
    contextSummary: overview?.contextSummary || discovery?.contextSummary || report?.output?.projectSnapshot?.contextSummary || "",
    discovery: {
      sections: discovery?.sections || { ...DEFAULT_DISCOVERY_SECTIONS },
      notes: discovery?.notes || "",
      brief: discovery?.brief || "",
      contextSummary: discovery?.contextSummary || "",
      persisted: Boolean(discovery?.persisted),
      lastUpdatedAt: discovery?.lastUpdatedAt || null,
    },
    web: {
      available: Boolean(web?.persisted || web?.output?.lastGeneratedAt || web?.output?.sectionPlan?.length),
      persisted: Boolean(web?.persisted),
      pageGoal: web?.output?.pageGoal || "",
      pageType: web?.output?.pageType || "",
      targetSummary: web?.output?.targetSummary || "",
      offerSummary: web?.output?.offerSummary || "",
      valueProp: web?.output?.valueProp || "",
      ctaPrimary: web?.output?.ctaSet?.primary || "",
      trustElements: Array.isArray(web?.output?.trustElements) ? web.output.trustElements : [],
      sectionPlanCount: Array.isArray(web?.output?.sectionPlan) ? web.output.sectionPlan.length : 0,
      previewAvailable: typeof web?.output?.previewHtmlBase === "string" && web.output.previewHtmlBase.trim().length > 0,
      lastGeneratedAt: web?.output?.lastGeneratedAt || null,
    },
    ads: {
      available: Boolean(
        ads?.persisted
        || ads?.output?.lastGeneratedAt
        || ads?.output?.googleAds?.keywordSeeds?.length
        || ads?.output?.metaAds?.primaryTexts?.length
      ),
      persisted: Boolean(ads?.persisted),
      channelScope: ads?.output?.channelScope || "none",
      campaignGoal: ads?.output?.campaignGoal || "",
      offerAngle: ads?.output?.offerAngle || "",
      google: {
        keywordSeedsCount: Array.isArray(ads?.output?.googleAds?.keywordSeeds) ? ads.output.googleAds.keywordSeeds.length : 0,
        landingRecommendation: ads?.output?.googleAds?.landingRecommendation || "",
      },
      meta: {
        creativeAnglesCount: Array.isArray(ads?.output?.metaAds?.creativeAngles) ? ads.output.metaAds.creativeAngles.length : 0,
        assetRequestsCount: Array.isArray(ads?.output?.metaAds?.assetRequests) ? ads.output.metaAds.assetRequests.length : 0,
        primaryTextsCount: Array.isArray(ads?.output?.metaAds?.primaryTexts) ? ads.output.metaAds.primaryTexts.length : 0,
      },
      lastGeneratedAt: ads?.output?.lastGeneratedAt || null,
    },
    report: {
      available: Boolean(report?.persisted || report?.output?.generatedAt || report?.output?.updatedAt),
      persisted: Boolean(report?.persisted),
      reportStatus: report?.output?.reportStatus || "draft",
      nextSteps: Array.isArray(report?.output?.nextSteps) ? report.output.nextSteps : [],
      topAlertsCount: Array.isArray(report?.output?.topAlerts) ? report.output.topAlerts.length : 0,
      topOpportunitiesCount: Array.isArray(report?.output?.topOpportunities) ? report.output.topOpportunities.length : 0,
      topTasksCount: Array.isArray(report?.output?.topTasks) ? report.output.topTasks.length : 0,
      updatedAt: report?.lastUpdatedAt || report?.output?.updatedAt || null,
    },
    alerts: Array.isArray(alerts) ? alerts : [],
    opportunities: Array.isArray(opportunities) ? opportunities : [],
    tasks: Array.isArray(tasks) ? tasks : [],
    dataSourceSummary: {
      dominantSource: chooseDominantSource([
        overviewMeta.source,
        discoveryMeta.source,
        webMeta.source,
        adsMeta.source,
        reportMeta.source,
        alertsMeta.source,
        opportunitiesMeta.source,
        tasksMeta.source,
      ]),
      hasDiscovery: Boolean(discovery?.persisted || discovery?.contextSummary),
      hasWeb: Boolean(web?.persisted || web?.output?.lastGeneratedAt || web?.output?.sectionPlan?.length),
      hasAds: Boolean(ads?.persisted || ads?.output?.lastGeneratedAt || ads?.output?.channelScope !== "none"),
      hasReport: Boolean(report?.persisted || report?.output?.generatedAt || report?.output?.updatedAt),
      hasAlerts: Array.isArray(alerts) && alerts.length > 0,
      hasOpportunities: Array.isArray(opportunities) && opportunities.length > 0,
      hasTasks: Array.isArray(tasks) && tasks.length > 0,
    },
  }, chooseDominantSource([
    overviewMeta.source,
    discoveryMeta.source,
    webMeta.source,
    adsMeta.source,
    reportMeta.source,
    alertsMeta.source,
    opportunitiesMeta.source,
    tasksMeta.source,
  ]), "Composed from overview/discovery/web/ads/report/alerts/opportunities/tasks.");
};

export const getAgencyProjectDiagnosis = async (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "";
  const fallbackInput = await buildAgencyDiagnosisInput(normalizedProjectId);

  if (!normalizedProjectId) {
    return withDataSource(
      normalizeDiagnosisPayload(null, projectId || "", fallbackInput),
      AGENCY_DATA_SOURCE.MOCK,
      "Missing projectId. Using empty Diagnosis payload.",
    );
  }

  try {
    const remoteDiagnosis = await fetchAgencyProjectDiagnosis(normalizedProjectId);
    const normalizedRemoteDiagnosis = normalizeDiagnosisPayload(remoteDiagnosis, normalizedProjectId, fallbackInput);
    writeDiagnosisToStorage(normalizedProjectId, normalizedRemoteDiagnosis);
    return withDataSource(normalizedRemoteDiagnosis, AGENCY_DATA_SOURCE.DB);
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Diagnosis remote fetch failed. Trying local fallback.", {
      projectId: normalizedProjectId,
    });
  }

  const cachedDiagnosis = readDiagnosisFromStorage(normalizedProjectId);
  if (cachedDiagnosis) {
    return withDataSource(
      normalizeDiagnosisPayload(cachedDiagnosis, normalizedProjectId, fallbackInput),
      AGENCY_DATA_SOURCE.LOCAL_FALLBACK,
      "Using browser localStorage cache.",
    );
  }

  return withDataSource(
    normalizeDiagnosisPayload(null, normalizedProjectId, fallbackInput),
    AGENCY_DATA_SOURCE.MOCK,
    "No persisted Diagnosis payload available. Using empty defaults.",
  );
};

export const saveAgencyProjectDiagnosis = async (projectId, payload) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "";
  const fallbackInput = await buildAgencyDiagnosisInput(normalizedProjectId);
  const fallbackPayload = normalizeDiagnosisPayload({
    projectId: normalizedProjectId,
    output: normalizeAgencyDiagnosisV1Output(payload?.output || payload, normalizedProjectId),
    input: fallbackInput,
    persisted: false,
    lastUpdatedAt: new Date().toISOString(),
  }, normalizedProjectId, fallbackInput);

  if (!normalizedProjectId) {
    return withDataSource(
      fallbackPayload,
      AGENCY_DATA_SOURCE.MOCK,
      "Missing projectId. Diagnosis payload kept local only.",
    );
  }

  try {
    const remoteDiagnosis = await saveAgencyProjectDiagnosisApi(normalizedProjectId, {
      output: fallbackPayload.output,
    });
    const normalizedRemoteDiagnosis = normalizeDiagnosisPayload(remoteDiagnosis, normalizedProjectId, fallbackInput);
    writeDiagnosisToStorage(normalizedProjectId, normalizedRemoteDiagnosis);
    return withDataSource(normalizedRemoteDiagnosis, AGENCY_DATA_SOURCE.DB);
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Diagnosis remote save failed. Persisting to localStorage fallback.", {
      projectId: normalizedProjectId,
    });
  }

  writeDiagnosisToStorage(normalizedProjectId, fallbackPayload);
  return withDataSource(
    fallbackPayload,
    AGENCY_DATA_SOURCE.LOCAL_FALLBACK,
    "Remote save unavailable. Persisted in browser localStorage.",
  );
};

export const getAgencyWorkspaceReports = async () => {
  try {
    const remoteReports = await fetchAgencyWorkspaceReports();
    if (Array.isArray(remoteReports)) {
      return withDataSource(remoteReports, AGENCY_DATA_SOURCE.DB);
    }
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Workspace reports remote fetch failed. Trying local fallback.", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  const cachedReports = readAllReportsFromStorage()
    .map((entry) => ({
      projectId: entry.output.projectId || entry.input.projectId,
      projectName: entry.output.projectSnapshot.projectName || entry.input.projectName || `Project ${entry.output.projectId || entry.input.projectId}`,
      projectTypeLabel: entry.output.projectSnapshot.projectTypeLabel || entry.input.projectType?.label || "Marketing Full",
      projectStatus: entry.output.projectSnapshot.projectStatus || entry.input.projectStatus || "draft",
      projectPriority: entry.output.projectSnapshot.projectPriority || entry.input.projectPriority || null,
      reportStatus: entry.output.reportStatus || "draft",
      persisted: Boolean(entry.persisted),
      hasClientReport: Boolean(entry.output.clientReport?.generatedAt),
      clientReportUpdatedAt: entry.output.clientReport?.updatedAt || null,
      updatedAt: entry.lastUpdatedAt || entry.output.updatedAt || null,
      generatedAt: entry.output.generatedAt || null,
      topAlerts: Array.isArray(entry.output.topAlerts) ? entry.output.topAlerts : [],
      topOpportunities: Array.isArray(entry.output.topOpportunities) ? entry.output.topOpportunities : [],
      topTasks: Array.isArray(entry.output.topTasks) ? entry.output.topTasks : [],
      nextSteps: Array.isArray(entry.output.nextSteps) ? entry.output.nextSteps : [],
      dataSourceSummary: entry.output.dataSourceSummary || createEmptyAgencyReportV1Output().dataSourceSummary,
    }))
    .filter((entry) => entry.projectId);

  if (cachedReports.length > 0) {
    return withDataSource(
      cachedReports,
      AGENCY_DATA_SOURCE.LOCAL_FALLBACK,
      "Workspace reports loaded from browser localStorage cache.",
    );
  }

  return withDataSource(
    [],
    AGENCY_DATA_SOURCE.MOCK,
    "No workspace reports available yet.",
  );
};

export const getAgencyProjectMemory = (projectId) => {
  return withDataSource(
    getMockMemorySummary(projectId),
    AGENCY_DATA_SOURCE.MOCK,
    "Memory page currently uses Agency mock summary.",
  );
};

export const getAgencyProjectTasks = async (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : null;
  if (!normalizedProjectId) {
    return withDataSource(
      buildFallbackTaskList(projectId),
      AGENCY_DATA_SOURCE.LOCAL_FALLBACK,
      "Missing projectId. Using local fallback task list.",
    );
  }

  try {
    const persistedTasks = normalizeTaskList(await fetchAgencyProjectTasks(normalizedProjectId));
    if (persistedTasks && persistedTasks.length > 0) {
      return withDataSource(persistedTasks, inferRemoteListSource(persistedTasks));
    }
    if (persistedTasks) {
      const syncedTasks = normalizeTaskList(await syncAgencyProjectTasks(normalizedProjectId));
      if (syncedTasks) {
        return withDataSource(syncedTasks, inferRemoteListSource(syncedTasks));
      }
    }
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Tasks project read/sync failed. Falling back to local tasks.", {
      projectId: normalizedProjectId,
    });
  }

  logAgencyDataEvent("Tasks resolved with local fallback source.", {
    projectId: normalizedProjectId,
  });
  return withDataSource(
    buildFallbackTaskList(normalizedProjectId),
    AGENCY_DATA_SOURCE.LOCAL_FALLBACK,
    "Remote tasks unavailable. Using local fallback task list.",
  );
};

export const evaluateAgencyOpportunities = async (projectId) => {
  return getAgencyProjectOpportunities(projectId);
};

export const syncAgencyOpportunities = async (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : null;

  if (!normalizedProjectId) {
    return withDataSource(
      [],
      AGENCY_DATA_SOURCE.MOCK,
      "Missing projectId. Opportunity sync skipped.",
    );
  }

  try {
    const syncedOpportunities = normalizeOpportunityList(await syncAgencyProjectOpportunities(normalizedProjectId));
    if (syncedOpportunities) {
      return withDataSource(syncedOpportunities, inferRemoteListSource(syncedOpportunities));
    }
  } catch (error) {
    if (isHardApiFailure(error)) {
      throw error;
    }
    logAgencyDataEvent("Opportunity sync failed. Falling back to project opportunities read.", {
      projectId: normalizedProjectId,
    });
  }

  return getAgencyProjectOpportunities(normalizedProjectId);
};
