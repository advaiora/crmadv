import type {
  AgencyProjectStatus,
  AgencyPriority,
  Prisma,
  ProjectAlertSeverity,
  ProjectAlertStatus,
  ProjectOpportunityStatus,
} from '@prisma/client';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { badRequest, forbidden, internalServerError, notFound } from '../../core/errors.js';
import { requestContext } from '../../core/request-context.js';
import { agencyRepository } from './agency.repository.js';
import { aiUsageRepository } from '../../repositories/ai-usage.repository.js';
import { aiBudgetRepository, AI_BUDGET_DEFAULT_USER } from '../../repositories/ai-budget.repository.js';
import { aiConversationRepository, type ConversationMessageInput } from '../../repositories/ai-conversation.repository.js';
import { broadcastToConversation } from '../realtime/hub.js';
import {
  ENTITY_TYPE_LABEL,
  buildEntitySnapshot,
  entityNotFound,
  extractAttachmentFileText,
  formatAttachmentForPrompt,
  isAttachableEntityType,
  isImageAttachment,
  imagePlaceholderText,
  resolveVisionMediaType,
  buildMultimodalMessages,
  MAX_VISION_IMAGES,
  MAX_VISION_IMAGE_BYTES,
  VISION_IMAGE_TOKEN_ESTIMATE,
  type AttachableEntityType,
  type ChatVisionImage,
} from './chat-attachments.js';
import { rbacRepository } from '../../repositories/rbac.repository.js';
import { moduleRepository } from '../../repositories/module.repository.js';
import {
  resolveAccessibleNavAreas,
  buildNavPromptSection,
  parseNavSuggestions,
  type ChatNavSuggestion,
} from './chat-nav.js';
import {
  CONTEXT_FETCH_LIMIT,
  planContextCompression,
  buildSummaryRequest,
  buildCompressedContext,
  type ContextMessage,
} from './chat-context.js';
import {
  ANTHROPIC_JSON_TOOL_NAME,
  buildAnthropicJsonTool,
  extractAnthropicToolInput,
  isEmptyStructuredPayload,
} from './anthropic-json.js';
import { CHAT_PERMISSIONS } from '../../auth/rbac-catalog.js';
import { departmentRepository } from '../../repositories/department.repository.js';
import { teamRepository } from '../team/team.repository.js';
import { createLoggingOpenAiEmbedder, searchProjectSources, searchClientSources } from '../sources/sources.rag.js';
import { decryptAESGCM, encryptAESGCM } from '../vault/crypto/aesGcm.js';
import { getOrCreateWorkspaceDEK } from '../vault/keys.js';
import { z } from 'zod';
import {
  evaluateAgencyOpportunities,
  type AgencyOpportunityInput,
} from './opportunities/opportunity-engine.js';
import {
  buildAgencyReportSnapshot,
  normalizeAgencyReportOutputFromJson,
  type AgencyReportInput,
  type AgencyReportOutput,
} from './reports/reporting-engine.js';
import {
  buildAgencyClientReportSnapshot,
  normalizeAgencyClientReportOutputFromJson,
  type AgencyClientReportInput,
  type AgencyClientReportOutput,
} from './reports/client-report-engine.js';
import {
  buildAgencyDiagnosisSnapshot,
  normalizeAgencyDiagnosisOutputFromJson,
  type AgencyDiagnosisInput,
  type AgencyDiagnosisOutput,
} from './diagnosis/diagnosis-engine.js';

type AgencyProjectSnapshot = NonNullable<Awaited<ReturnType<typeof agencyRepository.findProjectSnapshot>>>;
type AgencyProjectRecord = NonNullable<Awaited<ReturnType<typeof agencyRepository.findAgencyProject>>>;
type AgencyRuntimeSettingRecord = NonNullable<Awaited<ReturnType<typeof agencyRepository.listAgencyRuntimeSettings>>>[number];

type AgencySeedPayload = {
  projectId: string;
  projectType: {
    key: string;
    label: string;
    description: string;
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
  alerts: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    projectId: string;
  }>;
  opportunities: Array<{
    id: string;
    title: string;
    stage: string;
    estimatedValue: number;
    status?: string;
    category?: string | null;
    type?: string | null;
    rationale?: string | null;
    priority?: string | null;
    score?: number | null;
    impactLevel?: string | null;
    sourceModule?: string | null;
    sourceSignalKey?: string | null;
    dedupKey?: string | null;
    suggestedService?: string | null;
    lastEvaluatedAt?: string | null;
    origin?: string | null;
    projectId: string;
  }>;
  memorySummary: {
    projectId: string;
    lastUpdatedAt: string;
    keyDecisions: string[];
    nextActions: string[];
    knownRisks: string[];
  };
  sources: AgencyProjectSourcesPayload;
  sourceReadiness: ReturnType<typeof buildSourceReadiness>;
  contextSummary: string;
};

type DiscoverySections = {
  businessContext: string;
  projectGoal: string;
  target: string;
  offer: string;
  brandCommunication: string;
  availableMaterials: string;
  technicalAspects: string;
  marketingAcquisition: string;
};

type DiscoveryPayload = {
  sections: DiscoverySections;
  notes: string;
  brief: string;
  contextSummary: string;
  persisted: boolean;
  lastUpdatedAt: string | null;
  sourceReliability?: string;
  usedSources?: string[];
  sectionSources?: Record<string, string[]>;
  confidenceBySection?: Record<string, unknown>;
  aiHistory?: Array<Record<string, unknown>>;
  missingWarnings?: string[];
};

type AgencyAlertItem = {
  id: string;
  title: string;
  severity: string;
  status: string;
  projectId: string;
  reason: string | null;
  origin: string;
};

type AgencyOpportunityItem = {
  id: string;
  title: string;
  stage: string;
  estimatedValue: number;
  status: string;
  projectId: string;
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
};

type AgencyActiveModuleItem = {
  key: string;
  label: string;
  included: boolean;
  suggested: boolean;
  active: boolean;
};

type AgencyTaskItem = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  teamRole: string;
  priority: string;
  status: string;
  sourceType: string;
  dependsOnTaskId: string | null;
  origin: string;
};

type AgencyWebInputPayload = {
  projectId: string;
  projectType: {
    key: string;
    label: string;
    description: string;
  };
  scopePurchased: Array<{
    key: string;
    label: string;
    purchased: boolean;
  }>;
  activeModules: AgencyActiveModuleItem[];
  contextSummary: string;
  discovery: {
    sections: DiscoverySections;
    notes: string;
    contextSummary: string;
    lastUpdatedAt: string | null;
  };
  sources: {
    status: 'missing' | 'partial' | 'ready';
    summary: string;
    usedSources: string[];
    unreadableFiles: string[];
  };
  memorySummary: {
    keyDecisions: string[];
    nextActions: string[];
    knownRisks: string[];
    lastUpdatedAt: string | null;
  };
};

type AgencyWebOutputPayload = {
  projectId: string;
  pageGoal: string;
  pageType: string;
  targetSummary: string;
  offerSummary: string;
  valueProp: string;
  sectionPlan: Array<{
    key: string;
    title: string;
    objective: string;
  }>;
  copyBlocks: {
    headline: string;
    subheadline: string;
    intro: string;
    benefits: string[];
    objectionHandling: string;
  };
  faqItems: string[];
  ctaSet: {
    primary: string;
    secondary: string;
    final: string;
  };
  trustElements: string[];
  wireframe: {
    mode: 'text' | 'visual';
    blocks: string[];
  };
  previewHtmlBase: string;
  webProjects: Array<{
    id: string;
    type: string;
    name: string;
    goal: string;
    target: string;
    primaryCta: string;
    status: string;
    sourceRefs: string[];
    webOutput: Record<string, unknown>;
  }>;
  lastGeneratedAt: string | null;
  aiCache?: Record<string, unknown>;
  aiHistory?: Array<Record<string, unknown>>;
};

type AgencyWebPayload = {
  projectId: string;
  input: AgencyWebInputPayload;
  output: AgencyWebOutputPayload;
  persisted: boolean;
  lastUpdatedAt: string | null;
};

type AgencyAdsInputPayload = {
  projectId: string;
  projectType: {
    key: string;
    label: string;
    description: string;
  };
  scopePurchased: Array<{
    key: string;
    label: string;
    purchased: boolean;
  }>;
  activeModules: AgencyActiveModuleItem[];
  contextSummary: string;
  discovery: {
    sections: DiscoverySections;
    notes: string;
    contextSummary: string;
    lastUpdatedAt: string | null;
  };
  sources: {
    status: 'missing' | 'partial' | 'ready';
    summary: string;
    usedSources: string[];
    unreadableFiles: string[];
  };
  memorySummary: {
    keyDecisions: string[];
    nextActions: string[];
    knownRisks: string[];
    lastUpdatedAt: string | null;
  };
  web: {
    available: boolean;
    pageGoal: string;
    pageType: string;
    targetSummary: string;
    offerSummary: string;
    valueProp: string;
    ctaPrimary: string;
    trustElements: string[];
    landingRecommendationBase: string;
    lastGeneratedAt: string | null;
  };
  alerts: Array<{
    title: string;
    severity: string;
    status: string;
    origin: string;
  }>;
  opportunities: Array<{
    title: string;
    stage: string;
    status: string;
    origin: string;
  }>;
};

type AgencyAdsOutputPayload = {
  projectId: string;
  channelScope: 'google' | 'meta' | 'both';
  campaignGoal: 'lead_generation' | 'sales' | 'traffic' | 'awareness';
  targetingSummary: string;
  offerAngle: string;
  messageHooks: string[];
  adCopyBlocks: {
    google: string[];
    meta: string[];
  };
  assetRequests: string[];
  launchChecklist: Array<{
    key: string;
    label: string;
    channel: string;
    status: string;
  }>;
  notes: string;
  googleAds: {
    campaignType: string;
    campaignStructure: string[];
    adGroups: Array<{
      name: string;
      intent: string;
      keywords: string[];
    }>;
    keywordSeeds: string[];
    negativeSeeds: string[];
    rsaIdeas: Array<{
      headlines: string[];
      descriptions: string[];
    }>;
    extensionsIdeas: string[];
    landingRecommendation: string;
  };
  metaAds: {
    campaignAngle: string;
    audienceIdeas: string[];
    creativeAngles: string[];
    hooks: string[];
    primaryTexts: string[];
    headlines: string[];
    ctaIdeas: string[];
    assetRequests: string[];
  };
  adsProjects: Array<{
    id: string;
    channel: string;
    campaignType: string;
    name: string;
    goal: string;
    linkedWebProjectId: string;
    status: string;
    sourceRefs: string[];
    adsOutput: Record<string, unknown>;
  }>;
  lastGeneratedAt: string | null;
  aiCache?: Record<string, unknown>;
  aiHistory?: Array<Record<string, unknown>>;
};

type AgencyAdsPayload = {
  projectId: string;
  input: AgencyAdsInputPayload;
  output: AgencyAdsOutputPayload;
  persisted: boolean;
  lastUpdatedAt: string | null;
};

type AgencyReportInputPayload = AgencyReportInput;

type AgencyReportOutputPayload = AgencyReportOutput;

type AgencyReportPayload = {
  projectId: string;
  input: AgencyReportInputPayload;
  output: AgencyReportOutputPayload;
  persisted: boolean;
  lastUpdatedAt: string | null;
};

type AgencyWorkspaceReportItemPayload = {
  projectId: string;
  projectName: string;
  projectTypeLabel: string;
  projectStatus: string;
  projectPriority: string | null;
  reportStatus: string;
  persisted: boolean;
  hasClientReport: boolean;
  clientReportUpdatedAt: string | null;
  updatedAt: string | null;
  generatedAt: string | null;
  topAlerts: AgencyReportOutputPayload['topAlerts'];
  topOpportunities: AgencyReportOutputPayload['topOpportunities'];
  topTasks: AgencyReportOutputPayload['topTasks'];
  nextSteps: string[];
  dataSourceSummary: AgencyReportOutputPayload['dataSourceSummary'];
};

type AgencyClientReportInputPayload = AgencyClientReportInput;

type AgencyClientReportOutputPayload = AgencyClientReportOutput;

type AgencyClientReportPayload = {
  projectId: string;
  input: AgencyClientReportInputPayload;
  output: AgencyClientReportOutputPayload;
  persisted: boolean;
  lastUpdatedAt: string | null;
};

type AgencyDiagnosisInputPayload = AgencyDiagnosisInput;

type AgencyDiagnosisOutputPayload = AgencyDiagnosisOutput;

type AgencyDiagnosisPayload = {
  projectId: string;
  input: AgencyDiagnosisInputPayload;
  output: AgencyDiagnosisOutputPayload;
  persisted: boolean;
  lastUpdatedAt: string | null;
};

type AgencyProjectTypeDefinition = {
  key: string;
  label: string;
  description: string;
};

type AgencyProjectScopeMap = {
  website: boolean;
  landing_page: boolean;
  google_ads: boolean;
  meta_ads: boolean;
  seo: boolean;
  reporting: boolean;
  diagnosis: boolean;
};

type AgencyUploadedFileSource = {
  id: string;
  name: string;
  originalName?: string;
  type: string;
  mimeType?: string;
  size: number;
  extension?: string;
  storagePath?: string;
  status: 'uploaded' | 'parsed' | 'partial' | 'failed' | 'metadata_only';
  source: string;
  notes: string;
  uploadedAt?: string;
  parseStatus?: 'not_parsed' | 'parsed' | 'partial' | 'failed' | 'unsupported';
  extractedTextPreview?: string;
  extractedTextLength?: number;
  extractedTextHash?: string;
  parsedAt?: string;
  parseErrorCode?: string;
  parseError?: string;
  manualText?: string;
  markedUseful?: boolean;
};

type AgencyCompetitorSource = {
  id: string;
  name: string;
  url: string;
  source: 'manual' | 'auto_search' | 'ai_search' | 'mock' | 'imported';
  status: 'suggested' | 'confirmed' | 'rejected';
  reason: string;
  addedAt: string | null;
};

type AgencyCompetitorSearchSuggestion = AgencyCompetitorSource & {
  confidence?: number;
};

type AgencyProjectUrlSource = {
  id: string;
  label: string;
  type: 'website' | 'landing' | 'service_page' | 'instagram' | 'facebook' | 'linkedin' | 'youtube' | 'tiktok' | 'google_business' | 'other';
  url: string;
  status: 'active' | 'ignored';
  notes: string;
  addedAt: string | null;
};

type AgencyProjectSourcesPayload = {
  websiteUrl: string;
  primaryWebsiteUrl: string;
  urls: AgencyProjectUrlSource[];
  competitorUrls: string[];
  competitors: AgencyCompetitorSource[];
  uploadedFiles: AgencyUploadedFileSource[];
  manualNotes: string;
  sourceType: string;
  sourceStatus: 'missing' | 'partial' | 'ready';
  sourceSummary: string;
  lastSourceUpdateAt: string | null;
  sourceQuality?: 'missing' | 'low' | 'medium' | 'high';
  missingSourceWarnings?: string[];
  usedSources?: string[];
  unreadableFiles?: string[];
};

type AgencyProjectPayload = {
  id: string;
  name: string;
  clientId: string | null;
  clientName: string | null;
  projectType: AgencyProjectTypeDefinition | null;
  goal: string;
  scopePurchased: AgencyProjectScopeMap;
  statusAgency: string;
  priorityAgency: string;
  activeModules: AgencyActiveModuleItem[];
  createdAt: string | null;
  updatedAt: string | null;
  source: string;
  sources: AgencyProjectSourcesPayload;
  sourceReadiness: {
    status: 'missing' | 'partial' | 'ready';
    summary: string;
    usedSources: string[];
    isFallbackOnly: boolean;
    lastSourceUpdateAt: string | null;
  };
  dataReadiness: {
    hasMemory: boolean;
    hasDiscovery: boolean;
    hasWeb: boolean;
    hasAds: boolean;
    hasReports: boolean;
    hasDiagnosis: boolean;
  };
};

type AgencyProjectCreatePayload = {
  name: string;
  clientId?: string;
  clientName?: string;
  projectType: string;
  goal: string;
  scopePurchased: AgencyProjectScopeMap;
  priorityAgency: AgencyPriority;
  websiteUrl?: string;
  competitorUrls?: string[];
  uploadedFiles?: AgencyUploadedFileSource[];
  manualNotes?: string;
  hasMaterialsToAttach?: boolean;
};

type AgencyOpportunityInputPayload = {
  projectId: string;
  projectType: {
    key: string;
    label: string;
    description: string;
  };
  scopePurchased: Array<{
    key: string;
    label: string;
    purchased: boolean;
  }>;
  activeModules: AgencyActiveModuleItem[];
  contextSummary: string;
  discovery: {
    sections: DiscoverySections;
    notes: string;
    contextSummary: string;
    lastUpdatedAt: string | null;
    completeness: {
      hasBusinessContext: boolean;
      hasProjectGoal: boolean;
      hasTarget: boolean;
      hasOffer: boolean;
      hasTechnicalAspects: boolean;
      hasMarketingAcquisition: boolean;
      hasTrackingSignal: boolean;
    };
  };
  web: {
    available: boolean;
    pageGoal: string;
    pageType: string;
    targetSummary: string;
    offerSummary: string;
    valueProp: string;
    ctaPrimary: string;
    trustElements: string[];
    sectionPlanCount: number;
    lastGeneratedAt: string | null;
    output: AgencyWebOutputPayload | null;
  };
  ads: {
    available: boolean;
    channelScope: 'google' | 'meta' | 'both' | 'none';
    campaignGoal: AgencyAdsOutputPayload['campaignGoal'] | null;
    targetingSummary: string;
    offerAngle: string;
    messageHooks: string[];
    assetRequests: string[];
    googleKeywordSeedsCount: number;
    metaCreativeAnglesCount: number;
    metaAssetRequestsCount: number;
    lastGeneratedAt: string | null;
    output: AgencyAdsOutputPayload | null;
  };
  alerts: AgencyAlertItem[];
  tasks: AgencyTaskItem[];
  dataCompleteness: {
    hasDiscovery: boolean;
    hasContextSummary: boolean;
    hasWebOutput: boolean;
    hasAdsOutput: boolean;
    hasAlerts: boolean;
    hasTasks: boolean;
    hasActiveModules: boolean;
    hasTrustElements: boolean;
    hasPrimaryCta: boolean;
  };
};

const DISCOVERY_MAX_FIELD_LENGTH = 4000;
const WEB_MAX_FIELD_LENGTH = 4000;
const WEB_PAGE_TYPES = new Set(['landing', 'website', 'homepage', 'service_page', 'ecommerce_lite']);
const ADS_CHANNEL_SCOPES = new Set(['google', 'meta', 'both']);
const ADS_CAMPAIGN_GOALS = new Set(['lead_generation', 'sales', 'traffic', 'awareness']);
const AGENCY_PROJECT_TYPES = [
  {
    key: 'website',
    label: 'Website',
    description: 'Progetto orientato a sito, UX e conversione web.',
  },
  {
    key: 'landing_page',
    label: 'Landing Page',
    description: 'Progetto focalizzato su landing page dedicata e conversione.',
  },
  {
    key: 'marketing_full',
    label: 'Marketing Full',
    description: 'Progetto full-funnel con discovery, web, ads e reporting.',
  },
  {
    key: 'google_ads',
    label: 'Google Ads',
    description: 'Progetto focalizzato su acquisizione paid search.',
  },
  {
    key: 'meta_ads',
    label: 'Meta Ads',
    description: 'Progetto focalizzato su campagne Meta e creativita.',
  },
  {
    key: 'google_meta_ads',
    label: 'Google + Meta Ads',
    description: 'Progetto performance su advertising Google e Meta.',
  },
  {
    key: 'local_ads',
    label: 'Local Ads',
    description: 'Progetto advertising locale con focus su lead e store visit.',
  },
  {
    key: 'ecommerce',
    label: 'Ecommerce',
    description: 'Progetto orientato a catalogo, conversione e supporto paid.',
  },
] as const;
const AGENCY_PROJECT_TYPE_KEYS = AGENCY_PROJECT_TYPES.map((entry) => entry.key) as [
  (typeof AGENCY_PROJECT_TYPES)[number]['key'],
  ...(typeof AGENCY_PROJECT_TYPES)[number]['key'][],
];
const AGENCY_PROJECT_TYPE_DEFINITIONS = new Map<string, AgencyProjectTypeDefinition>(
  AGENCY_PROJECT_TYPES.map((entry) => [entry.key, entry]),
);
const AGENCY_SCOPE_FIELD_CATALOG = [
  {
    key: 'website',
    label: 'Sito web',
    aliases: ['website', 'web'],
  },
  {
    key: 'landing_page',
    label: 'Landing page',
    aliases: ['landing_page', 'landing'],
  },
  {
    key: 'google_ads',
    label: 'Google Ads',
    aliases: ['google_ads'],
  },
  {
    key: 'meta_ads',
    label: 'Meta Ads',
    aliases: ['meta_ads'],
  },
  {
    key: 'seo',
    label: 'SEO',
    aliases: ['seo'],
  },
  {
    key: 'reporting',
    label: 'Reporting',
    aliases: ['reporting'],
  },
  {
    key: 'diagnosis',
    label: 'Diagnosis',
    aliases: ['diagnosis'],
  },
] as const;
const AGENCY_SCOPE_KEYS = AGENCY_SCOPE_FIELD_CATALOG.map((entry) => entry.key);

const DEFAULT_DISCOVERY_SECTIONS: DiscoverySections = {
  businessContext: 'Agenzia in crescita con forte dipendenza dal canale paid.',
  projectGoal: 'Aumentare lead qualificati mantenendo CAC sostenibile.',
  target: 'PMI italiane nel settore servizi con team marketing snello.',
  offer: 'Pacchetto gestione funnel + performance marketing trimestrale.',
  brandCommunication: 'Tone pragmatico, orientato ai risultati e trasparente.',
  availableMaterials: 'Brand deck, landing v1, storici campagne, case study.',
  technicalAspects: 'CMS WordPress, GA4 attivo, tracciamento da validare.',
  marketingAcquisition: 'Google Ads attivo, Meta da rilanciare, email base.',
};

const DISCOVERY_SECTION_LABELS: Record<keyof DiscoverySections, string> = {
  businessContext: 'Contesto business',
  projectGoal: 'Obiettivo progetto',
  target: 'Target',
  offer: 'Offerta',
  brandCommunication: 'Brand e comunicazione',
  availableMaterials: 'Materiali disponibili',
  technicalAspects: 'Aspetti tecnici',
  marketingAcquisition: 'Marketing e acquisizione',
};

const discoverySectionsSchema = z.object({
  businessContext: z.string().trim().min(3).max(DISCOVERY_MAX_FIELD_LENGTH),
  projectGoal: z.string().trim().min(3).max(DISCOVERY_MAX_FIELD_LENGTH),
  target: z.string().trim().min(3).max(DISCOVERY_MAX_FIELD_LENGTH),
  offer: z.string().trim().min(3).max(DISCOVERY_MAX_FIELD_LENGTH),
  brandCommunication: z.string().trim().max(DISCOVERY_MAX_FIELD_LENGTH),
  availableMaterials: z.string().trim().max(DISCOVERY_MAX_FIELD_LENGTH),
  technicalAspects: z.string().trim().max(DISCOVERY_MAX_FIELD_LENGTH),
  marketingAcquisition: z.string().trim().max(DISCOVERY_MAX_FIELD_LENGTH),
});

const discoveryBodySchema = z.object({
  sections: discoverySectionsSchema,
  notes: z.string().trim().max(DISCOVERY_MAX_FIELD_LENGTH).default(''),
});

const agencyProjectScopeSchema = z.object({
  website: z.boolean().default(false),
  landing_page: z.boolean().default(false),
  google_ads: z.boolean().default(false),
  meta_ads: z.boolean().default(false),
  seo: z.boolean().default(false),
  reporting: z.boolean().default(false),
  diagnosis: z.boolean().default(false),
});

const optionalNullableString = (maxLength: number) => z.preprocess(
  (value) => (value === null ? undefined : value),
  z.string().trim().max(maxLength).optional(),
);
const optionalNullableEnum = <T extends readonly [string, ...string[]]>(values: T) => z.preprocess(
  (value) => (value === null ? undefined : value),
  z.enum(values).optional(),
);

const agencyUploadedFileSourceSchema = z.object({
  id: optionalNullableString(120),
  name: z.string().trim().min(1).max(240),
  originalName: optionalNullableString(240),
  type: z.string().trim().max(160).default(''),
  mimeType: optionalNullableString(160),
  size: z.coerce.number().int().nonnegative().max(1000 * 1000 * 1000).default(0),
  extension: optionalNullableString(20),
  storagePath: optionalNullableString(1024),
  status: z.enum(['uploaded', 'parsed', 'partial', 'failed', 'metadata_only']).default('metadata_only'),
  source: z.string().trim().max(80).default('manual_upload'),
  notes: z.string().trim().max(DISCOVERY_MAX_FIELD_LENGTH).default(''),
  uploadedAt: optionalNullableString(80),
  parseStatus: optionalNullableEnum(['not_parsed', 'parsed', 'partial', 'failed', 'unsupported']),
  extractedTextPreview: optionalNullableString(12000),
  extractedTextLength: z.coerce.number().int().nonnegative().max(20 * 1000 * 1000).optional(),
  extractedTextHash: optionalNullableString(128),
  parsedAt: optionalNullableString(80),
  parseErrorCode: optionalNullableString(80),
  parseError: optionalNullableString(500),
  manualText: optionalNullableString(12000),
  markedUseful: z.boolean().optional(),
});

const agencyCompetitorSourceSchema = z.object({
  id: optionalNullableString(120),
  name: z.string().trim().max(240).default(''),
  url: z.string().trim().min(1).max(2048),
  source: z.enum(['manual', 'auto_search', 'ai_search', 'mock', 'imported']).default('manual'),
  status: z.enum(['suggested', 'confirmed', 'rejected']).default('confirmed'),
  reason: z.string().trim().max(500).default(''),
  addedAt: optionalNullableString(80),
});

const agencyProjectUrlSourceSchema = z.object({
  id: optionalNullableString(120),
  label: z.string().trim().max(160).default(''),
  type: z.enum(['website', 'landing', 'service_page', 'instagram', 'facebook', 'linkedin', 'youtube', 'tiktok', 'google_business', 'other']).default('other'),
  url: z.string().trim().min(1).max(2048),
  status: z.enum(['active', 'ignored']).default('active'),
  notes: z.string().trim().max(1000).default(''),
  addedAt: optionalNullableString(80),
});

const projectSourcesBodySchema = z.object({
  websiteUrl: z.string().trim().max(2048).default(''),
  primaryWebsiteUrl: z.string().trim().max(2048).optional().default(''),
  urls: z.array(agencyProjectUrlSourceSchema).optional().default([]),
  competitorUrls: z.array(z.string().trim().max(2048)).default([]),
  competitors: z.array(agencyCompetitorSourceSchema).optional().default([]),
  uploadedFiles: z.array(agencyUploadedFileSourceSchema).default([]),
  manualNotes: z.string().trim().max(DISCOVERY_MAX_FIELD_LENGTH).default(''),
  sourceType: z.string().trim().max(80).default('manual_project_sources'),
});

const agencyProjectCreateBodySchema = z.object({
  name: z.string().trim().min(3).max(160),
  clientId: z.string().trim().min(1).optional(),
  clientName: z.string().trim().max(160).optional(),
  projectType: z.enum(AGENCY_PROJECT_TYPE_KEYS),
  goal: z.string().trim().min(3).max(DISCOVERY_MAX_FIELD_LENGTH),
  scopePurchased: agencyProjectScopeSchema,
  priorityAgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  websiteUrl: z.string().trim().max(2048).optional().default(''),
  competitorUrls: z.array(z.string().trim().max(2048)).optional().default([]),
  uploadedFiles: z.array(agencyUploadedFileSourceSchema).optional().default([]),
  manualNotes: z.string().trim().max(DISCOVERY_MAX_FIELD_LENGTH).optional().default(''),
  hasMaterialsToAttach: z.boolean().optional().default(false),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const normalizeUrlValue = (value: unknown) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
};

const normalizeCompetitorUrls = (value: unknown) => (
  normalizeStringArray(value)
    .map((entry) => entry.trim())
    .filter((entry, index, items) => items.indexOf(entry) === index)
    .slice(0, 10)
);

const createSourceId = (prefix = 'src') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const deriveNameFromUrl = (url: string) => {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return hostname || url;
  } catch {
    return url;
  }
};

const inferUrlSourceType = (url: string): AgencyProjectUrlSource['type'] => {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (hostname.includes('instagram.com')) return 'instagram';
    if (hostname.includes('facebook.com') || hostname.includes('fb.com')) return 'facebook';
    if (hostname.includes('linkedin.com')) return 'linkedin';
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube';
    if (hostname.includes('tiktok.com')) return 'tiktok';
    if (hostname.includes('google.') || hostname.includes('g.page') || hostname.includes('maps.app.goo.gl')) return 'google_business';
  } catch {
    return 'other';
  }
  return 'website';
};

const getDefaultUrlLabel = (type: AgencyProjectUrlSource['type']) => {
  switch (type) {
    case 'website': return 'Sito principale';
    case 'landing': return 'Landing';
    case 'service_page': return 'Pagina servizio';
    case 'instagram': return 'Instagram';
    case 'facebook': return 'Facebook';
    case 'linkedin': return 'LinkedIn';
    case 'youtube': return 'YouTube';
    case 'tiktok': return 'TikTok';
    case 'google_business': return 'Google Business Profile';
    default: return 'Link utile';
  }
};

const normalizeProjectUrls = (value: unknown, legacyWebsiteUrl: string): AgencyProjectUrlSource[] => {
  const now = new Date().toISOString();
  const rawEntries = Array.isArray(value) ? value : [];
  const normalized = rawEntries
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry) => {
      const url = normalizeUrlValue(entry.url);
      if (!url) {
        return null;
      }
      const type = agencyProjectUrlSourceSchema.shape.type.safeParse(entry.type).success
        ? entry.type as AgencyProjectUrlSource['type']
        : inferUrlSourceType(url);
      const label = typeof entry.label === 'string' && entry.label.trim()
        ? entry.label.trim()
        : getDefaultUrlLabel(type);

      return {
        id: typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : createSourceId('url'),
        label,
        type,
        url,
        status: entry.status === 'ignored' ? 'ignored' as const : 'active' as const,
        notes: typeof entry.notes === 'string' ? entry.notes.trim().slice(0, 1000) : '',
        addedAt: typeof entry.addedAt === 'string' && entry.addedAt.trim() ? entry.addedAt.trim() : now,
      };
    })
    .filter((entry): entry is AgencyProjectUrlSource => Boolean(entry));

  const seen = new Set<string>();
  const merged: AgencyProjectUrlSource[] = [];
  for (const entry of normalized) {
    const key = entry.url.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(entry);
    }
  }

  if (legacyWebsiteUrl) {
    const key = legacyWebsiteUrl.toLowerCase();
    if (!seen.has(key)) {
      merged.unshift({
        id: createSourceId('url'),
        label: 'Sito principale',
        type: 'website',
        url: legacyWebsiteUrl,
        status: 'active',
        notes: '',
        addedAt: now,
      });
    }
  }

  return merged.slice(0, 30);
};

const resolvePrimaryWebsiteUrl = (input: {
  explicitPrimaryUrl: string;
  legacyWebsiteUrl: string;
  urls: AgencyProjectUrlSource[];
}) => {
  const activeUrls = input.urls.filter((entry) => entry.status === 'active');
  if (input.explicitPrimaryUrl && activeUrls.some((entry) => entry.url === input.explicitPrimaryUrl)) {
    return input.explicitPrimaryUrl;
  }
  if (input.legacyWebsiteUrl) {
    return input.legacyWebsiteUrl;
  }
  return activeUrls.find((entry) => entry.type === 'website')?.url
    || activeUrls.find((entry) => entry.type === 'landing')?.url
    || activeUrls[0]?.url
    || '';
};

const normalizeCompetitors = (value: unknown, fallbackUrls: string[]): AgencyCompetitorSource[] => {
  const now = new Date().toISOString();
  const rawEntries = Array.isArray(value) ? value : [];
  const normalized = rawEntries
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry) => {
      const url = normalizeUrlValue(entry.url);
      if (!url) {
        return null;
      }

      const source = entry.source === 'auto_search' || entry.source === 'ai_search' || entry.source === 'mock' || entry.source === 'imported'
        ? entry.source
        : 'manual';
      const status = entry.status === 'suggested' || entry.status === 'rejected'
        ? entry.status
        : 'confirmed';
      const name = typeof entry.name === 'string' && entry.name.trim()
        ? entry.name.trim()
        : deriveNameFromUrl(url);

      return {
        id: typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : createSourceId('cmp'),
        name,
        url,
        source,
        status,
        reason: typeof entry.reason === 'string' ? entry.reason.trim() : '',
        addedAt: typeof entry.addedAt === 'string' && entry.addedAt.trim() ? entry.addedAt.trim() : now,
      };
    })
    .filter((entry): entry is AgencyCompetitorSource => Boolean(entry));

  const seen = new Set<string>();
  const merged: AgencyCompetitorSource[] = [];
  for (const entry of normalized) {
    const key = entry.url.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(entry);
    }
  }

  for (const url of fallbackUrls) {
    const key = url.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push({
        id: createSourceId('cmp'),
        name: deriveNameFromUrl(url),
        url,
        source: 'manual',
        status: 'confirmed',
        reason: 'Importato dai competitor URL legacy.',
        addedAt: now,
      });
    }
  }

  return merged.slice(0, 25);
};

const normalizeUploadedFiles = (value: unknown): AgencyUploadedFileSource[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry) => {
      const name = typeof entry.name === 'string' ? entry.name.trim() : '';
      if (!name) {
        return null;
      }

      const size = typeof entry.size === 'number'
        ? entry.size
        : typeof entry.size === 'string' && entry.size.trim()
          ? Number(entry.size)
          : 0;
      const status = entry.status === 'uploaded' || entry.status === 'parsed' || entry.status === 'partial' || entry.status === 'failed'
        ? entry.status
        : 'metadata_only';

      return {
        id: typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : createSourceId('file'),
        name,
        originalName: typeof entry.originalName === 'string' && entry.originalName.trim() ? entry.originalName.trim() : undefined,
        type: typeof entry.type === 'string' ? entry.type.trim() : '',
        mimeType: typeof entry.mimeType === 'string' && entry.mimeType.trim() ? entry.mimeType.trim() : undefined,
        size: Number.isFinite(size) && size > 0 ? Math.round(size) : 0,
        extension: typeof entry.extension === 'string' && entry.extension.trim() ? entry.extension.trim() : undefined,
        storagePath: typeof entry.storagePath === 'string' && entry.storagePath.trim() ? entry.storagePath.trim() : undefined,
        status,
        source: typeof entry.source === 'string' && entry.source.trim() ? entry.source.trim() : 'manual_upload',
        notes: typeof entry.notes === 'string' ? entry.notes.trim() : '',
        uploadedAt: typeof entry.uploadedAt === 'string' && entry.uploadedAt.trim() ? entry.uploadedAt.trim() : undefined,
        parseStatus: entry.parseStatus === 'parsed' || entry.parseStatus === 'partial' || entry.parseStatus === 'failed' || entry.parseStatus === 'unsupported' || entry.parseStatus === 'not_parsed'
          ? entry.parseStatus
          : status === 'parsed'
            ? 'parsed'
            : status === 'uploaded'
              ? 'not_parsed'
              : undefined,
        extractedTextPreview: typeof entry.extractedTextPreview === 'string' && entry.extractedTextPreview.trim()
          ? entry.extractedTextPreview.trim().slice(0, 12000)
          : undefined,
        extractedTextLength: typeof entry.extractedTextLength === 'number' && Number.isFinite(entry.extractedTextLength)
          ? Math.max(0, Math.round(entry.extractedTextLength))
          : typeof entry.extractedTextLength === 'string' && entry.extractedTextLength.trim()
            ? Math.max(0, Math.round(Number(entry.extractedTextLength)))
            : undefined,
        extractedTextHash: typeof entry.extractedTextHash === 'string' && entry.extractedTextHash.trim() ? entry.extractedTextHash.trim() : undefined,
        parsedAt: typeof entry.parsedAt === 'string' && entry.parsedAt.trim() ? entry.parsedAt.trim() : undefined,
        parseErrorCode: typeof entry.parseErrorCode === 'string' && entry.parseErrorCode.trim() ? entry.parseErrorCode.trim() : undefined,
        parseError: typeof entry.parseError === 'string' && entry.parseError.trim() ? entry.parseError.trim().slice(0, 500) : undefined,
        manualText: typeof entry.manualText === 'string' && entry.manualText.trim() ? entry.manualText.trim().slice(0, 12000) : undefined,
        markedUseful: typeof entry.markedUseful === 'boolean' ? entry.markedUseful : undefined,
      };
    })
    .filter((entry): entry is AgencyUploadedFileSource => Boolean(entry))
    .slice(0, 25);
};

const buildProjectSourcesSummary = (input: {
  websiteUrl: string;
  urls: AgencyProjectUrlSource[];
  competitorUrls: string[];
  competitors: AgencyCompetitorSource[];
  uploadedFiles: AgencyUploadedFileSource[];
  manualNotes: string;
}) => {
  const usedSources: string[] = [];
  const activeUrls = input.urls.filter((entry) => entry.status === 'active');
  if (input.websiteUrl) {
    usedSources.push(`Sito principale: ${input.websiteUrl}`);
  }
  if (activeUrls.length > 1) {
    usedSources.push(`${activeUrls.length} URL progetto`);
  }
  if (input.competitorUrls.length > 0) {
    usedSources.push(`${input.competitorUrls.length} competitor URL`);
  }
  if (input.competitors.length > 0) {
    usedSources.push(`${input.competitors.filter((entry) => entry.status !== 'rejected').length} competitor strutturati`);
  }
  if (input.uploadedFiles.length > 0) {
    const parsedCount = input.uploadedFiles.filter((entry) => entry.parseStatus === 'parsed' || entry.status === 'parsed').length;
    const partialCount = input.uploadedFiles.filter((entry) => entry.parseStatus === 'partial').length;
    const uploadedCount = input.uploadedFiles.filter((entry) => entry.status === 'uploaded' || entry.status === 'parsed').length;
    const metadataCount = input.uploadedFiles.filter((entry) => entry.status === 'metadata_only').length;
    const unreadableCount = input.uploadedFiles.filter((entry) => (
      entry.parseStatus === 'failed' || entry.parseStatus === 'unsupported' || entry.parseStatus === 'not_parsed'
    )).length;
    usedSources.push(`${uploadedCount} file caricati (${parsedCount} letti, ${partialCount} letti parzialmente, ${unreadableCount} non letti), ${metadataCount} file metadata`);
  }
  if (input.manualNotes) {
    usedSources.push('Note/brief manuale');
  }

  if (usedSources.length === 0) {
    return 'Nessuna fonte cliente reale registrata. Gli output useranno dati incompleti finche non vengono aggiunte fonti.';
  }

  return `Fonti registrate: ${usedSources.join(', ')}.`;
};

const buildSourceDiagnostics = (input: {
  websiteUrl: string;
  urls: AgencyProjectUrlSource[];
  competitors: AgencyCompetitorSource[];
  competitorUrls: string[];
  uploadedFiles: AgencyUploadedFileSource[];
  manualNotes: string;
  sourceStatus: AgencyProjectSourcesPayload['sourceStatus'];
}) => {
  const usedSources: string[] = [];
  const missingSourceWarnings: string[] = [];
  const unreadableFiles: string[] = [];
  const confirmedCompetitors = input.competitors.filter((entry) => entry.status === 'confirmed');
  const parsedFiles = input.uploadedFiles.filter((entry) => entry.parseStatus === 'parsed' || entry.status === 'parsed');
  const partialFiles = input.uploadedFiles.filter((entry) => entry.parseStatus === 'partial');
  const activeUrls = input.urls.filter((entry) => entry.status === 'active');

  if (input.websiteUrl) {
    usedSources.push('Sito principale inserito (riferimento, non analisi web automatica)');
  } else {
    missingSourceWarnings.push('Sito principale assente.');
  }
  if (activeUrls.length > 1) {
    usedSources.push(`${activeUrls.length} URL progetto disponibili`);
  }
  if (input.manualNotes) {
    usedSources.push('Note/brief manuale');
  } else {
    missingSourceWarnings.push('Note o brief iniziale assenti.');
  }
  if (input.uploadedFiles.length > 0) {
    usedSources.push(`${input.uploadedFiles.length} file allegati o registrati`);
  } else {
    missingSourceWarnings.push('Nessun file o materiale allegato.');
  }
  if (parsedFiles.length > 0) {
    usedSources.push(`${parsedFiles.length} file con testo estratto`);
  }
  if (partialFiles.length > 0) {
    usedSources.push(`${partialFiles.length} file letti parzialmente`);
  }
  if (confirmedCompetitors.length > 0 || input.competitorUrls.length > 0) {
    usedSources.push(`${confirmedCompetitors.length || input.competitorUrls.length} competitor disponibili`);
  } else {
    missingSourceWarnings.push('Nessun competitor confermato.');
  }

  input.uploadedFiles.forEach((entry) => {
    if (entry.status === 'metadata_only') {
      unreadableFiles.push(`${entry.name}: registrato senza upload reale`);
      return;
    }
    if (entry.parseStatus === 'partial') {
      unreadableFiles.push(`${entry.name}: testo estratto parzialmente${entry.parseError ? ` (${entry.parseError})` : ''}`);
    }
    if (entry.parseStatus === 'failed' || entry.parseStatus === 'unsupported' || entry.parseStatus === 'not_parsed') {
      unreadableFiles.push(`${entry.name}: ${entry.parseError || 'contenuto non letto'}`);
    }
  });

  const sourceQuality = input.sourceStatus === 'ready'
    ? (parsedFiles.length > 0 || partialFiles.length > 0 || input.manualNotes.length >= 200 ? 'high' : 'medium')
    : input.sourceStatus === 'partial'
      ? 'medium'
      : input.websiteUrl || input.manualNotes || input.uploadedFiles.length > 0 || input.competitorUrls.length > 0
        ? 'low'
        : 'missing';

  return {
    sourceQuality,
    usedSources,
    missingSourceWarnings,
    unreadableFiles,
  };
};

const normalizeProjectSources = (value: unknown): AgencyProjectSourcesPayload => {
  const source = isRecord(value) ? value : {};
  const legacyWebsiteUrl = normalizeUrlValue(source.websiteUrl);
  const explicitPrimaryUrl = normalizeUrlValue(source.primaryWebsiteUrl);
  const urls = normalizeProjectUrls(source.urls, legacyWebsiteUrl || explicitPrimaryUrl);
  const primaryWebsiteUrl = resolvePrimaryWebsiteUrl({
    explicitPrimaryUrl,
    legacyWebsiteUrl,
    urls,
  });
  const websiteUrl = primaryWebsiteUrl;
  const legacyCompetitorUrls = normalizeCompetitorUrls(source.competitorUrls);
  const competitors = normalizeCompetitors(source.competitors, legacyCompetitorUrls);
  const competitorUrls = normalizeCompetitorUrls([
    ...legacyCompetitorUrls,
    ...competitors
      .filter((entry) => entry.status !== 'rejected')
      .map((entry) => entry.url),
  ]);
  const uploadedFiles = normalizeUploadedFiles(source.uploadedFiles);
  const manualNotes = typeof source.manualNotes === 'string' ? source.manualNotes.trim() : '';
  const hasWebsite = websiteUrl.length > 0;
  const hasNotes = manualNotes.length > 0;
  const hasRobustNotes = manualNotes.length >= 80;
  const hasFiles = uploadedFiles.length > 0;
  const hasCompetitors = competitors.some((entry) => entry.status !== 'rejected') || competitorUrls.length > 0;
  const sourceStatus: AgencyProjectSourcesPayload['sourceStatus'] = (hasWebsite || hasRobustNotes) && (hasFiles || hasCompetitors || manualNotes.length >= 200)
    ? 'ready'
    : hasWebsite || hasNotes || hasFiles || hasCompetitors
      ? 'partial'
      : 'missing';
  const diagnostics = buildSourceDiagnostics({
    websiteUrl,
    urls,
    competitorUrls,
    competitors,
    uploadedFiles,
    manualNotes,
    sourceStatus,
  });
  const lastSourceUpdateAt = typeof source.lastSourceUpdateAt === 'string' && source.lastSourceUpdateAt.trim()
    ? source.lastSourceUpdateAt.trim()
    : null;

  return {
    websiteUrl,
    primaryWebsiteUrl,
    urls,
    competitorUrls,
    competitors,
    uploadedFiles,
    manualNotes,
    sourceType: typeof source.sourceType === 'string' && source.sourceType.trim()
      ? source.sourceType.trim()
      : 'manual_project_sources',
    sourceStatus,
    sourceSummary: buildProjectSourcesSummary({ websiteUrl, urls, competitorUrls, competitors, uploadedFiles, manualNotes }),
    lastSourceUpdateAt,
    ...diagnostics,
  };
};

const buildSourceReadiness = (sources: AgencyProjectSourcesPayload) => {
  const usedSources: string[] = [];
  if (sources.websiteUrl) {
    usedSources.push('websiteUrl');
  }
  if (sources.urls.length > 0) {
    usedSources.push('urls');
  }
  if (sources.competitorUrls.length > 0) {
    usedSources.push('competitorUrls');
  }
  if (sources.competitors.length > 0) {
    usedSources.push('competitors');
  }
  if (sources.uploadedFiles.length > 0) {
    const parsedCount = sources.uploadedFiles.filter((entry) => entry.parseStatus === 'parsed' || entry.status === 'parsed').length;
    const partialCount = sources.uploadedFiles.filter((entry) => entry.parseStatus === 'partial').length;
    usedSources.push(parsedCount > 0 || partialCount > 0 ? 'file letti' : 'file allegati/materiali registrati');
  }
  if (sources.manualNotes) {
    usedSources.push('manualNotes');
  }

  return {
    status: sources.sourceStatus,
    summary: sources.sourceSummary,
    usedSources,
    isFallbackOnly: sources.sourceStatus === 'missing',
    lastSourceUpdateAt: sources.lastSourceUpdateAt,
  };
};

// --- Merge Modulo Fonti (V4) → pipeline Agency ----------------------------
// Converte i record normalizzati ProjectSource (URL/testo con contenuto estratto)
// in "materiali" sintetici, così readiness e Discovery li usano come le altre
// fonti senza modifiche alla logica esistente. NON persistiti: iniettati solo in
// lettura (getProject, generazione Discovery), mai nel blob salvato dall'editor.
type IndexedProjectSourceRecord = {
  id: string;
  type: string;
  title: string;
  url: string | null;
  content: string | null;
  contentChars: number;
  createdAt: Date;
  updatedAt: Date;
};

const INDEXED_SOURCE_MARKER = 'ai_sources_module';

const buildSyntheticFilesFromIndexedSources = (
  records: IndexedProjectSourceRecord[],
): AgencyUploadedFileSource[] =>
  records
    .filter((record) => (record.content ?? '').trim().length > 0)
    .map((record) => ({
      id: `psrc_${record.id}`,
      name: record.title || (record.type === 'url' ? record.url ?? 'Fonte URL' : 'Fonte testo'),
      originalName: record.title || undefined,
      type: record.type === 'url' ? 'url' : 'text',
      size: record.contentChars || (record.content ?? '').length,
      status: 'parsed' as const,
      source: INDEXED_SOURCE_MARKER,
      notes: record.url ? `Fonte URL indicizzata: ${record.url}` : 'Fonte testo indicizzata',
      uploadedAt: record.createdAt.toISOString(),
      parseStatus: 'parsed' as const,
      extractedTextPreview: (record.content ?? '').slice(0, 12000),
      extractedTextLength: (record.content ?? '').length,
      parsedAt: record.updatedAt.toISOString(),
      markedUseful: true,
    }));

// Ritorna una copia del blob fonti con i record indicizzati aggiunti come
// materiali; ri-normalizza così stato/summary/diagnostica includono i nuovi.
const augmentSourcesWithIndexedRecords = (
  sources: AgencyProjectSourcesPayload,
  records: IndexedProjectSourceRecord[],
): AgencyProjectSourcesPayload => {
  const synthetic = buildSyntheticFilesFromIndexedSources(records);
  if (synthetic.length === 0) {
    return sources;
  }
  return normalizeProjectSources({
    ...sources,
    uploadedFiles: [...sources.uploadedFiles, ...synthetic],
  });
};

const buildProjectSourcesFromInput = (input: {
  websiteUrl?: string;
  primaryWebsiteUrl?: string;
  urls?: AgencyProjectUrlSource[];
  competitorUrls?: string[];
  competitors?: AgencyCompetitorSource[];
  uploadedFiles?: AgencyUploadedFileSource[];
  manualNotes?: string;
}): AgencyProjectSourcesPayload => {
  const now = new Date().toISOString();
  const normalized = normalizeProjectSources({
    websiteUrl: input.websiteUrl ?? '',
    primaryWebsiteUrl: input.primaryWebsiteUrl ?? '',
    urls: input.urls ?? [],
    competitorUrls: input.competitorUrls ?? [],
    competitors: input.competitors ?? [],
    uploadedFiles: input.uploadedFiles ?? [],
    manualNotes: input.manualNotes ?? '',
    sourceType: 'project_create',
    lastSourceUpdateAt: now,
  });

  return {
    ...normalized,
    lastSourceUpdateAt: now,
  };
};

const createEmptyAgencyProjectScopeMap = (): AgencyProjectScopeMap => ({
  website: false,
  landing_page: false,
  google_ads: false,
  meta_ads: false,
  seo: false,
  reporting: false,
  diagnosis: false,
});

const normalizeAgencyProjectTypeDefinition = (value: unknown): AgencyProjectTypeDefinition | null => {
  const key = typeof value === 'string'
    ? value.trim()
    : isRecord(value) && typeof value.key === 'string'
      ? value.key.trim()
      : '';
  if (!key) {
    return null;
  }

  return AGENCY_PROJECT_TYPE_DEFINITIONS.get(key) ?? null;
};

const normalizeAgencyProjectScopeMap = (
  value: unknown,
  projectTypeKey?: string | null,
): AgencyProjectScopeMap => {
  const result = createEmptyAgencyProjectScopeMap();

  const applyFlag = (rawKey: string, purchased: boolean) => {
    const normalizedKey = rawKey.trim().toLowerCase();
    if (!normalizedKey) {
      return;
    }

    if (normalizedKey === 'ads') {
      if (projectTypeKey === 'meta_ads') {
        result.meta_ads = purchased;
        return;
      }
      if (projectTypeKey === 'google_meta_ads') {
        result.google_ads = purchased;
        result.meta_ads = purchased;
        return;
      }
      if (projectTypeKey === 'local_ads' || projectTypeKey === 'google_ads') {
        result.google_ads = purchased;
        return;
      }

      result.google_ads = purchased;
      result.meta_ads = purchased;
      return;
    }

    const field = AGENCY_SCOPE_FIELD_CATALOG.find((entry) => entry.aliases.includes(normalizedKey));
    if (field) {
      result[field.key] = purchased;
    }
  };

  if (Array.isArray(value)) {
    value
      .filter((entry) => isRecord(entry))
      .forEach((entry) => {
        if (typeof entry.key === 'string') {
          applyFlag(entry.key, Boolean(entry.purchased));
        }
      });
  } else if (isRecord(value)) {
    AGENCY_SCOPE_KEYS.forEach((key) => {
      result[key] = Boolean(value[key]);
    });
  }

  return result;
};

const normalizeScopePurchased = (value: Prisma.JsonValue | null) => {
  if (Array.isArray(value)) {
    return value
      .filter((entry) => isRecord(entry))
      .map((entry) => {
        const key = typeof entry.key === 'string' ? entry.key.trim() : '';
        const label = typeof entry.label === 'string' ? entry.label.trim() : '';
        if (!key || !label) {
          return null;
        }

        return {
          key,
          label,
          purchased: Boolean(entry.purchased),
        };
      })
      .filter((entry): entry is { key: string; label: string; purchased: boolean } => entry !== null);
  }

  if (isRecord(value)) {
    const scopeMap = normalizeAgencyProjectScopeMap(value);
    return [
      { key: 'web', label: 'Sito web', purchased: scopeMap.website },
      { key: 'landing', label: 'Landing page', purchased: scopeMap.landing_page },
      { key: 'ads', label: 'Campagne ADS', purchased: scopeMap.google_ads || scopeMap.meta_ads },
      { key: 'seo', label: 'SEO', purchased: scopeMap.seo },
      { key: 'reporting', label: 'Report', purchased: scopeMap.reporting },
      { key: 'diagnosis', label: 'Diagnosi', purchased: scopeMap.diagnosis },
    ];
  }

  return [];
};

const ADS_PROJECT_TYPES = new Set(['google_ads', 'meta_ads', 'google_meta_ads', 'local_ads']);
const WEBSITE_PROJECT_TYPES = new Set(['website', 'landing_page', 'marketing_full', 'ecommerce']);
const RULE_SOURCE = 'rule_v1';
const IS_DEV_RUNTIME = process.env.NODE_ENV !== 'production';

const logAgencyServiceEvent = (message: string, details?: Record<string, unknown>) => {
  if (!IS_DEV_RUNTIME) {
    return;
  }

  if (details) {
    console.info(`[AgencyService] ${message}`, details);
    return;
  }

  console.info(`[AgencyService] ${message}`);
};

const getPurchasedFlag = (scopeItems: Array<{ key: string; purchased: boolean }>, key: string) => {
  const normalizedKey = key.trim().toLowerCase();
  if (!normalizedKey) {
    return false;
  }

  const hasPurchased = (candidates: string[]) => scopeItems.some((item) => {
    const itemKey = typeof item?.key === 'string' ? item.key.trim().toLowerCase() : '';
    return candidates.includes(itemKey) && Boolean(item.purchased);
  });

  switch (normalizedKey) {
    case 'web':
    case 'website':
      return hasPurchased(['web', 'website']);
    case 'landing':
    case 'landing_page':
      return hasPurchased(['landing', 'landing_page']);
    case 'ads':
      return hasPurchased(['ads', 'google_ads', 'meta_ads']);
    case 'google_ads':
      return hasPurchased(['google_ads']);
    case 'meta_ads':
      return hasPurchased(['meta_ads']);
    case 'seo':
      return hasPurchased(['seo']);
    case 'reporting':
      return hasPurchased(['reporting']);
    case 'diagnosis':
      return hasPurchased(['diagnosis']);
    case 'tracking':
      return hasPurchased(['tracking']);
    default:
      return hasPurchased([normalizedKey]);
  }
};

const mergeUniqueByTitle = <T extends { title: string }>(entries: T[]) => {
  const result: T[] = [];
  const seen = new Set<string>();

  entries.forEach((entry) => {
    const key = entry.title.trim().toLowerCase();
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(entry);
  });

  return result;
};

const buildDiscoveryBrief = (sections: DiscoverySections, notes: string) => {
  return [
    `Contesto: ${sections.businessContext}`,
    `Obiettivo: ${sections.projectGoal}`,
    `Target: ${sections.target}`,
    `Offerta: ${sections.offer}`,
    `Marketing: ${sections.marketingAcquisition}`,
    `Note operative: ${notes || 'Nessuna nota aggiuntiva.'}`,
  ].join('\n');
};

const buildDiscoveryContextSummary = (sections: DiscoverySections) => {
  const completedSections = Object.entries(sections).filter(([, value]) => value.trim().length > 0);
  const missingSections = Object.entries(sections)
    .filter(([, value]) => value.trim().length === 0)
    .map(([key]) => DISCOVERY_SECTION_LABELS[key as keyof DiscoverySections]);

  if (missingSections.length === 0) {
    return `Brief aggiornato. Sezioni completate: ${completedSections.length}/8. Obiettivo: ${sections.projectGoal || 'da definire'}.`;
  }

  return `Brief aggiornato. Sezioni completate: ${completedSections.length}/8. Mancano: ${missingSections.join(', ')}. Obiettivo: ${sections.projectGoal || 'da definire'}.`;
};

const sanitizeDiscoveryText = (value: string, fallback: string) => {
  const normalized = value.trim();
  if (!normalized) {
    return fallback;
  }

  if (normalized.length > DISCOVERY_MAX_FIELD_LENGTH) {
    return normalized.slice(0, DISCOVERY_MAX_FIELD_LENGTH);
  }

  return normalized;
};

const AGENCY_SOURCE_UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'agency-sources');
const AGENCY_SOURCE_ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.txt', '.csv', '.xlsx', '.png', '.jpg', '.jpeg']);
const AGENCY_SOURCE_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const AGENCY_SOURCE_TEXT_PREVIEW_MAX_LENGTH = 12000;

const sanitizeFileName = (value: string) => (
  value
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 160)
);

const assertStoragePathInsideUploads = (storagePath: string) => {
  const resolvedPath = path.resolve(process.cwd(), storagePath);
  const relativePath = path.relative(AGENCY_SOURCE_UPLOAD_ROOT, resolvedPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw badRequest('Invalid Agency source file path.');
  }

  return resolvedPath;
};

const normalizeExtractedSourceText = (value: string) => value
  .replace(/\u0000/g, ' ')
  .replace(/[ \t]+/g, ' ')
  .replace(/\r\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const buildParsedSourceTextResult = (text: string) => {
  const normalizedText = normalizeExtractedSourceText(text);
  if (!normalizedText) {
    return {
      parseStatus: 'failed' as const,
      parseErrorCode: 'empty_text',
      parseError: 'Il file sembra scannerizzato o senza testo selezionabile.',
    };
  }
  const isPartial = normalizedText.length < 20;

  return {
    parseStatus: isPartial ? 'partial' as const : 'parsed' as const,
    extractedTextPreview: normalizedText.slice(0, AGENCY_SOURCE_TEXT_PREVIEW_MAX_LENGTH),
    extractedTextLength: normalizedText.length,
    extractedTextHash: createHash('sha256').update(normalizedText).digest('hex'),
    parsedAt: new Date().toISOString(),
    parseErrorCode: isPartial ? 'short_text' : undefined,
    parseError: isPartial ? 'Testo estratto molto breve: verifica se il file contiene tutte le informazioni utili.' : undefined,
  };
};

const extractAgencySourceText = async (input: {
  buffer: Buffer;
  extension: string;
}) => {
  try {
    if (input.extension === '.txt' || input.extension === '.csv') {
      return buildParsedSourceTextResult(input.buffer.toString('utf8'));
    }

    if (input.extension === '.docx') {
      const mammoth = await import('mammoth');
      const extracted = await mammoth.extractRawText({ buffer: input.buffer });
      return buildParsedSourceTextResult(extracted.value || '');
    }

    if (input.extension === '.pdf') {
      const pdfParseModule = await import('pdf-parse') as {
        PDFParse?: new (options: { data: Buffer }) => {
          getText: () => Promise<{ text?: string }>;
          destroy?: () => Promise<void> | void;
        };
        default?: (buffer: Buffer) => Promise<{ text?: string }>;
      };
      if (pdfParseModule.PDFParse) {
        const parser = new pdfParseModule.PDFParse({ data: input.buffer });
        try {
          const extracted = await parser.getText();
          return buildParsedSourceTextResult(extracted.text || '');
        } finally {
          await parser.destroy?.();
        }
      }
      if (pdfParseModule.default) {
        const extracted = await pdfParseModule.default(input.buffer);
        return buildParsedSourceTextResult(extracted.text || '');
      }
      return {
        parseStatus: 'failed' as const,
        parseErrorCode: 'parser_unavailable',
        parseError: 'Parser PDF non disponibile nel runtime.',
      };
    }

    return {
      parseStatus: 'unsupported' as const,
      parseErrorCode: 'unsupported',
      parseError: 'Estrazione testo non supportata per questo formato.',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const lowered = message.toLowerCase();
    const parseErrorCode = lowered.includes('password') || lowered.includes('encrypted')
      ? 'password_protected'
      : 'parser_error';
    return {
      parseStatus: 'failed' as const,
      parseErrorCode,
      parseError: parseErrorCode === 'password_protected'
        ? 'File protetto da password: non posso leggerne il contenuto.'
        : 'Estrazione testo non riuscita. Il file resta allegato, ma non viene usato come contenuto letto.',
    };
  }
};

const getFileContentDisposition = (input: {
  file: AgencyUploadedFileSource;
  download: boolean;
}) => {
  const safeFileName = sanitizeFileName(input.file.originalName || input.file.name || 'agency-source-file');
  const extension = input.file.extension || path.extname(input.file.name || '').toLowerCase();
  const canInline = ['.pdf', '.png', '.jpg', '.jpeg', '.txt', '.csv'].includes(extension);
  const disposition = input.download || !canInline ? 'attachment' : 'inline';

  return `${disposition}; filename="${safeFileName}"`;
};

const getReadableSourceStatus = (status: AgencyProjectSourcesPayload['sourceStatus']) => {
  if (status === 'ready') {
    return 'alta';
  }
  if (status === 'partial') {
    return 'media';
  }
  return 'bassa';
};

const AGENCY_RUNTIME_SETTING_KEYS = {
  aiEnabled: 'agency_ai_enabled',
  aiProvider: 'agency_ai_provider',
  aiModel: 'agency_ai_model',
  aiTimeoutMs: 'agency_ai_timeout_ms',
  aiInputMaxChars: 'agency_ai_input_max_chars',
  aiStringMaxChars: 'agency_ai_string_max_chars',
  aiFileTextMaxChars: 'agency_ai_file_text_max_chars',
  aiMaxOutputTokens: 'agency_ai_max_output_tokens',
  aiDefaultMode: 'agency_ai_default_mode',
  aiDebugEnabled: 'agency_ai_debug_enabled',
  aiFunctionModels: 'agency_ai_function_models',
  openAiApiKey: 'openai_api_key',
  anthropicApiKey: 'anthropic_api_key',
  competitorSearchEnabled: 'agency_competitor_search_enabled',
  competitorSearchProvider: 'agency_competitor_search_provider',
} as const;

const runtimeSettingsPayloadSchema = z.object({
  ai: z.object({
    enabled: z.boolean().optional(),
    provider: z.enum(['none', 'openai', 'anthropic']).optional(),
    model: z.string().trim().min(1).max(120).optional(),
    timeoutMs: z.coerce.number().int().min(5000).max(180000).optional(),
    inputMaxChars: z.coerce.number().int().min(6000).max(120000).optional(),
    stringMaxChars: z.coerce.number().int().min(500).max(12000).optional(),
    fileTextMaxChars: z.coerce.number().int().min(300).max(12000).optional(),
    maxOutputTokens: z.coerce.number().int().min(0).max(12000).optional(),
    defaultMode: z.enum(['quick', 'deep']).optional(),
    debugEnabled: z.boolean().optional(),
    functionModels: z.record(z.string().trim().min(1).max(80), z.string().trim().min(1).max(120)).optional(),
    openAiApiKey: z.string().trim().min(1).max(4096).optional(),
    clearOpenAiApiKey: z.boolean().optional(),
    anthropicApiKey: z.string().trim().min(1).max(4096).optional(),
    clearAnthropicApiKey: z.boolean().optional(),
  }).optional(),
  competitorSearch: z.object({
    enabled: z.boolean().optional(),
    provider: z.enum(['none', 'openai_web_search', 'serpapi', 'custom']).optional(),
  }).optional(),
});

const runtimeStringFromJson = (value: Prisma.JsonValue | null | undefined): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const runtimeBooleanFromJson = (value: Prisma.JsonValue | null | undefined): boolean | null =>
  typeof value === 'boolean' ? value : null;

const runtimeNumberFromJson = (value: Prisma.JsonValue | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const buildRuntimeSettingsMap = (settings: AgencyRuntimeSettingRecord[] | null | undefined) =>
  new Map((settings ?? []).map((entry) => [entry.key, entry]));

const getRuntimeSettingString = (
  settingsByKey: Map<string, AgencyRuntimeSettingRecord>,
  key: string,
  fallback: string,
) => runtimeStringFromJson(settingsByKey.get(key)?.valueJson) ?? fallback;

const getRuntimeSettingBoolean = (
  settingsByKey: Map<string, AgencyRuntimeSettingRecord>,
  key: string,
  fallback: boolean,
) => runtimeBooleanFromJson(settingsByKey.get(key)?.valueJson) ?? fallback;

const getRuntimeSettingNumber = (
  settingsByKey: Map<string, AgencyRuntimeSettingRecord>,
  key: string,
  fallback: number,
) => runtimeNumberFromJson(settingsByKey.get(key)?.valueJson) ?? fallback;

const encodeBase64 = (value: Buffer) => value.toString('base64');
const decodeBase64 = (value: string) => Buffer.from(value, 'base64');

const buildAgencyRuntimeSecretAAD = (workspaceId: string, key: string): Buffer =>
  Buffer.from(`agency-runtime-setting:v1|workspace:${workspaceId}|key:${key}`, 'utf8');

const encryptAgencyRuntimeSecret = async (input: {
  workspaceId: string;
  key: string;
  value: string;
}) => {
  const dek = await getOrCreateWorkspaceDEK(input.workspaceId);
  const encrypted = encryptAESGCM({
    key: dek.key,
    aad: buildAgencyRuntimeSecretAAD(input.workspaceId, input.key),
    plaintext: Buffer.from(input.value, 'utf8'),
  });

  return {
    ciphertext: encodeBase64(encrypted.ciphertext),
    iv: encodeBase64(encrypted.iv),
    authTag: encodeBase64(encrypted.authTag),
    keyVersion: dek.keyVersion,
  };
};

const decryptAgencyRuntimeSecret = async (record: AgencyRuntimeSettingRecord | undefined) => {
  if (!record?.ciphertext || !record.iv || !record.authTag || !record.keyVersion) {
    return null;
  }

  const dek = await getOrCreateWorkspaceDEK(record.workspaceId, record.keyVersion);
  const plaintext = decryptAESGCM({
    key: dek.key,
    aad: buildAgencyRuntimeSecretAAD(record.workspaceId, record.key),
    ciphertext: decodeBase64(record.ciphertext),
    iv: decodeBase64(record.iv),
    authTag: decodeBase64(record.authTag),
  });

  return plaintext.toString('utf8').trim() || null;
};

const resolveAgencyRuntimeConfig = async (workspaceId?: string) => {
  const schemaReady = workspaceId
    ? await agencyRepository.isAgencyRuntimeSettingsSchemaReady()
    : false;
  const settings = schemaReady && workspaceId
    ? await agencyRepository.listAgencyRuntimeSettings(workspaceId)
    : null;
  const settingsByKey = buildRuntimeSettingsMap(settings);
  const openAiSecretRecord = settingsByKey.get(AGENCY_RUNTIME_SETTING_KEYS.openAiApiKey);
  let dbOpenAiApiKey: string | null = null;
  let dbSecretReadable = false;

  if (openAiSecretRecord) {
    try {
      dbOpenAiApiKey = await decryptAgencyRuntimeSecret(openAiSecretRecord);
      dbSecretReadable = Boolean(dbOpenAiApiKey);
    } catch {
      dbOpenAiApiKey = null;
      dbSecretReadable = false;
    }
  }

  const envOpenAiApiKey = process.env.OPENAI_API_KEY?.trim() || null;
  const openAiApiKey = dbOpenAiApiKey || envOpenAiApiKey;
  const openAiApiKeySource = dbOpenAiApiKey
    ? 'db'
    : envOpenAiApiKey
      ? 'env'
      : 'missing';

  // Chiave Anthropic/Claude: stesso schema di OpenAI (segreto cifrato su DB, con
  // fallback alla variabile d'ambiente). Consente il provider multi-modello.
  const anthropicSecretRecord = settingsByKey.get(AGENCY_RUNTIME_SETTING_KEYS.anthropicApiKey);
  let dbAnthropicApiKey: string | null = null;
  let dbAnthropicSecretReadable = false;
  if (anthropicSecretRecord) {
    try {
      dbAnthropicApiKey = await decryptAgencyRuntimeSecret(anthropicSecretRecord);
      dbAnthropicSecretReadable = Boolean(dbAnthropicApiKey);
    } catch {
      dbAnthropicApiKey = null;
      dbAnthropicSecretReadable = false;
    }
  }
  const envAnthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim() || null;
  const anthropicApiKey = dbAnthropicApiKey || envAnthropicApiKey;
  const anthropicApiKeySource = dbAnthropicApiKey
    ? 'db'
    : envAnthropicApiKey
      ? 'env'
      : 'missing';
  const aiEnabled = getRuntimeSettingBoolean(
    settingsByKey,
    AGENCY_RUNTIME_SETTING_KEYS.aiEnabled,
    process.env.AGENCY_AI_ENABLED === 'true',
  );
  const aiProvider = getRuntimeSettingString(
    settingsByKey,
    AGENCY_RUNTIME_SETTING_KEYS.aiProvider,
    process.env.AGENCY_AI_PROVIDER?.trim() || 'none',
  );
  const aiModel = getRuntimeSettingString(
    settingsByKey,
    AGENCY_RUNTIME_SETTING_KEYS.aiModel,
    process.env.AGENCY_AI_MODEL?.trim() || 'gpt-4o-mini',
  );
  const aiTimeoutMs = getRuntimeSettingNumber(
    settingsByKey,
    AGENCY_RUNTIME_SETTING_KEYS.aiTimeoutMs,
    Number(process.env.AGENCY_AI_TIMEOUT_MS || 45000),
  );
  const aiInputMaxChars = getRuntimeSettingNumber(
    settingsByKey,
    AGENCY_RUNTIME_SETTING_KEYS.aiInputMaxChars,
    Number(process.env.AGENCY_AI_INPUT_MAX_CHARS || 24000),
  );
  const aiStringMaxChars = getRuntimeSettingNumber(
    settingsByKey,
    AGENCY_RUNTIME_SETTING_KEYS.aiStringMaxChars,
    Number(process.env.AGENCY_AI_STRING_MAX_CHARS || 2200),
  );
  const aiFileTextMaxChars = getRuntimeSettingNumber(
    settingsByKey,
    AGENCY_RUNTIME_SETTING_KEYS.aiFileTextMaxChars,
    Number(process.env.AGENCY_AI_FILE_TEXT_MAX_CHARS || 1200),
  );
  const aiMaxOutputTokens = getRuntimeSettingNumber(
    settingsByKey,
    AGENCY_RUNTIME_SETTING_KEYS.aiMaxOutputTokens,
    Number(process.env.AGENCY_AI_MAX_OUTPUT_TOKENS || 0),
  );
  const aiDefaultMode = getRuntimeSettingString(
    settingsByKey,
    AGENCY_RUNTIME_SETTING_KEYS.aiDefaultMode,
    process.env.AGENCY_AI_DEFAULT_MODE?.trim() || 'quick',
  );
  const aiDebugEnabled = getRuntimeSettingBoolean(
    settingsByKey,
    AGENCY_RUNTIME_SETTING_KEYS.aiDebugEnabled,
    process.env.AGENCY_AI_DEBUG_ENABLED === 'true',
  );
  const rawFunctionModels = settingsByKey.get(AGENCY_RUNTIME_SETTING_KEYS.aiFunctionModels)?.valueJson;
  const aiFunctionModels = isRecord(rawFunctionModels)
    ? Object.fromEntries(Object.entries(rawFunctionModels)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0)
      .map(([key, value]) => [key, value.trim()]))
    : {};
  const competitorSearchEnabled = getRuntimeSettingBoolean(
    settingsByKey,
    AGENCY_RUNTIME_SETTING_KEYS.competitorSearchEnabled,
    process.env.AGENCY_COMPETITOR_SEARCH_ENABLED === 'true',
  );
  const competitorSearchProvider = getRuntimeSettingString(
    settingsByKey,
    AGENCY_RUNTIME_SETTING_KEYS.competitorSearchProvider,
    process.env.AGENCY_COMPETITOR_SEARCH_PROVIDER?.trim() || 'none',
  );

  return {
    storageReady: Boolean(schemaReady),
    ai: {
      enabled: aiEnabled,
      provider: aiProvider,
      model: aiModel,
      timeoutMs: Number.isFinite(aiTimeoutMs) ? Math.max(5000, aiTimeoutMs) : 45000,
      inputMaxChars: Number.isFinite(aiInputMaxChars) ? Math.max(6000, aiInputMaxChars) : 24000,
      stringMaxChars: Number.isFinite(aiStringMaxChars) ? Math.max(500, aiStringMaxChars) : 2200,
      fileTextMaxChars: Number.isFinite(aiFileTextMaxChars) ? Math.max(300, aiFileTextMaxChars) : 1200,
      maxOutputTokens: Number.isFinite(aiMaxOutputTokens) ? Math.max(0, aiMaxOutputTokens) : 0,
      defaultMode: aiDefaultMode === 'deep' ? 'deep' : 'quick',
      debugEnabled: aiDebugEnabled,
      functionModels: aiFunctionModels,
      openAiApiKey,
      apiKeyConfigured: Boolean(openAiApiKey),
      apiKeySource: openAiApiKeySource,
      dbSecretConfigured: Boolean(openAiSecretRecord),
      dbSecretReadable,
      anthropicApiKey,
      anthropicApiKeyConfigured: Boolean(anthropicApiKey),
      anthropicApiKeySource,
      anthropicDbSecretConfigured: Boolean(anthropicSecretRecord),
      anthropicDbSecretReadable: dbAnthropicSecretReadable,
    },
    competitorSearch: {
      enabled: competitorSearchEnabled,
      provider: competitorSearchProvider,
    },
  };
};

// Espone la sola chiave OpenAI risolta (segreto cifrato su DB o env), per riuso da
// altri moduli (es. vettorizzazione Fonti) senza duplicare la logica di decifratura.
// Ritorna null se non configurata.
export const resolveAgencyOpenAiApiKey = async (workspaceId?: string): Promise<string | null> => {
  const runtimeConfig = await resolveAgencyRuntimeConfig(workspaceId);
  return runtimeConfig.ai.openAiApiKey ?? null;
};

const getAgencyAiStatusPayload = async (workspaceId?: string) => {
  const runtimeConfig = await resolveAgencyRuntimeConfig(workspaceId);
  const configuredProvider = runtimeConfig.ai.provider;

  // Entrambi i provider sono di prima classe. Difetto storico: lo stato "configurato"
  // guardava SOLO la chiave del provider di default, così avere solo l'altra chiave
  // risultava "non configurato". Ora l'AI è "configurata" se è abilitata e ALMENO un
  // provider (OpenAI o Anthropic) ha la chiave. Il provider EFFETTIVO usato dalle
  // generazioni è quello di default se ha la chiave, altrimenti l'altro se ce l'ha: così
  // una chiave presente basta a far funzionare l'AI e non si parte mai verso un provider
  // senza chiave (niente 401 al posto del ripiego pulito). Il selettore per-sessione della
  // chat resta libero di scegliere qualunque provider con chiave (invariato).
  const openAiKeyPresent = Boolean(runtimeConfig.ai.openAiApiKey);
  const anthropicKeyPresent = Boolean(runtimeConfig.ai.anthropicApiKey);

  let provider: 'none' | AgencyAiProvider = 'none';
  if (
    (configuredProvider === 'openai' || configuredProvider === 'anthropic')
    && isAgencyProviderKeyPresent(runtimeConfig, configuredProvider)
  ) {
    provider = configuredProvider;
  } else if (openAiKeyPresent) {
    provider = 'openai';
  } else if (anthropicKeyPresent) {
    provider = 'anthropic';
  }

  const configured = runtimeConfig.ai.enabled && provider !== 'none';
  const providerKeyConfigured = provider === 'anthropic'
    ? anthropicKeyPresent
    : provider === 'openai'
      ? openAiKeyPresent
      : false;

  // Modello effettivo per il provider risolto: se il modello di default è di un altro
  // provider (es. default storico gpt-* con provider effettivo Anthropic),
  // resolveAgencyProviderModel ripiega sul default del provider effettivo.
  const model = resolveAgencyProviderModel(
    provider === 'none' ? configuredProvider : provider,
    runtimeConfig.ai.model,
  );

  return {
    status: configured ? 'configured' : 'not_configured',
    configured,
    enabled: runtimeConfig.ai.enabled,
    provider,
    model,
    serverSideOnly: true,
    apiKeyConfigured: providerKeyConfigured,
    apiKeySource: provider === 'anthropic'
      ? runtimeConfig.ai.anthropicApiKeySource
      : runtimeConfig.ai.apiKeySource,
    storageReady: runtimeConfig.storageReady,
    message: configured
      ? 'AI configurata lato server. Le generazioni possono usare il provider AI.'
      : 'AI non configurata. Il sistema usa generatori rule-based dichiarati.',
  };
};

const readPositiveIntEnv = (key: string, fallback: number, min = 1000) => {
  const value = Number(process.env[key] || fallback);
  return Number.isFinite(value) ? Math.max(min, Math.floor(value)) : fallback;
};

const AGENCY_AI_INPUT_MAX_CHARS = () => readPositiveIntEnv('AGENCY_AI_INPUT_MAX_CHARS', 24000, 6000);
const AGENCY_AI_STRING_MAX_CHARS = () => readPositiveIntEnv('AGENCY_AI_STRING_MAX_CHARS', 2200, 500);
const AGENCY_AI_FILE_TEXT_MAX_CHARS = () => readPositiveIntEnv('AGENCY_AI_FILE_TEXT_MAX_CHARS', 1200, 300);
const agencyAiInFlight = new Map<string, Promise<AgencyAiJsonResult | null>>();

type AgencyAiJsonMeta = {
  functionName: string;
  model: string;
  inputHash: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd?: number;
  durationMs: number;
  cacheHit: boolean;
  status: 'success' | 'cache_hit' | 'failed';
};

type AgencyAiJsonResult = {
  payload: Record<string, unknown>;
  meta: AgencyAiJsonMeta;
};

const clipAgencyAiText = (value: unknown, max = AGENCY_AI_STRING_MAX_CHARS()) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    return '';
  }
  return text.length > max ? `${text.slice(0, max)}\n[contenuto abbreviato]` : text;
};

const compactAgencyAiValue = (value: unknown, key = '', depth = 0): unknown => {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    const max = ['extractedTextPreview', 'manualText', 'textPreview'].includes(key)
      ? AGENCY_AI_FILE_TEXT_MAX_CHARS()
      : AGENCY_AI_STRING_MAX_CHARS();
    return clipAgencyAiText(value, max);
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (depth >= 5) {
    return '[contenuto compatto]';
  }
  if (Array.isArray(value)) {
    const limits: Record<string, number> = {
      urls: 12,
      uploadedFiles: 8,
      competitors: 8,
      confirmedCompetitors: 8,
      parsedFiles: 4,
      webProjects: 6,
      adsProjects: 6,
      sectionPlan: 12,
      faqItems: 8,
      recommendations: 8,
      missingInputs: 8,
    };
    const limit = limits[key] ?? 10;
    return value.slice(0, limit).map((entry) => compactAgencyAiValue(entry, key, depth + 1));
  }
  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [
    entryKey,
    compactAgencyAiValue(entryValue, entryKey, depth + 1),
  ]));
};

const stringifyCompactAgencyAiPayload = (payload: unknown, maxChars = AGENCY_AI_INPUT_MAX_CHARS()) => (
  JSON.stringify(compactAgencyAiValue(payload)).slice(0, maxChars)
);

const estimateAgencyAiTokens = (text: string) => Math.ceil(text.length / 4);

// Provider AI supportati dal motore (oltre a 'none').
const AGENCY_AI_PROVIDERS = ['openai', 'anthropic'] as const;
type AgencyAiProvider = (typeof AGENCY_AI_PROVIDERS)[number];

// Default quando il provider è Anthropic: modello premium e tetto token (Anthropic
// richiede sempre max_tokens, a differenza di OpenAI dove è opzionale).
const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-4-8';
const DEFAULT_ANTHROPIC_MAX_TOKENS = 4096;
const ANTHROPIC_API_VERSION = '2023-06-01';

// Modello effettivo per il provider. Se il provider è Anthropic ma il modello
// configurato non è un modello Claude (retaggio: default storico 'gpt-4o-mini'),
// si ricade sul default Claude, così switchare provider non richiede anche di
// riscrivere il modello a mano.
const resolveAgencyProviderModel = (provider: string, configuredModel: string): string => {
  if (provider === 'anthropic') {
    return configuredModel.toLowerCase().startsWith('claude') ? configuredModel : DEFAULT_ANTHROPIC_MODEL;
  }
  return configuredModel;
};

// Catalogo curato dei modelli selezionabili nel selettore per-sessione della Chat AI
// (deciso il 20/7/2026: provider + modello specifico, ambito per sessione). Non e'
// l'universo dei modelli: e' una lista umana e ristretta. Il `provider` di ogni voce
// guida sia il ramo API sia la chiave usata; l'`id` contiene la parola chiave
// (opus/sonnet/haiku, gpt-*) su cui poggiano gia' finestra di contesto (chat-context.ts)
// e stima costi (estimateAgencyAiCostUsd). Gli id vanno tenuti allineati a quelli reali
// del provider: il collaudo vero e' con le chiavi, a fine V.
type AgencyAiModelOption = {
  id: string;
  provider: AgencyAiProvider;
  label: string;
  hint: string;
};
const AGENCY_AI_MODEL_CATALOG: readonly AgencyAiModelOption[] = [
  { id: 'claude-opus-4-8', provider: 'anthropic', label: 'Claude Opus 4.8', hint: 'Massima qualita' },
  { id: 'claude-sonnet-5', provider: 'anthropic', label: 'Claude Sonnet 5', hint: 'Equilibrato' },
  { id: 'claude-haiku-4-5-20251001', provider: 'anthropic', label: 'Claude Haiku 4.5', hint: 'Veloce ed economico' },
  { id: 'gpt-5', provider: 'openai', label: 'GPT-5', hint: 'Massima qualita' },
  { id: 'gpt-4o', provider: 'openai', label: 'GPT-4o', hint: 'Equilibrato' },
  { id: 'gpt-4o-mini', provider: 'openai', label: 'GPT-4o mini', hint: 'Veloce ed economico' },
];
const findAgencyCatalogModel = (id?: string | null): AgencyAiModelOption | null => {
  const trimmed = typeof id === 'string' ? id.trim() : '';
  if (!trimmed) {
    return null;
  }
  return AGENCY_AI_MODEL_CATALOG.find((entry) => entry.id === trimmed) ?? null;
};

// Un modello del catalogo e' "usabile" solo se il suo provider ha una chiave (DB o env).
const isAgencyProviderKeyPresent = (
  runtimeConfig: Awaited<ReturnType<typeof resolveAgencyRuntimeConfig>>,
  provider: AgencyAiProvider,
): boolean => (
  provider === 'anthropic'
    ? Boolean(runtimeConfig.ai.anthropicApiKey)
    : Boolean(runtimeConfig.ai.openAiApiKey)
);

// Opzioni per il selettore di modello in Chat AI: catalogo + disponibilita' per-provider
// (chiave presente) + il default di workspace, cosi' la UI marca la scelta corrente e
// disabilita i provider senza chiave.
const getAgencyChatModelOptions = async (workspaceId?: string) => {
  const runtimeConfig = await resolveAgencyRuntimeConfig(workspaceId);
  const status = await getAgencyAiStatusPayload(workspaceId);
  return {
    configured: status.configured,
    defaultProvider: status.provider,
    defaultModel: status.model,
    models: AGENCY_AI_MODEL_CATALOG.map((entry) => ({
      id: entry.id,
      provider: entry.provider,
      label: entry.label,
      hint: entry.hint,
      available: isAgencyProviderKeyPresent(runtimeConfig, entry.provider),
    })),
  };
};

const estimateAgencyAiCostUsd = (model: string, inputTokens: number, outputTokens: number) => {
  const normalizedModel = model.toLowerCase();
  const rates = normalizedModel.includes('gpt-4o-mini')
    ? { inputPerMillion: 0.15, outputPerMillion: 0.6 }
    : normalizedModel.includes('gpt-4o')
      ? { inputPerMillion: 5, outputPerMillion: 15 }
      : normalizedModel.includes('gpt-5')
        ? { inputPerMillion: 1.25, outputPerMillion: 10 }
        // Modelli Claude/Anthropic (prezzi per 1M token, input/output).
        : normalizedModel.includes('claude-haiku') || normalizedModel.includes('haiku')
          ? { inputPerMillion: 1, outputPerMillion: 5 }
          : normalizedModel.includes('claude-sonnet') || normalizedModel.includes('sonnet')
            ? { inputPerMillion: 3, outputPerMillion: 15 }
            : normalizedModel.includes('claude-opus') || normalizedModel.includes('opus')
              ? { inputPerMillion: 5, outputPerMillion: 25 }
              : normalizedModel.includes('claude-fable') || normalizedModel.includes('fable')
                ? { inputPerMillion: 10, outputPerMillion: 50 }
                : normalizedModel.includes('claude')
                  ? { inputPerMillion: 5, outputPerMillion: 25 }
                  : { inputPerMillion: 2, outputPerMillion: 8 };
  const cost = ((inputTokens / 1_000_000) * rates.inputPerMillion)
    + ((outputTokens / 1_000_000) * rates.outputPerMillion);
  return Number(cost.toFixed(6));
};

// Stima di costo dei pulsanti AI (V4 — cost control). I pulsanti a funzione
// predefinita che passano dal motore AI e vengono loggati in AiUsageLog. Per
// ognuno un token-seed (stima grezza input/output) usato finché non ci sono
// abbastanza usi reali: da lì in poi la stima si affina sui token storici.
type AgencyAiEstimatableFunction = {
  functionName: string;
  label: string;
  seedInputTokens: number;
  seedOutputTokens: number;
};

const AGENCY_AI_ESTIMATABLE_FUNCTIONS: AgencyAiEstimatableFunction[] = [
  { functionName: 'discovery.generateBrief', label: 'Brief completo', seedInputTokens: 4000, seedOutputTokens: 2000 },
  { functionName: 'discovery.generateSection', label: 'Sezione del Brief', seedInputTokens: 2500, seedOutputTokens: 800 },
  { functionName: 'web.generateProject', label: 'Struttura sito/landing', seedInputTokens: 3000, seedOutputTokens: 1500 },
  { functionName: 'web.generateBlock', label: 'Blocco sito', seedInputTokens: 1500, seedOutputTokens: 600 },
  { functionName: 'ads.generateAsset', label: 'Copy campagna ADV', seedInputTokens: 1500, seedOutputTokens: 500 },
];

// Numero minimo di usi reali oltre il quale la stima passa dallo "seed" allo
// storico. Sotto questa soglia il range resta indicativo (basato sul seed).
const AGENCY_AI_ESTIMATE_MIN_SAMPLES = 4;
// Quanti campioni recenti considerare per la distribuzione storica.
const AGENCY_AI_ESTIMATE_SAMPLE_LIMIT = 50;

// Percentile (nearest-rank) su un array già ordinato in modo crescente.
const percentileSorted = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[idx];
};

// Errore dedicato al superamento del budget AI giornaliero (V4 — cost control).
// Distinto dagli altri errori così i chiamanti possono mostrarlo chiaramente
// invece di trattarlo come un fallback silenzioso.
export class AiBudgetExceededError extends Error {
  readonly code = 'AI_BUDGET_EXCEEDED';
  readonly dailyLimitUsd: number;
  readonly spentTodayUsd: number;

  constructor(dailyLimitUsd: number, spentTodayUsd: number) {
    super(
      `Budget AI giornaliero superato: spesi $${spentTodayUsd.toFixed(4)} su un limite di $${dailyLimitUsd.toFixed(2)}. Riprova domani o chiedi all'amministratore di alzare il limite.`,
    );
    this.name = 'AiBudgetExceededError';
    this.dailyLimitUsd = dailyLimitUsd;
    this.spentTodayUsd = spentTodayUsd;
  }
}

// Mezzanotte locale del server: inizio della giornata corrente per il budget.
const startOfToday = (): Date => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

// Controllo budget PRIMA di una chiamata AI a pagamento. Salta se non c'è un utente
// nel contesto (job di sistema) o se il limite è 0 (nessun limite). Se la spesa già
// registrata oggi raggiunge/supera il limite, solleva AiBudgetExceededError.
const assertWithinAiBudget = async (workspaceId?: string): Promise<void> => {
  if (!workspaceId) {
    return;
  }
  const userId = requestContext.getUserId();
  if (!userId) {
    return;
  }
  const { dailyLimitUsd } = await aiBudgetRepository.resolveLimitForUser(workspaceId, userId);
  if (!dailyLimitUsd || dailyLimitUsd <= 0) {
    return;
  }
  const spentToday = await aiUsageRepository.sumCostForUser(workspaceId, userId, startOfToday());
  if (spentToday >= dailyLimitUsd) {
    throw new AiBudgetExceededError(dailyLimitUsd, spentToday);
  }
};

// Estrae il testo dalla risposta Anthropic Messages API: content è un array di
// blocchi, i blocchi di tipo 'text' contengono il testo generato.
const extractAnthropicTextContent = (payload: unknown): string => {
  if (!isRecord(payload)) {
    return '';
  }
  const content = Array.isArray(payload.content) ? payload.content : [];
  const text = content
    .map((part) => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
    .join('');
  return text;
};


// Claude a volte incornicia il JSON in un blocco markdown (```json … ```), aggiunge
// un preambolo/commento, o tronca la risposta lasciando la fence di chiusura assente.
// Lo stripping rende il parse robusto senza forzare structured outputs. NB: il vecchio
// regex ancorato (^```…```$) rimuoveva la fence SOLO se tutta la risposta era un blocco
// pulito: negli altri casi la fence sopravviveva e JSON.parse falliva, facendo ricadere
// in silenzio le generazioni JSON (Discovery/Web/Ads) sul fallback rule-based.
const stripJsonCodeFence = (raw: string): string => {
  let text = raw.trim();
  // 1) Rimuove la fence di apertura (anche se la chiusura manca per troncamento) e
  //    l'eventuale fence di chiusura. Solo se la risposta INIZIA con ``` così una
  //    ``` dentro un valore stringa del JSON pulito non innesca lo strip.
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  }
  // 2) Se resta del testo attorno all'oggetto/array JSON (preambolo o coda), lo isola
  //    dal primo delimitatore di apertura all'ultimo di chiusura. No-op su JSON già
  //    pulito; su risposta troncata restituisce il frammento (il parse fallirà come
  //    "Unexpected end", segnalando il troncamento invece di una fence non rimossa).
  const objStart = text.indexOf('{');
  const arrStart = text.indexOf('[');
  const start = objStart === -1 ? arrStart : arrStart === -1 ? objStart : Math.min(objStart, arrStart);
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (start !== -1 && end >= start) {
    text = text.slice(start, end + 1);
  }
  return text;
};

const extractOpenAiTextContent = (payload: unknown): string => {
  if (!isRecord(payload)) {
    return '';
  }
  if (typeof payload.output_text === 'string') {
    return payload.output_text;
  }
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!isRecord(item)) {
      continue;
    }
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (!isRecord(part)) {
        continue;
      }
      if (typeof part.text === 'string' && part.text.trim()) {
        return part.text;
      }
    }
  }
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  for (const choice of choices) {
    if (!isRecord(choice)) {
      continue;
    }
    const message = isRecord(choice.message) ? choice.message : {};
    const content = message.content;
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      const text = content
        .map((part) => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
        .join('');
      if (text.trim()) {
        return text;
      }
    }
  }
  return '';
};

const buildAgencyAiInputHash = (parts: unknown) => (
  createHash('sha256').update(JSON.stringify(compactAgencyAiValue(parts))).digest('hex')
);

const appendAgencyAiHistory = (
  current: unknown,
  entry: Record<string, unknown>,
  limit = 30,
) => [
  ...(Array.isArray(current) ? current.filter(isRecord) : []),
  entry,
].slice(-limit);

const buildAgencyAiProjectSnapshot = (project: AgencyProjectPayload) => ({
  id: project.id,
  name: project.name,
  clientName: project.clientName,
  projectType: project.projectType ? {
    key: project.projectType.key,
    label: project.projectType.label,
  } : null,
  goal: clipAgencyAiText(project.goal, 1200),
  statusAgency: project.statusAgency,
  priorityAgency: project.priorityAgency,
  scopePurchased: Object.entries(project.scopePurchased || {})
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => ({ key, value: compactAgencyAiValue(value, key) })),
});

const buildAgencyAiSourceSnapshot = (sources: AgencyProjectSourcesPayload) => ({
  sourceStatus: sources.sourceStatus,
  sourceQuality: sources.sourceQuality || sources.sourceStatus,
  sourceSummary: clipAgencyAiText(sources.sourceSummary, 1200),
  primaryWebsiteUrl: sources.primaryWebsiteUrl || sources.websiteUrl,
  urls: sources.urls
    .filter((entry) => entry.status === 'active')
    .slice(0, 12)
    .map((entry) => ({
      label: entry.label,
      type: entry.type,
      url: entry.url,
      notes: clipAgencyAiText(entry.notes, 500),
    })),
  manualNotes: clipAgencyAiText(sources.manualNotes, 2200),
  competitors: sources.competitors
    .filter((entry) => entry.status === 'confirmed')
    .slice(0, 8)
    .map((entry) => ({
      name: entry.name,
      url: entry.url,
      source: entry.source,
      reason: clipAgencyAiText(entry.reason, 500),
    })),
  uploadedFiles: sources.uploadedFiles.slice(0, 8).map((entry) => ({
    id: entry.id,
    name: entry.originalName || entry.name,
    mimeType: entry.mimeType,
    extension: entry.extension,
    status: entry.status,
    parseStatus: entry.parseStatus || 'not_parsed',
    extractedTextLength: entry.extractedTextLength || 0,
    extractedTextPreview: clipAgencyAiText(entry.extractedTextPreview, AGENCY_AI_FILE_TEXT_MAX_CHARS()),
    manualText: clipAgencyAiText(entry.manualText, AGENCY_AI_FILE_TEXT_MAX_CHARS()),
    notes: clipAgencyAiText(entry.notes, 500),
  })),
  missingSourceWarnings: (sources.missingSourceWarnings || []).slice(0, 8),
  usedSources: (sources.usedSources || []).slice(0, 12),
  unreadableFiles: (sources.unreadableFiles || []).slice(0, 8),
});

// Recupero semantico (RAG, passo 4b): fornisce al modello i passaggi delle Fonti
// più pertinenti al progetto, oltre agli snapshot troncati. Best-effort: se manca
// la chiave OpenAI, non ci sono chunk indicizzati o la ricerca fallisce, ritorna []
// senza disturbare la generazione (comportamento invariato). Gli embeddings usano
// sempre OpenAI (Anthropic non ne ha), a prescindere dal provider di generazione.
const retrieveRelevantSourceExcerpts = async (input: {
  workspaceId: string;
  projectId: string;
  project: AgencyProjectPayload;
  topK?: number;
}): Promise<Array<{ sourceId: string; chunkIndex: number; excerpt: string; score: number }>> => {
  try {
    const apiKey = await resolveAgencyOpenAiApiKey(input.workspaceId);
    if (!apiKey) {
      return [];
    }
    const query = [input.project.name, input.project.clientName, input.project.goal]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean)
      .join('. ')
      .slice(0, 1000);
    if (!query) {
      return [];
    }
    const hits = await searchProjectSources({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      query,
      topK: input.topK ?? 8,
      embedder: createLoggingOpenAiEmbedder({
        apiKey,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        functionName: 'sources.embed.search',
      }),
    });
    return hits.map((hit) => ({
      sourceId: hit.sourceId,
      chunkIndex: hit.chunkIndex,
      excerpt: clipAgencyAiText(hit.content, 800),
      score: Math.round(hit.score * 1000) / 1000,
    }));
  } catch (error) {
    logAgencyServiceEvent('RAG retrieval saltato (best-effort).', {
      projectId: input.projectId,
      reason: (error as Error).message,
    });
    return [];
  }
};

// Recupero RAG a partire da una domanda esplicita (Chat AI di progetto). Come
// retrieveRelevantSourceExcerpts ma la query è il messaggio dell'utente invece
// del profilo del progetto. Best-effort: senza chiave OpenAI / chunk / su errore
// ritorna [] senza rompere la chat (che risponderà col solo contesto testuale).
const retrieveSourceExcerptsForQuery = async (input: {
  workspaceId: string;
  projectId: string;
  query: string;
  topK?: number;
}): Promise<Array<{ sourceId: string; chunkIndex: number; excerpt: string; score: number }>> => {
  const query = (input.query ?? '').trim().slice(0, 1000);
  if (!query) {
    return [];
  }
  try {
    const apiKey = await resolveAgencyOpenAiApiKey(input.workspaceId);
    if (!apiKey) {
      return [];
    }
    const hits = await searchProjectSources({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      query,
      topK: input.topK ?? 6,
      embedder: createLoggingOpenAiEmbedder({
        apiKey,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        functionName: 'sources.embed.search',
      }),
    });
    return hits.map((hit) => ({
      sourceId: hit.sourceId,
      chunkIndex: hit.chunkIndex,
      excerpt: clipAgencyAiText(hit.content, 900),
      score: Math.round(hit.score * 1000) / 1000,
    }));
  } catch (error) {
    logAgencyServiceEvent('RAG chat retrieval saltato (best-effort).', {
      projectId: input.projectId,
      reason: (error as Error).message,
    });
    return [];
  }
};

// Nota: la finestra di storico passata al modello e' governata dalla compressione
// del contesto (Fase 5, CONTEXT_FETCH_LIMIT in chat-context.ts), non piu' da un tetto
// fisso di turni: oltre soglia i messaggi vecchi si riassumono invece di sparire.

// Quanti allegati dei turni PRECEDENTI ripassare al modello, oltre a quelli del
// turno corrente. Tenuto basso: ogni allegato pesa fino a ATTACHMENT_PROMPT_CHARS
// caratteri, e il contesto va speso soprattutto sul messaggio in corso.
const CHAT_HISTORY_ATTACHMENT_LIMIT = 3;

type ProjectChatCitation = {
  sourceId: string;
  sourceTitle: string;
  excerpt: string;
  score: number;
};

// Prompt di sistema "grounded" della Chat AI di progetto: vincola il modello a
// rispondere SOLO col contesto del progetto (profilo + estratti RAG delle Fonti),
// a dichiarare quando l'informazione non c'è e a citare le fonti usate.
const buildProjectChatSystemPrompt = (input: {
  projectName: string;
  clientName: string | null;
  goal: string;
  citations: ProjectChatCitation[];
}): string => {
  const rules = [
    "Sei l'assistente AI di un progetto di un'agenzia. Rispondi in italiano, in modo chiaro e conciso.",
    'Usa ESCLUSIVAMENTE le informazioni del contesto qui sotto (profilo del progetto, estratti delle Fonti ed eventuali ALLEGATI del messaggio).',
    'Se la risposta non è nel contesto, dillo esplicitamente ("Questa informazione non è presente nelle fonti del progetto") invece di inventare.',
    'Quando usi un estratto, cita la fonte tra parentesi con il suo numero, es. [1]; per un allegato usa la sua sigla, es. [A1].',
  ].join(' ');
  const profile = [
    'PROFILO PROGETTO:',
    `- Nome: ${input.projectName || 'n/d'}`,
    `- Cliente: ${input.clientName || 'n/d'}`,
    `- Obiettivo: ${input.goal || 'n/d'}`,
  ].join('\n');
  const sources = input.citations.length > 0
    ? ['ESTRATTI DELLE FONTI:', ...input.citations.map((citation, index) => `[${index + 1}] (${citation.sourceTitle}) ${citation.excerpt}`)].join('\n')
    : 'ESTRATTI DELLE FONTI: nessun estratto pertinente trovato per questa domanda.';
  return `${rules}\n\n${profile}\n\n${sources}`;
};

// Autore da mostrare in UI: null per i messaggi dell'AI (authorUserId assente).
type ConversationAuthorRow = { id: string; name: string | null; email: string } | null | undefined;

// Allegato come lo vede la UI: mai il testo estratto (puo' essere enorme e serve
// solo al prompt), solo l'etichetta e i metadati per disegnare il chip.
type ConversationAttachmentRow = {
  id: string;
  kind: string;
  entityType: string | null;
  entityId: string | null;
  label: string;
  mimeType: string | null;
  fileSize: number | null;
  contentChars: number;
  createdAt: Date;
  binary?: { attachmentId: string } | null;
};

const mapConversationAttachment = (row: ConversationAttachmentRow) => ({
  id: row.id,
  kind: row.kind,
  entityType: row.entityType,
  entityId: row.entityId,
  label: row.label,
  mimeType: row.mimeType,
  fileSize: row.fileSize,
  contentChars: row.contentChars,
  createdAt: row.createdAt.toISOString(),
  // C'è un binario originale da scaricare? (i byte non viaggiano qui, solo il flag)
  hasFile: Boolean(row.binary),
});

const mapConversationMessage = (row: {
  id: string;
  role: string;
  content: string;
  citationsJson: unknown;
  createdAt: Date;
  authorUserId: string | null;
  author?: ConversationAuthorRow;
  attachments?: ConversationAttachmentRow[];
}) => ({
  id: row.id,
  role: row.role,
  content: row.content,
  citations: Array.isArray(row.citationsJson) ? (row.citationsJson as ProjectChatCitation[]) : [],
  attachments: (row.attachments ?? []).map(mapConversationAttachment),
  createdAt: row.createdAt.toISOString(),
  author: row.authorUserId
    ? { id: row.authorUserId, name: row.author?.name ?? null, email: row.author?.email ?? null }
    : null,
});

const mapConversationParticipant = (row: {
  userId: string;
  role: string;
  createdAt: Date;
  user?: ConversationAuthorRow;
}) => ({
  userId: row.userId,
  role: row.role,
  name: row.user?.name ?? null,
  email: row.user?.email ?? null,
  joinedAt: row.createdAt.toISOString(),
});

// Riga dell'elenco sessioni. `frozenAt` valorizzato = sessione ARCHIVIATA per chi
// guarda (ne e' uscito, o l'hanno rimosso, o il gruppo si e' sciolto): resta
// consultabile in sola lettura fino a quella data.
const mapConversationSession = (row: {
  id: string;
  title: string | null;
  lastMessageAt: Date | null;
  createdAt: Date;
  resumedFromConversationId: string | null;
  participants: { role: string; frozenAt: Date | null }[];
  _count: { messages: number; participants: number };
}) => {
  const me = row.participants[0];
  return {
    id: row.id,
    title: row.title,
    lastMessageAt: (row.lastMessageAt ?? row.createdAt).toISOString(),
    createdAt: row.createdAt.toISOString(),
    messageCount: row._count.messages,
    participantCount: row._count.participants,
    isGroup: row._count.participants > 1,
    isFrozen: Boolean(me?.frozenAt),
    frozenAt: me?.frozenAt ? me.frozenAt.toISOString() : null,
    canManage: me?.role === 'owner' && !me?.frozenAt,
    resumedFrom: row.resumedFromConversationId,
  };
};

// --- Chat AI con AMBITI (Fase 2): oltre a 'project', anche 'client' e 'general'. ---

// Bersaglio d'ambito di una conversazione: identifica quale conversazione (e quale
// contesto RAG) usare. project -> un progetto; client -> tutti i progetti del
// cliente; general -> nessun contesto CRM.
type ChatScopeTarget =
  | { scope: 'project'; projectId: string }
  | { scope: 'client'; clientId: string }
  | { scope: 'general' };

// Progetti che l'utente puo' vedere secondo la visibilita' V2 (owner/assegnazione/
// reparti; chi ha projects.view_all vede tutto). Ricalca projectsService.resolveProjectVisibility
// usando i repository condivisi, per non accoppiare Agency al modulo projects.
// Usato dal selettore d'ambito della chat (Fase 2) e dal controllo di visibilita'
// degli allegati CRM (Fase 3a), che devono applicare la stessa regola.
const resolveVisibleChatProjects = async (workspaceId: string, userId: string) => {
  const hasViewAll = await rbacRepository.hasPermission(userId, workspaceId, 'projects.view_all');
  const ledDepartmentIds = hasViewAll
    ? []
    : await departmentRepository.listLedDepartmentIds(workspaceId, userId);
  const scope = hasViewAll
    ? null
    : { userId, ledDepartmentIds, isLead: ledDepartmentIds.length > 0 };
  return agencyRepository.listAgencyChatProjects(workspaceId, scope, userId);
};

// Un elemento CRM si puo' allegare solo se l'utente potrebbe comunque vederlo:
// l'allegato ne mette il contenuto sotto gli occhi di tutti i partecipanti alla
// conversazione, quindi vale la stessa visibilita' V2 del selettore d'ambito.
// Progetto/fonte si validano sul progetto; cliente/preventivo-senza-progetto sul
// cliente, derivato dai progetti visibili (in V2 non esiste assegnazione diretta
// utente-cliente, come gia' per il selettore di Fase 2).
const assertEntityAttachable = async (input: {
  workspaceId: string;
  userId: string;
  entityType: AttachableEntityType;
  snapshot: { projectId: string | null; clientId: string | null };
}) => {
  const projects = await resolveVisibleChatProjects(input.workspaceId, input.userId);
  const denied = forbidden(`Non hai accesso a questo elemento (${ENTITY_TYPE_LABEL[input.entityType]}).`);
  if (input.snapshot.projectId) {
    if (!projects.some((project) => project.id === input.snapshot.projectId)) {
      throw denied;
    }
    return;
  }
  if (input.snapshot.clientId) {
    if (!projects.some((project) => project.clientId === input.snapshot.clientId)) {
      throw denied;
    }
    return;
  }
  throw denied;
};

// Titolo automatico di una sessione: le prime parole del primo messaggio, senza
// chiamare l'AI (gratis, e funziona anche senza chiavi configurate). Rinominabile
// a mano dall'utente.
const SESSION_TITLE_MAX = 60;
const buildSessionTitle = (firstMessage: string): string | null => {
  const clean = firstMessage.replace(/\s+/g, ' ').trim();
  if (!clean) {
    return null;
  }
  if (clean.length <= SESSION_TITLE_MAX) {
    return clean;
  }
  // Taglia sull'ultimo spazio utile, cosi' non si spezzano le parole a meta'.
  const cut = clean.slice(0, SESSION_TITLE_MAX);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
};

// La SESSIONE su cui lavora la richiesta, con i diritti dell'utente su di essa.
// Regole (spec sez. 4-bis):
//  - conversationId indicato -> quella sessione, se e' dell'ambito giusto e l'utente
//    vi partecipa (anche da congelato: la vede in sola lettura);
//  - conversationId assente -> l'ultima sessione dell'utente su quell'ambito, e se
//    non ne ha nessuna se ne crea una SUA. E' qui che si ripara il difetto storico:
//    prima si atterrava sull'unica conversazione dell'ambito, e chi non l'aveva
//    aperta per primo restava fuori (zero messaggi, scrittura negata).
// `moderatorOk`: ammette anche chi non partecipa ma ha chat.moderate, restituendo
// participant = null. Si usa per le operazioni di GESTIONE (membri, scioglimento),
// mai per leggere i messaggi.
const resolveScopedSession = async (input: {
  workspaceId: string;
  userId: string;
  target: ChatScopeTarget;
  conversationId?: string | null;
  createIfMissing?: boolean;
  moderatorOk?: boolean;
}) => {
  if (input.conversationId) {
    const conversation = await aiConversationRepository.findSessionById(input.workspaceId, input.conversationId);
    if (!conversation || !matchesScope(conversation, input.target)) {
      throw notFound('Conversazione non trovata.');
    }
    const participant = await aiConversationRepository.findParticipant(conversation.id, input.userId);
    if (!participant) {
      if (input.moderatorOk && (await canModerateChat(input.workspaceId, input.userId))) {
        return { conversation, participant: null };
      }
      throw forbidden('Non fai parte di questa conversazione. Chiedi a un partecipante di invitarti.');
    }
    return { conversation, participant };
  }

  const latest = await aiConversationRepository.findLatestUserSession(input.workspaceId, input.userId, input.target);
  if (latest) {
    const participant = await aiConversationRepository.findParticipant(latest.id, input.userId);
    return { conversation: latest, participant };
  }
  if (input.createIfMissing === false) {
    return { conversation: null, participant: null };
  }
  const created = await aiConversationRepository.createSession({
    workspaceId: input.workspaceId,
    target: input.target,
    creatorUserId: input.userId,
  });
  const participant = await aiConversationRepository.findParticipant(created.id, input.userId);
  return { conversation: created, participant };
};

// La sessione appartiene davvero all'ambito richiesto? Evita che un id di
// conversazione di un altro progetto venga letto passando dalla rotta sbagliata.
const matchesScope = (
  conversation: { scope: string; projectId: string | null; clientId: string | null },
  target: ChatScopeTarget,
) => {
  if (conversation.scope !== target.scope) {
    return false;
  }
  if (target.scope === 'project') {
    return conversation.projectId === target.projectId;
  }
  if (target.scope === 'client') {
    return conversation.clientId === target.clientId;
  }
  return true;
};

// Chi ha chat.moderate (Admin/Superadmin) puo' GESTIRE una sessione altrui — togliere
// membri, subentrare, sciogliere — anche senza esserne partecipante, cosi' un gruppo
// non resta mai ingestibile. NON e' un lasciapassare sui contenuti: i messaggi restano
// visibili ai soli partecipanti, moderare non vuol dire leggere (spec sez. 4-bis).
const canModerateChat = (workspaceId: string, userId: string) =>
  rbacRepository.hasPermission(userId, workspaceId, CHAT_PERMISSIONS.moderate);

// L'ambito e' accessibile all'utente? Applica la visibilita' V2 (la stessa del
// selettore d'ambito e degli allegati): senza, basterebbe conoscere l'id di un
// progetto per aprirne la chat, anche di un progetto che non compare nel proprio
// selettore. Gli ambiti Cliente/Generale seguono la stessa regola dei progetti
// visibili (in V2 non esiste assegnazione diretta utente-cliente).
const assertScopeVisible = async (workspaceId: string, userId: string, target: ChatScopeTarget) => {
  if (target.scope === 'general') {
    return;
  }
  const projects = await resolveVisibleChatProjects(workspaceId, userId);
  const visible =
    target.scope === 'project'
      ? projects.some((project) => project.id === target.projectId)
      : projects.some((project) => project.clientId === target.clientId);
  if (!visible) {
    throw forbidden('Non hai accesso alla chat di questo elemento.');
  }
};

// Prompt di sistema per l'ambito Cliente: come quello di progetto ma il contesto
// sono le Fonti di TUTTI i progetti del cliente.
const buildClientChatSystemPrompt = (input: { clientName: string; citations: ProjectChatCitation[] }): string => {
  const rules = [
    "Sei l'assistente AI di un'agenzia, a supporto di un intero CLIENTE (che puo' avere piu' progetti). Rispondi in italiano, in modo chiaro e conciso.",
    'Usa ESCLUSIVAMENTE le informazioni del contesto qui sotto (estratti delle Fonti dei progetti del cliente ed eventuali ALLEGATI del messaggio).',
    'Se la risposta non e\' nel contesto, dillo esplicitamente ("Questa informazione non e\' presente nelle fonti del cliente") invece di inventare.',
    'Quando usi un estratto, cita la fonte tra parentesi con il suo numero, es. [1]; per un allegato usa la sua sigla, es. [A1].',
  ].join(' ');
  const profile = `CLIENTE: ${input.clientName || 'n/d'}`;
  const sources = input.citations.length > 0
    ? ['ESTRATTI DELLE FONTI (tutti i progetti del cliente):', ...input.citations.map((c, i) => `[${i + 1}] (${c.sourceTitle}) ${c.excerpt}`)].join('\n')
    : 'ESTRATTI DELLE FONTI: nessun estratto pertinente trovato per questa domanda.';
  return `${rules}\n\n${profile}\n\n${sources}`;
};

// Prompt di sistema per l'ambito Generale: nessun contesto CRM specifico (ma gli
// allegati del messaggio, se ci sono, restano contesto valido).
const buildGeneralChatSystemPrompt = (): string => [
  "Sei l'assistente AI di un'agenzia di marketing. Rispondi in italiano, in modo chiaro e conciso.",
  "Questa e' una chat GENERALE: non hai un progetto o un cliente specifico come contesto.",
  "Aiuta su domande generali di marketing, strategia e uso del CRM. Se serve un'informazione specifica di un progetto o cliente, invita a usare la chat di quel progetto o cliente.",
  "Se il messaggio ha degli ALLEGATI, usali come contesto e citali con la loro sigla, es. [A1].",
].join(' ');

// Sezione ALLEGATI del prompt: contesto specifico portato dall'utente in questo
// turno (documenti caricati o elementi CRM), sopra il contesto d'ambito. E'
// deliberatamente in coda al system prompt, cosi' resta l'ultima cosa letta dal
// modello prima della domanda.
const buildAttachmentsPromptSection = (
  attachments: Array<{ kind: string; label: string; content: string }>,
): string => {
  if (attachments.length === 0) {
    return '';
  }
  return [
    "ALLEGATI DEL MESSAGGIO (contesto specifico fornito dall'utente, prevale sugli estratti quando in conflitto):",
    ...attachments.map((attachment, index) => formatAttachmentForPrompt(attachment, index)),
  ].join('\n\n');
};

// Recupero RAG per l'ambito Cliente: come retrieveSourceExcerptsForQuery ma sui
// chunk di PIU' progetti. Best-effort: senza chiave/chunk ritorna [].
const retrieveClientSourceExcerptsForQuery = async (input: {
  workspaceId: string;
  projectIds: string[];
  query: string;
  topK?: number;
}): Promise<Array<{ sourceId: string; chunkIndex: number; excerpt: string; score: number }>> => {
  const query = (input.query ?? '').trim().slice(0, 1000);
  if (!query || input.projectIds.length === 0) {
    return [];
  }
  try {
    const apiKey = await resolveAgencyOpenAiApiKey(input.workspaceId);
    if (!apiKey) {
      return [];
    }
    const hits = await searchClientSources({
      workspaceId: input.workspaceId,
      projectIds: input.projectIds,
      query,
      topK: input.topK ?? 6,
      embedder: createLoggingOpenAiEmbedder({
        apiKey,
        workspaceId: input.workspaceId,
        functionName: 'sources.embed.search',
      }),
    });
    return hits.map((hit) => ({
      sourceId: hit.sourceId,
      chunkIndex: hit.chunkIndex,
      excerpt: clipAgencyAiText(hit.content, 900),
      score: Math.round(hit.score * 1000) / 1000,
    }));
  } catch (error) {
    logAgencyServiceEvent('RAG chat cliente saltato (best-effort).', {
      clientProjects: input.projectIds.length,
      reason: (error as Error).message,
    });
    return [];
  }
};

// Costruisce il contesto AI (system prompt + citazioni RAG) per l'ambito indicato,
// con in coda gli eventuali ALLEGATI del turno.
const buildScopedChatContext = async (
  workspaceId: string,
  target: ChatScopeTarget,
  message: string,
  attachments: Array<{ kind: string; label: string; content: string }> = [],
): Promise<{ system: string; citations: ProjectChatCitation[] }> => {
  const withAttachments = (system: string): string => {
    const section = buildAttachmentsPromptSection(attachments);
    return section ? `${system}\n\n${section}` : system;
  };
  if (target.scope === 'general') {
    return { system: withAttachments(buildGeneralChatSystemPrompt()), citations: [] };
  }
  if (target.scope === 'project') {
    const [project, excerpts, indexedSources] = await Promise.all([
      agencyRepository.findAgencyProject(workspaceId, target.projectId),
      retrieveSourceExcerptsForQuery({ workspaceId, projectId: target.projectId, query: message, topK: 6 }),
      agencyRepository.listIndexedProjectSources(workspaceId, target.projectId),
    ]);
    const titleById = new Map(indexedSources.map((source) => [source.id, source.title]));
    const citations: ProjectChatCitation[] = excerpts.map((excerpt) => ({
      sourceId: excerpt.sourceId,
      sourceTitle: titleById.get(excerpt.sourceId) || 'Fonte',
      excerpt: excerpt.excerpt,
      score: excerpt.score,
    }));
    const system = buildProjectChatSystemPrompt({
      projectName: project?.name || '',
      clientName: project?.client?.name ?? null,
      goal: project?.goal || '',
      citations,
    });
    return { system: withAttachments(system), citations };
  }
  // client: RAG su tutte le Fonti dei progetti del cliente, titoli risolti insieme.
  const [client, projectIds] = await Promise.all([
    agencyRepository.findAgencyClient(workspaceId, target.clientId),
    aiConversationRepository.listClientProjectIds(workspaceId, target.clientId),
  ]);
  const excerpts = await retrieveClientSourceExcerptsForQuery({ workspaceId, projectIds, query: message, topK: 6 });
  const titles = await agencyRepository.listSourceTitlesByIds(workspaceId, excerpts.map((excerpt) => excerpt.sourceId));
  const titleById = new Map(titles.map((source) => [source.id, source.title]));
  const citations: ProjectChatCitation[] = excerpts.map((excerpt) => ({
    sourceId: excerpt.sourceId,
    sourceTitle: titleById.get(excerpt.sourceId) || 'Fonte',
    excerpt: excerpt.excerpt,
    score: excerpt.score,
  }));
  const system = buildClientChatSystemPrompt({ clientName: client?.name || '', citations });
  return { system: withAttachments(system), citations };
};

const buildAgencyAiDiscoverySnapshot = (sections: DiscoverySections, notes = '') => ({
  sections: Object.fromEntries(DISCOVERY_SECTION_KEYS.map((key) => [
    key,
    clipAgencyAiText(sections[key], 1600),
  ])),
  notes: clipAgencyAiText(notes, 1200),
});

// Esportato per riuso dal modulo Reportistica (sotto-modulo Excel+AI): la mappatura
// colonna->metrica proposta dall'AI usa questo stesso helper structured-output.
export const runAgencyOpenAiJsonWithMeta = async (input: {
  workspaceId?: string;
  system: string;
  user: unknown;
  timeoutMs?: number;
  functionName?: string;
  lockKey?: string;
  // Progetto a cui imputare il consumo nel registro (tutti i chiamanti ce l'hanno:
  // lo usano gia' per la chiave di lock).
  projectId?: string;
  // JSON Schema dell'output atteso. Se presente, con Anthropic si usa lo structured
  // output (tool-use): il JSON lo produce l'API ed e' valido per costruzione.
  // Se assente si resta sul comportamento storico (JSON chiesto a prompt + parse del
  // testo): serve a non far regredire i chiamanti non ancora migrati.
  // NB: lo schema deve elencare davvero i campi attesi, altrimenti Claude risponde con
  // un oggetto vuoto (vedi nota in anthropic-json.ts).
  jsonSchema?: Record<string, unknown>;
}): Promise<AgencyAiJsonResult | null> => {
  const status = await getAgencyAiStatusPayload(input.workspaceId);
  const runtimeConfig = await resolveAgencyRuntimeConfig(input.workspaceId);
  if (!status.configured) {
    return null;
  }
  // Cost control: blocca la chiamata se l'utente ha esaurito il budget giornaliero.
  await assertWithinAiBudget(input.workspaceId);
  const functionName = input.functionName || 'agency_ai_generation';
  const userContent = stringifyCompactAgencyAiPayload(input.user, runtimeConfig.ai.inputMaxChars);
  const inputHash = buildAgencyAiInputHash({
    system: input.system,
    user: userContent,
    functionName,
    model: runtimeConfig.ai.functionModels[functionName] || status.model,
  });
  const lockKey = input.lockKey || `${input.workspaceId || 'workspace'}:${functionName}:${inputHash}`;
  const existing = agencyAiInFlight.get(lockKey);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs || runtimeConfig.ai.timeoutMs);
    try {
      const provider = status.provider as AgencyAiProvider;
      const model = resolveAgencyProviderModel(
        provider,
        runtimeConfig.ai.functionModels[functionName] || status.model,
      );
      const systemPrompt = `${input.system}\nRispondi solo con JSON valido.`;

      let content: string;
      // Valorizzato solo con lo structured output (Anthropic tool-use): in quel caso il
      // JSON e' gia' un oggetto validato dall'API e non va ri-parsato dal testo.
      let structuredPayload: Record<string, unknown> | null = null;
      if (provider === 'anthropic') {
        // Anthropic Messages API. max_tokens è obbligatorio: usa il tetto
        // configurato o il default. Il JSON NON è più chiesto via prompt e ripulito in
        // parse: si obbliga il modello a rispondere chiamando uno "strumento"
        // (structured output), così a produrre il JSON è l'API — valido per costruzione.
        // Prima, su risposte lunghe, Claude emetteva JSON malformato e la generazione
        // ricadeva in silenzio sul rule-based (con la chiamata comunque fatturata).
        const maxTokens = runtimeConfig.ai.maxOutputTokens > 0
          ? runtimeConfig.ai.maxOutputTokens
          : DEFAULT_ANTHROPIC_MAX_TOKENS;
        // Structured output solo se il chiamante ha dichiarato lo schema dell'output.
        const useStructuredOutput = Boolean(input.jsonSchema);
        const requestBody: Record<string, unknown> = {
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }],
        };
        if (input.jsonSchema) {
          requestBody.tools = [buildAnthropicJsonTool(input.jsonSchema)];
          requestBody.tool_choice = { type: 'tool', name: ANTHROPIC_JSON_TOOL_NAME };
        }
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': runtimeConfig.ai.anthropicApiKey ?? '',
            'anthropic-version': ANTHROPIC_API_VERSION,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Anthropic API error ${response.status}`);
        }
        const responsePayload = await response.json();
        if (useStructuredOutput) {
          structuredPayload = extractAnthropicToolInput(responsePayload, ANTHROPIC_JSON_TOOL_NAME);
          // Un tool_use che torna vuoto NON e' un successo: meglio fallire (e far
          // ripiegare il chiamante sul rule-based) che spacciare per AI un brief vuoto.
          if (isEmptyStructuredPayload(structuredPayload)) {
            throw new Error('Anthropic structured output empty');
          }
          // Solo per la stima token/costo del registro consumi.
          content = JSON.stringify(structuredPayload);
        } else {
          content = extractAnthropicTextContent(responsePayload);
          if (!content.trim()) {
            throw new Error('Anthropic response empty');
          }
        }
      } else {
        const requestBody: Record<string, unknown> = {
          model,
          input: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          text: {
            format: { type: 'json_object' },
          },
        };
        if (runtimeConfig.ai.maxOutputTokens > 0) {
          requestBody.max_output_tokens = runtimeConfig.ai.maxOutputTokens;
        }
        let response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${runtimeConfig.ai.openAiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        if (!response.ok && response.status !== 401 && response.status !== 403) {
          const chatRequestBody: Record<string, unknown> = {
            model,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userContent },
            ],
          };
          if (runtimeConfig.ai.maxOutputTokens > 0) {
            chatRequestBody.max_completion_tokens = runtimeConfig.ai.maxOutputTokens;
          }
          response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${runtimeConfig.ai.openAiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(chatRequestBody),
            signal: controller.signal,
          });
        }

        if (!response.ok) {
          throw new Error(`OpenAI API error ${response.status}`);
        }

        const responsePayload = await response.json();
        content = extractOpenAiTextContent(responsePayload);
        if (!content.trim()) {
          throw new Error('OpenAI response empty');
        }
      }
      const estimatedInputTokens = estimateAgencyAiTokens(userContent);
      const estimatedOutputTokens = estimateAgencyAiTokens(content);
      const estimatedCostUsd = estimateAgencyAiCostUsd(model, estimatedInputTokens, estimatedOutputTokens);
      const durationMs = Date.now() - startedAt;

      // Log costi/consumi AI per la Console piattaforma (Fase 4b). Best-effort:
      // un errore di scrittura non deve mai rompere la risposta AI.
      if (input.workspaceId) {
        try {
          await aiUsageRepository.create({
            workspaceId: input.workspaceId,
            // Utente che ha avviato l'azione (dal contesto di richiesta). Null per
            // i job di sistema (sync automatiche senza richiesta HTTP).
            userId: requestContext.getUserId(),
            projectId: input.projectId ?? null,
            functionName,
            model,
            inputTokens: estimatedInputTokens,
            outputTokens: estimatedOutputTokens,
            costUsd: estimatedCostUsd,
            durationMs,
            status: 'success',
          });
        } catch {
          // ignora: il log costi è accessorio rispetto alla risposta AI
        }
      }

      return {
        // Con lo structured output il payload e' gia' un oggetto valido: si ri-parsa dal
        // testo solo nel ramo OpenAI o nel ripiego testuale di Anthropic.
        payload: structuredPayload ?? (JSON.parse(stripJsonCodeFence(content)) as Record<string, unknown>),
        meta: {
          functionName,
          model,
          inputHash,
          estimatedInputTokens,
          estimatedOutputTokens,
          estimatedCostUsd,
          durationMs,
          cacheHit: false,
          status: 'success',
        },
      };
    } finally {
      clearTimeout(timeout);
      agencyAiInFlight.delete(lockKey);
    }
  })();

  agencyAiInFlight.set(lockKey, promise);
  return promise;
};

const runAgencyOpenAiJson = async (input: {
  workspaceId?: string;
  system: string;
  user: unknown;
  timeoutMs?: number;
  functionName?: string;
  lockKey?: string;
}) => {
  const result = await runAgencyOpenAiJsonWithMeta(input);
  return result?.payload || null;
};

// Generazione a TESTO libero (V4 — Chat AI di progetto). Gemello di
// runAgencyOpenAiJsonWithMeta ma senza forzare il JSON: la chat vuole linguaggio
// naturale. Condivide provider-branching, enforcement del budget giornaliero e il
// log costi (AiUsageLog), così la chat rispetta il budget e finisce nel rendiconto
// consumi. Riceve la conversazione (`messages`) invece di un singolo input. Nessun
// lock in-flight: ogni turno di chat è unico, non c'è deduplica da fare.
type AgencyAiTextResult = {
  text: string;
  meta: {
    functionName: string;
    model: string;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    estimatedCostUsd: number;
    durationMs: number;
  };
};

const runAgencyAiTextWithMeta = async (input: {
  workspaceId?: string;
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  timeoutMs?: number;
  functionName?: string;
  // Contesto a cui imputare il consumo nel registro. Per la chat: sempre la
  // conversazione, e il progetto solo quando l'ambito e' Progetto (con l'ambito
  // Cliente il progetto non e' uno solo; con Generale non ce n'e' nessuno).
  projectId?: string;
  conversationId?: string;
  // Modello scelto per la sessione (selettore per-sessione, deciso 20/7/2026). Se e' nel
  // catalogo e il suo provider ha una chiave, sovrascrive provider+modello di workspace
  // SOLO per questa chiamata; altrimenti resta il default di workspace (retro-compat).
  model?: string;
  // Immagini da far "vedere" al modello (Fase 3b). Vuoto/assente = flusso solo-testo
  // identico a prima. Vanno come content block sull'ultimo messaggio user.
  images?: ChatVisionImage[];
}): Promise<AgencyAiTextResult | null> => {
  const status = await getAgencyAiStatusPayload(input.workspaceId);
  const runtimeConfig = await resolveAgencyRuntimeConfig(input.workspaceId);
  if (!status.configured) {
    return null;
  }
  // Cost control: blocca se l'utente ha esaurito il budget AI giornaliero.
  await assertWithinAiBudget(input.workspaceId);
  const functionName = input.functionName || 'chat.project';
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs || runtimeConfig.ai.timeoutMs);
  try {
    // Il selettore per-sessione puo' scegliere provider+modello per questa chiamata, ma
    // solo tra i modelli del catalogo il cui provider ha una chiave. Fuori da questo caso
    // (nessuna scelta, id sconosciuto, provider senza chiave) si usa il default di
    // workspace come da sempre — incluso il riassunto interno (chat.summary).
    const requested = findAgencyCatalogModel(input.model);
    let provider: AgencyAiProvider;
    let model: string;
    if (requested && isAgencyProviderKeyPresent(runtimeConfig, requested.provider)) {
      provider = requested.provider;
      model = requested.id;
    } else {
      provider = status.provider as AgencyAiProvider;
      model = resolveAgencyProviderModel(provider, runtimeConfig.ai.functionModels[functionName] || status.model);
    }
    // Immagini per la "vista" multimodale (Fase 3b): senza, buildMultimodalMessages
    // torna i messaggi solo-testo identici a prima (retro-compat totale).
    const visionImages = input.images ?? [];

    let content: string;
    if (provider === 'anthropic') {
      const maxTokens = runtimeConfig.ai.maxOutputTokens > 0
        ? runtimeConfig.ai.maxOutputTokens
        : DEFAULT_ANTHROPIC_MAX_TOKENS;
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': runtimeConfig.ai.anthropicApiKey ?? '',
          'anthropic-version': ANTHROPIC_API_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: input.system,
          messages: buildMultimodalMessages(input.messages, visionImages, 'anthropic'),
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Anthropic API error ${response.status}`);
      }
      content = extractAnthropicTextContent(await response.json());
    } else {
      const requestBody: Record<string, unknown> = {
        model,
        input: [
          { role: 'system', content: input.system },
          ...buildMultimodalMessages(input.messages, visionImages, 'openai-responses'),
        ],
      };
      if (runtimeConfig.ai.maxOutputTokens > 0) {
        requestBody.max_output_tokens = runtimeConfig.ai.maxOutputTokens;
      }
      let response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${runtimeConfig.ai.openAiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok && response.status !== 401 && response.status !== 403) {
        const chatRequestBody: Record<string, unknown> = {
          model,
          messages: [
            { role: 'system', content: input.system },
            ...buildMultimodalMessages(input.messages, visionImages, 'openai-chat'),
          ],
        };
        if (runtimeConfig.ai.maxOutputTokens > 0) {
          chatRequestBody.max_completion_tokens = runtimeConfig.ai.maxOutputTokens;
        }
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${runtimeConfig.ai.openAiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chatRequestBody),
          signal: controller.signal,
        });
      }

      if (!response.ok) {
        throw new Error(`OpenAI API error ${response.status}`);
      }
      content = extractOpenAiTextContent(await response.json());
    }

    if (!content.trim()) {
      throw new Error('AI response empty');
    }

    const promptText = `${input.system}\n${input.messages.map((message) => message.content).join('\n')}`;
    // Le immagini "viste" non sono nel testo: si somma una stima grossolana per non
    // lasciare il loro costo fuori dal registro consumi (il costo reale dipende dalla
    // risoluzione, qui ignota).
    const estimatedInputTokens =
      estimateAgencyAiTokens(promptText) + visionImages.length * VISION_IMAGE_TOKEN_ESTIMATE;
    const estimatedOutputTokens = estimateAgencyAiTokens(content);
    const estimatedCostUsd = estimateAgencyAiCostUsd(model, estimatedInputTokens, estimatedOutputTokens);
    const durationMs = Date.now() - startedAt;

    if (input.workspaceId) {
      try {
        await aiUsageRepository.create({
          workspaceId: input.workspaceId,
          userId: requestContext.getUserId(),
          projectId: input.projectId ?? null,
          conversationId: input.conversationId ?? null,
          functionName,
          model,
          inputTokens: estimatedInputTokens,
          outputTokens: estimatedOutputTokens,
          costUsd: estimatedCostUsd,
          durationMs,
          status: 'success',
        });
      } catch {
        // accessorio: il log costi non deve mai rompere la risposta AI
      }
    }

    return {
      text: content.trim(),
      meta: { functionName, model, estimatedInputTokens, estimatedOutputTokens, estimatedCostUsd, durationMs },
    };
  } finally {
    clearTimeout(timeout);
  }
};

// Immagini "viste" dal modello per un turno di chat (Fase 3b). Dagli allegati del
// contesto (turno + recenti) tiene solo quelle in un formato supportato e sotto al
// tetto di dimensione, ne carica i byte e le porta in base64. L'ordine segue
// promptAttachments (turno corrente in coda), e si tengono al più MAX_VISION_IMAGES —
// le ultime, cioè le più pertinenti. Best-effort: se una lettura fallisce si prosegue
// senza quell'immagine (resta comunque il suo segnaposto testuale nel prompt).
const collectPromptVisionImages = async (
  conversationId: string,
  promptAttachments: Array<{ id: string }>,
): Promise<ChatVisionImage[]> => {
  const ids = promptAttachments.map((attachment) => attachment.id);
  if (ids.length === 0) {
    return [];
  }
  try {
    // Prima i soli metadati (niente blob): così si scopre QUALI allegati sono immagini
    // senza caricare i byte dei documenti, che pure hanno un binario.
    const meta = await aiConversationRepository.listAttachmentBinaryMeta(conversationId, ids);
    const metaById = new Map(meta.map((row) => [row.id, row]));
    const candidates: Array<{ id: string; mediaType: string }> = [];
    for (const attachment of promptAttachments) {
      const row = metaById.get(attachment.id);
      if (!row) {
        continue;
      }
      const mediaType = resolveVisionMediaType({ mimeType: row.mimeType, fileName: row.label });
      if (mediaType) {
        candidates.push({ id: attachment.id, mediaType });
      }
    }
    // Tetto sui costi: le ultime N (turno corrente + più recenti).
    const chosen = candidates.slice(-MAX_VISION_IMAGES);
    const images: ChatVisionImage[] = [];
    for (const candidate of chosen) {
      const binary = await aiConversationRepository.findAttachmentBinary(candidate.id);
      if (!binary?.binary) {
        continue;
      }
      const buffer = Buffer.from(binary.binary.data);
      // Immagini vuote o troppo grandi: si lasciano al loro segnaposto (i provider
      // rifiutano i file grossi; il ridimensionamento è un lavoro a sé).
      if (buffer.byteLength === 0 || buffer.byteLength > MAX_VISION_IMAGE_BYTES) {
        continue;
      }
      images.push({ mediaType: candidate.mediaType, dataBase64: buffer.toString('base64') });
    }
    return images;
  } catch (error) {
    logAgencyServiceEvent('Vista multimodale immagini saltata (best-effort).', {
      reason: (error as Error).message,
    });
    return [];
  }
};

const competitorSearchResponseSchema = z.object({
  competitors: z.array(z.object({
    name: z.string().trim().max(240).default(''),
    url: z.string().trim().max(2048),
    reason: z.string().trim().max(500).default(''),
    confidence: z.coerce.number().min(0).max(1).optional(),
  })).default([]),
  usedQueries: z.array(z.string().trim().max(300)).optional().default([]),
  notes: z.string().trim().max(1000).optional().default(''),
});

const getUrlHostname = (value: string) => {
  try {
    return new URL(value).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
};

const normalizeHttpUrl = (value: unknown) => {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return '';
  }
};

const extractOpenAiResponseText = (payload: unknown) => {
  if (!isRecord(payload)) {
    return '';
  }
  if (typeof payload.output_text === 'string') {
    return payload.output_text.trim();
  }
  const chunks: string[] = [];
  if (Array.isArray(payload.output)) {
    for (const outputItem of payload.output) {
      if (!isRecord(outputItem) || !Array.isArray(outputItem.content)) {
        continue;
      }
      for (const contentItem of outputItem.content) {
        if (isRecord(contentItem) && typeof contentItem.text === 'string') {
          chunks.push(contentItem.text);
        }
      }
    }
  }
  return chunks.join('\n').trim();
};

const parseJsonObjectFromText = (text: string) => {
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  if (!trimmed) {
    throw new Error('OpenAI response empty');
  }
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error('OpenAI response is not valid JSON');
  }
};

const getCompetitorSearchTimeoutMs = () => {
  const configuredTimeout = Number(process.env.AGENCY_COMPETITOR_SEARCH_TIMEOUT_MS || 180000);
  return Number.isFinite(configuredTimeout)
    ? Math.max(30000, configuredTimeout)
    : 180000;
};

const modelSupportsReasoningEffort = (model: string) => (
  /^gpt-5/i.test(model) || /^o\d/i.test(model)
);

const buildCompetitorSearchContext = (project: AgencyProjectPayload) => {
  const confirmedCompetitors = project.sources.competitors.filter((entry) => entry.status === 'confirmed');
  const scopePurchased = Array.isArray(project.scopePurchased)
    ? project.scopePurchased.filter((entry) => entry.purchased).map((entry) => entry.key)
    : Object.entries(project.scopePurchased || {})
      .filter(([, value]) => Boolean(value))
      .map(([key]) => key);
  const parsedFiles = project.sources.uploadedFiles
    .filter((entry) => entry.extractedTextPreview || entry.manualText)
    .slice(0, 4)
    .map((entry) => ({
      name: entry.name,
      parseStatus: entry.parseStatus || entry.status,
      textPreview: normalizeExtractedSourceText(`${entry.extractedTextPreview || ''}\n${entry.manualText || ''}`).slice(0, AGENCY_AI_FILE_TEXT_MAX_CHARS()),
    }));

  return {
    projectName: project.name,
    clientName: project.clientName,
    projectType: project.projectType?.key ?? null,
    projectTypeLabel: project.projectType?.label ?? null,
    goal: project.goal,
    scopePurchased,
    primaryWebsiteUrl: project.sources.primaryWebsiteUrl || project.sources.websiteUrl,
    urls: project.sources.urls.filter((entry) => entry.status === 'active').slice(0, 12).map((entry) => ({
      label: entry.label,
      type: entry.type,
      url: entry.url,
      notes: clipAgencyAiText(entry.notes, 500),
    })),
    manualNotes: clipAgencyAiText(project.sources.manualNotes, 1800),
    confirmedCompetitors: confirmedCompetitors.slice(0, 8).map((entry) => ({
      name: entry.name,
      url: entry.url,
    })),
    legacyCompetitorUrls: project.sources.competitorUrls.slice(0, 8),
    parsedFiles,
  };
};

const runAgencyOpenAiCompetitorSearch = async (input: {
  workspaceId: string;
  project: AgencyProjectPayload;
  runtimeConfig: Awaited<ReturnType<typeof resolveAgencyRuntimeConfig>>;
}) => {
  const context = buildCompetitorSearchContext(input.project);
  const model = process.env.AGENCY_COMPETITOR_SEARCH_MODEL?.trim()
    || input.runtimeConfig.ai.model
    || 'gpt-4o-mini';
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    getCompetitorSearchTimeoutMs(),
  );

  try {
    const requestBody: Record<string, unknown> = {
      model,
      tools: [{ type: 'web_search' }],
      tool_choice: 'auto',
      include: ['web_search_call.action.sources'],
      input: [
        {
          role: 'system',
          content: [
            'Sei un market research analyst per agenzie digitali.',
            'Devi cercare online competitor reali e pertinenti per il progetto.',
            'Non inventare aziende, URL o prove: inserisci solo competitor trovati tramite ricerca web.',
            'Escludi directory, marketplace, portali generici e lo stesso dominio del cliente, salvo siano competitor diretti.',
            'Rispondi solo con JSON valido nel formato {"competitors":[{"name":"","url":"","reason":"","confidence":0.0}],"usedQueries":[],"notes":""}.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'search_real_competitors',
            maxCompetitors: 5,
            language: 'it',
            context,
          }).slice(0, 18000),
        },
      ],
    };
    if (modelSupportsReasoningEffort(model)) {
      requestBody.reasoning = { effort: 'low' };
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.runtimeConfig.ai.openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      let details = '';
      try {
        const errorPayload = await response.json() as { error?: { message?: string } };
        details = errorPayload.error?.message ? `: ${errorPayload.error.message}` : '';
      } catch {
        details = '';
      }
      throw new Error(`OpenAI Responses API error ${response.status}${details}`);
    }

    const payload = await response.json();
    const parsed = competitorSearchResponseSchema.parse(
      parseJsonObjectFromText(extractOpenAiResponseText(payload)),
    );

    const blockedHosts = new Set([
      ...input.project.sources.urls.map((entry) => getUrlHostname(entry.url)),
      getUrlHostname(input.project.sources.websiteUrl),
      getUrlHostname(input.project.sources.primaryWebsiteUrl),
      ...input.project.sources.competitors.map((entry) => getUrlHostname(entry.url)),
      ...input.project.sources.competitorUrls.map((entry) => getUrlHostname(entry)),
    ].filter(Boolean));
    const seenHosts = new Set<string>();
    const now = new Date().toISOString();
    const suggestions: AgencyCompetitorSearchSuggestion[] = [];

    for (const entry of parsed.competitors) {
      const url = normalizeHttpUrl(entry.url);
      const host = getUrlHostname(url);
      if (!url || !host || blockedHosts.has(host) || seenHosts.has(host)) {
        continue;
      }
      seenHosts.add(host);
      suggestions.push({
        id: createSourceId('cmp_ai'),
        name: entry.name || deriveNameFromUrl(url),
        url,
        source: 'ai_search',
        status: 'suggested',
        reason: entry.reason || 'Suggerito dalla ricerca AI online.',
        addedAt: now,
        confidence: entry.confidence,
      });
      if (suggestions.length >= 8) {
        break;
      }
    }

    return {
      provider: 'openai_web_search',
      providerStatus: 'configured',
      realSearch: true,
      model,
      suggestions,
      queryContext: {
        websiteUrl: context.primaryWebsiteUrl,
        projectName: input.project.name,
        projectType: input.project.projectType?.key ?? null,
        clientName: input.project.clientName,
        manualNotesAvailable: input.project.sources.manualNotes.length > 0,
      },
      usedQueries: parsed.usedQueries,
      notes: parsed.notes,
      message: suggestions.length > 0
        ? `Ricerca online completata: ${suggestions.length} competitor suggeriti. Conferma solo quelli pertinenti.`
        : 'Ricerca online completata, ma non ho trovato competitor sufficientemente affidabili da proporre.',
    };
  } finally {
    clearTimeout(timeout);
  }
};

const splitSourceEvidence = (text: string) => normalizeExtractedSourceText(text)
  .split(/\n|(?<=[.!?])\s+/)
  .map((entry) => entry.trim())
  .filter((entry) => entry.length >= 20)
  .slice(0, 300);

const findSourceEvidence = (sources: AgencyProjectSourcesPayload, keywords: string[], limit = 3) => {
  const entries: Array<{ text: string; source: string }> = [];
  const pushMatches = (text: string, source: string) => {
    for (const sentence of splitSourceEvidence(text)) {
      const normalized = sentence.toLowerCase();
      if (keywords.some((keyword) => normalized.includes(keyword))) {
        entries.push({
          text: sentence.slice(0, 600),
          source,
        });
      }
      if (entries.length >= limit) {
        return;
      }
    }
  };

  if (sources.manualNotes) {
    pushMatches(sources.manualNotes, 'Note manuali');
  }
  for (const file of sources.uploadedFiles) {
    if (entries.length >= limit) {
      break;
    }
    if (file.extractedTextPreview) {
      pushMatches(file.extractedTextPreview, `File letto: ${file.name}`);
    }
    if (file.manualText) {
      pushMatches(file.manualText, `Testo manuale dal file: ${file.name}`);
    }
  }

  return entries.slice(0, limit);
};

const formatEvidenceSection = (input: {
  intro: string;
  evidence: Array<{ text: string; source: string }>;
  insufficient: string;
}) => {
  if (input.evidence.length === 0) {
    return input.insufficient;
  }

  return [
    input.intro,
    ...input.evidence.map((entry) => `- ${entry.text} [${entry.source}]`),
  ].join('\n');
};

const getSectionSourceLabels = (evidence: Array<{ source: string }>, fallback: string[]) => {
  const labels = Array.from(new Set(evidence.map((entry) => entry.source).filter(Boolean)));
  return labels.length > 0 ? labels : fallback;
};

const buildDiscoveryFromProjectSources = (input: {
  project: AgencyProjectPayload;
  sources: AgencyProjectSourcesPayload;
}) => {
  const confirmedCompetitors = input.sources.competitors.filter((entry) => entry.status === 'confirmed');
  const uploadedFiles = input.sources.uploadedFiles;
  const parsedFiles = uploadedFiles.filter((entry) => entry.parseStatus === 'parsed' || entry.status === 'parsed');
  const unreadableFiles = input.sources.unreadableFiles || [];
  const websitePart = input.sources.websiteUrl || 'URL sito non inserito';
  const competitorPart = confirmedCompetitors.length > 0
    ? confirmedCompetitors.map((entry) => `${entry.name} (${entry.url})`).join(', ')
    : input.sources.competitorUrls.length > 0
      ? input.sources.competitorUrls.join(', ')
      : 'Competitor non confermati';
  const filePart = uploadedFiles.length > 0
    ? uploadedFiles.map((entry) => {
      if (entry.parseStatus === 'parsed' || entry.status === 'parsed') {
        return `${entry.name} - testo estratto`;
      }
      if (entry.status === 'metadata_only') {
        return `${entry.name} - solo metadata`;
      }
      return `${entry.name} - allegato non letto`;
    }).join('; ')
    : 'Nessun file allegato';
  const reliability = getReadableSourceStatus(input.sources.sourceStatus);
  const usedSources = buildSourceReadiness(input.sources).usedSources;
  const defaultSources = usedSources.length > 0 ? usedSources : ['nessuna fonte cliente reale'];
  const targetEvidence = findSourceEvidence(input.sources, ['target', 'pubblico', 'audience', 'persona', 'cliente ideale', 'segmento']);
  const offerEvidence = findSourceEvidence(input.sources, ['offerta', 'servizio', 'prodotto', 'pacchetto', 'prezzo', 'soluzione']);
  const goalEvidence = findSourceEvidence(input.sources, ['obiettivo', 'goal', 'kpi', 'risultato', 'conversion', 'lead', 'vendite']);
  const brandEvidence = findSourceEvidence(input.sources, ['brand', 'tono', 'tone', 'posizionamento', 'messaggio', 'usp', 'differenz']);
  const technicalEvidence = findSourceEvidence(input.sources, ['tracking', 'analytics', 'ga4', 'pixel', 'cms', 'wordpress', 'shopify', 'cookie']);
  const marketingEvidence = findSourceEvidence(input.sources, ['google ads', 'meta ads', 'seo', 'email', 'funnel', 'campagna', 'acquisizione', 'retargeting']);
  const contextEvidence = findSourceEvidence(input.sources, ['azienda', 'business', 'mercato', 'settore', 'cliente', 'progetto']);

  const sectionSources: Record<string, string[]> = {
    businessContext: getSectionSourceLabels(contextEvidence, defaultSources),
    projectGoal: getSectionSourceLabels(goalEvidence, ['CRM progetto', ...defaultSources]),
    target: getSectionSourceLabels(targetEvidence, defaultSources),
    offer: getSectionSourceLabels(offerEvidence, defaultSources),
    brandCommunication: getSectionSourceLabels(brandEvidence, defaultSources),
    availableMaterials: uploadedFiles.length > 0 ? uploadedFiles.map((entry) => `Materiale: ${entry.name}`) : defaultSources,
    technicalAspects: getSectionSourceLabels(technicalEvidence, input.sources.websiteUrl ? ['Website URL inserito'] : defaultSources),
    marketingAcquisition: getSectionSourceLabels(marketingEvidence, confirmedCompetitors.length > 0 ? ['Competitor confermati'] : defaultSources),
  };
  const missingWarnings = [
    targetEvidence.length === 0 ? 'Target non definito nelle fonti disponibili.' : '',
    offerEvidence.length === 0 ? 'Offerta/proposta di valore non chiara nelle fonti disponibili.' : '',
    goalEvidence.length === 0 && !input.project.goal ? 'Obiettivo progetto non definito.' : '',
    brandEvidence.length === 0 ? 'Differenzianti/USP non evidenti nelle fonti disponibili.' : '',
    marketingEvidence.length === 0 ? 'CTA e canali di acquisizione da chiarire.' : '',
    technicalEvidence.length === 0 ? 'Tracking/CMS/aspetti tecnici da verificare.' : '',
    ...unreadableFiles.map((entry) => `File non letto: ${entry}.`),
  ].filter(Boolean);

  const sections: DiscoverySections = {
    businessContext: [
      `Progetto ${input.project.projectType?.label || 'Agency'}: ${input.project.name}.`,
      input.project.clientName ? `Cliente collegato: ${input.project.clientName}.` : 'Cliente non collegato nel CRM.',
      `Sito indicato: ${websitePart}.`,
      contextEvidence.length > 0 ? formatEvidenceSection({
        intro: 'Elementi emersi dalle fonti:',
        evidence: contextEvidence,
        insufficient: '',
      }) : '',
    ].join(' '),
    projectGoal: formatEvidenceSection({
      intro: input.project.goal ? `Obiettivo CRM indicato: ${input.project.goal}. Elementi coerenti trovati nelle fonti:` : 'Elementi obiettivo trovati nelle fonti:',
      evidence: goalEvidence,
      insufficient: input.project.goal || 'Dati insufficienti: le fonti disponibili non definiscono un obiettivo progetto concreto.',
    }),
    target: formatEvidenceSection({
      intro: 'Target emerso dalle fonti:',
      evidence: targetEvidence,
      insufficient: 'Dati insufficienti: le fonti disponibili non descrivono target, audience o cliente ideale.',
    }),
    offer: formatEvidenceSection({
      intro: 'Offerta/proposta di valore emersa dalle fonti:',
      evidence: offerEvidence,
      insufficient: 'Dati insufficienti: le fonti disponibili non chiariscono offerta, prodotto, servizio o value proposition.',
    }),
    brandCommunication: formatEvidenceSection({
      intro: 'Elementi di brand, tono e differenziazione emersi dalle fonti:',
      evidence: brandEvidence,
      insufficient: 'Dati insufficienti: tono, posizionamento e differenzianti non sono determinabili dalle fonti registrate.',
    }),
    availableMaterials: [
      `File e materiali: ${filePart}.`,
      parsedFiles.length > 0
        ? `Contenuto letto da ${parsedFiles.length} file.`
        : 'Nessun contenuto file letto: il brief usa solo metadata, URL e note disponibili.',
      unreadableFiles.length > 0 ? `File non letti: ${unreadableFiles.join('; ')}.` : '',
    ].join(' '),
    technicalAspects: formatEvidenceSection({
      intro: `Website URL: ${websitePart}. Aspetti tecnici emersi dalle fonti:`,
      evidence: technicalEvidence,
      insufficient: `Website URL: ${websitePart}. Dati insufficienti: tracking, CMS, analytics e vincoli tecnici non sono descritti nelle fonti disponibili.`,
    }),
    marketingAcquisition: [
      `Competitor/confronto: ${competitorPart}.`,
      'I competitor sono usati solo se inseriti o confermati manualmente; non e stata eseguita ricerca web automatica.',
      marketingEvidence.length > 0 ? formatEvidenceSection({
        intro: 'Elementi marketing/acquisizione emersi dalle fonti:',
        evidence: marketingEvidence,
        insufficient: '',
      }) : 'Dati insufficienti: canali, CTA, funnel e piano acquisizione non sono definiti nelle fonti disponibili.',
    ].join(' '),
  };
  const notes = [
    `Brief rigenerato dalle fonti progetto. Affidabilita: ${reliability}.`,
    `Fonti usate: ${usedSources.length > 0 ? usedSources.join(', ') : 'nessuna fonte cliente reale'}.`,
    parsedFiles.length > 0 ? `File letti: ${parsedFiles.map((entry) => entry.name).join(', ')}.` : '',
    unreadableFiles.length > 0 ? `Limiti lettura file: ${unreadableFiles.join('; ')}.` : '',
    missingWarnings.length > 0 ? `Alert incompletezza: ${missingWarnings.join(' ')}` : '',
  ].filter(Boolean).join('\n');
  const brief = buildDiscoveryBrief(sections, notes);
  const contextSummary = [
    `${input.project.projectType?.label || 'Progetto Agency'} per ${input.project.clientName || input.project.name}.`,
    `Qualita fonti: ${input.sources.sourceStatus}.`,
    input.sources.websiteUrl ? `Sito: ${input.sources.websiteUrl}.` : 'Sito non indicato.',
    `${uploadedFiles.length} file registrati, ${confirmedCompetitors.length} competitor confermati.`,
  ].join(' ');

  return {
    sections,
    notes,
    brief,
    contextSummary,
    sourceReliability: reliability,
    usedSources,
    sectionSources,
    missingWarnings,
  };
};

const mergeDiscoverySections = (inputSections: DiscoverySections, previousSections: DiscoverySections): DiscoverySections => {
  return {
    businessContext: sanitizeDiscoveryText(inputSections.businessContext, previousSections.businessContext),
    projectGoal: sanitizeDiscoveryText(inputSections.projectGoal, previousSections.projectGoal),
    target: sanitizeDiscoveryText(inputSections.target, previousSections.target),
    offer: sanitizeDiscoveryText(inputSections.offer, previousSections.offer),
    brandCommunication: sanitizeDiscoveryText(inputSections.brandCommunication, previousSections.brandCommunication),
    availableMaterials: sanitizeDiscoveryText(inputSections.availableMaterials, previousSections.availableMaterials),
    technicalAspects: sanitizeDiscoveryText(inputSections.technicalAspects, previousSections.technicalAspects),
    marketingAcquisition: sanitizeDiscoveryText(inputSections.marketingAcquisition, previousSections.marketingAcquisition),
  };
};

const DISCOVERY_SECTION_KEYS = [
  'businessContext',
  'projectGoal',
  'target',
  'offer',
  'brandCommunication',
  'availableMaterials',
  'technicalAspects',
  'marketingAcquisition',
] as const;

type DiscoverySectionKey = typeof DISCOVERY_SECTION_KEYS[number];

// Schema dell'output della Discovery, usato per lo structured output di Anthropic
// (tool-use). E' derivato da DISCOVERY_SECTION_KEYS cosi' resta allineato se un giorno si
// aggiunge una sezione. Deve elencare davvero i campi: e' lo schema a guidare la
// generazione del modello (vedi la nota in anthropic-json.ts).
const DISCOVERY_AI_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    sections: {
      type: 'object',
      description: 'Testo di ciascuna sezione del brief Discovery.',
      properties: Object.fromEntries(
        DISCOVERY_SECTION_KEYS.map((key) => [key, { type: 'string' }]),
      ),
      required: [...DISCOVERY_SECTION_KEYS],
    },
    missingFields: {
      type: 'array',
      description: 'Campi che le fonti non permettono di determinare.',
      items: { type: 'string' },
    },
    usedSourcesBySection: {
      type: 'object',
      description: 'Per ogni sezione, gli identificativi delle fonti usate.',
      additionalProperties: { type: 'array', items: { type: 'string' } },
    },
    confidenceBySection: {
      type: 'object',
      description: 'Per ogni sezione, il livello di confidenza (alta/media/bassa).',
      additionalProperties: { type: 'string' },
    },
  },
  required: ['sections'],
};

const discoverySectionRegenerateBodySchema = z.object({
  sectionKey: z.enum(DISCOVERY_SECTION_KEYS),
});

const webBlockGenerateBodySchema = z.object({
  blockKey: z.enum(['hero', 'benefits', 'faq', 'cta', 'trust', 'wireframe', 'section_plan']),
});

const adsAssetGenerateBodySchema = z.object({
  assetKey: z.enum(['headlines', 'primary_texts', 'keywords', 'creative_angles', 'angle', 'sitelinks']),
});

// Schemi JSON per lo structured output di Anthropic sulle altre generazioni Agency
// (Discovery sezione, Web progetto, Web blocco, Ads asset). Stesso principio di
// DISCOVERY_AI_JSON_SCHEMA: elencano DAVVERO i campi che il codice legge a valle, perche'
// e' lo schema a guidare la generazione. Uno schema generico (properties vuote) fa
// rispondere Claude con un oggetto segnaposto `{"_dummy"}` — JSON valido ma vuoto (vedi la
// nota in anthropic-json.ts). I campi "morti" del requiredOutput dei prompt (es.
// assumptions/confidence su web blocco e ads asset), che nessuna riga legge, sono esclusi.

// Discovery, singola sezione: campi letti in generateProjectDiscoverySectionWithAi.
const DISCOVERY_SECTION_AI_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    sectionText: { type: 'string', description: 'Testo rigenerato della sezione Discovery.' },
    usedSources: {
      type: 'array',
      description: 'Identificativi delle fonti usate per questa sezione.',
      items: { type: 'string' },
    },
    missingFields: {
      type: 'array',
      description: 'Dati che le fonti non permettono di determinare.',
      items: { type: 'string' },
    },
    confidence: { type: 'string', description: 'Livello di confidenza: low, medium o high.' },
  },
  required: ['sectionText'],
};

// Web, progetto completo: campi letti da normalizeWebOutputFromJson piu' missingInputs e
// recommendations (letti a parte in generateProjectWebProjectWithAi).
const WEB_PROJECT_AI_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    pageGoal: { type: 'string' },
    pageType: {
      type: 'string',
      description: 'Uno tra: landing, homepage, service_page, ecommerce_page, section.',
    },
    targetSummary: { type: 'string' },
    offerSummary: { type: 'string' },
    valueProp: { type: 'string' },
    sectionPlan: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          title: { type: 'string' },
          objective: { type: 'string' },
        },
        required: ['key', 'title', 'objective'],
      },
    },
    copyBlocks: {
      type: 'object',
      properties: {
        headline: { type: 'string' },
        subheadline: { type: 'string' },
        intro: { type: 'string' },
        benefits: { type: 'array', items: { type: 'string' } },
        objectionHandling: { type: 'string' },
      },
      required: ['headline', 'subheadline', 'intro', 'benefits'],
    },
    ctaSet: {
      type: 'object',
      properties: {
        primary: { type: 'string' },
        secondary: { type: 'string' },
        final: { type: 'string' },
      },
      required: ['primary'],
    },
    trustElements: { type: 'array', items: { type: 'string' } },
    faqItems: { type: 'array', items: { type: 'string' } },
    wireframe: {
      type: 'object',
      properties: {
        mode: { type: 'string', description: 'text oppure visual.' },
        blocks: { type: 'array', items: { type: 'string' } },
      },
      required: ['blocks'],
    },
    previewHtmlBase: { type: 'string', description: 'HTML statico sicuro, senza script.' },
    missingInputs: { type: 'array', items: { type: 'string' } },
    recommendations: { type: 'array', items: { type: 'string' } },
  },
  required: ['pageGoal', 'pageType', 'targetSummary', 'offerSummary', 'valueProp', 'sectionPlan', 'copyBlocks', 'ctaSet'],
};

// Web, singolo blocco: la generazione riguarda un solo blockKey e il codice legge solo il
// campo corrispondente (switch in generateProjectWebBlockWithAi). Schema mirato per chiave:
// Claude produce esattamente quel campo (required) senza sprecare token sugli altri. Il
// Record copre tutto l'enum, quindi aggiungere un blockKey senza schema non compila.
type WebBlockKey = z.infer<typeof webBlockGenerateBodySchema>['blockKey'];
const WEB_BLOCK_AI_JSON_SCHEMAS: Record<WebBlockKey, Record<string, unknown>> = {
  hero: {
    type: 'object',
    properties: {
      headline: { type: 'string' },
      subheadline: { type: 'string' },
      intro: { type: 'string' },
    },
    required: ['headline', 'subheadline', 'intro'],
  },
  benefits: {
    type: 'object',
    properties: { benefits: { type: 'array', items: { type: 'string' } } },
    required: ['benefits'],
  },
  faq: {
    type: 'object',
    properties: { faqItems: { type: 'array', items: { type: 'string' } } },
    required: ['faqItems'],
  },
  cta: {
    type: 'object',
    properties: {
      ctaSet: {
        type: 'object',
        properties: {
          primary: { type: 'string' },
          secondary: { type: 'string' },
          final: { type: 'string' },
        },
        required: ['primary'],
      },
    },
    required: ['ctaSet'],
  },
  trust: {
    type: 'object',
    properties: { trustElements: { type: 'array', items: { type: 'string' } } },
    required: ['trustElements'],
  },
  wireframe: {
    type: 'object',
    properties: {
      wireframe: {
        type: 'object',
        properties: {
          mode: { type: 'string', description: 'text oppure visual.' },
          blocks: { type: 'array', items: { type: 'string' } },
        },
        required: ['blocks'],
      },
    },
    required: ['wireframe'],
  },
  section_plan: {
    type: 'object',
    properties: {
      sectionPlan: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            title: { type: 'string' },
            objective: { type: 'string' },
          },
          required: ['key', 'title', 'objective'],
        },
      },
    },
    required: ['sectionPlan'],
  },
};

// Ads, singolo asset: come il web blocco, la generazione riguarda un solo assetKey e il
// codice legge solo i campi corrispondenti (switch in generateProjectAdsAssetWithAi).
type AdsAssetKey = z.infer<typeof adsAssetGenerateBodySchema>['assetKey'];
const ADS_ASSET_AI_JSON_SCHEMAS: Record<AdsAssetKey, Record<string, unknown>> = {
  headlines: {
    type: 'object',
    properties: {
      headlines: { type: 'array', items: { type: 'string' } },
      descriptions: { type: 'array', items: { type: 'string' } },
    },
    required: ['headlines'],
  },
  primary_texts: {
    type: 'object',
    properties: { primaryTexts: { type: 'array', items: { type: 'string' } } },
    required: ['primaryTexts'],
  },
  keywords: {
    type: 'object',
    properties: { keywordSeeds: { type: 'array', items: { type: 'string' } } },
    required: ['keywordSeeds'],
  },
  creative_angles: {
    type: 'object',
    properties: { creativeAngles: { type: 'array', items: { type: 'string' } } },
    required: ['creativeAngles'],
  },
  angle: {
    type: 'object',
    properties: {
      offerAngle: { type: 'string' },
      campaignAngle: { type: 'string' },
    },
    required: ['offerAngle', 'campaignAngle'],
  },
  sitelinks: {
    type: 'object',
    properties: { extensionsIdeas: { type: 'array', items: { type: 'string' } } },
    required: ['extensionsIdeas'],
  },
};

const normalizeDiscoverySectionsFromBriefJson = (value: Prisma.JsonValue | null): DiscoverySections => {
  if (!isRecord(value)) {
    return { ...DEFAULT_DISCOVERY_SECTIONS };
  }

  return {
    businessContext: sanitizeDiscoveryText(
      typeof value.businessContext === 'string' ? value.businessContext : '',
      DEFAULT_DISCOVERY_SECTIONS.businessContext,
    ),
    projectGoal: sanitizeDiscoveryText(
      typeof value.projectGoal === 'string' ? value.projectGoal : '',
      DEFAULT_DISCOVERY_SECTIONS.projectGoal,
    ),
    target: sanitizeDiscoveryText(
      typeof value.target === 'string' ? value.target : '',
      DEFAULT_DISCOVERY_SECTIONS.target,
    ),
    offer: sanitizeDiscoveryText(
      typeof value.offer === 'string' ? value.offer : '',
      DEFAULT_DISCOVERY_SECTIONS.offer,
    ),
    brandCommunication: sanitizeDiscoveryText(
      typeof value.brandCommunication === 'string' ? value.brandCommunication : '',
      DEFAULT_DISCOVERY_SECTIONS.brandCommunication,
    ),
    availableMaterials: sanitizeDiscoveryText(
      typeof value.availableMaterials === 'string' ? value.availableMaterials : '',
      DEFAULT_DISCOVERY_SECTIONS.availableMaterials,
    ),
    technicalAspects: sanitizeDiscoveryText(
      typeof value.technicalAspects === 'string' ? value.technicalAspects : '',
      DEFAULT_DISCOVERY_SECTIONS.technicalAspects,
    ),
    marketingAcquisition: sanitizeDiscoveryText(
      typeof value.marketingAcquisition === 'string' ? value.marketingAcquisition : '',
      DEFAULT_DISCOVERY_SECTIONS.marketingAcquisition,
    ),
  };
};

const normalizeDiscoveryNotesFromBriefJson = (value: Prisma.JsonValue | null) => {
  if (!isRecord(value)) {
    return '';
  }

  return typeof value.notes === 'string' ? value.notes : '';
};

const normalizeMemorySummary = (
  projectId: string,
  memorySummaryValue: Prisma.JsonValue | null,
  updatedAt: Date | null | undefined,
) => {
  if (isRecord(memorySummaryValue)) {
    return {
      projectId,
      lastUpdatedAt: typeof memorySummaryValue.lastUpdatedAt === 'string'
        ? memorySummaryValue.lastUpdatedAt
        : (updatedAt ?? new Date()).toISOString(),
      keyDecisions: normalizeStringArray(memorySummaryValue.keyDecisions),
      nextActions: normalizeStringArray(memorySummaryValue.nextActions),
      knownRisks: normalizeStringArray(memorySummaryValue.knownRisks),
    };
  }

  return {
    projectId,
    lastUpdatedAt: (updatedAt ?? new Date()).toISOString(),
    keyDecisions: [],
    nextActions: [],
    knownRisks: [],
  };
};

const sanitizeWebText = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();
  if (!normalized) {
    return fallback;
  }

  return normalized.length > WEB_MAX_FIELD_LENGTH
    ? normalized.slice(0, WEB_MAX_FIELD_LENGTH)
    : normalized;
};

const normalizeWebStringList = (value: unknown, maxItems = 12): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(0, maxItems);
};

const createDefaultWebSectionPlan = (): AgencyWebOutputPayload['sectionPlan'] => ([
  { key: 'hero', title: 'Hero', objective: 'Aprire con promessa chiara e CTA primaria.' },
  { key: 'problem', title: 'Problema', objective: 'Esplicitare il problema principale del target.' },
  { key: 'solution', title: 'Soluzione', objective: 'Presentare il servizio/prodotto come risposta.' },
  { key: 'benefits', title: 'Benefici', objective: 'Mostrare risultati concreti e vantaggi chiave.' },
  { key: 'trust', title: 'Trust', objective: 'Aggiungere elementi di prova sociale e autorevolezza.' },
  { key: 'faq', title: 'FAQ', objective: 'Ridurre obiezioni con risposte rapide.' },
  { key: 'cta_final', title: 'CTA Finale', objective: 'Chiudere con call to action netta.' },
]);

const normalizeWebSectionPlan = (value: unknown): AgencyWebOutputPayload['sectionPlan'] => {
  if (!Array.isArray(value)) {
    return createDefaultWebSectionPlan();
  }

  const normalized = value
    .map((entry, index) => {
      if (!isRecord(entry)) {
        return null;
      }

      const keyCandidate = sanitizeWebText(entry.key, `section_${index + 1}`).toLowerCase().replace(/\s+/g, '_');
      const title = sanitizeWebText(entry.title, keyCandidate);
      if (!title) {
        return null;
      }

      return {
        key: keyCandidate,
        title,
        objective: sanitizeWebText(entry.objective, ''),
      };
    })
    .filter((entry): entry is AgencyWebOutputPayload['sectionPlan'][number] => entry !== null);

  return normalized.length > 0 ? normalized : createDefaultWebSectionPlan();
};

const normalizeWebProjects = (value: unknown): AgencyWebOutputPayload['webProjects'] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry) => ({
      id: sanitizeWebText(entry.id, createSourceId('web')),
      type: sanitizeWebText(entry.type, 'landing'),
      name: sanitizeWebText(entry.name, 'Landing principale'),
      goal: sanitizeWebText(entry.goal, ''),
      target: sanitizeWebText(entry.target, ''),
      primaryCta: sanitizeWebText(entry.primaryCta, ''),
      status: sanitizeWebText(entry.status, 'draft'),
      sourceRefs: normalizeWebStringList(entry.sourceRefs, 20),
      webOutput: isRecord(entry.webOutput) ? entry.webOutput : {},
    }))
    .slice(0, 50);
};

const normalizeAdsProjects = (value: unknown): AgencyAdsOutputPayload['adsProjects'] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry) => ({
      id: sanitizeWebText(entry.id, createSourceId('ads')),
      channel: sanitizeWebText(entry.channel, 'google'),
      campaignType: sanitizeWebText(entry.campaignType, ''),
      name: sanitizeWebText(entry.name, 'Campagna'),
      goal: sanitizeWebText(entry.goal, ''),
      linkedWebProjectId: sanitizeWebText(entry.linkedWebProjectId, ''),
      status: sanitizeWebText(entry.status, 'draft'),
      sourceRefs: normalizeWebStringList(entry.sourceRefs, 20),
      adsOutput: isRecord(entry.adsOutput) ? entry.adsOutput : {},
    }))
    .slice(0, 50);
};

const createEmptyWebOutput = (
  projectId: string,
  input: AgencyWebInputPayload,
): AgencyWebOutputPayload => ({
  projectId,
  pageGoal: sanitizeWebText(input.discovery.sections.projectGoal, 'Generare conversioni qualificate'),
  pageType: 'landing',
  targetSummary: sanitizeWebText(input.discovery.sections.target, ''),
  offerSummary: sanitizeWebText(input.discovery.sections.offer, ''),
  valueProp: '',
  sectionPlan: createDefaultWebSectionPlan(),
  copyBlocks: {
    headline: '',
    subheadline: '',
    intro: '',
    benefits: [],
    objectionHandling: '',
  },
  faqItems: [],
  ctaSet: {
    primary: '',
    secondary: '',
    final: '',
  },
  trustElements: [],
  wireframe: {
    mode: 'text',
    blocks: [],
  },
  previewHtmlBase: '',
  webProjects: [],
  lastGeneratedAt: null,
  aiCache: {},
  aiHistory: [],
});

const normalizeWebOutputFromJson = (
  value: Prisma.JsonValue | null,
  projectId: string,
  input: AgencyWebInputPayload,
): AgencyWebOutputPayload => {
  const base = createEmptyWebOutput(projectId, input);
  if (!isRecord(value)) {
    return base;
  }

  const pageTypeCandidate = sanitizeWebText(value.pageType, base.pageType);
  const wireframeBlocks = normalizeWebStringList(isRecord(value.wireframe) ? value.wireframe.blocks : [], 40);

  return {
    projectId,
    pageGoal: sanitizeWebText(value.pageGoal, base.pageGoal),
    pageType: WEB_PAGE_TYPES.has(pageTypeCandidate) ? pageTypeCandidate : base.pageType,
    targetSummary: sanitizeWebText(value.targetSummary, base.targetSummary),
    offerSummary: sanitizeWebText(value.offerSummary, base.offerSummary),
    valueProp: sanitizeWebText(value.valueProp, base.valueProp),
    sectionPlan: normalizeWebSectionPlan(value.sectionPlan),
    copyBlocks: {
      headline: sanitizeWebText(isRecord(value.copyBlocks) ? value.copyBlocks.headline : undefined, ''),
      subheadline: sanitizeWebText(isRecord(value.copyBlocks) ? value.copyBlocks.subheadline : undefined, ''),
      intro: sanitizeWebText(isRecord(value.copyBlocks) ? value.copyBlocks.intro : undefined, ''),
      benefits: normalizeWebStringList(isRecord(value.copyBlocks) ? value.copyBlocks.benefits : [], 8),
      objectionHandling: sanitizeWebText(isRecord(value.copyBlocks) ? value.copyBlocks.objectionHandling : undefined, ''),
    },
    faqItems: normalizeWebStringList(value.faqItems, 8),
    ctaSet: {
      primary: sanitizeWebText(isRecord(value.ctaSet) ? value.ctaSet.primary : undefined, ''),
      secondary: sanitizeWebText(isRecord(value.ctaSet) ? value.ctaSet.secondary : undefined, ''),
      final: sanitizeWebText(isRecord(value.ctaSet) ? value.ctaSet.final : undefined, ''),
    },
    trustElements: normalizeWebStringList(value.trustElements, 8),
    wireframe: {
      mode: isRecord(value.wireframe) && value.wireframe.mode === 'visual' ? 'visual' : 'text',
      blocks: wireframeBlocks,
    },
    previewHtmlBase: sanitizeWebText(value.previewHtmlBase, ''),
    webProjects: normalizeWebProjects(value.webProjects),
    lastGeneratedAt: sanitizeWebText(value.lastGeneratedAt, '') || null,
    aiCache: isRecord(value.aiCache) ? value.aiCache : {},
    aiHistory: Array.isArray(value.aiHistory) ? value.aiHistory.filter(isRecord).slice(-30) : [],
  };
};

const buildWebInputContract = (input: {
  projectId: string;
  seed: AgencySeedPayload | null;
  discovery: DiscoveryPayload;
}): AgencyWebInputPayload => {
  const projectType = input.seed?.projectType ?? {
    key: 'marketing_full',
    label: 'Marketing Full',
    description: '',
  };
  const contextSummary = input.seed?.contextSummary?.trim() || input.discovery.contextSummary;
  const activeModules = input.seed?.activeModules ?? [];
  const scopePurchased = input.seed?.scopePurchased ?? [];
  const memorySummary = input.seed?.memorySummary ?? {
    projectId: input.projectId,
    lastUpdatedAt: null,
    keyDecisions: [],
    nextActions: [],
    knownRisks: [],
  };

  return {
    projectId: input.projectId,
    projectType,
    scopePurchased,
    activeModules,
    contextSummary,
    discovery: {
      sections: input.discovery.sections,
      notes: input.discovery.notes,
      contextSummary: input.discovery.contextSummary,
      lastUpdatedAt: input.discovery.lastUpdatedAt,
    },
    sources: {
      status: input.seed?.sources?.sourceStatus ?? 'missing',
      summary: input.seed?.sources?.sourceSummary ?? 'Nessuna fonte cliente reale registrata.',
      usedSources: input.seed?.sourceReadiness?.usedSources ?? [],
      unreadableFiles: input.seed?.sources?.unreadableFiles ?? [],
    },
    memorySummary: {
      keyDecisions: memorySummary.keyDecisions,
      nextActions: memorySummary.nextActions,
      knownRisks: memorySummary.knownRisks,
      lastUpdatedAt: memorySummary.lastUpdatedAt,
    },
  };
};

const resolveWebOutputFromBody = (
  body: unknown,
  projectId: string,
  input: AgencyWebInputPayload,
): AgencyWebOutputPayload => {
  if (!isRecord(body)) {
    return createEmptyWebOutput(projectId, input);
  }

  const source = isRecord(body.output) ? body.output : body;
  return normalizeWebOutputFromJson(source as Prisma.JsonValue, projectId, input);
};

const createEmptyAdsOutput = (
  projectId: string,
  input: AgencyAdsInputPayload,
): AgencyAdsOutputPayload => ({
  projectId,
  channelScope: 'both',
  campaignGoal: 'lead_generation',
  targetingSummary: input.web.targetSummary || input.discovery.sections.target || '',
  offerAngle: input.web.offerSummary || input.discovery.sections.offer || '',
  messageHooks: [],
  adCopyBlocks: {
    google: [],
    meta: [],
  },
  assetRequests: [],
  launchChecklist: [],
  notes: '',
  googleAds: {
    campaignType: '',
    campaignStructure: [],
    adGroups: [],
    keywordSeeds: [],
    negativeSeeds: [],
    rsaIdeas: [],
    extensionsIdeas: [],
    landingRecommendation: input.web.landingRecommendationBase || '',
  },
  metaAds: {
    campaignAngle: '',
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
  aiCache: {},
  aiHistory: [],
});

const normalizeAdsChecklistItems = (value: unknown): AgencyAdsOutputPayload['launchChecklist'] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => {
      if (!isRecord(entry)) {
        return null;
      }

      const label = sanitizeWebText(entry.label, '');
      if (!label) {
        return null;
      }

      return {
        key: sanitizeWebText(entry.key, `check_${index + 1}`) || `check_${index + 1}`,
        label,
        channel: sanitizeWebText(entry.channel, 'shared') || 'shared',
        status: sanitizeWebText(entry.status, 'pending') || 'pending',
      };
    })
    .filter((entry): entry is AgencyAdsOutputPayload['launchChecklist'][number] => entry !== null);
};

const normalizeAdsAdGroups = (value: unknown): AgencyAdsOutputPayload['googleAds']['adGroups'] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const name = sanitizeWebText(entry.name, '');
      if (!name) {
        return null;
      }

      return {
        name,
        intent: sanitizeWebText(entry.intent, ''),
        keywords: normalizeWebStringList(entry.keywords, 24),
      };
    })
    .filter((entry): entry is AgencyAdsOutputPayload['googleAds']['adGroups'][number] => entry !== null);
};

const normalizeAdsRsaIdeas = (value: unknown): AgencyAdsOutputPayload['googleAds']['rsaIdeas'] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const headlines = normalizeWebStringList(entry.headlines, 15);
      const descriptions = normalizeWebStringList(entry.descriptions, 4);
      if (headlines.length === 0 && descriptions.length === 0) {
        return null;
      }

      return {
        headlines,
        descriptions,
      };
    })
    .filter((entry): entry is AgencyAdsOutputPayload['googleAds']['rsaIdeas'][number] => entry !== null);
};

const normalizeAdsOutputFromJson = (
  value: Prisma.JsonValue | null,
  projectId: string,
  input: AgencyAdsInputPayload,
): AgencyAdsOutputPayload => {
  const base = createEmptyAdsOutput(projectId, input);
  if (!isRecord(value)) {
    return base;
  }

  const googleAdsRecord = isRecord(value.googleAds) ? value.googleAds : {};
  const metaAdsRecord = isRecord(value.metaAds) ? value.metaAds : {};
  const adCopyBlocksRecord = isRecord(value.adCopyBlocks) ? value.adCopyBlocks : {};
  const channelScopeCandidate = sanitizeWebText(value.channelScope, base.channelScope);
  const campaignGoalCandidate = sanitizeWebText(value.campaignGoal, base.campaignGoal);

  return {
    projectId,
    channelScope: ADS_CHANNEL_SCOPES.has(channelScopeCandidate)
      ? channelScopeCandidate as AgencyAdsOutputPayload['channelScope']
      : base.channelScope,
    campaignGoal: ADS_CAMPAIGN_GOALS.has(campaignGoalCandidate)
      ? campaignGoalCandidate as AgencyAdsOutputPayload['campaignGoal']
      : base.campaignGoal,
    targetingSummary: sanitizeWebText(value.targetingSummary, base.targetingSummary),
    offerAngle: sanitizeWebText(value.offerAngle, base.offerAngle),
    messageHooks: normalizeWebStringList(value.messageHooks, 12),
    adCopyBlocks: {
      google: normalizeWebStringList(adCopyBlocksRecord.google, 10),
      meta: normalizeWebStringList(adCopyBlocksRecord.meta, 10),
    },
    assetRequests: normalizeWebStringList(value.assetRequests, 20),
    launchChecklist: normalizeAdsChecklistItems(value.launchChecklist),
    notes: sanitizeWebText(value.notes, base.notes),
    googleAds: {
      campaignType: sanitizeWebText(googleAdsRecord.campaignType, base.googleAds.campaignType),
      campaignStructure: normalizeWebStringList(googleAdsRecord.campaignStructure, 12),
      adGroups: normalizeAdsAdGroups(googleAdsRecord.adGroups),
      keywordSeeds: normalizeWebStringList(googleAdsRecord.keywordSeeds, 24),
      negativeSeeds: normalizeWebStringList(googleAdsRecord.negativeSeeds, 24),
      rsaIdeas: normalizeAdsRsaIdeas(googleAdsRecord.rsaIdeas),
      extensionsIdeas: normalizeWebStringList(googleAdsRecord.extensionsIdeas, 12),
      landingRecommendation: sanitizeWebText(
        googleAdsRecord.landingRecommendation,
        base.googleAds.landingRecommendation,
      ),
    },
    metaAds: {
      campaignAngle: sanitizeWebText(metaAdsRecord.campaignAngle, base.metaAds.campaignAngle),
      audienceIdeas: normalizeWebStringList(metaAdsRecord.audienceIdeas, 12),
      creativeAngles: normalizeWebStringList(metaAdsRecord.creativeAngles, 12),
      hooks: normalizeWebStringList(metaAdsRecord.hooks, 12),
      primaryTexts: normalizeWebStringList(metaAdsRecord.primaryTexts, 8),
      headlines: normalizeWebStringList(metaAdsRecord.headlines, 8),
      ctaIdeas: normalizeWebStringList(metaAdsRecord.ctaIdeas, 8),
      assetRequests: normalizeWebStringList(metaAdsRecord.assetRequests, 12),
    },
    adsProjects: normalizeAdsProjects(value.adsProjects),
    lastGeneratedAt: sanitizeWebText(value.lastGeneratedAt, '') || null,
    aiCache: isRecord(value.aiCache) ? value.aiCache : {},
    aiHistory: Array.isArray(value.aiHistory) ? value.aiHistory.filter(isRecord).slice(-30) : [],
  };
};

const buildAdsInputContract = (input: {
  projectId: string;
  seed: AgencySeedPayload | null;
  discovery: DiscoveryPayload;
  web: AgencyWebOutputPayload | null;
}): AgencyAdsInputPayload => {
  const projectType = input.seed?.projectType ?? {
    key: 'marketing_full',
    label: 'Marketing Full',
    description: '',
  };
  const memorySummary = input.seed?.memorySummary ?? {
    projectId: input.projectId,
    lastUpdatedAt: null,
    keyDecisions: [],
    nextActions: [],
    knownRisks: [],
  };
  const webOutput = input.web;

  return {
    projectId: input.projectId,
    projectType,
    scopePurchased: input.seed?.scopePurchased ?? [],
    activeModules: input.seed?.activeModules ?? [],
    contextSummary: input.seed?.contextSummary?.trim() || input.discovery.contextSummary,
    discovery: {
      sections: input.discovery.sections,
      notes: input.discovery.notes,
      contextSummary: input.discovery.contextSummary,
      lastUpdatedAt: input.discovery.lastUpdatedAt,
    },
    sources: {
      status: input.seed?.sources?.sourceStatus ?? 'missing',
      summary: input.seed?.sources?.sourceSummary ?? 'Nessuna fonte cliente reale registrata.',
      usedSources: input.seed?.sourceReadiness?.usedSources ?? [],
      unreadableFiles: input.seed?.sources?.unreadableFiles ?? [],
    },
    memorySummary: {
      keyDecisions: memorySummary.keyDecisions,
      nextActions: memorySummary.nextActions,
      knownRisks: memorySummary.knownRisks,
      lastUpdatedAt: memorySummary.lastUpdatedAt,
    },
    web: {
      available: Boolean(webOutput),
      pageGoal: webOutput?.pageGoal || '',
      pageType: webOutput?.pageType || '',
      targetSummary: webOutput?.targetSummary || '',
      offerSummary: webOutput?.offerSummary || '',
      valueProp: webOutput?.valueProp || '',
      ctaPrimary: webOutput?.ctaSet.primary || '',
      trustElements: webOutput?.trustElements ?? [],
      landingRecommendationBase: webOutput?.pageType === 'landing'
        ? 'Landing dedicata già presente nel modulo Web.'
        : 'Valutare landing dedicata per sostenere le campagne.',
      lastGeneratedAt: webOutput?.lastGeneratedAt || null,
    },
    alerts: (input.seed?.alerts ?? []).map((entry) => ({
      title: entry.title,
      severity: entry.severity,
      status: entry.status,
      origin: 'seed',
    })),
    opportunities: (input.seed?.opportunities ?? []).map((entry) => ({
      title: entry.title,
      stage: entry.stage,
      status: 'suggested',
      origin: 'seed',
    })),
  };
};

const buildOpportunityInputContract = (input: {
  projectId: string;
  seed: AgencySeedPayload | null;
  discovery: DiscoveryPayload;
  web: AgencyWebOutputPayload | null;
  ads: AgencyAdsOutputPayload | null;
  alerts: AgencyAlertItem[];
  tasks: AgencyTaskItem[];
}): AgencyOpportunityInputPayload => {
  const projectType = input.seed?.projectType ?? {
    key: 'marketing_full',
    label: 'Marketing Full',
    description: '',
  };
  const scopePurchased = input.seed?.scopePurchased ?? [];
  const activeModules = input.seed?.activeModules ?? [];
  const contextSummary = input.seed?.contextSummary?.trim() || input.discovery.contextSummary;
  const webOutput = input.web;
  const adsOutput = input.ads;
  const technicalAspectsLower = input.discovery.sections.technicalAspects.toLowerCase();
  const marketingAcquisitionLower = input.discovery.sections.marketingAcquisition.toLowerCase();
  const hasTrackingSignal = technicalAspectsLower.includes('tracking')
    || marketingAcquisitionLower.includes('tracking')
    || scopePurchased.some((entry) => entry.key === 'tracking' && entry.purchased);
  const webTrustElements = webOutput?.trustElements ?? [];
  const primaryCta = webOutput?.ctaSet.primary?.trim() || '';

  return {
    projectId: input.projectId,
    projectType,
    scopePurchased,
    activeModules,
    contextSummary,
    discovery: {
      sections: input.discovery.sections,
      notes: input.discovery.notes,
      contextSummary: input.discovery.contextSummary,
      lastUpdatedAt: input.discovery.lastUpdatedAt,
      completeness: {
        hasBusinessContext: input.discovery.sections.businessContext.trim().length > 0,
        hasProjectGoal: input.discovery.sections.projectGoal.trim().length > 0,
        hasTarget: input.discovery.sections.target.trim().length > 0,
        hasOffer: input.discovery.sections.offer.trim().length > 0,
        hasTechnicalAspects: input.discovery.sections.technicalAspects.trim().length > 0,
        hasMarketingAcquisition: input.discovery.sections.marketingAcquisition.trim().length > 0,
        hasTrackingSignal,
      },
    },
    web: {
      available: Boolean(webOutput),
      pageGoal: webOutput?.pageGoal || '',
      pageType: webOutput?.pageType || '',
      targetSummary: webOutput?.targetSummary || '',
      offerSummary: webOutput?.offerSummary || '',
      valueProp: webOutput?.valueProp || '',
      ctaPrimary: primaryCta,
      trustElements: webTrustElements,
      sectionPlanCount: webOutput?.sectionPlan.length ?? 0,
      lastGeneratedAt: webOutput?.lastGeneratedAt || null,
      output: webOutput,
    },
    ads: {
      available: Boolean(adsOutput),
      channelScope: adsOutput?.channelScope || 'none',
      campaignGoal: adsOutput?.campaignGoal || null,
      targetingSummary: adsOutput?.targetingSummary || '',
      offerAngle: adsOutput?.offerAngle || '',
      messageHooks: adsOutput?.messageHooks ?? [],
      assetRequests: adsOutput?.assetRequests ?? [],
      googleKeywordSeedsCount: adsOutput?.googleAds.keywordSeeds.length ?? 0,
      metaCreativeAnglesCount: adsOutput?.metaAds.creativeAngles.length ?? 0,
      metaAssetRequestsCount: adsOutput?.metaAds.assetRequests.length ?? 0,
      lastGeneratedAt: adsOutput?.lastGeneratedAt || null,
      output: adsOutput,
    },
    alerts: input.alerts,
    tasks: input.tasks,
    dataCompleteness: {
      hasDiscovery: Boolean(input.discovery.persisted || input.discovery.lastUpdatedAt),
      hasContextSummary: contextSummary.trim().length > 0,
      hasWebOutput: Boolean(webOutput?.lastGeneratedAt || (webOutput?.sectionPlan.length ?? 0) > 0 || webOutput?.previewHtmlBase),
      hasAdsOutput: Boolean(adsOutput?.lastGeneratedAt || (adsOutput?.messageHooks.length ?? 0) > 0 || (adsOutput?.assetRequests.length ?? 0) > 0),
      hasAlerts: input.alerts.length > 0,
      hasTasks: input.tasks.length > 0,
      hasActiveModules: activeModules.length > 0,
      hasTrustElements: webTrustElements.length > 0,
      hasPrimaryCta: primaryCta.length >= 6,
    },
  };
};

const evaluateOpportunityInputV2 = (input: AgencyOpportunityInputPayload) => {
  const lastEvaluatedAt = new Date();
  const isAdsRelevant = ADS_PROJECT_TYPES.has(input.projectType.key)
    || input.projectType.key === 'local_ads'
    || input.ads.channelScope !== 'none'
    || getPurchasedFlag(input.scopePurchased, 'ads');
  const isWebsiteRelevant = WEBSITE_PROJECT_TYPES.has(input.projectType.key)
    || input.projectType.key === 'landing_page'
    || input.web.available
    || getPurchasedFlag(input.scopePurchased, 'web');
  const isLocalAdsProject = input.projectType.key === 'local_ads';
  const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));
  const resolvePriorityFromScore = (score: number): AgencyPriority => {
    if (score >= 90) {
      return 'URGENT';
    }
    if (score >= 75) {
      return 'HIGH';
    }
    if (score >= 60) {
      return 'MEDIUM';
    }
    return 'LOW';
  };
  const resolveImpactFromScore = (score: number): AgencyPriority => {
    if (score >= 95) {
      return 'URGENT';
    }
    if (score >= 80) {
      return 'HIGH';
    }
    if (score >= 60) {
      return 'MEDIUM';
    }
    return 'LOW';
  };
  const toPriorityLabel = (priority: AgencyPriority) => {
    switch (priority) {
      case 'URGENT':
        return 'urgente';
      case 'HIGH':
        return 'alta';
      case 'MEDIUM':
        return 'media';
      default:
        return 'bassa';
    }
  };
  const buildOpportunityMeta = (title: string) => {
    const normalizedTitle = normalizeTitleKey(title);

    switch (normalizedTitle) {
      case 'landing dedicata consigliata': {
        const score = clampScore(
          86
          + (input.ads.channelScope === 'both' ? 6 : 0)
          + (input.dataCompleteness.hasAdsOutput ? 4 : 0),
        );
        const priority = resolvePriorityFromScore(score);
        return {
          category: 'landing',
          type: 'critical',
          priority,
          score,
          impactLevel: resolveImpactFromScore(score),
          sourceModule: input.ads.available ? 'ads' : 'brain',
          sourceSignalKey: 'missing_dedicated_landing',
          dedupKey: 'landing:missing_dedicated_landing',
          suggestedService: 'landing_page',
          rationale: `Il progetto è orientato alle Ads ma non emerge una landing dedicata: la coerenza annuncio-pagina può impattare direttamente la conversione, quindi la priorità è ${toPriorityLabel(priority)}.`,
        };
      }
      case 'pacchetto seo consigliato per il progetto web': {
        const score = clampScore(60 + (isWebsiteRelevant ? 6 : 0));
        const priority = resolvePriorityFromScore(score);
        return {
          category: 'seo',
          type: 'strategic',
          priority,
          score,
          impactLevel: resolveImpactFromScore(score),
          sourceModule: input.web.available ? 'web' : 'brain',
          sourceSignalKey: 'missing_seo_scope',
          dedupKey: 'seo:missing_seo_scope',
          suggestedService: 'seo_foundation',
          rationale: `Il progetto ha un perimetro web ma non mostra un presidio SEO esplicito: questo limita la capacità di intercettare domanda organica e rende l’opportunità strategica con priorità ${toPriorityLabel(priority)}.`,
        };
      }
      case 'setup tracking conversioni consigliato': {
        const score = clampScore(78 + (isAdsRelevant ? 10 : 0) + (input.ads.channelScope === 'both' ? 4 : 0));
        const priority = resolvePriorityFromScore(score);
        return {
          category: 'tracking',
          type: isAdsRelevant ? 'critical' : 'improvement',
          priority,
          score,
          impactLevel: resolveImpactFromScore(score),
          sourceModule: 'cross_module',
          sourceSignalKey: 'missing_tracking_signal',
          dedupKey: 'tracking:missing_tracking_signal',
          suggestedService: 'tracking_setup',
          rationale: `Manca un segnale chiaro di tracking tra scope, discovery e output operativi: senza misurazione affidabile il rendimento del progetto resta opaco, quindi la priorità è ${toPriorityLabel(priority)}.`,
        };
      }
      case 'integrare prova sociale nella pagina web': {
        const score = clampScore(66 + (isAdsRelevant ? 4 : 0) + (isLocalAdsProject ? 6 : 0));
        const priority = resolvePriorityFromScore(score);
        return {
          category: 'copy',
          type: 'improvement',
          priority,
          score,
          impactLevel: resolveImpactFromScore(score),
          sourceModule: 'web',
          sourceSignalKey: isLocalAdsProject ? 'missing_local_trust_elements' : 'missing_trust_elements',
          dedupKey: isLocalAdsProject ? 'copy:missing_local_trust_elements' : 'copy:missing_trust_elements',
          suggestedService: 'trust_elements_pack',
          rationale: isLocalAdsProject
            ? `La pagina non mostra segnali di fiducia o prova locale sufficienti per supportare campagne local: il beneficio atteso è aumentare credibilità e risposta, con priorità ${toPriorityLabel(priority)}.`
            : `L’output Web non evidenzia abbastanza prova sociale: rafforzare trust e credibilità può sostenere il tasso di conversione, quindi la priorità è ${toPriorityLabel(priority)}.`,
        };
      }
      case 'definire cta primaria chiara per la pagina': {
        const score = clampScore(68 + (isAdsRelevant ? 6 : 0));
        const priority = resolvePriorityFromScore(score);
        return {
          category: 'copy',
          type: 'improvement',
          priority,
          score,
          impactLevel: resolveImpactFromScore(score),
          sourceModule: 'web',
          sourceSignalKey: 'missing_primary_cta',
          dedupKey: 'copy:missing_primary_cta',
          suggestedService: 'conversion_copy',
          rationale: `La pagina non espone una CTA primaria abbastanza chiara rispetto all’obiettivo dichiarato: questo rende più debole il percorso di conversione, quindi la priorità è ${toPriorityLabel(priority)}.`,
        };
      }
      case 'tracking web da esplicitare nel brief tecnico': {
        const score = clampScore(72 + (isWebsiteRelevant ? 4 : 0));
        const priority = resolvePriorityFromScore(score);
        return {
          category: 'tracking',
          type: isAdsRelevant ? 'critical' : 'improvement',
          priority,
          score,
          impactLevel: resolveImpactFromScore(score),
          sourceModule: 'discovery',
          sourceSignalKey: 'brief_tracking_missing',
          dedupKey: 'tracking:missing_tracking_signal',
          suggestedService: 'tracking_brief_alignment',
          rationale: `Nel discovery il tracciamento non è esplicitato in modo sufficiente: il team rischia di produrre senza criteri di misura chiari, quindi la priorità è ${toPriorityLabel(priority)}.`,
        };
      }
      case 'sprint creativo meta + landing dedicata': {
        const score = clampScore(80 + (input.ads.channelScope === 'both' ? 4 : 0));
        const priority = resolvePriorityFromScore(score);
        return {
          category: 'landing',
          type: 'commercial',
          priority,
          score,
          impactLevel: resolveImpactFromScore(score),
          sourceModule: 'cross_module',
          sourceSignalKey: 'meta_landing_combo',
          dedupKey: 'landing:meta_landing_combo',
          suggestedService: 'meta_landing_sprint',
          rationale: `Il progetto mostra segnali Meta ma non una combinazione solida tra creatività e landing dedicata: l’opportunità nasce per aumentare continuità del funnel, con priorità ${toPriorityLabel(priority)}.`,
        };
      }
      case 'definire angoli creativi piu forti per meta ads': {
        const score = clampScore(74 + (input.ads.metaCreativeAnglesCount === 0 ? 6 : 0));
        const priority = resolvePriorityFromScore(score);
        return {
          category: 'creative',
          type: 'improvement',
          priority,
          score,
          impactLevel: resolveImpactFromScore(score),
          sourceModule: 'ads',
          sourceSignalKey: 'missing_meta_creative_angles',
          dedupKey: 'creative:missing_meta_creative_angles',
          suggestedService: 'creative_strategy',
          rationale: `L’output Ads non mostra abbastanza angoli creativi per Meta rispetto al target e al canale: il rischio è saturare presto il messaggio, quindi la priorità è ${toPriorityLabel(priority)}.`,
        };
      }
      case 'preparare asset visual dedicati per meta ads': {
        const score = clampScore(77 + (input.ads.metaAssetRequestsCount === 0 ? 6 : 0));
        const priority = resolvePriorityFromScore(score);
        return {
          category: 'creative',
          type: 'commercial',
          priority,
          score,
          impactLevel: resolveImpactFromScore(score),
          sourceModule: 'ads',
          sourceSignalKey: 'missing_meta_visual_assets',
          dedupKey: 'creative:missing_meta_visual_assets',
          suggestedService: 'creative_asset_pack',
          rationale: `Meta richiede asset visual coerenti con hook e audience, ma l’output attuale non li copre ancora abbastanza: questo limita la partenza operativa, quindi la priorità è ${toPriorityLabel(priority)}.`,
        };
      }
      case 'chiarire offerta principale per campagne search': {
        const score = clampScore(76 + (input.ads.googleKeywordSeedsCount > 0 ? 3 : 0));
        const priority = resolvePriorityFromScore(score);
        return {
          category: 'offer',
          type: 'improvement',
          priority,
          score,
          impactLevel: resolveImpactFromScore(score),
          sourceModule: 'ads',
          sourceSignalKey: 'unclear_search_offer',
          dedupKey: 'offer:unclear_search_offer',
          suggestedService: 'offer_refinement',
          rationale: `Le campagne Search hanno bisogno di un’offerta leggibile e immediata, ma dall’output Ads non emerge ancora con sufficiente chiarezza: la priorità è ${toPriorityLabel(priority)}.`,
        };
      }
      case 'sprint cro su pagine ad alto traffico':
      default: {
        const score = clampScore(54 + (isWebsiteRelevant ? 4 : 0));
        const priority = resolvePriorityFromScore(score);
        return {
          category: 'copy',
          type: 'strategic',
          priority,
          score,
          impactLevel: resolveImpactFromScore(score),
          sourceModule: 'cross_module',
          sourceSignalKey: 'cro_sprint_recommended',
          dedupKey: 'copy:cro_sprint_recommended',
          suggestedService: 'cro_sprint',
          rationale: `Non emerge un gap singolo dominante, ma c’è spazio per ottimizzare le pagine con maggiore potenziale: l’opportunità resta strategica con priorità ${toPriorityLabel(priority)}.`,
        };
      }
    }
  };
  const baseOpportunities = buildRuleBasedOpportunities({
    projectTypeKey: input.projectType.key,
    scopePurchased: input.scopePurchased.map((entry) => ({
      key: entry.key,
      purchased: entry.purchased,
    })),
    discovery: input.discovery.sections,
    webOutput: input.web.output,
    adsOutput: input.ads.output,
  });

  const dedupedByKey = new Map<string, ReturnType<typeof buildOpportunityMeta> & {
    title: string;
    stage: string;
    estimatedValue: number;
    status: ProjectOpportunityStatus;
    rationale: null;
    lastEvaluatedAt: Date;
  }>();

  for (const entry of baseOpportunities) {
    const meta = buildOpportunityMeta(entry.title);
    const mergedEntry = {
      ...entry,
      ...meta,
      lastEvaluatedAt,
    };
    const dedupKey = meta.dedupKey || normalizeTitleKey(entry.title);
    const existingEntry = dedupedByKey.get(dedupKey);

    if (!existingEntry || (mergedEntry.score ?? 0) > (existingEntry.score ?? 0)) {
      dedupedByKey.set(dedupKey, mergedEntry);
    }
  }

  return Array.from(dedupedByKey.values()).sort((left, right) => {
    const scoreDelta = (right.score ?? 0) - (left.score ?? 0);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return right.estimatedValue - left.estimatedValue;
  });
};

const resolveAdsOutputFromBody = (
  body: unknown,
  projectId: string,
  input: AgencyAdsInputPayload,
): AgencyAdsOutputPayload => {
  if (!isRecord(body)) {
    return createEmptyAdsOutput(projectId, input);
  }

  const source = isRecord(body.output) ? body.output : body;
  return normalizeAdsOutputFromJson(source as Prisma.JsonValue, projectId, input);
};

const buildContextSummaryFallback = (snapshot: AgencyProjectSnapshot) => {
  const projectTypeLabel = snapshot.projectType?.label ?? 'Progetto Agency';
  const scopeCount = normalizeScopePurchased(snapshot.scopePurchased).filter((item) => item.purchased).length;
  const activeModulesCount = snapshot.activeModules.filter((item) => item.active).length;
  const alertsCount = snapshot.projectAlerts.length;
  const opportunitiesCount = snapshot.projectOpportunities.length;

  return `${projectTypeLabel}. Scope acquistati: ${scopeCount}. Moduli attivi: ${activeModulesCount}. Alert: ${alertsCount}. Opportunita: ${opportunitiesCount}.`;
};

const extractSourcesJsonFromMemory = (memory: unknown) => {
  if (!isRecord(memory)) {
    return null;
  }

  if ('sourcesJson' in memory && memory.sourcesJson) {
    return memory.sourcesJson;
  }

  const briefJson = memory.briefJson;
  if (isRecord(briefJson) && briefJson.sources) {
    return briefJson.sources;
  }

  return null;
};

const mapSnapshotToSeedPayload = (
  snapshot: AgencyProjectSnapshot,
  sourcesOverride?: AgencyProjectSourcesPayload,
): AgencySeedPayload => {
  const memorySummary = normalizeMemorySummary(
    snapshot.id,
    snapshot.projectMemory?.memorySummary as Prisma.JsonValue | null,
    snapshot.projectMemory?.updatedAt,
  );
  const sources = sourcesOverride ?? normalizeProjectSources(extractSourcesJsonFromMemory(snapshot.projectMemory));
  const sourceReadiness = buildSourceReadiness(sources);

  return {
    projectId: snapshot.id,
    projectType: snapshot.projectType
      ? {
          key: snapshot.projectType.key,
          label: snapshot.projectType.label,
          description: snapshot.projectType.description ?? '',
        }
      : null,
    scopePurchased: normalizeScopePurchased(snapshot.scopePurchased as Prisma.JsonValue | null),
    activeModules: snapshot.activeModules.map((entry) => ({
      key: entry.moduleKey,
      label: entry.moduleLabel ?? entry.moduleKey,
      included: entry.included,
      suggested: entry.suggested,
      active: entry.active,
    })),
    alerts: snapshot.projectAlerts.map((entry) => ({
      id: entry.id,
      title: entry.title,
      severity: entry.severity.toLowerCase(),
      status: entry.status.toLowerCase(),
      projectId: snapshot.id,
    })),
    opportunities: snapshot.projectOpportunities.map((entry) => ({
      id: entry.id,
      title: entry.title,
      stage: entry.stage ?? 'Identificata',
      estimatedValue: entry.estimatedValue ? Number(entry.estimatedValue) : 0,
      status: entry.status.toLowerCase(),
      category: 'category' in entry ? entry.category : null,
      type: 'type' in entry ? entry.type : null,
      rationale: 'rationale' in entry ? entry.rationale : null,
      priority: 'priority' in entry ? entry.priority?.toLowerCase() ?? null : null,
      score: 'score' in entry ? entry.score : null,
      impactLevel: 'impactLevel' in entry ? entry.impactLevel?.toLowerCase() ?? null : null,
      sourceModule: 'sourceModule' in entry ? entry.sourceModule : null,
      sourceSignalKey: 'sourceSignalKey' in entry ? entry.sourceSignalKey : null,
      dedupKey: 'dedupKey' in entry ? entry.dedupKey : null,
      suggestedService: 'suggestedService' in entry ? entry.suggestedService : null,
      lastEvaluatedAt: 'lastEvaluatedAt' in entry && entry.lastEvaluatedAt
        ? entry.lastEvaluatedAt.toISOString()
        : null,
      origin: entry.source?.trim() || 'persisted',
      projectId: snapshot.id,
    })),
    memorySummary,
    sources,
    sourceReadiness,
    contextSummary: snapshot.projectMemory?.contextSummary?.trim() || buildContextSummaryFallback(snapshot),
  };
};

const mapAlertRecordToItem = (record: {
  id: string;
  title: string;
  severity: string;
  status: string;
  reason: string | null;
  projectId: string;
  source?: string | null;
}): AgencyAlertItem => ({
  id: record.id,
  title: record.title,
  severity: record.severity.toLowerCase(),
  status: record.status.toLowerCase(),
  reason: record.reason,
  projectId: record.projectId,
  origin: record.source?.trim() || 'persisted',
});

const mapOpportunityRecordToItem = (record: {
  id: string;
  title: string;
  stage: string | null;
  estimatedValue: Prisma.Decimal | null;
  status: string;
  projectId: string;
  category?: string | null;
  type?: string | null;
  rationale?: string | null;
  priority?: string | null;
  score?: number | null;
  impactLevel?: string | null;
  sourceModule?: string | null;
  sourceSignalKey?: string | null;
  dedupKey?: string | null;
  suggestedService?: string | null;
  lastEvaluatedAt?: Date | null;
  source?: string | null;
}): AgencyOpportunityItem => ({
  id: record.id,
  title: record.title,
  stage: record.stage ?? 'Identificata',
  estimatedValue: record.estimatedValue ? Number(record.estimatedValue) : 0,
  status: record.status.toLowerCase(),
  projectId: record.projectId,
  origin: record.source?.trim() || 'persisted',
  category: typeof record.category === 'string' && record.category.trim() ? record.category.trim() : null,
  type: typeof record.type === 'string' && record.type.trim() ? record.type.trim() : null,
  rationale: typeof record.rationale === 'string' && record.rationale.trim() ? record.rationale.trim() : null,
  priority: typeof record.priority === 'string' && record.priority.trim() ? record.priority.toLowerCase() : null,
  score: typeof record.score === 'number' ? record.score : null,
  impactLevel: typeof record.impactLevel === 'string' && record.impactLevel.trim() ? record.impactLevel.toLowerCase() : null,
  sourceModule: typeof record.sourceModule === 'string' && record.sourceModule.trim() ? record.sourceModule.trim() : null,
  sourceSignalKey: typeof record.sourceSignalKey === 'string' && record.sourceSignalKey.trim() ? record.sourceSignalKey.trim() : null,
  dedupKey: typeof record.dedupKey === 'string' && record.dedupKey.trim() ? record.dedupKey.trim() : null,
  suggestedService: typeof record.suggestedService === 'string' && record.suggestedService.trim() ? record.suggestedService.trim() : null,
  lastEvaluatedAt: record.lastEvaluatedAt instanceof Date ? record.lastEvaluatedAt.toISOString() : null,
});

const mapActiveModuleRecordToItem = (record: {
  moduleKey: string;
  moduleLabel: string | null;
  included: boolean;
  suggested: boolean;
  active: boolean;
}): AgencyActiveModuleItem => ({
  key: record.moduleKey,
  label: record.moduleLabel ?? record.moduleKey,
  included: record.included,
  suggested: record.suggested,
  active: record.active,
});

const mapTaskRecordToItem = (record: {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  teamRole: string;
  priority: string;
  status: string;
  sourceType: string;
  dependsOnTaskId: string | null;
}): AgencyTaskItem => ({
  id: record.id,
  projectId: record.projectId,
  title: record.title,
  description: record.description,
  teamRole: record.teamRole,
  priority: record.priority.toLowerCase(),
  status: record.status.toLowerCase(),
  sourceType: record.sourceType,
  dependsOnTaskId: record.dependsOnTaskId,
  origin: record.sourceType?.trim() || 'persisted',
});

const toAgencyProjectScopeEntries = (scopeMap: AgencyProjectScopeMap) => ([
  {
    key: 'web',
    label: 'Sito web',
    purchased: Boolean(scopeMap.website),
  },
  {
    key: 'landing',
    label: 'Landing page',
    purchased: Boolean(scopeMap.landing_page),
  },
  {
    key: 'ads',
    label: 'Campaign Ads',
    purchased: Boolean(scopeMap.google_ads || scopeMap.meta_ads),
  },
  {
    key: 'seo',
    label: 'SEO',
    purchased: Boolean(scopeMap.seo),
  },
  {
    key: 'reporting',
    label: 'Reporting',
    purchased: Boolean(scopeMap.reporting),
  },
  {
    key: 'diagnosis',
    label: 'Diagnosis',
    purchased: Boolean(scopeMap.diagnosis),
  },
]);

const buildAgencyProjectDataReadiness = (record: AgencyProjectRecord | AgencyProjectSnapshot) => ({
  hasMemory: Boolean(record.projectMemory?.id),
  hasDiscovery: Boolean(record.projectMemory?.briefJson || record.projectMemory?.contextSummary),
  hasWeb: Boolean(record.projectMemory?.webJson),
  hasAds: Boolean(record.projectMemory?.adsJson),
  hasReports: Boolean(record.projectMemory?.reportsJson),
  hasDiagnosis: Boolean(record.projectMemory?.diagnosisJson),
});

const mapProjectRecordToPayload = (
  record: AgencyProjectRecord | AgencyProjectSnapshot,
  source = 'db',
  sourcesOverride?: AgencyProjectSourcesPayload,
): AgencyProjectPayload => {
  const projectTypeKey = record.projectType?.key ?? null;
  const sources = sourcesOverride ?? normalizeProjectSources(extractSourcesJsonFromMemory(record.projectMemory));
  return {
    id: record.id,
    name: record.name,
    clientId: record.clientId ?? null,
    clientName: record.client?.name ?? null,
    projectType: record.projectType
      ? {
          key: record.projectType.key,
          label: record.projectType.label,
          description: record.projectType.description ?? '',
        }
      : null,
    goal: record.goal?.trim() || '',
    scopePurchased: normalizeAgencyProjectScopeMap(
      normalizeScopePurchased(record.scopePurchased as Prisma.JsonValue | null),
      projectTypeKey,
    ),
    statusAgency: record.statusAgency.toLowerCase(),
    priorityAgency: record.priorityAgency.toLowerCase(),
    activeModules: record.activeModules.map((entry) => mapActiveModuleRecordToItem({
      moduleKey: entry.moduleKey,
      moduleLabel: entry.moduleLabel,
      included: entry.included,
      suggested: entry.suggested,
      active: entry.active,
    })),
    createdAt: record.createdAt?.toISOString?.() ?? null,
    updatedAt: record.updatedAt?.toISOString?.() ?? null,
    source,
    sources,
    sourceReadiness: buildSourceReadiness(sources),
    dataReadiness: buildAgencyProjectDataReadiness(record),
  };
};

const buildInitialDiscoverySections = (input: {
  projectName: string;
  projectTypeLabel: string;
  goal: string;
  clientName?: string | null;
}): DiscoverySections => ({
  businessContext: input.clientName
    ? `Progetto ${input.projectTypeLabel} per ${input.clientName}.`
    : `Nuovo progetto ${input.projectTypeLabel} in fase iniziale.`,
  projectGoal: input.goal.trim() || 'Obiettivo operativo da definire.',
  target: 'Target da validare in discovery.',
  offer: 'Offerta da dettagliare nel discovery.',
  brandCommunication: 'Tone e linee guida da confermare con il team.',
  availableMaterials: 'Materiali iniziali da raccogliere.',
  technicalAspects: 'Setup tecnico da verificare.',
  marketingAcquisition: 'Canali di acquisizione da definire o confermare.',
});

const buildInitialProjectContextSummary = (input: {
  projectName: string;
  projectTypeLabel: string;
  goal: string;
}) => {
  const normalizedGoal = input.goal.trim() || 'obiettivo da definire';
  return `${input.projectTypeLabel} avviato per ${input.projectName}. Goal iniziale: ${normalizedGoal}.`;
};

const buildRuleBasedAlerts = (input: {
  projectTypeKey: string;
  scopePurchased: Array<{ key: string; purchased: boolean }>;
  discovery: DiscoverySections;
  adsOutput?: AgencyAdsOutputPayload | null;
}) => {
  const alerts: Array<{
    title: string;
    severity: ProjectAlertSeverity;
    status: ProjectAlertStatus;
    priority: AgencyPriority;
    reason?: string;
  }> = [];

  const hasTracking = getPurchasedFlag(input.scopePurchased, 'tracking');
  const targetLower = input.discovery.target.toLowerCase();
  const offerLower = input.discovery.offer.toLowerCase();
  const goalLower = input.discovery.projectGoal.toLowerCase();
  const brandLower = input.discovery.brandCommunication.toLowerCase();
  const marketingLower = input.discovery.marketingAcquisition.toLowerCase();
  const hasTarget = input.discovery.target.trim().length > 0 && !targetLower.includes('dati insufficienti');
  const hasOffer = input.discovery.offer.trim().length > 0 && !offerLower.includes('dati insufficienti');
  const hasGoal = input.discovery.projectGoal.trim().length > 0 && !goalLower.includes('dati insufficienti');
  const hasClearCta = marketingLower.includes('cta') || marketingLower.includes('call to action') || marketingLower.includes('prenota') || marketingLower.includes('richiedi');
  const hasDifferentiator = brandLower.includes('usp') || brandLower.includes('differenz') || brandLower.includes('posizionamento');
  const technicalAspectsLower = input.discovery.technicalAspects.toLowerCase();
  const hasAdsOutputSignal = Boolean(input.adsOutput)
    && (
      input.adsOutput?.googleAds.keywordSeeds.length > 0
      || input.adsOutput?.metaAds.primaryTexts.length > 0
      || input.adsOutput?.assetRequests.length > 0
    );
  const hasMetaAssets = (input.adsOutput?.metaAds.assetRequests.length ?? 0) > 0;

  if (ADS_PROJECT_TYPES.has(input.projectTypeKey)) {
    alerts.push({
      title: 'Competitor analysis consigliata prima di scalare le campagne.',
      severity: 'HIGH',
      status: 'SUGGESTED',
      priority: 'HIGH',
      reason: 'Progetto ads con necessità di benchmark competitivo.',
    });
  }

  if (!hasTracking || !technicalAspectsLower.includes('tracking')) {
    alerts.push({
      title: 'Tracking incompleto: consigliato setup eventi e conversioni.',
      severity: 'MEDIUM',
      status: 'SUGGESTED',
      priority: 'MEDIUM',
      reason: 'Dati discovery/Scope indicano gap di tracciamento.',
    });
  }

  if (hasAdsOutputSignal && !hasMetaAssets && (input.projectTypeKey === 'meta_ads' || input.projectTypeKey === 'google_meta_ads')) {
    alerts.push({
      title: 'Asset visual Meta da confermare prima del launch.',
      severity: 'MEDIUM',
      status: 'SUGGESTED',
      priority: 'MEDIUM',
      reason: 'Output Ads presente ma asset request Meta non ancora definiti.',
    });
  }

  if (!hasOffer) {
    alerts.push({
      title: 'Offerta non chiara: la landing rischia di risultare generica.',
      severity: 'MEDIUM',
      status: 'SUGGESTED',
      priority: 'MEDIUM',
      reason: 'Brief senza offerta esplicita.',
    });
  }

  if (!hasTarget) {
    alerts.push({
      title: 'Target non definito: impossibile generare copy Ads preciso.',
      severity: 'HIGH',
      status: 'SUGGESTED',
      priority: 'HIGH',
      reason: 'Brief senza audience o cliente ideale esplicito.',
    });
  }

  if (!hasGoal) {
    alerts.push({
      title: 'Obiettivo progetto non definito: manca il criterio di successo.',
      severity: 'HIGH',
      status: 'SUGGESTED',
      priority: 'HIGH',
      reason: 'Brief senza obiettivo operativo o KPI chiaro.',
    });
  }

  if (!hasClearCta) {
    alerts.push({
      title: "CTA mancante: serve definire l'azione primaria.",
      severity: 'MEDIUM',
      status: 'SUGGESTED',
      priority: 'MEDIUM',
      reason: 'Brief senza call to action primaria utilizzabile da Contenuti Web o Campagne ADS.',
    });
  }

  if (!hasDifferentiator) {
    alerts.push({
      title: 'Differenzianti/USP non evidenti nelle fonti disponibili.',
      severity: 'MEDIUM',
      status: 'SUGGESTED',
      priority: 'MEDIUM',
      reason: 'Brand e comunicazione non contengono un differenziante operativo.',
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      title: 'Pianificare revisione KPI settimanale del progetto.',
      severity: 'LOW',
      status: 'SUGGESTED',
      priority: 'LOW',
      reason: 'Alert di controllo operativo.',
    });
  }

  return mergeUniqueByTitle(alerts);
};

const buildRuleBasedOpportunities = (input: {
  projectTypeKey: string;
  scopePurchased: Array<{ key: string; purchased: boolean }>;
  discovery: DiscoverySections;
  webOutput?: AgencyWebOutputPayload | null;
  adsOutput?: AgencyAdsOutputPayload | null;
}) => {
  const opportunities: Array<{
    title: string;
    stage: string;
    estimatedValue: number;
    status: ProjectOpportunityStatus;
  }> = [];

  const hasLanding = getPurchasedFlag(input.scopePurchased, 'landing');
  const hasSeo = getPurchasedFlag(input.scopePurchased, 'seo');
  const hasTracking = getPurchasedFlag(input.scopePurchased, 'tracking');
  const technicalAspectsLower = input.discovery.technicalAspects.toLowerCase();
  const sectionPlan = Array.isArray(input.webOutput?.sectionPlan) ? input.webOutput.sectionPlan : [];
  const hasWebOutputSignal = sectionPlan.length > 0
    || (typeof input.webOutput?.pageGoal === 'string' && input.webOutput.pageGoal.trim().length > 0)
    || (typeof input.webOutput?.previewHtmlBase === 'string' && input.webOutput.previewHtmlBase.trim().length > 0);
  const webTrustElements = Array.isArray(input.webOutput?.trustElements) ? input.webOutput.trustElements : [];
  const hasTrustElements = webTrustElements.some((entry) => entry.trim().length > 0);
  const primaryCta = typeof input.webOutput?.ctaSet?.primary === 'string'
    ? input.webOutput.ctaSet.primary.trim()
    : '';
  const hasClearCta = primaryCta.length >= 6;
  const hasAdsOutputSignal = Boolean(input.adsOutput)
    && (
      input.adsOutput?.googleAds.keywordSeeds.length > 0
      || input.adsOutput?.metaAds.primaryTexts.length > 0
      || input.adsOutput?.assetRequests.length > 0
    );
  const hasMetaAngles = (input.adsOutput?.metaAds.creativeAngles.length ?? 0) >= 2;
  const hasMetaAssets = (input.adsOutput?.metaAds.assetRequests.length ?? 0) > 0;
  const hasGoogleOfferAngle = (input.adsOutput?.offerAngle.trim().length ?? 0) >= 6;

  if (ADS_PROJECT_TYPES.has(input.projectTypeKey) && !hasLanding) {
    opportunities.push({
      title: 'Landing dedicata consigliata',
      stage: 'Identificata',
      estimatedValue: 1600,
      status: 'SUGGESTED',
    });
  }

  if (WEBSITE_PROJECT_TYPES.has(input.projectTypeKey) && !hasSeo) {
    opportunities.push({
      title: 'Pacchetto SEO consigliato per il progetto web',
      stage: 'Proposta',
      estimatedValue: 1400,
      status: 'SUGGESTED',
    });
  }

  if (!hasTracking) {
    opportunities.push({
      title: 'Setup tracking conversioni consigliato',
      stage: 'Identificata',
      estimatedValue: 900,
      status: 'SUGGESTED',
    });
  }

  if (hasWebOutputSignal && !hasTrustElements) {
    opportunities.push({
      title: 'Integrare prova sociale nella pagina Web',
      stage: 'Identificata',
      estimatedValue: 700,
      status: 'SUGGESTED',
    });
  }

  if (hasWebOutputSignal && !hasClearCta) {
    opportunities.push({
      title: 'Definire CTA primaria chiara per la pagina',
      stage: 'Identificata',
      estimatedValue: 600,
      status: 'SUGGESTED',
    });
  }

  if (WEBSITE_PROJECT_TYPES.has(input.projectTypeKey) && !hasTracking && !technicalAspectsLower.includes('tracking')) {
    opportunities.push({
      title: 'Tracking web da esplicitare nel brief tecnico',
      stage: 'Proposta',
      estimatedValue: 950,
      status: 'SUGGESTED',
    });
  }

  if (input.discovery.marketingAcquisition.toLowerCase().includes('meta') && !hasLanding) {
    opportunities.push({
      title: 'Sprint creativo Meta + landing dedicata',
      stage: 'In valutazione',
      estimatedValue: 1800,
      status: 'SUGGESTED',
    });
  }

  if (hasAdsOutputSignal && (input.projectTypeKey === 'meta_ads' || input.projectTypeKey === 'google_meta_ads') && !hasMetaAngles) {
    opportunities.push({
      title: 'Definire angoli creativi piu forti per Meta Ads',
      stage: 'Identificata',
      estimatedValue: 850,
      status: 'SUGGESTED',
    });
  }

  if (hasAdsOutputSignal && (input.projectTypeKey === 'meta_ads' || input.projectTypeKey === 'google_meta_ads') && !hasMetaAssets) {
    opportunities.push({
      title: 'Preparare asset visual dedicati per Meta Ads',
      stage: 'Identificata',
      estimatedValue: 1100,
      status: 'SUGGESTED',
    });
  }

  if (hasAdsOutputSignal && (input.projectTypeKey === 'google_ads' || input.projectTypeKey === 'google_meta_ads' || input.projectTypeKey === 'local_ads') && !hasGoogleOfferAngle) {
    opportunities.push({
      title: 'Chiarire offerta principale per campagne Search',
      stage: 'Identificata',
      estimatedValue: 750,
      status: 'SUGGESTED',
    });
  }

  if (opportunities.length === 0) {
    opportunities.push({
      title: 'Sprint CRO su pagine ad alto traffico',
      stage: 'Proposta',
      estimatedValue: 1300,
      status: 'SUGGESTED',
    });
  }

  return mergeUniqueByTitle(opportunities);
};

const buildRuleBasedActiveModules = (input: {
  projectTypeKey: string;
  scopePurchased: Array<{ key: string; purchased: boolean }>;
}) => {
  const hasWeb = getPurchasedFlag(input.scopePurchased, 'web');
  const hasLanding = getPurchasedFlag(input.scopePurchased, 'landing');
  const hasAds = getPurchasedFlag(input.scopePurchased, 'ads');
  const hasReporting = getPurchasedFlag(input.scopePurchased, 'reporting');
  const hasDiagnosis = getPurchasedFlag(input.scopePurchased, 'diagnosis');

  const isAdsProject = ADS_PROJECT_TYPES.has(input.projectTypeKey);
  const isWebsiteProject = WEBSITE_PROJECT_TYPES.has(input.projectTypeKey);
  const isMarketingFullProject = input.projectTypeKey === 'marketing_full';
  const isEcommerceProject = input.projectTypeKey === 'ecommerce';
  const webIncluded = hasWeb || hasLanding;
  const adsIncluded = hasAds;
  const assetsIncluded = webIncluded || adsIncluded;
  const normalizeModuleState = <T extends AgencyActiveModuleItem>(entry: T): T => {
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
      key: 'discovery',
      label: 'Brief',
      included: true,
      suggested: false,
      active: true,
    },
    {
      key: 'brain',
      label: 'Agency Brain',
      included: true,
      suggested: false,
      active: true,
    },
    {
      key: 'web',
      label: 'Contenuti Web',
      included: webIncluded,
      suggested: (isWebsiteProject || isMarketingFullProject || isEcommerceProject) && !webIncluded,
      active: webIncluded || isWebsiteProject || isMarketingFullProject || isEcommerceProject,
    },
    {
      key: 'ads',
      label: 'Campagne ADS',
      included: adsIncluded,
      suggested: (isAdsProject || isMarketingFullProject || isEcommerceProject) && !adsIncluded,
      active: adsIncluded || isAdsProject || isMarketingFullProject || isEcommerceProject,
    },
    {
      key: 'reports',
      label: 'Report',
      included: hasReporting,
      suggested: (isMarketingFullProject || isWebsiteProject || isAdsProject || isEcommerceProject) && !hasReporting,
      active: hasReporting || isMarketingFullProject,
    },
    {
      key: 'diagnosis',
      label: 'Da risolvere',
      included: hasDiagnosis,
      suggested: (isMarketingFullProject || isWebsiteProject || isAdsProject || isEcommerceProject) && !hasDiagnosis,
      active: hasDiagnosis || isMarketingFullProject,
    },
    {
      key: 'opportunities',
      label: 'Opportunita',
      included: false,
      suggested: true,
      active: true,
    },
    {
      key: 'memory',
      label: 'Memoria',
      included: true,
      suggested: false,
      active: true,
    },
    {
      key: 'assets',
      label: 'Fonti',
      included: assetsIncluded,
      suggested: (isWebsiteProject || isAdsProject || isMarketingFullProject || isEcommerceProject) && !assetsIncluded,
      active: assetsIncluded || isWebsiteProject || isAdsProject || isMarketingFullProject || isEcommerceProject,
    },
    {
      key: 'tasks',
      label: 'Task',
      included: true,
      suggested: false,
      active: true,
    },
  ].map((entry) => normalizeModuleState(entry)) satisfies AgencyActiveModuleItem[];
};

const buildRuleBasedTasks = (input: {
  projectTypeKey: string;
  scopePurchased: Array<{ key: string; purchased: boolean }>;
  discovery: DiscoverySections;
}) => {
  const tasks: Array<{
    title: string;
    description?: string;
    teamRole: string;
    priority: AgencyPriority;
    status: string;
  }> = [];

  const hasWeb = getPurchasedFlag(input.scopePurchased, 'web');
  const hasLanding = getPurchasedFlag(input.scopePurchased, 'landing');
  const hasAds = getPurchasedFlag(input.scopePurchased, 'ads');
  const hasTracking = getPurchasedFlag(input.scopePurchased, 'tracking');

  tasks.push({
    title: 'Allineare roadmap operativa e milestone progetto',
    description: `Obiettivo discovery: ${input.discovery.projectGoal || 'da definire'}.`,
    teamRole: 'marketing_strategy_pm',
    priority: 'HIGH',
    status: 'todo',
  });

  if (hasWeb || hasLanding || WEBSITE_PROJECT_TYPES.has(input.projectTypeKey)) {
    tasks.push({
      title: 'Definire struttura pagine e requisiti web',
      description: 'Allineare sitemap minima e requisiti tecnici principali.',
      teamRole: 'web',
      priority: 'MEDIUM',
      status: 'todo',
    });
    tasks.push({
      title: 'Raccogliere asset grafici offline di supporto',
      description: 'Preparare materiali visual coerenti con il brand.',
      teamRole: 'graphic_offline',
      priority: 'LOW',
      status: 'todo',
    });
  }

  if (hasAds || ADS_PROJECT_TYPES.has(input.projectTypeKey)) {
    tasks.push({
      title: 'Impostare piano campagne ads sprint 1',
      description: 'Definire audience, funnel e KPI iniziali.',
      teamRole: 'ads_specialist',
      priority: 'HIGH',
      status: 'todo',
    });
    tasks.push({
      title: 'Produrre creativita social per test ads',
      description: 'Creare varianti visual per Meta/Display.',
      teamRole: 'graphic_adv_social',
      priority: 'MEDIUM',
      status: 'todo',
    });
  }

  if (!hasTracking) {
    tasks.push({
      title: 'Implementare tracking conversioni minimo',
      description: 'Validare eventi principali e conversion actions.',
      teamRole: 'web',
      priority: 'HIGH',
      status: 'todo',
    });
  }

  return mergeUniqueByTitle(tasks);
};

const getProjectSeed = async (workspaceId: string, projectId: string) => {
  const snapshot = await agencyRepository.findProjectSnapshot(workspaceId, projectId);
  if (!snapshot) {
    return null;
  }

  const sources = await agencyService.getProjectSources(workspaceId, projectId);
  return mapSnapshotToSeedPayload(snapshot, sources);
};

export const agencyService = {
  parseProjectCreateBody(body: unknown): AgencyProjectCreatePayload {
    const parsed = agencyProjectCreateBodySchema.safeParse(body);
    if (!parsed.success) {
      throw badRequest('Invalid Agency project payload', {
        issues: parsed.error.flatten(),
      });
    }

    return parsed.data;
  },

  async listWorkspaceProjects(workspaceId: string): Promise<AgencyProjectPayload[]> {
    const projects = await agencyRepository.listWorkspaceAgencyProjects(workspaceId);
    return Promise.all(projects.map(async (entry) => {
      const sources = await this.getProjectSources(workspaceId, entry.id);
      return mapProjectRecordToPayload(entry, 'db', sources);
    }));
  },

  async getProject(workspaceId: string, projectId: string): Promise<AgencyProjectPayload> {
    const project = await agencyRepository.findAgencyProject(workspaceId, projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    const loadedSources = await this.getProjectSources(workspaceId, projectId);
    const indexedRecords = await agencyRepository.listIndexedProjectSources(workspaceId, projectId);
    const sources = augmentSourcesWithIndexedRecords(loadedSources, indexedRecords);
    return mapProjectRecordToPayload(project, 'db', sources);
  },

  async createProject(input: {
    workspaceId: string;
    body: unknown;
  }): Promise<AgencyProjectPayload> {
    const payload = this.parseProjectCreateBody(input.body);
    const projectTypeDefinition = normalizeAgencyProjectTypeDefinition(payload.projectType);
    if (!projectTypeDefinition) {
      throw badRequest('Project type non supportato.');
    }

    if (payload.clientId) {
      const client = await agencyRepository.findClientLite(input.workspaceId, payload.clientId);
      if (!client) {
        throw badRequest('Cliente non trovato per il workspace corrente.');
      }
    }

    const projectTypeRecord = await agencyRepository.upsertWorkspaceProjectType({
      workspaceId: input.workspaceId,
      key: projectTypeDefinition.key,
      label: projectTypeDefinition.label,
      description: projectTypeDefinition.description,
    });
    if (!projectTypeRecord) {
      throw badRequest('Catalogo ProjectType Agency non disponibile.');
    }

    const normalizedScopeMap = normalizeAgencyProjectScopeMap(
      payload.scopePurchased,
      projectTypeDefinition.key,
    );
    const initialSources = buildProjectSourcesFromInput({
      websiteUrl: payload.websiteUrl,
      competitorUrls: payload.competitorUrls,
      uploadedFiles: payload.uploadedFiles,
      manualNotes: payload.manualNotes,
    });
    const createdProject = await agencyRepository.createAgencyProject({
      workspaceId: input.workspaceId,
      name: payload.name,
      clientId: payload.clientId ?? null,
      projectTypeId: projectTypeRecord.id,
      goal: payload.goal,
      scopePurchased: toAgencyProjectScopeEntries(normalizedScopeMap) as unknown as Prisma.InputJsonValue,
      statusAgency: 'DISCOVERY',
      priorityAgency: payload.priorityAgency,
    });

    if (payload.clientId) {
      await agencyRepository.linkProjectClient({
        projectId: createdProject.id,
        clientId: payload.clientId,
      });
    }

    const initialDiscoverySections = buildInitialDiscoverySections({
      projectName: createdProject.name,
      projectTypeLabel: projectTypeDefinition.label,
      goal: payload.goal,
      clientName: createdProject.client?.name ?? payload.clientName ?? null,
    });

    await agencyRepository.upsertProjectMemory({
      workspaceId: input.workspaceId,
      projectId: createdProject.id,
      briefJson: {
        ...initialDiscoverySections,
        notes: payload.manualNotes?.trim() || '',
        sources: initialSources,
      } as unknown as Prisma.InputJsonValue,
      sourcesJson: initialSources as unknown as Prisma.InputJsonValue,
      contextSummary: buildInitialProjectContextSummary({
        projectName: createdProject.name,
        projectTypeLabel: projectTypeDefinition.label,
        goal: payload.goal,
      }) + ` Qualita fonti: ${initialSources.sourceStatus}.`,
    });

    const bootstrapResults = await Promise.allSettled([
      this.syncProjectActiveModules(input.workspaceId, createdProject.id),
      this.syncProjectAlerts(input.workspaceId, createdProject.id),
      this.syncProjectOpportunities(input.workspaceId, createdProject.id),
      this.syncProjectTasks(input.workspaceId, createdProject.id),
    ]);

    bootstrapResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        return;
      }

      const stepName = index === 0
        ? 'active-modules'
        : index === 1
          ? 'alerts'
          : index === 2
            ? 'opportunities'
            : 'tasks';

      logAgencyServiceEvent('Agency project bootstrap step failed after create.', {
        projectId: createdProject.id,
        stepName,
      });
    });

    const refreshedProject = await agencyRepository.findAgencyProject(input.workspaceId, createdProject.id);
    return mapProjectRecordToPayload(refreshedProject ?? createdProject, 'db', initialSources);
  },

  async getProjectOverview(workspaceId: string, projectId: string) {
    const project = await agencyRepository.findProjectLite(workspaceId, projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    const syncResults = await Promise.allSettled([
      this.syncProjectActiveModules(workspaceId, projectId),
      this.syncProjectAlerts(workspaceId, projectId),
      this.syncProjectOpportunities(workspaceId, projectId),
    ]);

    syncResults.forEach((result, index) => {
      if (result.status !== 'rejected') {
        return;
      }

      const syncLabel = index === 0
        ? 'active-modules'
        : index === 1
          ? 'alerts'
          : 'opportunities';

      logAgencyServiceEvent('Overview sync step failed. Continuing with available data.', {
        projectId,
        syncLabel,
      });
    });

    const seed = await getProjectSeed(workspaceId, projectId);
    if (!seed) {
      logAgencyServiceEvent('Overview seed unavailable. Adapter fallback expected.', {
        projectId,
      });
    }

    return seed;
  },

  async getProjectBrain(workspaceId: string, projectId: string) {
    const project = await agencyRepository.findProjectLite(workspaceId, projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    const syncResults = await Promise.allSettled([
      this.syncProjectActiveModules(workspaceId, projectId),
      this.syncProjectAlerts(workspaceId, projectId),
      this.syncProjectOpportunities(workspaceId, projectId),
    ]);

    syncResults.forEach((result, index) => {
      if (result.status !== 'rejected') {
        return;
      }

      const syncLabel = index === 0
        ? 'active-modules'
        : index === 1
          ? 'alerts'
          : 'opportunities';

      logAgencyServiceEvent('Brain sync step failed. Continuing with available data.', {
        projectId,
        syncLabel,
      });
    });

    const seed = await getProjectSeed(workspaceId, projectId);
    if (!seed) {
      logAgencyServiceEvent('Brain seed unavailable. Adapter fallback expected.', {
        projectId,
      });
    }

    return seed;
  },

  parseDiscoveryBody(body: unknown) {
    const parsed = discoveryBodySchema.safeParse(body);
    if (!parsed.success) {
      throw badRequest('Invalid discovery payload', {
        issues: parsed.error.flatten(),
      });
    }

    return parsed.data;
  },

  async buildProjectWebInput(workspaceId: string, projectId: string): Promise<AgencyWebInputPayload> {
    const project = await agencyRepository.findProjectLite(workspaceId, projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    const [seed, discovery] = await Promise.all([
      getProjectSeed(workspaceId, projectId),
      this.getProjectDiscovery(workspaceId, projectId),
    ]);

    return buildWebInputContract({
      projectId,
      seed,
      discovery,
    });
  },

  async getProjectWeb(workspaceId: string, projectId: string): Promise<AgencyWebPayload> {
    const project = await agencyRepository.findProjectLite(workspaceId, projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    const [input, memoryWeb] = await Promise.all([
      this.buildProjectWebInput(workspaceId, projectId),
      agencyRepository.findProjectMemoryWeb(workspaceId, projectId),
    ]);
    const output = normalizeWebOutputFromJson(memoryWeb?.webJson as Prisma.JsonValue | null, projectId, input);

    return {
      projectId,
      input,
      output,
      persisted: Boolean(memoryWeb?.webJson),
      lastUpdatedAt: memoryWeb?.updatedAt ? memoryWeb.updatedAt.toISOString() : null,
    };
  },

  async saveProjectWeb(input: {
    workspaceId: string;
    projectId: string;
    body: unknown;
  }): Promise<AgencyWebPayload> {
    const project = await agencyRepository.findProjectLite(input.workspaceId, input.projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    const webInput = await this.buildProjectWebInput(input.workspaceId, input.projectId);
    const output = resolveWebOutputFromBody(input.body, input.projectId, webInput);
    const memoryRecord = await agencyRepository.upsertProjectMemoryWeb({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      webJson: output as unknown as Prisma.InputJsonValue,
    });

    if (!memoryRecord) {
      logAgencyServiceEvent('Web persistence unavailable. Returning non-persisted payload.', {
        projectId: input.projectId,
      });
    } else {
      try {
        await this.syncProjectOpportunities(input.workspaceId, input.projectId);
      } catch (_error) {
        logAgencyServiceEvent('Web save completed but opportunities sync failed.', {
          projectId: input.projectId,
        });
      }
    }

    return {
      projectId: input.projectId,
      input: webInput,
      output,
      persisted: Boolean(memoryRecord),
      lastUpdatedAt: memoryRecord?.updatedAt ? memoryRecord.updatedAt.toISOString() : null,
    };
  },

  async generateProjectWebProjectWithAi(input: {
    workspaceId: string;
    projectId: string;
    webProjectId: string;
  }): Promise<AgencyWebPayload & { aiGeneration: Record<string, unknown> }> {
    const aiStatus = await this.getAgencyAiStatus(input.workspaceId);
    const currentWeb = await this.getProjectWeb(input.workspaceId, input.projectId);
    if (!aiStatus.configured) {
      return {
        ...currentWeb,
        aiGeneration: {
          generated: false,
          mode: 'ai_not_configured',
          aiConfigured: false,
          message: 'AI non configurata. Usa la bozza base oppure configura un provider AI lato server.',
        },
      };
    }

    try {
      const [project, sources, discovery] = await Promise.all([
        this.getProject(input.workspaceId, input.projectId),
        this.getProjectSources(input.workspaceId, input.projectId),
        this.getProjectDiscovery(input.workspaceId, input.projectId),
      ]);
      const webProject = currentWeb.output.webProjects.find((entry) => entry.id === input.webProjectId) || currentWeb.output.webProjects[0] || null;
      const aiUserPayload = {
        task: 'generateWebOutputV2',
        webProject,
        webInput: compactAgencyAiValue(currentWeb.input),
        project: buildAgencyAiProjectSnapshot(project),
        sources: buildAgencyAiSourceSnapshot(sources),
        discovery: {
          ...buildAgencyAiDiscoverySnapshot(discovery.sections, discovery.notes),
          contextSummary: clipAgencyAiText(discovery.contextSummary, 1200),
          sourceReliability: discovery.sourceReliability,
          missingWarnings: (discovery.missingWarnings || []).slice(0, 8),
        },
        requiredOutput: {
          pageGoal: 'string',
          pageType: 'landing|homepage|service_page|ecommerce_page|section',
          targetSummary: 'string',
          offerSummary: 'string',
          valueProp: 'string',
          sectionPlan: [{ key: 'string', title: 'string', objective: 'string' }],
          copyBlocks: {
            headline: 'string',
            subheadline: 'string',
            intro: 'string',
            benefits: ['string'],
            objectionHandling: 'string',
          },
          ctaSet: { primary: 'string', secondary: 'string', final: 'string' },
          trustElements: ['string'],
          faqItems: ['string'],
          wireframe: { mode: 'text', blocks: ['string'] },
          previewHtmlBase: 'safe static HTML string without scripts',
          missingInputs: ['string'],
          recommendations: ['string'],
        },
      };
      const inputHash = buildAgencyAiInputHash(aiUserPayload);
      const aiCache = isRecord(currentWeb.output.aiCache) ? currentWeb.output.aiCache : {};
      const cacheKey = `webProject:${input.webProjectId}:full`;
      const cachedGeneration = isRecord(aiCache[cacheKey]) ? aiCache[cacheKey] as Record<string, unknown> : null;
      const cachedPayload = cachedGeneration?.inputHash === inputHash && isRecord(cachedGeneration.payload)
        ? cachedGeneration.payload
        : null;
      const systemPrompt = [
          'Sei un lead strategist e conversion copywriter per landing page.',
          'Genera output Web v2 usando solo brief, fonti e file dichiarati.',
          'Non inserire placeholder, non inventare prove sociali o dati non presenti.',
          'Ogni claim importante deve indicare fonte o assunzione.',
        ].join(' ');
      const aiResult = cachedPayload
        ? {
          payload: cachedPayload,
          meta: {
            functionName: 'web.generateProject',
            model: aiStatus.model,
            inputHash,
            estimatedInputTokens: 0,
            estimatedOutputTokens: 0,
            durationMs: 0,
            cacheHit: true,
            status: 'cache_hit' as const,
          },
        }
        : await runAgencyOpenAiJsonWithMeta({
          workspaceId: input.workspaceId,
          functionName: 'web.generateProject',
          projectId: input.projectId,
          lockKey: `${input.workspaceId}:${input.projectId}:web.generateProject:${input.webProjectId}:${inputHash}`,
          system: systemPrompt,
          user: aiUserPayload,
          jsonSchema: WEB_PROJECT_AI_JSON_SCHEMA,
        });
      const aiPayload = aiResult?.payload || {};

      const source = isRecord(aiPayload) ? aiPayload : {};
      const output = normalizeWebOutputFromJson({
        ...currentWeb.output,
        ...source,
        projectId: input.projectId,
        webProjects: currentWeb.output.webProjects.map((entry) => (
          entry.id === input.webProjectId
            ? {
              ...entry,
              status: 'review',
              sourceRefs: currentWeb.input.sources.usedSources,
              webOutput: {
                version: 'v2',
                generationMode: 'ai_with_sources',
                generatedAt: new Date().toISOString(),
                missingInputs: Array.isArray(source.missingInputs) ? source.missingInputs : [],
                recommendations: Array.isArray(source.recommendations) ? source.recommendations : [],
              },
            }
            : entry
        )),
        lastGeneratedAt: new Date().toISOString(),
        aiCache: {
          ...aiCache,
          [cacheKey]: {
            inputHash,
            payload: aiPayload,
            updatedAt: new Date().toISOString(),
            model: aiResult?.meta.model || aiStatus.model,
          },
        },
        aiHistory: appendAgencyAiHistory(currentWeb.output.aiHistory, {
          module: 'web',
          function: 'generateProject',
          webProjectId: input.webProjectId,
          inputHash,
          cacheHit: Boolean(aiResult?.meta.cacheHit),
          model: aiResult?.meta.model || aiStatus.model,
          estimatedInputTokens: aiResult?.meta.estimatedInputTokens || 0,
          estimatedOutputTokens: aiResult?.meta.estimatedOutputTokens || 0,
          estimatedCostUsd: aiResult?.meta.estimatedCostUsd || 0,
          durationMs: aiResult?.meta.durationMs || 0,
          status: aiResult?.meta.status || 'success',
          generatedAt: new Date().toISOString(),
        }),
      } as Prisma.JsonValue, input.projectId, currentWeb.input);
      const memoryRecord = await agencyRepository.upsertProjectMemoryWeb({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        webJson: output as unknown as Prisma.InputJsonValue,
      });

      return {
        projectId: input.projectId,
        input: currentWeb.input,
        output,
        persisted: Boolean(memoryRecord),
        lastUpdatedAt: memoryRecord?.updatedAt ? memoryRecord.updatedAt.toISOString() : null,
        aiGeneration: {
          generated: true,
          mode: 'ai_with_sources',
          provider: aiStatus.provider,
          model: aiStatus.model,
          cacheHit: Boolean(aiResult?.meta.cacheHit),
          inputHash,
          estimatedInputTokens: aiResult?.meta.estimatedInputTokens || 0,
          estimatedOutputTokens: aiResult?.meta.estimatedOutputTokens || 0,
          estimatedCostUsd: aiResult?.meta.estimatedCostUsd || 0,
          durationMs: aiResult?.meta.durationMs || 0,
        },
      };
    } catch (error) {
      return {
        ...currentWeb,
        aiGeneration: {
          generated: false,
          mode: 'ai_failed_fallback_available',
          aiConfigured: true,
          provider: aiStatus.provider,
          model: aiStatus.model,
          message: error instanceof Error ? error.message : 'AI generation failed',
        },
      };
    }
  },

  async generateProjectWebBlockWithAi(input: {
    workspaceId: string;
    projectId: string;
    webProjectId: string;
    body: unknown;
  }): Promise<AgencyWebPayload & { aiGeneration: Record<string, unknown> }> {
    const parsed = webBlockGenerateBodySchema.parse(input.body ?? {});
    const aiStatus = await this.getAgencyAiStatus(input.workspaceId);
    const currentWeb = await this.getProjectWeb(input.workspaceId, input.projectId);
    if (!aiStatus.configured) {
      return {
        ...currentWeb,
        aiGeneration: {
          generated: false,
          mode: 'ai_not_configured',
          blockKey: parsed.blockKey,
          aiConfigured: false,
          message: 'AI non configurata. Usa la bozza base oppure configura un provider AI lato server.',
        },
      };
    }

    try {
      const [project, sources, discovery] = await Promise.all([
        this.getProject(input.workspaceId, input.projectId),
        this.getProjectSources(input.workspaceId, input.projectId),
        this.getProjectDiscovery(input.workspaceId, input.projectId),
      ]);
      const webProject = currentWeb.output.webProjects.find((entry) => entry.id === input.webProjectId) || currentWeb.output.webProjects[0] || null;
      const aiUserPayload = {
        task: 'generateWebBlock',
        blockKey: parsed.blockKey,
        webProject,
        currentOutput: compactAgencyAiValue({
          pageGoal: currentWeb.output.pageGoal,
          pageType: currentWeb.output.pageType,
          targetSummary: currentWeb.output.targetSummary,
          offerSummary: currentWeb.output.offerSummary,
          copyBlocks: currentWeb.output.copyBlocks,
          ctaSet: currentWeb.output.ctaSet,
          trustElements: currentWeb.output.trustElements,
          faqItems: currentWeb.output.faqItems,
          wireframe: currentWeb.output.wireframe,
          sectionPlan: currentWeb.output.sectionPlan,
        }),
        project: buildAgencyAiProjectSnapshot(project),
        sources: buildAgencyAiSourceSnapshot(sources),
        discovery: buildAgencyAiDiscoverySnapshot(discovery.sections, discovery.notes),
        requiredOutput: {
          headline: 'string for hero',
          subheadline: 'string for hero',
          intro: 'string for hero',
          benefits: ['string'],
          faqItems: ['string'],
          ctaSet: { primary: 'string', secondary: 'string', final: 'string' },
          trustElements: ['string'],
          wireframe: { mode: 'text', blocks: ['string'] },
          sectionPlan: [{ key: 'string', title: 'string', objective: 'string' }],
          assumptions: ['string'],
          missingInputs: ['string'],
          confidence: 'low|medium|high',
        },
      };
      const inputHash = buildAgencyAiInputHash(aiUserPayload);
      const aiCache = isRecord(currentWeb.output.aiCache) ? currentWeb.output.aiCache : {};
      const cacheKey = `webProject:${input.webProjectId}:block:${parsed.blockKey}`;
      const cachedGeneration = isRecord(aiCache[cacheKey]) ? aiCache[cacheKey] as Record<string, unknown> : null;
      const cachedPayload = cachedGeneration?.inputHash === inputHash && isRecord(cachedGeneration.payload)
        ? cachedGeneration.payload
        : null;
      const aiResult = cachedPayload
        ? {
          payload: cachedPayload,
          meta: {
            functionName: 'web.generateBlock',
            model: aiStatus.model,
            inputHash,
            estimatedInputTokens: 0,
            estimatedOutputTokens: 0,
            durationMs: 0,
            cacheHit: true,
            status: 'cache_hit' as const,
          },
        }
        : await runAgencyOpenAiJsonWithMeta({
          workspaceId: input.workspaceId,
          functionName: 'web.generateBlock',
          projectId: input.projectId,
          lockKey: `${input.workspaceId}:${input.projectId}:web.generateBlock:${input.webProjectId}:${parsed.blockKey}:${inputHash}`,
          system: [
            'Sei un conversion copywriter per landing page.',
            'Rigenera un solo blocco Web usando esclusivamente fonti, brief e output corrente.',
            'Non inventare prove sociali o dati non presenti. Restituisci JSON compatibile con il blocco richiesto.',
          ].join(' '),
          user: aiUserPayload,
          jsonSchema: WEB_BLOCK_AI_JSON_SCHEMAS[parsed.blockKey],
        });
      const source = aiResult?.payload || {};
      const nextRawOutput: Record<string, unknown> = {
        ...currentWeb.output,
        lastGeneratedAt: new Date().toISOString(),
        aiCache: {
          ...aiCache,
          [cacheKey]: {
            inputHash,
            payload: source,
            updatedAt: new Date().toISOString(),
            model: aiResult?.meta.model || aiStatus.model,
          },
        },
        aiHistory: appendAgencyAiHistory(currentWeb.output.aiHistory, {
          module: 'web',
          function: 'generateBlock',
          blockKey: parsed.blockKey,
          webProjectId: input.webProjectId,
          inputHash,
          cacheHit: Boolean(aiResult?.meta.cacheHit),
          model: aiResult?.meta.model || aiStatus.model,
          estimatedInputTokens: aiResult?.meta.estimatedInputTokens || 0,
          estimatedOutputTokens: aiResult?.meta.estimatedOutputTokens || 0,
          estimatedCostUsd: aiResult?.meta.estimatedCostUsd || 0,
          durationMs: aiResult?.meta.durationMs || 0,
          status: aiResult?.meta.status || 'success',
          generatedAt: new Date().toISOString(),
        }),
      };

      if (parsed.blockKey === 'hero') {
        nextRawOutput.copyBlocks = {
          ...currentWeb.output.copyBlocks,
          headline: sanitizeWebText(source.headline, currentWeb.output.copyBlocks.headline),
          subheadline: sanitizeWebText(source.subheadline, currentWeb.output.copyBlocks.subheadline),
          intro: sanitizeWebText(source.intro, currentWeb.output.copyBlocks.intro),
        };
      } else if (parsed.blockKey === 'benefits') {
        nextRawOutput.copyBlocks = {
          ...currentWeb.output.copyBlocks,
          benefits: normalizeWebStringList(source.benefits, 8),
        };
      } else if (parsed.blockKey === 'faq') {
        nextRawOutput.faqItems = normalizeWebStringList(source.faqItems, 8);
      } else if (parsed.blockKey === 'cta') {
        nextRawOutput.ctaSet = {
          ...currentWeb.output.ctaSet,
          ...(isRecord(source.ctaSet) ? source.ctaSet : {}),
        };
      } else if (parsed.blockKey === 'trust') {
        nextRawOutput.trustElements = normalizeWebStringList(source.trustElements, 8);
      } else if (parsed.blockKey === 'wireframe') {
        nextRawOutput.wireframe = isRecord(source.wireframe)
          ? source.wireframe
          : currentWeb.output.wireframe;
      } else if (parsed.blockKey === 'section_plan') {
        nextRawOutput.sectionPlan = Array.isArray(source.sectionPlan) ? source.sectionPlan : currentWeb.output.sectionPlan;
      }

      const output = normalizeWebOutputFromJson(nextRawOutput as Prisma.JsonValue, input.projectId, currentWeb.input);
      const memoryRecord = await agencyRepository.upsertProjectMemoryWeb({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        webJson: output as unknown as Prisma.InputJsonValue,
      });

      return {
        projectId: input.projectId,
        input: currentWeb.input,
        output,
        persisted: Boolean(memoryRecord),
        lastUpdatedAt: memoryRecord?.updatedAt ? memoryRecord.updatedAt.toISOString() : null,
        aiGeneration: {
          generated: true,
          mode: 'ai_with_sources',
          blockKey: parsed.blockKey,
          provider: aiStatus.provider,
          model: aiStatus.model,
          cacheHit: Boolean(aiResult?.meta.cacheHit),
          inputHash,
          estimatedInputTokens: aiResult?.meta.estimatedInputTokens || 0,
          estimatedOutputTokens: aiResult?.meta.estimatedOutputTokens || 0,
          estimatedCostUsd: aiResult?.meta.estimatedCostUsd || 0,
          durationMs: aiResult?.meta.durationMs || 0,
        },
      };
    } catch (error) {
      return {
        ...currentWeb,
        aiGeneration: {
          generated: false,
          mode: 'ai_failed_fallback_available',
          blockKey: parsed.blockKey,
          aiConfigured: true,
          provider: aiStatus.provider,
          model: aiStatus.model,
          message: error instanceof Error ? error.message : 'AI block generation failed',
        },
      };
    }
  },

  async buildProjectAdsInput(workspaceId: string, projectId: string): Promise<AgencyAdsInputPayload> {
    const project = await agencyRepository.findProjectLite(workspaceId, projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    const [seed, discovery, memoryWeb] = await Promise.all([
      getProjectSeed(workspaceId, projectId),
      this.getProjectDiscovery(workspaceId, projectId),
      agencyRepository.findProjectMemoryWeb(workspaceId, projectId),
    ]);
    const webInput = buildWebInputContract({
      projectId,
      seed,
      discovery,
    });
    const webOutput = normalizeWebOutputFromJson(memoryWeb?.webJson as Prisma.JsonValue | null, projectId, webInput);

    return buildAdsInputContract({
      projectId,
      seed,
      discovery,
      web: memoryWeb?.webJson ? webOutput : null,
    });
  },

  async buildProjectOpportunityInput(workspaceId: string, projectId: string): Promise<AgencyOpportunityInput> {
    const project = await agencyRepository.findProjectLite(workspaceId, projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    const [seed, discovery, memoryWeb, memoryAds, alertRecords, taskRecords] = await Promise.all([
      getProjectSeed(workspaceId, projectId),
      this.getProjectDiscovery(workspaceId, projectId),
      agencyRepository.findProjectMemoryWeb(workspaceId, projectId),
      agencyRepository.findProjectMemoryAds(workspaceId, projectId),
      agencyRepository.listProjectAlerts(workspaceId, projectId),
      agencyRepository.listProjectTasks(workspaceId, projectId),
    ]);

    const webInput = buildWebInputContract({
      projectId,
      seed,
      discovery,
    });
    const webOutput = normalizeWebOutputFromJson(memoryWeb?.webJson as Prisma.JsonValue | null, projectId, webInput);
    const adsInput = buildAdsInputContract({
      projectId,
      seed,
      discovery,
      web: memoryWeb?.webJson ? webOutput : null,
    });
    const adsOutput = normalizeAdsOutputFromJson(memoryAds?.adsJson as Prisma.JsonValue | null, projectId, adsInput);
    const contextSummary = seed?.contextSummary?.trim() || discovery.contextSummary;
    const hasPersistedWebOutput = Boolean(memoryWeb?.webJson);
    const hasPersistedAdsOutput = Boolean(memoryAds?.adsJson);

    return {
      projectId,
      workspaceId,
      projectType: seed?.projectType
        ? {
            key: seed.projectType.key,
            label: seed.projectType.label,
          }
        : null,
      scopePurchased: seed?.scopePurchased ?? [],
      activeModules: seed?.activeModules ?? [],
      discovery: {
        sections: discovery.sections,
        notes: discovery.notes,
        brief: discovery.brief,
        contextSummary: discovery.contextSummary,
        lastUpdatedAt: discovery.lastUpdatedAt,
      },
      contextSummary,
      web: {
        available: hasPersistedWebOutput,
        pageGoal: webOutput.pageGoal,
        pageType: webOutput.pageType,
        targetSummary: webOutput.targetSummary,
        offerSummary: webOutput.offerSummary,
        valueProp: webOutput.valueProp,
        ctaPrimary: webOutput.ctaSet.primary,
        trustElements: webOutput.trustElements,
        sectionPlanCount: webOutput.sectionPlan.length,
        previewAvailable: webOutput.previewHtmlBase.trim().length > 0,
        lastGeneratedAt: webOutput.lastGeneratedAt,
      },
      ads: {
        available: hasPersistedAdsOutput,
        channelScope: hasPersistedAdsOutput ? adsOutput.channelScope : 'none',
        offerAngle: hasPersistedAdsOutput ? adsOutput.offerAngle : '',
        google: {
          keywordSeedsCount: hasPersistedAdsOutput ? adsOutput.googleAds.keywordSeeds.length : 0,
          landingRecommendation: hasPersistedAdsOutput ? adsOutput.googleAds.landingRecommendation : '',
        },
        meta: {
          creativeAnglesCount: hasPersistedAdsOutput ? adsOutput.metaAds.creativeAngles.length : 0,
          assetRequestsCount: hasPersistedAdsOutput ? adsOutput.metaAds.assetRequests.length : 0,
          primaryTextsCount: hasPersistedAdsOutput ? adsOutput.metaAds.primaryTexts.length : 0,
        },
        lastGeneratedAt: hasPersistedAdsOutput ? adsOutput.lastGeneratedAt : null,
      },
      alerts: alertRecords
        ? alertRecords.map((entry) => ({
            title: entry.title,
            severity: entry.severity.toLowerCase(),
            status: entry.status.toLowerCase(),
            origin: entry.source?.trim() || 'persisted',
          }))
        : (seed?.alerts ?? []).map((entry) => ({
            title: entry.title,
            severity: entry.severity,
            status: entry.status,
            origin: 'seed',
          })),
      tasks: taskRecords
        ? taskRecords.map((entry) => ({
            title: entry.title,
            teamRole: entry.teamRole,
            priority: entry.priority.toLowerCase(),
            status: entry.status.toLowerCase(),
            sourceType: entry.sourceType,
          }))
        : [],
      dataCompleteness: {
        hasProjectType: Boolean(seed?.projectType?.key),
        hasDiscovery: discovery.persisted,
        hasOffer: discovery.sections.offer.trim().length > 0,
        hasTarget: discovery.sections.target.trim().length > 0,
        hasContextSummary: contextSummary.trim().length > 0,
        hasWebOutput: hasPersistedWebOutput,
        hasAdsOutput: hasPersistedAdsOutput,
        hasAlerts: Array.isArray(alertRecords) && alertRecords.length > 0,
        hasTasks: Array.isArray(taskRecords) && taskRecords.length > 0,
      },
    };
  },

  async evaluateProjectOpportunities(workspaceId: string, projectId: string) {
    const input = await this.buildProjectOpportunityInput(workspaceId, projectId);
    return evaluateAgencyOpportunities(input);
  },

  async getProjectAds(workspaceId: string, projectId: string): Promise<AgencyAdsPayload> {
    const project = await agencyRepository.findProjectLite(workspaceId, projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    const [adsInput, memoryAds] = await Promise.all([
      this.buildProjectAdsInput(workspaceId, projectId),
      agencyRepository.findProjectMemoryAds(workspaceId, projectId),
    ]);
    const output = normalizeAdsOutputFromJson(memoryAds?.adsJson as Prisma.JsonValue | null, projectId, adsInput);

    return {
      projectId,
      input: adsInput,
      output,
      persisted: Boolean(memoryAds?.adsJson),
      lastUpdatedAt: memoryAds?.updatedAt ? memoryAds.updatedAt.toISOString() : null,
    };
  },

    async saveProjectAds(input: {
      workspaceId: string;
      projectId: string;
      body: unknown;
  }): Promise<AgencyAdsPayload> {
    const project = await agencyRepository.findProjectLite(input.workspaceId, input.projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    const adsInput = await this.buildProjectAdsInput(input.workspaceId, input.projectId);
    const output = resolveAdsOutputFromBody(input.body, input.projectId, adsInput);
    const memoryRecord = await agencyRepository.upsertProjectMemoryAds({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      adsJson: output as unknown as Prisma.InputJsonValue,
    });

    if (!memoryRecord) {
      logAgencyServiceEvent('Ads persistence unavailable. Returning non-persisted payload.', {
        projectId: input.projectId,
      });
    } else {
      try {
        await Promise.all([
          this.syncProjectAlerts(input.workspaceId, input.projectId),
          this.syncProjectOpportunities(input.workspaceId, input.projectId),
        ]);
      } catch (_error) {
        logAgencyServiceEvent('Ads save completed but alerts/opportunities sync failed.', {
          projectId: input.projectId,
        });
      }
    }

      return {
        projectId: input.projectId,
        input: adsInput,
        output,
        persisted: Boolean(memoryRecord),
        lastUpdatedAt: memoryRecord?.updatedAt ? memoryRecord.updatedAt.toISOString() : null,
      };
    },

    async generateProjectAdsAssetWithAi(input: {
      workspaceId: string;
      projectId: string;
      body: unknown;
    }): Promise<AgencyAdsPayload & { aiGeneration: Record<string, unknown> }> {
      const parsed = adsAssetGenerateBodySchema.parse(input.body ?? {});
      const aiStatus = await this.getAgencyAiStatus(input.workspaceId);
      const currentAds = await this.getProjectAds(input.workspaceId, input.projectId);
      if (!aiStatus.configured) {
        return {
          ...currentAds,
          aiGeneration: {
            generated: false,
            mode: 'ai_not_configured',
            assetKey: parsed.assetKey,
            aiConfigured: false,
            message: 'AI non configurata. Usa la bozza base oppure configura un provider AI lato server.',
          },
        };
      }

      try {
        const [project, sources, discovery] = await Promise.all([
          this.getProject(input.workspaceId, input.projectId),
          this.getProjectSources(input.workspaceId, input.projectId),
          this.getProjectDiscovery(input.workspaceId, input.projectId),
        ]);
        const aiUserPayload = {
          task: 'generateAdsAsset',
          assetKey: parsed.assetKey,
          currentAds: compactAgencyAiValue({
            channelScope: currentAds.output.channelScope,
            campaignGoal: currentAds.output.campaignGoal,
            targetingSummary: currentAds.output.targetingSummary,
            offerAngle: currentAds.output.offerAngle,
            googleAds: currentAds.output.googleAds,
            metaAds: currentAds.output.metaAds,
            adsProjects: currentAds.output.adsProjects,
          }),
          project: buildAgencyAiProjectSnapshot(project),
          sources: buildAgencyAiSourceSnapshot(sources),
          discovery: buildAgencyAiDiscoverySnapshot(discovery.sections, discovery.notes),
          web: compactAgencyAiValue(currentAds.input.web),
          requiredOutput: {
            headlines: ['string'],
            descriptions: ['string'],
            primaryTexts: ['string'],
            keywordSeeds: ['string'],
            creativeAngles: ['string'],
            campaignAngle: 'string',
            offerAngle: 'string',
            extensionsIdeas: ['string'],
            assumptions: ['string'],
            missingInputs: ['string'],
            confidence: 'low|medium|high',
          },
        };
        const inputHash = buildAgencyAiInputHash(aiUserPayload);
        const aiCache = isRecord(currentAds.output.aiCache) ? currentAds.output.aiCache : {};
        const cacheKey = `adsAsset:${parsed.assetKey}`;
        const cachedGeneration = isRecord(aiCache[cacheKey]) ? aiCache[cacheKey] as Record<string, unknown> : null;
        const cachedPayload = cachedGeneration?.inputHash === inputHash && isRecord(cachedGeneration.payload)
          ? cachedGeneration.payload
          : null;
        const aiResult = cachedPayload
          ? {
            payload: cachedPayload,
            meta: {
              functionName: 'ads.generateAsset',
              model: aiStatus.model,
              inputHash,
              estimatedInputTokens: 0,
              estimatedOutputTokens: 0,
              durationMs: 0,
              cacheHit: true,
              status: 'cache_hit' as const,
            },
          }
          : await runAgencyOpenAiJsonWithMeta({
            workspaceId: input.workspaceId,
            functionName: 'ads.generateAsset',
            projectId: input.projectId,
            lockKey: `${input.workspaceId}:${input.projectId}:ads.generateAsset:${parsed.assetKey}:${inputHash}`,
            system: [
              'Sei un ads strategist per Google Ads e Meta Ads.',
              'Rigenera un singolo asset Ads usando solo fonti progetto, Discovery, Web e campagne correnti.',
              'Non inventare dati di mercato o promesse non presenti. Restituisci solo JSON valido.',
            ].join(' '),
            user: aiUserPayload,
            jsonSchema: ADS_ASSET_AI_JSON_SCHEMAS[parsed.assetKey],
          });
        const source = aiResult?.payload || {};
        const googleAds = { ...currentAds.output.googleAds };
        const metaAds = { ...currentAds.output.metaAds };
        const nextRawOutput: Record<string, unknown> = {
          ...currentAds.output,
          lastGeneratedAt: new Date().toISOString(),
          aiCache: {
            ...aiCache,
            [cacheKey]: {
              inputHash,
              payload: source,
              updatedAt: new Date().toISOString(),
              model: aiResult?.meta.model || aiStatus.model,
            },
          },
          aiHistory: appendAgencyAiHistory(currentAds.output.aiHistory, {
            module: 'ads',
            function: 'generateAsset',
            assetKey: parsed.assetKey,
            inputHash,
            cacheHit: Boolean(aiResult?.meta.cacheHit),
            model: aiResult?.meta.model || aiStatus.model,
            estimatedInputTokens: aiResult?.meta.estimatedInputTokens || 0,
            estimatedOutputTokens: aiResult?.meta.estimatedOutputTokens || 0,
            estimatedCostUsd: aiResult?.meta.estimatedCostUsd || 0,
            durationMs: aiResult?.meta.durationMs || 0,
            status: aiResult?.meta.status || 'success',
            generatedAt: new Date().toISOString(),
          }),
        };

        if (parsed.assetKey === 'headlines') {
          const headlines = normalizeWebStringList(source.headlines, 12);
          metaAds.headlines = headlines.slice(0, 8);
          googleAds.rsaIdeas = [{
            headlines,
            descriptions: normalizeWebStringList(source.descriptions, 4),
          }];
        } else if (parsed.assetKey === 'primary_texts') {
          metaAds.primaryTexts = normalizeWebStringList(source.primaryTexts, 8);
        } else if (parsed.assetKey === 'keywords') {
          googleAds.keywordSeeds = normalizeWebStringList(source.keywordSeeds, 24);
        } else if (parsed.assetKey === 'creative_angles') {
          metaAds.creativeAngles = normalizeWebStringList(source.creativeAngles, 12);
        } else if (parsed.assetKey === 'angle') {
          nextRawOutput.offerAngle = sanitizeWebText(source.offerAngle, currentAds.output.offerAngle);
          metaAds.campaignAngle = sanitizeWebText(source.campaignAngle, currentAds.output.metaAds.campaignAngle);
        } else if (parsed.assetKey === 'sitelinks') {
          googleAds.extensionsIdeas = normalizeWebStringList(source.extensionsIdeas, 12);
        }
        nextRawOutput.googleAds = googleAds;
        nextRawOutput.metaAds = metaAds;

        const output = normalizeAdsOutputFromJson(nextRawOutput as Prisma.JsonValue, input.projectId, currentAds.input);
        const memoryRecord = await agencyRepository.upsertProjectMemoryAds({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          adsJson: output as unknown as Prisma.InputJsonValue,
        });

        return {
          projectId: input.projectId,
          input: currentAds.input,
          output,
          persisted: Boolean(memoryRecord),
          lastUpdatedAt: memoryRecord?.updatedAt ? memoryRecord.updatedAt.toISOString() : null,
          aiGeneration: {
            generated: true,
            mode: 'ai_with_sources',
            assetKey: parsed.assetKey,
            provider: aiStatus.provider,
            model: aiStatus.model,
            cacheHit: Boolean(aiResult?.meta.cacheHit),
            inputHash,
            estimatedInputTokens: aiResult?.meta.estimatedInputTokens || 0,
            estimatedOutputTokens: aiResult?.meta.estimatedOutputTokens || 0,
            estimatedCostUsd: aiResult?.meta.estimatedCostUsd || 0,
            durationMs: aiResult?.meta.durationMs || 0,
          },
        };
      } catch (error) {
        return {
          ...currentAds,
          aiGeneration: {
            generated: false,
            mode: 'ai_failed_fallback_available',
            assetKey: parsed.assetKey,
            aiConfigured: true,
            provider: aiStatus.provider,
            model: aiStatus.model,
            message: error instanceof Error ? error.message : 'AI ads asset generation failed',
          },
        };
      }
    },

    async buildProjectReportInput(workspaceId: string, projectId: string): Promise<AgencyReportInputPayload> {
      const projectSnapshot = await agencyRepository.findProjectSnapshot(workspaceId, projectId);
      if (!projectSnapshot) {
        throw notFound('Project not found');
      }

      const [seed, discovery, web, ads, alerts, opportunities, tasks] = await Promise.all([
        getProjectSeed(workspaceId, projectId),
        this.getProjectDiscovery(workspaceId, projectId),
        this.getProjectWeb(workspaceId, projectId),
        this.getProjectAds(workspaceId, projectId),
        this.getProjectAlerts(workspaceId, projectId),
        this.getProjectOpportunities(workspaceId, projectId),
        this.getProjectTasks(workspaceId, projectId),
      ]);

      return {
        projectId,
        workspaceId,
        projectName: projectSnapshot.name,
        projectStatus: projectSnapshot.statusAgency?.toLowerCase() || null,
        projectPriority: projectSnapshot.priorityAgency?.toLowerCase() || null,
        projectType: seed?.projectType
          ? {
              key: seed.projectType.key,
              label: seed.projectType.label,
            }
          : null,
        scopePurchased: seed?.scopePurchased ?? [],
        activeModules: seed?.activeModules ?? [],
        discovery: {
          sections: discovery.sections,
          notes: discovery.notes,
          brief: discovery.brief,
          contextSummary: discovery.contextSummary,
          persisted: discovery.persisted,
          lastUpdatedAt: discovery.lastUpdatedAt,
        },
        contextSummary: seed?.contextSummary?.trim() || discovery.contextSummary,
        web: {
          available: Boolean(web.persisted || web.output.lastGeneratedAt || web.output.sectionPlan.length > 0),
          persisted: web.persisted,
          pageGoal: web.output.pageGoal,
          pageType: web.output.pageType,
          targetSummary: web.output.targetSummary,
          offerSummary: web.output.offerSummary,
          valueProp: web.output.valueProp,
          ctaPrimary: web.output.ctaSet.primary,
          trustElements: web.output.trustElements,
          sectionPlanCount: web.output.sectionPlan.length,
          previewAvailable: web.output.previewHtmlBase.trim().length > 0,
          lastGeneratedAt: web.output.lastGeneratedAt,
        },
        ads: {
          available: Boolean(
            ads.persisted
            || ads.output.lastGeneratedAt
            || ads.output.googleAds.keywordSeeds.length > 0
            || ads.output.metaAds.primaryTexts.length > 0
          ),
          persisted: ads.persisted,
          channelScope: ads.output.channelScope || 'none',
          offerAngle: ads.output.offerAngle,
          google: {
            keywordSeedsCount: ads.output.googleAds.keywordSeeds.length,
            landingRecommendation: ads.output.googleAds.landingRecommendation,
          },
          meta: {
            creativeAnglesCount: ads.output.metaAds.creativeAngles.length,
            assetRequestsCount: ads.output.metaAds.assetRequests.length,
            primaryTextsCount: ads.output.metaAds.primaryTexts.length,
          },
          lastGeneratedAt: ads.output.lastGeneratedAt,
        },
        alerts,
        opportunities,
        tasks,
        dataSourceSummary: {
          dominantSource: 'db',
          hasDiscovery: discovery.persisted || discovery.contextSummary.trim().length > 0,
          hasWeb: Boolean(web.persisted || web.output.lastGeneratedAt || web.output.sectionPlan.length > 0),
          hasAds: Boolean(ads.persisted || ads.output.lastGeneratedAt || ads.output.channelScope !== 'none'),
          hasAlerts: alerts.length > 0,
          hasOpportunities: opportunities.length > 0,
          hasTasks: tasks.length > 0,
        },
      };
    },

    async getProjectReport(workspaceId: string, projectId: string): Promise<AgencyReportPayload> {
      const project = await agencyRepository.findProjectLite(workspaceId, projectId);
      if (!project) {
        throw notFound('Project not found');
      }

      const [input, memoryReport] = await Promise.all([
        this.buildProjectReportInput(workspaceId, projectId),
        agencyRepository.findProjectMemoryReports(workspaceId, projectId),
      ]);

      const generatedOutput = buildAgencyReportSnapshot(input);
      const output = normalizeAgencyReportOutputFromJson(
        memoryReport?.reportsJson as Prisma.JsonValue | null,
        generatedOutput,
      );

      return {
        projectId,
        input,
        output,
        persisted: Boolean(memoryReport?.reportsJson),
        lastUpdatedAt: memoryReport?.updatedAt ? memoryReport.updatedAt.toISOString() : null,
      };
    },

    async saveProjectReport(input: {
      workspaceId: string;
      projectId: string;
      body: unknown;
    }): Promise<AgencyReportPayload> {
      const project = await agencyRepository.findProjectLite(input.workspaceId, input.projectId);
      if (!project) {
        throw notFound('Project not found');
      }

      const [reportInput, memoryReport] = await Promise.all([
        this.buildProjectReportInput(input.workspaceId, input.projectId),
        agencyRepository.findProjectMemoryReports(input.workspaceId, input.projectId),
      ]);
      const generatedOutput = buildAgencyReportSnapshot(reportInput);
      const existingOutput = normalizeAgencyReportOutputFromJson(
        memoryReport?.reportsJson as Prisma.JsonValue | null,
        generatedOutput,
      );
      const sourceBody = isRecord(input.body) && isRecord(input.body.output)
        ? input.body.output
        : input.body;
      const output = normalizeAgencyReportOutputFromJson(
        sourceBody as Prisma.JsonValue | null,
        {
          ...generatedOutput,
          clientReport: existingOutput.clientReport,
        },
      );
      const memoryRecord = await agencyRepository.upsertProjectMemoryReports({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        reportsJson: output as unknown as Prisma.InputJsonValue,
      });

      if (!memoryRecord) {
        logAgencyServiceEvent('Reports persistence unavailable. Returning non-persisted payload.', {
          projectId: input.projectId,
        });
      }

      return {
        projectId: input.projectId,
        input: reportInput,
        output,
        persisted: Boolean(memoryRecord),
        lastUpdatedAt: memoryRecord?.updatedAt ? memoryRecord.updatedAt.toISOString() : null,
      };
    },

    async buildProjectDiagnosisInput(workspaceId: string, projectId: string): Promise<AgencyDiagnosisInputPayload> {
      const projectSnapshot = await agencyRepository.findProjectSnapshot(workspaceId, projectId);
      if (!projectSnapshot) {
        throw notFound('Project not found');
      }

      const [seed, discovery, web, ads, report, alerts, opportunities, tasks] = await Promise.all([
        getProjectSeed(workspaceId, projectId),
        this.getProjectDiscovery(workspaceId, projectId),
        this.getProjectWeb(workspaceId, projectId),
        this.getProjectAds(workspaceId, projectId),
        this.getProjectReport(workspaceId, projectId),
        this.getProjectAlerts(workspaceId, projectId),
        this.getProjectOpportunities(workspaceId, projectId),
        this.getProjectTasks(workspaceId, projectId),
      ]);

      return {
        projectId,
        workspaceId,
        projectName: projectSnapshot.name,
        projectStatus: projectSnapshot.statusAgency?.toLowerCase() || null,
        projectPriority: projectSnapshot.priorityAgency?.toLowerCase() || null,
        projectType: seed?.projectType
          ? {
              key: seed.projectType.key,
              label: seed.projectType.label,
            }
          : null,
        scopePurchased: seed?.scopePurchased ?? [],
        activeModules: seed?.activeModules ?? [],
        contextSummary: seed?.contextSummary?.trim() || discovery.contextSummary || report.output.projectSnapshot.contextSummary,
        discovery: {
          sections: discovery.sections,
          notes: discovery.notes,
          brief: discovery.brief,
          contextSummary: discovery.contextSummary,
          persisted: discovery.persisted,
          lastUpdatedAt: discovery.lastUpdatedAt,
        },
        web: {
          available: Boolean(web.persisted || web.output.lastGeneratedAt || web.output.sectionPlan.length > 0),
          persisted: web.persisted,
          pageGoal: web.output.pageGoal,
          pageType: web.output.pageType,
          targetSummary: web.output.targetSummary,
          offerSummary: web.output.offerSummary,
          valueProp: web.output.valueProp,
          ctaPrimary: web.output.ctaSet.primary,
          trustElements: web.output.trustElements,
          sectionPlanCount: web.output.sectionPlan.length,
          previewAvailable: web.output.previewHtmlBase.trim().length > 0,
          lastGeneratedAt: web.output.lastGeneratedAt,
        },
        ads: {
          available: Boolean(
            ads.persisted
            || ads.output.lastGeneratedAt
            || ads.output.googleAds.keywordSeeds.length > 0
            || ads.output.metaAds.primaryTexts.length > 0
          ),
          persisted: ads.persisted,
          channelScope: ads.output.channelScope || 'none',
          campaignGoal: ads.output.campaignGoal,
          offerAngle: ads.output.offerAngle,
          google: {
            keywordSeedsCount: ads.output.googleAds.keywordSeeds.length,
            landingRecommendation: ads.output.googleAds.landingRecommendation,
          },
          meta: {
            creativeAnglesCount: ads.output.metaAds.creativeAngles.length,
            assetRequestsCount: ads.output.metaAds.assetRequests.length,
            primaryTextsCount: ads.output.metaAds.primaryTexts.length,
          },
          lastGeneratedAt: ads.output.lastGeneratedAt,
        },
        report: {
          available: Boolean(report.persisted || report.output.generatedAt || report.output.updatedAt),
          persisted: report.persisted,
          reportStatus: report.output.reportStatus,
          nextSteps: report.output.nextSteps,
          topAlertsCount: report.output.topAlerts.length,
          topOpportunitiesCount: report.output.topOpportunities.length,
          topTasksCount: report.output.topTasks.length,
          updatedAt: report.lastUpdatedAt || report.output.updatedAt,
        },
        alerts,
        opportunities,
        tasks,
        dataSourceSummary: {
          dominantSource: 'db',
          hasDiscovery: discovery.persisted || discovery.contextSummary.trim().length > 0,
          hasWeb: Boolean(web.persisted || web.output.lastGeneratedAt || web.output.sectionPlan.length > 0),
          hasAds: Boolean(ads.persisted || ads.output.lastGeneratedAt || ads.output.channelScope !== 'none'),
          hasReport: Boolean(report.persisted || report.output.generatedAt || report.output.updatedAt),
          hasAlerts: alerts.length > 0,
          hasOpportunities: opportunities.length > 0,
          hasTasks: tasks.length > 0,
        },
      };
    },

    async getProjectDiagnosis(workspaceId: string, projectId: string): Promise<AgencyDiagnosisPayload> {
      const project = await agencyRepository.findProjectLite(workspaceId, projectId);
      if (!project) {
        throw notFound('Project not found');
      }

      const [input, memoryDiagnosis] = await Promise.all([
        this.buildProjectDiagnosisInput(workspaceId, projectId),
        agencyRepository.findProjectMemoryDiagnosis(workspaceId, projectId),
      ]);

      const generatedOutput = buildAgencyDiagnosisSnapshot(input);
      const output = normalizeAgencyDiagnosisOutputFromJson(
        memoryDiagnosis?.diagnosisJson as Prisma.JsonValue | null,
        generatedOutput,
      );

      return {
        projectId,
        input,
        output,
        persisted: Boolean(memoryDiagnosis?.diagnosisJson),
        lastUpdatedAt: memoryDiagnosis?.updatedAt ? memoryDiagnosis.updatedAt.toISOString() : null,
      };
    },

    async saveProjectDiagnosis(input: {
      workspaceId: string;
      projectId: string;
      body: unknown;
    }): Promise<AgencyDiagnosisPayload> {
      const project = await agencyRepository.findProjectLite(input.workspaceId, input.projectId);
      if (!project) {
        throw notFound('Project not found');
      }

      const diagnosisInput = await this.buildProjectDiagnosisInput(input.workspaceId, input.projectId);
      const generatedOutput = buildAgencyDiagnosisSnapshot(diagnosisInput);
      const sourceBody = isRecord(input.body) && isRecord(input.body.output)
        ? input.body.output
        : input.body;
      const output = normalizeAgencyDiagnosisOutputFromJson(
        sourceBody as Prisma.JsonValue | null,
        generatedOutput,
      );
      const memoryRecord = await agencyRepository.upsertProjectMemoryDiagnosis({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        diagnosisJson: output as unknown as Prisma.InputJsonValue,
      });

      if (!memoryRecord) {
        logAgencyServiceEvent('Diagnosis persistence unavailable. Returning non-persisted payload.', {
          projectId: input.projectId,
        });
      }

      return {
        projectId: input.projectId,
        input: diagnosisInput,
        output,
        persisted: Boolean(memoryRecord),
        lastUpdatedAt: memoryRecord?.updatedAt ? memoryRecord.updatedAt.toISOString() : null,
      };
    },

    async buildProjectClientReportInput(workspaceId: string, projectId: string): Promise<AgencyClientReportInputPayload> {
      const [report, diagnosis] = await Promise.all([
        this.getProjectReport(workspaceId, projectId),
        this.getProjectDiagnosis(workspaceId, projectId),
      ]);

      return {
        projectId,
        workspaceId,
        projectName: report.output.projectSnapshot.projectName || report.input.projectName,
        projectTypeLabel: report.output.projectSnapshot.projectTypeLabel || report.input.projectType?.label || 'Marketing Full',
        projectStatus: report.output.projectSnapshot.projectStatus || report.input.projectStatus || 'draft',
        projectPriority: report.output.projectSnapshot.projectPriority || report.input.projectPriority,
        contextSummary: report.output.projectSnapshot.contextSummary || report.input.contextSummary,
        scopeSummary: report.output.projectSnapshot.scopeSummary || [],
        report: {
          reportStatus: report.output.reportStatus,
          discoverySummary: report.output.discoverySummary,
          webSummary: report.output.webSummary,
          adsSummary: report.output.adsSummary,
          topAlerts: report.output.topAlerts,
          topOpportunities: report.output.topOpportunities,
          topTasks: report.output.topTasks,
          nextSteps: report.output.nextSteps,
          dataSourceSummary: {
            dominantSource: report.output.dataSourceSummary.dominantSource,
          },
        },
        diagnosis: diagnosis
          ? {
              diagnosisStatus: diagnosis.output.diagnosisStatus,
              diagnosisSummary: diagnosis.output.diagnosisSummary,
              criticalFindings: diagnosis.output.criticalFindings.map((entry) => ({
                title: entry.title,
                summary: entry.summary,
                priority: entry.priority,
                category: entry.category,
              })),
              recommendedActions: diagnosis.output.recommendedActions.map((entry) => ({
                title: entry.title,
                summary: entry.summary,
                priority: entry.priority,
                module: entry.module,
              })),
              interventionPriority: diagnosis.output.interventionPriority,
              confidenceLevel: diagnosis.output.confidenceLevel,
            }
          : null,
        web: {
          available: report.input.web.available,
          pageGoal: report.input.web.pageGoal,
          pageType: report.input.web.pageType,
          ctaPrimary: report.input.web.ctaPrimary,
          trustElements: report.input.web.trustElements,
        },
        ads: {
          available: report.input.ads.available,
          channelScope: report.input.ads.channelScope,
          offerAngle: report.input.ads.offerAngle,
        },
      };
    },

    async getProjectClientReport(workspaceId: string, projectId: string): Promise<AgencyClientReportPayload> {
      const project = await agencyRepository.findProjectLite(workspaceId, projectId);
      if (!project) {
        throw notFound('Project not found');
      }

      const [input, memoryReport, report] = await Promise.all([
        this.buildProjectClientReportInput(workspaceId, projectId),
        agencyRepository.findProjectMemoryReports(workspaceId, projectId),
        this.getProjectReport(workspaceId, projectId),
      ]);

      const generatedOutput = buildAgencyClientReportSnapshot(input);
      const persistedClientReportCandidate = isRecord(memoryReport?.reportsJson)
        ? memoryReport.reportsJson.clientReport as Prisma.JsonValue | null
        : null;
      const output = normalizeAgencyClientReportOutputFromJson(
        persistedClientReportCandidate,
        report.output.clientReport?.generatedAt ? report.output.clientReport : generatedOutput,
      );
      const hasPersistedClientReport = isRecord(memoryReport?.reportsJson)
        && Object.prototype.hasOwnProperty.call(memoryReport.reportsJson, 'clientReport');

      return {
        projectId,
        input,
        output,
        persisted: hasPersistedClientReport,
        lastUpdatedAt: memoryReport?.updatedAt ? memoryReport.updatedAt.toISOString() : null,
      };
    },

    async saveProjectClientReport(input: {
      workspaceId: string;
      projectId: string;
      body: unknown;
    }): Promise<AgencyClientReportPayload> {
      const project = await agencyRepository.findProjectLite(input.workspaceId, input.projectId);
      if (!project) {
        throw notFound('Project not found');
      }

      const [clientReportInput, report, memoryReport] = await Promise.all([
        this.buildProjectClientReportInput(input.workspaceId, input.projectId),
        this.getProjectReport(input.workspaceId, input.projectId),
        agencyRepository.findProjectMemoryReports(input.workspaceId, input.projectId),
      ]);
      const generatedOutput = buildAgencyClientReportSnapshot(clientReportInput);
      const sourceBody = isRecord(input.body) && isRecord(input.body.output)
        ? input.body.output
        : input.body;
      const clientOutput = normalizeAgencyClientReportOutputFromJson(
        sourceBody as Prisma.JsonValue | null,
        generatedOutput,
      );
      const baseReportOutput = normalizeAgencyReportOutputFromJson(
        memoryReport?.reportsJson as Prisma.JsonValue | null,
        report.output,
      );
      const mergedReportOutput = {
        ...baseReportOutput,
        clientReport: clientOutput,
      };
      const memoryRecord = await agencyRepository.upsertProjectMemoryReports({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        reportsJson: mergedReportOutput as unknown as Prisma.InputJsonValue,
      });

      if (!memoryRecord) {
        logAgencyServiceEvent('Client report persistence unavailable. Returning non-persisted payload.', {
          projectId: input.projectId,
        });
      }

      return {
        projectId: input.projectId,
        input: clientReportInput,
        output: clientOutput,
        persisted: Boolean(memoryRecord),
        lastUpdatedAt: memoryRecord?.updatedAt ? memoryRecord.updatedAt.toISOString() : null,
      };
    },

  async getWorkspaceReports(workspaceId: string): Promise<AgencyWorkspaceReportItemPayload[] | null> {
      const projects = await agencyRepository.listWorkspaceProjectsLite(workspaceId);
      if (!projects) {
        return null;
      }

      const reports = await Promise.all(
        projects.map(async (project) => {
          const report = await this.getProjectReport(workspaceId, project.id);
          return {
            projectId: project.id,
            projectName: report.output.projectSnapshot.projectName || project.name,
            projectTypeLabel: report.output.projectSnapshot.projectTypeLabel || project.projectType?.label || 'Marketing Full',
            projectStatus: report.output.projectSnapshot.projectStatus || project.statusAgency.toLowerCase(),
            projectPriority: report.output.projectSnapshot.projectPriority || project.priorityAgency.toLowerCase(),
            reportStatus: report.output.reportStatus,
            persisted: report.persisted,
            hasClientReport: Boolean(report.output.clientReport?.generatedAt),
            clientReportUpdatedAt: report.output.clientReport?.updatedAt || null,
            updatedAt: report.lastUpdatedAt || report.output.updatedAt,
            generatedAt: report.output.generatedAt,
            topAlerts: report.output.topAlerts,
            topOpportunities: report.output.topOpportunities,
            topTasks: report.output.topTasks,
            nextSteps: report.output.nextSteps,
            dataSourceSummary: report.output.dataSourceSummary,
          };
        }),
      );

      return reports.sort((left, right) => {
        const updatedRight = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
        const updatedLeft = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
        if (updatedRight !== updatedLeft) {
          return updatedRight - updatedLeft;
        }

        return left.projectName.localeCompare(right.projectName);
      });
    },

    async getProjectSources(workspaceId: string, projectId: string): Promise<AgencyProjectSourcesPayload> {
      const project = await agencyRepository.findProjectLite(workspaceId, projectId);
      if (!project) {
        throw notFound('Project not found');
      }

    const memory = await agencyRepository.findProjectMemorySources(workspaceId, projectId);
      return normalizeProjectSources(extractSourcesJsonFromMemory(memory));
    },

  async saveProjectSources(input: {
    workspaceId: string;
    projectId: string;
    body: unknown;
  }): Promise<AgencyProjectSourcesPayload> {
    const project = await agencyRepository.findProjectLite(input.workspaceId, input.projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    const parsed = projectSourcesBodySchema.safeParse(input.body);
    if (!parsed.success) {
      throw badRequest('Invalid Agency project sources payload', {
        issues: parsed.error.flatten(),
      });
    }

    const sources = buildProjectSourcesFromInput(parsed.data);
    const memoryRecord = await agencyRepository.upsertProjectMemorySources({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      sourcesJson: sources as unknown as Prisma.InputJsonValue,
    });

    if (!memoryRecord) {
      logAgencyServiceEvent('Sources persistence unavailable. Returning normalized non-persisted payload.', {
        projectId: input.projectId,
      });
    }

    return sources;
  },

  async uploadProjectSourceFile(input: {
    workspaceId: string;
    projectId: string;
    originalName: string;
    mimeType: string;
    buffer: Buffer;
  }): Promise<AgencyUploadedFileSource> {
    const project = await agencyRepository.findProjectLite(input.workspaceId, input.projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    if (input.buffer.byteLength <= 0) {
      throw badRequest('File vuoto.');
    }
    if (input.buffer.byteLength > AGENCY_SOURCE_MAX_FILE_SIZE_BYTES) {
      throw badRequest('File troppo grande. Limite massimo 20 MB.');
    }

    const originalName = input.originalName.trim() || 'source-file';
    const extension = path.extname(originalName).toLowerCase();
    if (!AGENCY_SOURCE_ALLOWED_EXTENSIONS.has(extension)) {
      throw badRequest('Estensione file non supportata per le fonti Agency.', {
        allowedExtensions: [...AGENCY_SOURCE_ALLOWED_EXTENSIONS],
      });
    }

    const fileId = createSourceId('file');
    const safeName = `${fileId}-${sanitizeFileName(originalName)}`;
    const uploadDir = path.join(AGENCY_SOURCE_UPLOAD_ROOT, input.workspaceId, input.projectId);
    await mkdir(uploadDir, { recursive: true });

    const absolutePath = path.join(uploadDir, safeName);
    await writeFile(absolutePath, input.buffer);
    const extraction = await extractAgencySourceText({
      buffer: input.buffer,
      extension,
    });

    const storagePath = path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');
    const uploadedAt = new Date().toISOString();
    const fileRecord: AgencyUploadedFileSource = {
      id: fileId,
      name: originalName,
      originalName,
      type: input.mimeType || extension.replace('.', '').toUpperCase(),
      mimeType: input.mimeType || undefined,
      size: input.buffer.byteLength,
      extension,
      storagePath,
      status: extraction.parseStatus === 'parsed' || extraction.parseStatus === 'partial' ? 'parsed' : 'uploaded',
      source: 'manual_upload',
      notes: extraction.parseStatus === 'parsed'
        ? 'File caricato e testo estratto per il Brief.'
        : extraction.parseStatus === 'partial'
          ? 'File caricato e testo estratto parzialmente. Verifica o integra con testo manuale.'
        : extraction.parseStatus === 'unsupported'
          ? 'File caricato. Estrazione testo non supportata per questo formato.'
          : 'File caricato. Estrazione testo non riuscita.',
      uploadedAt,
      parseStatus: extraction.parseStatus,
      extractedTextPreview: extraction.parseStatus === 'parsed' || extraction.parseStatus === 'partial' ? extraction.extractedTextPreview : undefined,
      extractedTextLength: extraction.parseStatus === 'parsed' || extraction.parseStatus === 'partial' ? extraction.extractedTextLength : undefined,
      extractedTextHash: extraction.parseStatus === 'parsed' || extraction.parseStatus === 'partial' ? extraction.extractedTextHash : undefined,
      parsedAt: extraction.parseStatus === 'parsed' || extraction.parseStatus === 'partial' ? extraction.parsedAt : undefined,
      parseErrorCode: extraction.parseErrorCode,
      parseError: extraction.parseStatus !== 'parsed' ? extraction.parseError : undefined,
    };

    const sources = await this.getProjectSources(input.workspaceId, input.projectId);
    const saved = await this.saveProjectSources({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      body: {
        ...sources,
        uploadedFiles: [
          ...sources.uploadedFiles.filter((entry) => entry.id !== fileId),
          fileRecord,
        ],
      },
    });
    const uploadedFile = saved.uploadedFiles.find((entry) => entry.id === fileId);
    if (!uploadedFile) {
      throw internalServerError('Agency source file metadata was not persisted.');
    }

    return uploadedFile;
  },

  async getProjectSourceFile(input: {
    workspaceId: string;
    projectId: string;
    fileId: string;
  }): Promise<{
    file: AgencyUploadedFileSource;
    buffer: Buffer;
    contentType: string;
    disposition: (download: boolean) => string;
  }> {
    const sources = await this.getProjectSources(input.workspaceId, input.projectId);
    const file = sources.uploadedFiles.find((entry) => entry.id === input.fileId);
    if (!file) {
      throw notFound('Source file not found');
    }
    if (!file.storagePath) {
      throw badRequest('Questo materiale non ha un file caricato da aprire.');
    }

    const absolutePath = assertStoragePathInsideUploads(file.storagePath);
    const buffer = await readFile(absolutePath);

    return {
      file,
      buffer,
      contentType: file.mimeType || 'application/octet-stream',
      disposition: (download: boolean) => getFileContentDisposition({ file, download }),
    };
  },

  async deleteProjectSourceFile(input: {
    workspaceId: string;
    projectId: string;
    fileId: string;
  }): Promise<AgencyProjectSourcesPayload> {
    const sources = await this.getProjectSources(input.workspaceId, input.projectId);
    const file = sources.uploadedFiles.find((entry) => entry.id === input.fileId);
    if (!file) {
      throw notFound('Source file not found');
    }

    if (file.storagePath) {
      try {
        await unlink(assertStoragePathInsideUploads(file.storagePath));
      } catch (error) {
        if ((error as { code?: string })?.code !== 'ENOENT') {
          throw error;
        }
      }
    }

    return this.saveProjectSources({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      body: {
        ...sources,
        uploadedFiles: sources.uploadedFiles.filter((entry) => entry.id !== input.fileId),
      },
    });
  },

  async searchProjectCompetitors(input: {
    workspaceId: string;
    projectId: string;
    dryRun?: boolean;
  }) {
    const project = await this.getProject(input.workspaceId, input.projectId);
    const runtimeConfig = await resolveAgencyRuntimeConfig(input.workspaceId);
    const provider = runtimeConfig.competitorSearch.provider;
    const enabled = runtimeConfig.competitorSearch.enabled;
    const hasOpenAiKey = runtimeConfig.ai.apiKeyConfigured;
    const isConfigured = enabled && provider === 'openai_web_search' && hasOpenAiKey;

    if (isConfigured) {
      if (input.dryRun) {
        return {
          provider,
          providerStatus: 'configured',
          realSearch: false,
          suggestions: [],
          queryContext: {
            websiteUrl: project.sources.websiteUrl,
            projectName: project.name,
            projectType: project.projectType?.key ?? null,
            clientName: project.clientName,
            manualNotesAvailable: project.sources.manualNotes.length > 0,
          },
          message: 'Ricerca competitor configurata. Dry-run completato senza chiamare il provider esterno.',
        };
      }

      try {
        return await runAgencyOpenAiCompetitorSearch({
          workspaceId: input.workspaceId,
          project,
          runtimeConfig,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Errore sconosciuto';
      const isTimeout = (error instanceof Error && (
        error.name === 'AbortError' || detail.toLowerCase().includes('aborted')
      ));
      return {
        provider,
        providerStatus: isTimeout ? 'configured_timeout' : 'configured_error',
        realSearch: false,
        suggestions: [],
        queryContext: {
          websiteUrl: project.sources.websiteUrl,
          projectName: project.name,
            projectType: project.projectType?.key ?? null,
          clientName: project.clientName,
          manualNotesAvailable: project.sources.manualNotes.length > 0,
        },
        message: isTimeout
          ? 'La ricerca online ha richiesto troppo tempo ed e stata interrotta. Riprova tra poco o usa un modello piu veloce nelle Impostazioni AI.'
          : `Ricerca online configurata, ma la chiamata al provider non e riuscita. Dettaglio tecnico: ${detail}`,
      };
    }
  }

    return {
      provider,
      providerStatus: 'not_configured',
      realSearch: false,
      suggestions: [],
      queryContext: {
        websiteUrl: project.sources.websiteUrl,
        projectName: project.name,
        projectType: project.projectType?.key ?? null,
        manualNotesAvailable: project.sources.manualNotes.length > 0,
      },
      message: 'Ricerca automatica non ancora configurata. Puoi inserire competitor manualmente o configurare un provider in Impostazioni AI.',
    };
  },

  async getCompetitorSearchSettings(workspaceId?: string) {
    const runtimeConfig = await resolveAgencyRuntimeConfig(workspaceId);
    const provider = runtimeConfig.competitorSearch.provider;
    const enabled = runtimeConfig.competitorSearch.enabled;
    const hasOpenAiKey = runtimeConfig.ai.apiKeyConfigured;
    const hasProviderEnv = enabled && provider === 'openai_web_search' && hasOpenAiKey;

    return {
      status: hasProviderEnv ? 'configured' : 'not_configured',
      provider,
      enabled,
      serverSideOnly: true,
      apiKeyConfigured: hasOpenAiKey,
      apiKeySource: runtimeConfig.ai.apiKeySource,
      storageReady: runtimeConfig.storageReady,
      requiredEnv: [
        'AGENCY_COMPETITOR_SEARCH_ENABLED=true',
        'AGENCY_COMPETITOR_SEARCH_PROVIDER=openai_web_search',
        'OPENAI_API_KEY',
      ],
      message: hasProviderEnv
        ? 'Ricerca competitor configurata lato server. Il sistema puo usare OpenAI web search per suggerire competitor reali.'
        : 'Per cercare competitor online serve un provider configurato lato server. Senza provider puoi inserire competitor manualmente.',
    };
  },

  getAgencyAiStatus(workspaceId?: string) {
    return getAgencyAiStatusPayload(workspaceId);
  },

  // Budget AI giornaliero (V4 — cost control): default del workspace + spesa odierna
  // e limite per ciascun dipendente. Per la config in Impostazioni Agency.
  async getAiBudgets(workspaceId: string) {
    const [members, budgetRows, spentByUser] = await Promise.all([
      teamRepository.listMembers(workspaceId),
      aiBudgetRepository.listByWorkspace(workspaceId),
      aiUsageRepository.sumCostByUserSince(workspaceId, startOfToday()),
    ]);
    const defaultRow = budgetRows.find((row) => row.userId === AI_BUDGET_DEFAULT_USER);
    const overrideByUser = new Map(
      budgetRows
        .filter((row) => row.userId !== AI_BUDGET_DEFAULT_USER)
        .map((row) => [row.userId, row.dailyLimitUsd] as const),
    );
    const defaultDailyLimitUsd = defaultRow?.dailyLimitUsd ?? 0;
    return {
      defaultDailyLimitUsd,
      members: members.map((member) => {
        const override = overrideByUser.get(member.userId);
        return {
          userId: member.userId,
          name: member.name,
          email: member.email,
          status: member.status,
          // null = nessun override personale: vale il default del workspace.
          overrideDailyLimitUsd: override ?? null,
          effectiveDailyLimitUsd: override ?? defaultDailyLimitUsd,
          spentTodayUsd: Number((spentByUser[member.userId] ?? 0).toFixed(6)),
        };
      }),
    };
  },

  // Rendiconto consumi AI del singolo workspace (V4 — cost control): totali,
  // dettaglio per utente e per funzione, ultime chiamate e opzioni per i filtri.
  // È la versione per-workspace del pannello che nella Console piattaforma è
  // cross-workspace: qui il workspace è forzato dalla guardia della rotta, così
  // ogni agenzia vede solo i propri dati. Vive in Impostazioni Agency, accanto al
  // budget (budget = controllo, questo = monitoraggio). Sola lettura di AiUsageLog.
  async getWorkspaceAiUsage(input: {
    workspaceId: string;
    windowDays?: number;
    userId?: string;
    model?: string;
    functionName?: string;
    projectId?: string;
  }) {
    const windowDays = Math.min(Math.max(Math.round(input.windowDays ?? 30), 1), 365);
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const round6 = (value: number | null | undefined) => Number((value ?? 0).toFixed(6));

    // Dati mostrati: rispettano i filtri attivi. Opzioni dei menu: sull'intero
    // periodo del workspace, così cambiare filtro non fa sparire le scelte.
    const dataFilter = {
      since,
      workspaceId: input.workspaceId,
      userId: input.userId,
      model: input.model,
      functionName: input.functionName,
      projectId: input.projectId,
    };
    const periodFilter = { since, workspaceId: input.workspaceId };

    const [
      groupedUser,
      groupedFunction,
      groupedProject,
      totals,
      recent,
      periodUsers,
      periodModels,
      periodFunctions,
      periodProjects,
    ] = await Promise.all([
      aiUsageRepository.aggregateByUser(dataFilter),
      aiUsageRepository.aggregateByFunction(dataFilter),
      aiUsageRepository.aggregateByProject(dataFilter),
      aiUsageRepository.totals(dataFilter),
      aiUsageRepository.recentLogs(dataFilter, 50),
      aiUsageRepository.aggregateByUser(periodFilter),
      aiUsageRepository.distinctModels(periodFilter),
      aiUsageRepository.distinctFunctions(periodFilter),
      aiUsageRepository.aggregateByProject(periodFilter),
    ]);

    // Nomi/email degli utenti coinvolti (dati mostrati + opzioni filtro).
    const userIds = new Set<string>();
    for (const row of groupedUser) if (row.userId) userIds.add(row.userId);
    for (const row of periodUsers) if (row.userId) userIds.add(row.userId);
    const userRows = userIds.size > 0 ? await aiUsageRepository.usersByIds([...userIds]) : [];
    const userById = new Map(userRows.map((user) => [user.id, user]));
    const userLabel = (userId: string | null) => {
      if (!userId) {
        return { name: 'Sistema / non tracciato', email: '' };
      }
      const found = userById.get(userId);
      return { name: found?.name || '—', email: found?.email || '' };
    };

    const perUser = groupedUser
      .map((row) => {
        const label = userLabel(row.userId);
        return {
          userId: row.userId,
          name: label.name,
          email: label.email,
          calls: row._count._all,
          costUsd: round6(row._sum.costUsd),
          inputTokens: row._sum.inputTokens ?? 0,
          outputTokens: row._sum.outputTokens ?? 0,
          lastCallAt: row._max.createdAt,
        };
      })
      .sort((left, right) => right.costUsd - left.costUsd);

    const perFunction = groupedFunction
      .map((row) => ({
        functionName: row.functionName,
        calls: row._count._all,
        costUsd: round6(row._sum.costUsd),
        inputTokens: row._sum.inputTokens ?? 0,
        outputTokens: row._sum.outputTokens ?? 0,
        lastCallAt: row._max.createdAt,
      }))
      .sort((left, right) => right.costUsd - left.costUsd);

    // Nomi dei progetti coinvolti (dati mostrati + opzioni filtro + ultime chiamate).
    // Un progetto cancellato lascia il suo costo storico con projectId nullo (il
    // registro e' contabilita': sopravvive a cio' che descrive).
    const projectIds = new Set<string>();
    for (const row of groupedProject) if (row.projectId) projectIds.add(row.projectId);
    for (const row of periodProjects) if (row.projectId) projectIds.add(row.projectId);
    for (const log of recent) if (log.projectId) projectIds.add(log.projectId);
    const projectRows = projectIds.size > 0 ? await aiUsageRepository.projectsByIds([...projectIds]) : [];
    const projectNameById = new Map(projectRows.map((project) => [project.id, project.name]));
    const projectLabel = (projectId: string | null) => {
      if (!projectId) {
        return 'Senza progetto';
      }
      return projectNameById.get(projectId) || 'Progetto eliminato';
    };

    const perProject = groupedProject
      .map((row) => ({
        projectId: row.projectId,
        name: projectLabel(row.projectId),
        calls: row._count._all,
        costUsd: round6(row._sum.costUsd),
        inputTokens: row._sum.inputTokens ?? 0,
        outputTokens: row._sum.outputTokens ?? 0,
        lastCallAt: row._max.createdAt,
      }))
      .sort((left, right) => right.costUsd - left.costUsd);

    const projectOptions = periodProjects
      .filter((row) => Boolean(row.projectId))
      .map((row) => ({ id: row.projectId as string, name: projectLabel(row.projectId) }))
      .sort((left, right) => left.name.localeCompare(right.name, 'it'));

    const userOptions = periodUsers
      .filter((row) => Boolean(row.userId))
      .map((row) => {
        const label = userLabel(row.userId);
        return { id: row.userId as string, name: label.name, email: label.email };
      })
      .sort((left, right) => left.name.localeCompare(right.name, 'it'));

    return {
      windowDays,
      filters: {
        userId: input.userId ?? null,
        model: input.model ?? null,
        functionName: input.functionName ?? null,
        projectId: input.projectId ?? null,
      },
      totals: {
        calls: totals._count._all,
        costUsd: round6(totals._sum.costUsd),
        inputTokens: totals._sum.inputTokens ?? 0,
        outputTokens: totals._sum.outputTokens ?? 0,
      },
      perUser,
      perFunction,
      perProject,
      recent: recent.map((log) => ({
        id: log.id,
        userId: log.userId,
        userName: userLabel(log.userId).name,
        projectId: log.projectId,
        projectName: log.projectId ? projectLabel(log.projectId) : null,
        // Il registro sa distinguere anche la singola conversazione di chat: qui
        // basta dire SE la chiamata veniva da una chat (il nome della conversazione
        // e' quello del suo ambito, gia' leggibile dalla colonna Progetto/Funzione).
        fromConversation: Boolean(log.conversationId),
        functionName: log.functionName,
        model: log.model,
        costUsd: log.costUsd,
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        durationMs: log.durationMs,
        createdAt: log.createdAt,
      })),
      options: {
        users: userOptions,
        models: periodModels.map((row) => row.model),
        functions: periodFunctions.map((row) => row.functionName),
        projects: projectOptions,
      },
    };
  },

  // Stime di costo per i pulsanti AI (V4 — cost control). Per ogni funzione
  // predefinita restituisce un range in USD col modello attualmente configurato:
  // se ci sono abbastanza usi reali il range viene dai token storici (p25–p75),
  // altrimenti da un token-seed (range indicativo). I token sono stabili a parità
  // di funzione, il prezzo dipende dal modello: così cambiare modello aggiorna la
  // stima senza dover ri-imparare. Sola lettura di AiUsageLog, nessuna scrittura.
  async getWorkspaceAiCostEstimates(workspaceId: string) {
    const status = await getAgencyAiStatusPayload(workspaceId);
    const runtimeConfig = await resolveAgencyRuntimeConfig(workspaceId);

    const estimates = await Promise.all(
      AGENCY_AI_ESTIMATABLE_FUNCTIONS.map(async (fn) => {
        const model = resolveAgencyProviderModel(
          status.provider,
          runtimeConfig.ai.functionModels[fn.functionName] || status.model,
        );
        const samples = await aiUsageRepository.recentSuccessSamples(
          workspaceId,
          fn.functionName,
          AGENCY_AI_ESTIMATE_SAMPLE_LIMIT,
        );

        let minUsd: number;
        let maxUsd: number;
        let basis: 'history' | 'seed';

        if (samples.length >= AGENCY_AI_ESTIMATE_MIN_SAMPLES) {
          // Ricalcola il costo di ogni uso storico col modello CORRENTE (i token
          // restano quelli reali), poi prende la banda centrale p25–p75.
          const costs = samples
            .map((sample) => estimateAgencyAiCostUsd(model, sample.inputTokens, sample.outputTokens))
            .sort((left, right) => left - right);
          minUsd = percentileSorted(costs, 0.25);
          maxUsd = percentileSorted(costs, 0.75);
          basis = 'history';
        } else {
          // Nessuno/pochi usi: range indicativo attorno al token-seed.
          const point = estimateAgencyAiCostUsd(model, fn.seedInputTokens, fn.seedOutputTokens);
          minUsd = Number((point * 0.5).toFixed(6));
          maxUsd = Number((point * 1.5).toFixed(6));
          basis = 'seed';
        }

        return {
          functionName: fn.functionName,
          label: fn.label,
          minUsd,
          maxUsd,
          basis,
          sampleSize: samples.length,
          model,
        };
      }),
    );

    return {
      // Se l'AI non è configurata le generazioni sono rule-based (gratis): il
      // frontend usa questo flag per non mostrare stime fuorvianti.
      aiConfigured: status.configured,
      provider: status.provider,
      estimates,
    };
  },

  // Progetti per il selettore della Chat globale (Fase 2). Applica la visibilita'
  // V2 (owner/assegnazione/reparti; chi ha projects.view_all vede tutto) e marca
  // quelli "assegnati a me" e con Fonti indicizzate, per ordinarli in cima lato UI.
  // La risoluzione del perimetro ricalca projectsService.resolveProjectVisibility
  // usando i repository condivisi, per non accoppiare Agency al modulo projects.
  async listChatProjects(input: { workspaceId: string; userId: string }) {
    const rows = await resolveVisibleChatProjects(input.workspaceId, input.userId);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      clientId: row.clientId,
      clientName: row.clientName,
      assignedToMe: row.assignedToMe,
      hasIndexedSources: row.hasIndexedSources,
      updatedAt: row.updatedAt.toISOString(),
    }));
  },

  // --- Chat AI di progetto (Fase 1). Le rotte storiche restano queste, ma la logica
  // e' una sola: quella "scoped" (Fase 2) con ambito 'project'. Prima erano due copie
  // parallele della stessa cosa, e la Fase 3a l'ha reso evidente (gli allegati
  // esistevano solo nella versione scoped, quindi non funzionavano sul progetto —
  // proprio l'ambito principale). Qui si delega e basta. ---

  getProjectChat(input: { workspaceId: string; projectId: string; userId: string; conversationId?: string | null }) {
    return this.getScopedChat({
      workspaceId: input.workspaceId,
      userId: input.userId,
      target: { scope: 'project', projectId: input.projectId },
      conversationId: input.conversationId,
    });
  },

  clearProjectChat(input: { workspaceId: string; projectId: string; userId: string; conversationId?: string | null }) {
    return this.clearScopedChat({
      workspaceId: input.workspaceId,
      userId: input.userId,
      target: { scope: 'project', projectId: input.projectId },
      conversationId: input.conversationId,
    });
  },

  sendProjectChatMessage(input: {
    workspaceId: string;
    projectId: string;
    userId: string;
    conversationId?: string | null;
    body: unknown;
  }) {
    return this.sendScopedChatMessage({
      workspaceId: input.workspaceId,
      userId: input.userId,
      target: { scope: 'project', projectId: input.projectId },
      conversationId: input.conversationId,
      body: input.body,
    });
  },

  listProjectChatParticipants(input: {
    workspaceId: string;
    projectId: string;
    userId: string;
    conversationId?: string | null;
  }) {
    return this.listScopedChatParticipants({
      workspaceId: input.workspaceId,
      userId: input.userId,
      target: { scope: 'project', projectId: input.projectId },
      conversationId: input.conversationId,
    });
  },

  addProjectChatParticipant(input: {
    workspaceId: string;
    projectId: string;
    userId: string;
    conversationId?: string | null;
    body: unknown;
  }) {
    return this.addScopedChatParticipant({
      workspaceId: input.workspaceId,
      userId: input.userId,
      target: { scope: 'project', projectId: input.projectId },
      conversationId: input.conversationId,
      body: input.body,
    });
  },

  removeProjectChatParticipant(input: {
    workspaceId: string;
    projectId: string;
    userId: string;
    conversationId?: string | null;
    targetUserId: string;
  }) {
    return this.removeScopedChatParticipant({
      workspaceId: input.workspaceId,
      userId: input.userId,
      target: { scope: 'project', projectId: input.projectId },
      conversationId: input.conversationId,
      targetUserId: input.targetUserId,
    });
  },

  // --- Chat AI scoped (Fase 2): la logica della chat per un ambito qualsiasi
  // (progetto/cliente/generale). E' l'unica implementazione: anche le rotte di
  // progetto (Fase 1) passano di qui. ---

  // Verifica che il bersaglio dell'ambito esista (progetto/cliente); 404 altrimenti.
  async assertScopeTargetExists(workspaceId: string, target: ChatScopeTarget) {
    if (target.scope === 'project') {
      const project = await agencyRepository.findAgencyProject(workspaceId, target.projectId);
      if (!project) {
        throw notFound('Project not found');
      }
    } else if (target.scope === 'client') {
      const client = await agencyRepository.findAgencyClient(workspaceId, target.clientId);
      if (!client) {
        throw notFound('Client not found');
      }
    }
  },

  // Elenco delle sessioni dell'utente su un ambito (la "lista chat" della UI).
  async listScopedChatSessions(input: { workspaceId: string; userId: string; target: ChatScopeTarget }) {
    await this.assertScopeTargetExists(input.workspaceId, input.target);
    await assertScopeVisible(input.workspaceId, input.userId, input.target);
    const rows = await aiConversationRepository.listUserSessions(input.workspaceId, input.userId, input.target);
    return { scope: input.target.scope, sessions: rows.map(mapConversationSession) };
  },

  // Apre una sessione nuova sull'ambito, anche se l'utente ne ha gia' altre.
  async createScopedChatSession(input: { workspaceId: string; userId: string; target: ChatScopeTarget }) {
    await this.assertScopeTargetExists(input.workspaceId, input.target);
    await assertScopeVisible(input.workspaceId, input.userId, input.target);
    const conversation = await aiConversationRepository.createSession({
      workspaceId: input.workspaceId,
      target: input.target,
      creatorUserId: input.userId,
    });
    return { conversationId: conversation.id };
  },

  async renameScopedChatSession(input: {
    workspaceId: string;
    userId: string;
    target: ChatScopeTarget;
    conversationId: string;
    title: string;
  }) {
    const title = input.title.trim().slice(0, 200);
    if (!title) {
      throw badRequest('Il titolo non puo essere vuoto.');
    }
    const { participant } = await resolveScopedSession({ ...input, conversationId: input.conversationId });
    if (participant?.frozenAt) {
      throw forbidden('Questa conversazione e archiviata: non si puo rinominare.');
    }
    await aiConversationRepository.setSessionTitle(input.conversationId, title);
    return { conversationId: input.conversationId, title };
  },

  async getScopedChat(input: {
    workspaceId: string;
    userId: string;
    target: ChatScopeTarget;
    conversationId?: string | null;
  }) {
    await this.assertScopeTargetExists(input.workspaceId, input.target);
    await assertScopeVisible(input.workspaceId, input.userId, input.target);
    const { conversation, participant } = await resolveScopedSession(input);
    const [participants, status] = await Promise.all([
      aiConversationRepository.listParticipants(conversation!.id),
      getAgencyAiStatusPayload(input.workspaceId),
    ]);
    // Il congelato (uscito/rimosso/sciolto) vede la sessione in sola lettura, e solo
    // fino al momento in cui ne e' uscito.
    const isFrozen = Boolean(participant?.frozenAt);
    const messages = participant
      ? (await aiConversationRepository.listMessages(conversation!.id, 200, participant.frozenAt)).map(
          mapConversationMessage,
        )
      : [];
    return {
      aiConfigured: status.configured,
      scope: input.target.scope,
      conversationId: conversation!.id,
      title: conversation!.title,
      // Modello scelto per la sessione (selettore per-sessione): la UI ci semina la
      // scelta iniziale del selettore, cosi' e' condivisa tra i partecipanti. Null =
      // usa il default di workspace.
      model: conversation!.model,
      isParticipant: Boolean(participant) && !isFrozen,
      isFrozen,
      frozenAt: participant?.frozenAt ?? null,
      canManage: participant?.role === 'owner' && !isFrozen,
      // Da solo (un solo partecipante attivo) l'AI risponde a ogni messaggio: la UI
      // lo usa per mostrare un solo tasto "Invia" e l'indicatore di attesa (spec sez. 2).
      isSolo: participants.length <= 1,
      participants: participants.map(mapConversationParticipant),
      messages,
    };
  },

  async clearScopedChat(input: {
    workspaceId: string;
    userId: string;
    target: ChatScopeTarget;
    conversationId?: string | null;
  }) {
    // Niente get-or-create qui: prima una DELETE su una chat mai aperta la CREAVA
    // col chiamante come owner, e solo dopo passava il controllo.
    const { conversation, participant } = await resolveScopedSession({ ...input, createIfMissing: false });
    if (!conversation) {
      throw notFound('Conversazione non trovata.');
    }
    if (!participant || participant.frozenAt || participant.role !== 'owner') {
      throw forbidden('Solo il proprietario della conversazione puo azzerarla.');
    }
    await aiConversationRepository.clearMessages(conversation.id);
    return { messages: [] as ReturnType<typeof mapConversationMessage>[] };
  },

  // --- Allegati (Fase 3a). Ciclo di vita: si caricano come BOZZE sulla conversazione
  // dell'ambito (visibili solo a chi le carica), poi l'invio del messaggio le lega e
  // le rende parte della conversazione per tutti i partecipanti. ---

  // Sessione dell'ambito, con i controlli comuni a ogni SCRITTURA: il bersaglio
  // esiste, l'ambito e' visibile all'utente, e l'utente vi partecipa da ATTIVO.
  // Un congelato passa il controllo di partecipazione ma non deve poter scrivere:
  // la sua e' sola lettura.
  async resolveConversationForUser(input: {
    workspaceId: string;
    userId: string;
    target: ChatScopeTarget;
    conversationId?: string | null;
  }) {
    await this.assertScopeTargetExists(input.workspaceId, input.target);
    await assertScopeVisible(input.workspaceId, input.userId, input.target);
    const { conversation, participant } = await resolveScopedSession(input);
    if (!participant) {
      throw forbidden('Non fai parte di questa conversazione. Chiedi a un partecipante di invitarti.');
    }
    if (participant.frozenAt) {
      throw forbidden('Questa conversazione e archiviata: puoi solo consultarla. Riprendila in una nuova chat.');
    }
    return conversation!;
  },

  // Come resolveConversationForUser ma ammette il MODERATORE (chat.moderate) che non
  // partecipa: gli serve per gestire i membri di un gruppo altrui — non per leggerlo.
  async resolveConversationForModeration(input: {
    workspaceId: string;
    userId: string;
    target: ChatScopeTarget;
    conversationId?: string | null;
  }) {
    await this.assertScopeTargetExists(input.workspaceId, input.target);
    await assertScopeVisible(input.workspaceId, input.userId, input.target);
    const { conversation, participant } = await resolveScopedSession({ ...input, moderatorOk: true });
    if (participant?.frozenAt) {
      throw forbidden('Questa conversazione e archiviata: puoi solo consultarla.');
    }
    return conversation!;
  },

  // Bozze dell'utente sulla conversazione (i chip mostrati nel composer).
  // conversationId: la SESSIONE su cui si carica la bozza. Va indicato dalla UI,
  // altrimenti la bozza finisce sull'ultima sessione dell'utente mentre lui sta
  // scrivendo in un'altra, e all'invio il controllo qui sotto la rifiuta.
  async listScopedChatAttachments(input: {
    workspaceId: string;
    userId: string;
    target: ChatScopeTarget;
    conversationId?: string | null;
  }) {
    const conversation = await this.resolveConversationForUser(input);
    const drafts = await aiConversationRepository.listAttachmentDrafts(conversation.id, input.userId);
    return {
      conversationId: conversation.id,
      scope: input.target.scope,
      attachments: drafts.map(mapConversationAttachment),
    };
  },

  // Allega un file: si conservano i BYTE VERI (documenti e immagini). Per i documenti
  // si estrae anche il testo (stesso estrattore delle Fonti), che è ciò che legge
  // l'AI; per le immagini il testo è un segnaposto — la "vista" vera arriva con le
  // chiavi. L'originale resta comunque riscaricabile.
  async addScopedChatFileAttachment(input: {
    workspaceId: string;
    userId: string;
    target: ChatScopeTarget;
    conversationId?: string | null;
    file: { buffer: Buffer; fileName: string; mimeType: string };
  }) {
    const conversation = await this.resolveConversationForUser(input);
    const isImage = isImageAttachment({ mimeType: input.file.mimeType, fileName: input.file.fileName });
    const content = isImage
      ? imagePlaceholderText(input.file.fileName)
      : await extractAttachmentFileText({ buffer: input.file.buffer, fileName: input.file.fileName });
    const attachment = await aiConversationRepository.createAttachmentDraft({
      workspaceId: input.workspaceId,
      conversationId: conversation.id,
      createdByUserId: input.userId,
      kind: 'file',
      label: input.file.fileName.slice(0, 200),
      mimeType: input.file.mimeType || null,
      fileSize: input.file.buffer.byteLength,
      content,
      binaryData: input.file.buffer,
    });
    return mapConversationAttachment(attachment);
  },

  // Allega un elemento del CRM: se ne salva lo snapshot testuale corrente.
  async addScopedChatEntityAttachment(input: {
    workspaceId: string;
    userId: string;
    target: ChatScopeTarget;
    conversationId?: string | null;
    body: unknown;
  }) {
    const schema = z.object({
      entityType: z.string().trim().min(1),
      entityId: z.string().trim().min(1),
    });
    const parsed = schema.safeParse(input.body ?? {});
    if (!parsed.success) {
      throw badRequest('Elemento da allegare non valido.', { issues: parsed.error.flatten() });
    }
    if (!isAttachableEntityType(parsed.data.entityType)) {
      throw badRequest('Tipo di elemento non allegabile.');
    }
    const entityType: AttachableEntityType = parsed.data.entityType;

    const conversation = await this.resolveConversationForUser(input);
    const snapshot = await buildEntitySnapshot(input.workspaceId, entityType, parsed.data.entityId);
    if (!snapshot) {
      throw entityNotFound(entityType);
    }
    await assertEntityAttachable({
      workspaceId: input.workspaceId,
      userId: input.userId,
      entityType,
      snapshot,
    });

    const attachment = await aiConversationRepository.createAttachmentDraft({
      workspaceId: input.workspaceId,
      conversationId: conversation.id,
      createdByUserId: input.userId,
      kind: 'entity',
      entityType,
      entityId: parsed.data.entityId,
      label: snapshot.label.slice(0, 200),
      content: snapshot.content,
    });
    return mapConversationAttachment(attachment);
  },

  // Toglie una bozza dal composer. Solo bozze proprie e non ancora inviate: un
  // allegato gia' in un messaggio fa parte dello storico e non si cancella qui.
  async removeScopedChatAttachment(input: { workspaceId: string; userId: string; attachmentId: string }) {
    const result = await aiConversationRepository.deleteAttachmentDraft(input.attachmentId, input.userId);
    if (result.count === 0) {
      throw notFound('Allegato non trovato (o gia inviato).');
    }
    return { removed: true };
  },

  // Byte originali di un allegato file, per il download/anteprima. Accesso: deve
  // essere del proprio workspace e l'utente dev'essere partecipante ATTIVO della
  // conversazione a cui l'allegato appartiene (i byte sono contenuto, non gestione).
  async getScopedChatAttachmentFile(input: { workspaceId: string; userId: string; attachmentId: string }) {
    const row = await aiConversationRepository.findAttachmentBinary(input.attachmentId);
    if (!row || row.binary === null || row.workspaceId !== input.workspaceId) {
      throw notFound('Allegato non trovato.');
    }
    const allowed = await aiConversationRepository.isParticipant(row.conversationId, input.userId);
    if (!allowed) {
      throw forbidden('Non fai parte di questa conversazione.');
    }
    return {
      data: Buffer.from(row.binary.data),
      mimeType: row.mimeType ?? 'application/octet-stream',
      label: row.label,
    };
  },

  async listChatModels(input: { workspaceId?: string }) {
    // Opzioni del selettore di modello in Chat AI: catalogo curato + disponibilita' per
    // provider (chiave presente) + default di workspace. Lettura: basta chat.view.
    return getAgencyChatModelOptions(input.workspaceId);
  },

  async sendScopedChatMessage(input: {
    workspaceId: string;
    userId: string;
    target: ChatScopeTarget;
    conversationId?: string | null;
    body: unknown;
  }) {
    const schema = z.object({
      message: z.string().trim().min(1).max(4000),
      askAi: z.boolean().optional(),
      attachmentIds: z.array(z.string().min(1)).max(10).optional(),
      // Modello scelto per la sessione (selettore per-sessione). Stringa libera qui: la
      // validazione vera (catalogo + provider con chiave) e il fallback al default li fa
      // runAgencyAiTextWithMeta. Puo' mancare (si usa il default di workspace).
      model: z.string().trim().min(1).max(120).optional(),
    });
    const parsed = schema.safeParse(input.body ?? {});
    if (!parsed.success) {
      throw badRequest('Messaggio non valido.', { issues: parsed.error.flatten() });
    }
    const message = parsed.data.message;
    const attachmentIds = parsed.data.attachmentIds ?? [];
    const requestedModel = parsed.data.model;

    const conversation = await this.resolveConversationForUser(input);

    // Allegati del turno: devono essere bozze proprie e ancora libere. Se anche uno
    // solo non lo e' (id inventato, gia' inviato, di un altro), si rifiuta tutto
    // invece di inviare un messaggio con meno contesto di quello che l'utente vede.
    const turnAttachments = await aiConversationRepository.listAttachmentDraftsByIds(
      conversation.id,
      input.userId,
      attachmentIds,
    );
    if (turnAttachments.length !== attachmentIds.length) {
      throw badRequest('Allegato non valido o gia inviato.');
    }

    // Salva sempre il messaggio umano, con il suo autore, e lega gli allegati.
    const createdMessage = await aiConversationRepository.createMessage({
      workspaceId: input.workspaceId,
      conversationId: conversation.id,
      authorUserId: input.userId,
      role: 'user',
      content: message,
    });
    await aiConversationRepository.linkAttachmentsToMessage({
      conversationId: conversation.id,
      userId: input.userId,
      attachmentIds,
      messageId: createdMessage.id,
    });

    // Ordina l'elenco delle sessioni e, al primo messaggio, battezza la sessione con
    // le prime parole di quel messaggio (l'utente puo' rinominarla).
    await aiConversationRepository.touchSession(conversation.id, {
      lastMessageAt: createdMessage.createdAt,
      titleIfEmpty: conversation.title ? null : buildSessionTitle(message),
      // Persiste il modello scelto sulla sessione (condiviso tra i partecipanti), ma
      // solo se e' uno del catalogo: cosi' non si salva spazzatura. Nessuna scelta
      // valida = si lascia il modello precedente della sessione.
      model: findAgencyCatalogModel(requestedModel) ? requestedModel : undefined,
    });

    // I suggerimenti di navigazione (Fase 6) non sono persistiti: sono CTA una tantum.
    // Si agganciano qui al messaggio dell'AI appena creato, cosi' la UI li legge
    // uniformemente da `message.suggestions` come ogni altro campo. Riaprendo la
    // sessione non tornano (listMessages non li ha), ed e' voluto.
    const buildResult = async (
      extra: Record<string, unknown> = {},
      suggestionAttach?: { messageId: string; suggestions: ChatNavSuggestion[] },
    ) => {
      const rows = await aiConversationRepository.listMessages(conversation.id);
      const messages = rows.map(mapConversationMessage).map((row) =>
        suggestionAttach && suggestionAttach.suggestions.length > 0 && row.id === suggestionAttach.messageId
          ? { ...row, suggestions: suggestionAttach.suggestions }
          : row,
      );
      // Tempo reale (Fase 4): ogni ramo di uscita passa di qui dopo aver persistito i
      // messaggi del turno (utente e, se invocata, risposta AI). Un solo segnale
      // leggero "la conversazione e' cambiata" agli altri partecipanti connessi, che
      // ricaricano dal loro endpoint autorizzato. Best-effort, niente contenuto nel
      // canale; se nessuno e' iscritto non fa nulla.
      broadcastToConversation(conversation.id, {
        type: 'chat.changed',
        conversationId: conversation.id,
        scope: input.target.scope,
      });
      return {
        conversationId: conversation.id,
        scope: input.target.scope,
        messages,
        ...extra,
      };
    };

    // Turni (spec sez. 2 + 4-bis). L'AI risponde solo se interpellata — @AI o
    // pulsante — MA questa e' una regola nata per il GRUPPO: se sei l'unico
    // partecipante attivo non c'e' nessun altro a cui parlare, quindi ogni messaggio
    // la interpella. Vale per SESSIONE, non per ambito: appena inviti qualcuno la
    // sessione diventa di gruppo e torna la regola @AI. Il mittente e' sempre attivo
    // (resolveConversationForUser blocca i congelati), quindi count === 1 = da solo.
    const mentioned = parsed.data.askAi === true || /(^|\s)@ai\b/i.test(message);
    const activeParticipantCount = await aiConversationRepository.countActiveParticipants(conversation.id);
    const invokeAi = mentioned || activeParticipantCount === 1;
    if (!invokeAi) {
      return buildResult({ aiInvoked: false });
    }

    const status = await getAgencyAiStatusPayload(input.workspaceId);
    if (!status.configured) {
      return buildResult({ aiInvoked: false, aiConfigured: false });
    }

    // Allegati da dare al modello: quelli di questo turno piu' i piu' recenti dei
    // turni precedenti (gia' legati ai loro messaggi), cosi' il contesto allegato
    // prima non sparisce al turno dopo. I duplicati si scartano: quelli di questo
    // turno sono appena stati legati, quindi risultano anche tra gli "inviati".
    const sentAttachments = await aiConversationRepository.listSentAttachments(
      conversation.id,
      CHAT_HISTORY_ATTACHMENT_LIMIT + turnAttachments.length,
    );
    const turnAttachmentIds = new Set(turnAttachments.map((attachment) => attachment.id));
    const previousAttachments = sentAttachments
      .filter((attachment) => !turnAttachmentIds.has(attachment.id))
      .slice(0, CHAT_HISTORY_ATTACHMENT_LIMIT)
      .reverse();
    const promptAttachments = [...previousAttachments, ...turnAttachments];

    // Contesto per l'ambito (profilo + RAG + allegati), finestra di storico (piu' ampia
    // del passato: la compressione decide cosa tenere) e le aree del CRM su cui
    // l'utente puo' andare (per la navigazione suggerita, Fase 6).
    const [context, history, enabledModules, permissions, promptImages] = await Promise.all([
      buildScopedChatContext(input.workspaceId, input.target, message, promptAttachments),
      aiConversationRepository.listMessages(conversation.id, CONTEXT_FETCH_LIMIT),
      moduleRepository.listEnabledModules(input.workspaceId),
      rbacRepository.listUserPermissions(input.userId, input.workspaceId),
      // "Vista" multimodale (Fase 3b): byte delle immagini tra gli allegati del contesto.
      collectPromptVisionImages(conversation.id, promptAttachments),
    ]);
    const historyMessages: ContextMessage[] = history.map((row) => ({
      role: row.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: row.content,
    }));

    // Solo le aree accessibili finiscono nel prompt: il modello non propone porte
    // chiuse, e i suggerimenti che tornano puntano solo dove l'utente puo' entrare.
    const navAreas = resolveAccessibleNavAreas(enabledModules, permissions);
    const systemPrompt = context.system + buildNavPromptSection(navAreas);

    // Compressione del contesto (Fase 5). Oltre la soglia (~45% della finestra del
    // modello) i messaggi piu' vecchi della finestra vengono RIASSUNTI in un turno
    // sintetico, e si tiene verbatim solo la coda recente. Invisibile all'utente (che
    // vede sempre lo storico intero da listMessages): comprimiamo solo cio' che l'AI
    // legge. Il riassunto e' esso stesso una chiamata AI, loggata e a budget.
    // status.model e' gia' il modello effettivo risolto: serve solo a scegliere la
    // finestra di contesto giusta (per-modello).
    // La finestra di contesto segue il modello EFFETTIVO della risposta: se l'utente ha
    // scelto un modello del catalogo, si usa il suo per dimensionare la finestra (la
    // validazione della chiave la fa runAgencyAiTextWithMeta, che altrimenti ricade sul
    // default). Il riassunto interno resta sul modello di default (chat.summary).
    const requestedCatalogModel = findAgencyCatalogModel(requestedModel);
    const windowModel = requestedCatalogModel ? requestedCatalogModel.id : status.model;
    const plan = planContextCompression({ systemText: systemPrompt, messages: historyMessages, model: windowModel });
    let contextMessages: ContextMessage[] = plan.keepVerbatim;
    if (plan.needsCompression) {
      const summaryRequest = buildSummaryRequest(plan.toSummarize);
      let summary: AgencyAiTextResult | null = null;
      try {
        summary = await runAgencyAiTextWithMeta({
          workspaceId: input.workspaceId,
          system: summaryRequest.system,
          messages: summaryRequest.messages,
          functionName: 'chat.summary',
          conversationId: conversation.id,
          projectId: input.target.scope === 'project' ? input.target.projectId : undefined,
        });
      } catch (error) {
        // Se non c'e' budget nemmeno per riassumere si prosegue con la sola coda
        // recente: meglio una risposta con meno contesto che nessuna risposta.
        if (!(error instanceof AiBudgetExceededError)) {
          throw error;
        }
      }
      contextMessages = summary?.text
        ? buildCompressedContext(summary.text, plan.keepVerbatim)
        : plan.keepVerbatim;
    }

    let result: AgencyAiTextResult | null;
    try {
      result = await runAgencyAiTextWithMeta({
        workspaceId: input.workspaceId,
        system: systemPrompt,
        messages: contextMessages,
        functionName: `chat.${input.target.scope}`,
        conversationId: conversation.id,
        projectId: input.target.scope === 'project' ? input.target.projectId : undefined,
        model: requestedModel,
        // Le immagini allegate al turno (e alle poche recenti): il modello le VEDE, non
        // ne legge più solo il nome. Il riassunto interno (sopra) resta solo-testo.
        images: promptImages,
      });
    } catch (error) {
      if (error instanceof AiBudgetExceededError) {
        return buildResult({ aiInvoked: false, budgetExceeded: true, budgetMessage: error.message });
      }
      throw error;
    }
    if (!result) {
      throw badRequest('Generazione della risposta non riuscita.');
    }

    // I token [[vai:…]] si tolgono dal testo salvato (DB pulito) e diventano bottoni.
    const { text: assistantText, suggestions } = parseNavSuggestions(result.text, navAreas);
    const assistantRow = await aiConversationRepository.createMessage({
      workspaceId: input.workspaceId,
      conversationId: conversation.id,
      authorUserId: null,
      role: 'assistant',
      content: assistantText,
      citationsJson: context.citations as unknown as Prisma.InputJsonValue,
    });

    return buildResult({ aiInvoked: true }, { messageId: assistantRow.id, suggestions });
  },

  async listScopedChatParticipants(input: {
    workspaceId: string;
    userId: string;
    target: ChatScopeTarget;
    conversationId?: string | null;
  }) {
    await this.assertScopeTargetExists(input.workspaceId, input.target);
    await assertScopeVisible(input.workspaceId, input.userId, input.target);
    // moderatorOk: l'elenco dei membri e' gestione, non contenuto — un moderatore
    // deve poterlo vedere per intervenire su un gruppo di cui non fa parte.
    const { conversation } = await resolveScopedSession({ ...input, moderatorOk: true });
    const [participants, members] = await Promise.all([
      aiConversationRepository.listParticipants(conversation!.id),
      aiConversationRepository.listWorkspaceMembers(input.workspaceId),
    ]);
    const participantIds = new Set(participants.map((row) => row.userId));
    const invitable = members
      .filter((member) => !participantIds.has(member.userId))
      .map((member) => ({ userId: member.userId, name: member.user?.name ?? null, email: member.user?.email ?? null }));
    return {
      conversationId: conversation!.id,
      scope: input.target.scope,
      participants: participants.map(mapConversationParticipant),
      invitable,
    };
  },

  async addScopedChatParticipant(input: {
    workspaceId: string;
    userId: string;
    target: ChatScopeTarget;
    conversationId?: string | null;
    body: unknown;
  }) {
    const schema = z.object({ userId: z.string().min(1) });
    const parsed = schema.safeParse(input.body ?? {});
    if (!parsed.success) {
      throw badRequest('Dati invito non validi.', { issues: parsed.error.flatten() });
    }
    // Invitare e' una scrittura: il congelato non puo' farlo (lo blocca qui dentro).
    const conversation = await this.resolveConversationForUser(input);
    const members = await aiConversationRepository.listWorkspaceMembers(input.workspaceId);
    const invited = members.find((member) => member.userId === parsed.data.userId);
    if (!invited) {
      throw badRequest('Utente non appartenente al workspace.');
    }
    await aiConversationRepository.addParticipant({
      workspaceId: input.workspaceId,
      conversationId: conversation.id,
      userId: parsed.data.userId,
      role: 'member',
      invitedByUserId: input.userId,
    });
    return this.listScopedChatParticipants({ ...input, conversationId: conversation.id });
  },

  // Uscire o essere rimossi CONGELA il partecipante, non lo cancella (spec 4-bis):
  // la sessione gli resta in sola lettura fino al momento dell'uscita.
  // Chiunque puo' uscire da solo, owner compreso: se esce l'owner la sessione passa
  // al partecipante attivo piu' anziano, cosi' non resta mai ingestibile. Prima
  // l'owner era legato alla conversazione per sempre (il controllo che lo proteggeva
  // scattava prima di quello che permetteva l'uscita autonoma).
  async removeScopedChatParticipant(input: {
    workspaceId: string;
    userId: string;
    target: ChatScopeTarget;
    conversationId?: string | null;
    targetUserId: string;
  }) {
    const conversation = await this.resolveConversationForModeration(input);
    const actor = await aiConversationRepository.findParticipant(conversation.id, input.userId);
    const targetMember = await aiConversationRepository.findParticipant(conversation.id, input.targetUserId);
    if (targetMember && !targetMember.frozenAt) {
      const removingSelf = input.targetUserId === input.userId;
      const isModerator = !actor && (await canModerateChat(input.workspaceId, input.userId));
      if (!removingSelf && actor?.role !== 'owner' && !isModerator) {
        throw forbidden('Solo il proprietario puo rimuovere altri partecipanti.');
      }
      // L'owner non lo si sfila da sotto: puo' uscirne da solo, oppure lo sostituisce
      // un moderatore (il caso "chi ha aperto la chat non c'e' piu'").
      if (!removingSelf && targetMember.role === 'owner' && !isModerator) {
        throw badRequest('Il proprietario della conversazione non puo essere rimosso: puo solo uscirne da solo.');
      }
      await this.freezeAndHandOver(conversation.id, input.targetUserId, targetMember.role === 'owner');
    }
    return this.listScopedChatParticipants({ ...input, conversationId: conversation.id });
  },

  // Congela un partecipante e, se era l'owner, passa la sessione al piu' anziano tra
  // gli attivi. Se non resta nessuno la sessione non muore: torna semplicemente una
  // conversazione senza attivi, consultabile in sola lettura da chi c'e' passato.
  async freezeAndHandOver(conversationId: string, userId: string, wasOwner: boolean) {
    const heirs = wasOwner
      ? await aiConversationRepository.listOtherActiveParticipants(conversationId, userId)
      : [];
    await aiConversationRepository.freezeParticipant(conversationId, userId, new Date());
    if (wasOwner && heirs.length > 0) {
      await aiConversationRepository.promoteToOwner(conversationId, heirs[0].userId);
    }
  },

  // Sciogli il gruppo: la sessione torna SOLITARIA per chi esegue l'azione, che
  // continua a scriverci. Gli altri vengono congelati (punto 4 della spec): se la
  // ritrovano in sola lettura, ferma al momento dello scioglimento, e possono
  // riprenderla in una chat propria se e quando vogliono.
  // Copia "a richiesta", non subito: sciogliendo non si duplica nulla.
  async disbandScopedChat(input: {
    workspaceId: string;
    userId: string;
    target: ChatScopeTarget;
    conversationId?: string | null;
  }) {
    const conversation = await this.resolveConversationForModeration(input);
    const actor = await aiConversationRepository.findParticipant(conversation.id, input.userId);
    if (actor?.role !== 'owner' && !(await canModerateChat(input.workspaceId, input.userId))) {
      throw forbidden('Solo il proprietario della conversazione puo sciogliere il gruppo.');
    }
    // Sciogliendo da moderatore esterno non ci si autoinvita dentro: si congelano
    // TUTTI, e la sessione resta consultabile a chi c'e' passato.
    await aiConversationRepository.freezeOtherParticipants(conversation.id, actor ? input.userId : '', new Date());
    return this.listScopedChatParticipants({ ...input, conversationId: conversation.id });
  },

  // "Riprendi in una nuova chat": duplica una sessione congelata in una sessione
  // nuova, tutta di chi la riprende, copiando lo storico SOLO fino a frozenAt (non
  // si portano dietro messaggi scritti dopo l'uscita). E' il momento in cui si paga
  // la copia: chi non riprende non duplica niente.
  async resumeScopedChatSession(input: {
    workspaceId: string;
    userId: string;
    target: ChatScopeTarget;
    conversationId: string;
  }) {
    await this.assertScopeTargetExists(input.workspaceId, input.target);
    await assertScopeVisible(input.workspaceId, input.userId, input.target);
    const { conversation, participant } = await resolveScopedSession(input);
    if (!participant?.frozenAt) {
      throw badRequest('Questa conversazione e ancora attiva: non c\'e nulla da riprendere.');
    }
    const source = await aiConversationRepository.listMessages(conversation!.id, 200, participant.frozenAt);
    const created = await aiConversationRepository.createSession({
      workspaceId: input.workspaceId,
      target: input.target,
      creatorUserId: input.userId,
      title: conversation!.title,
      resumedFromConversationId: conversation!.id,
    });
    if (source.length > 0) {
      await aiConversationRepository.createMessages(
        source.map((row) => ({
          workspaceId: input.workspaceId,
          conversationId: created.id,
          authorUserId: row.authorUserId,
          // In DB role e' una stringa; i soli valori scritti sono 'user'/'assistant'.
          role: row.role as 'user' | 'assistant',
          content: row.content,
          citationsJson: (row.citationsJson ?? undefined) as Prisma.InputJsonValue | undefined,
        })),
      );
    }
    return { conversationId: created.id };
  },

  async saveAiBudgets(input: { workspaceId: string; body: unknown }) {
    const schema = z.object({
      defaultDailyLimitUsd: z.coerce.number().min(0).max(100000).optional(),
      overrides: z
        .array(
          z.object({
            userId: z.string().trim().min(1),
            // null = rimuovi l'override (torna al default del workspace).
            dailyLimitUsd: z.coerce.number().min(0).max(100000).nullable(),
          }),
        )
        .optional(),
    });
    const parsed = schema.safeParse(input.body ?? {});
    if (!parsed.success) {
      throw badRequest('Payload budget AI non valido', { issues: parsed.error.flatten() });
    }
    const payload = parsed.data;

    if (payload.defaultDailyLimitUsd !== undefined) {
      await aiBudgetRepository.upsert(input.workspaceId, AI_BUDGET_DEFAULT_USER, payload.defaultDailyLimitUsd);
    }
    if (payload.overrides?.length) {
      // Solo utenti realmente membri del workspace (evita righe spurie).
      const members = await teamRepository.listMembers(input.workspaceId);
      const memberIds = new Set(members.map((member) => member.userId));
      for (const entry of payload.overrides) {
        if (!memberIds.has(entry.userId)) {
          continue;
        }
        if (entry.dailyLimitUsd === null) {
          await aiBudgetRepository.remove(input.workspaceId, entry.userId);
        } else {
          await aiBudgetRepository.upsert(input.workspaceId, entry.userId, entry.dailyLimitUsd);
        }
      }
    }
    return this.getAiBudgets(input.workspaceId);
  },

  async getAgencyRuntimeSettings(input: {
    workspaceId: string;
    canManage: boolean;
  }) {
    const [ai, competitorSearch, runtimeConfig] = await Promise.all([
      this.getAgencyAiStatus(input.workspaceId),
      this.getCompetitorSearchSettings(input.workspaceId),
      resolveAgencyRuntimeConfig(input.workspaceId),
    ]);

    return {
      canManage: input.canManage,
      storageReady: runtimeConfig.storageReady,
      ai: {
        enabled: ai.enabled,
        provider: ai.provider,
        model: ai.model,
        timeoutMs: runtimeConfig.ai.timeoutMs,
        inputMaxChars: runtimeConfig.ai.inputMaxChars,
        stringMaxChars: runtimeConfig.ai.stringMaxChars,
        fileTextMaxChars: runtimeConfig.ai.fileTextMaxChars,
        maxOutputTokens: runtimeConfig.ai.maxOutputTokens,
        defaultMode: runtimeConfig.ai.defaultMode,
        debugEnabled: runtimeConfig.ai.debugEnabled,
        functionModels: runtimeConfig.ai.functionModels,
        configured: ai.configured,
        status: ai.status,
        apiKeyConfigured: ai.apiKeyConfigured,
        apiKeySource: ai.apiKeySource,
        // Stato di entrambe le chiavi, indipendente dal provider attivo, così la
        // UI può gestirle entrambe (senza esporre i segreti).
        openAiApiKeyConfigured: runtimeConfig.ai.apiKeyConfigured,
        openAiApiKeySource: runtimeConfig.ai.apiKeySource,
        anthropicApiKeyConfigured: runtimeConfig.ai.anthropicApiKeyConfigured,
        anthropicApiKeySource: runtimeConfig.ai.anthropicApiKeySource,
        message: ai.message,
      },
      competitorSearch: {
        enabled: competitorSearch.enabled,
        provider: competitorSearch.provider,
        status: competitorSearch.status,
        apiKeyConfigured: competitorSearch.apiKeyConfigured,
        message: competitorSearch.message,
      },
      availableProviders: {
        ai: ['none', 'openai', 'anthropic'],
        competitorSearch: ['none', 'openai_web_search', 'serpapi', 'custom'],
      },
      // Catalogo curato dei modelli selezionabili, per popolare il select in UI: cosi'
      // non si puo' piu' digitare a mano un id arbitrario (che ripiegherebbe su Opus).
      availableModels: AGENCY_AI_MODEL_CATALOG.map((entry) => ({
        id: entry.id,
        label: entry.label,
        provider: entry.provider,
        hint: entry.hint,
      })),
      security: {
        serverSideOnly: true,
        secretReadable: runtimeConfig.ai.dbSecretConfigured ? runtimeConfig.ai.dbSecretReadable : true,
        secretStorage: runtimeConfig.ai.apiKeySource === 'db'
          ? 'encrypted_db'
          : runtimeConfig.ai.apiKeySource === 'env'
            ? 'env'
            : 'missing',
      },
    };
  },

  async saveAgencyRuntimeSettings(input: {
    workspaceId: string;
    actorUserId: string;
    body: unknown;
  }) {
    const schemaReady = await agencyRepository.isAgencyRuntimeSettingsSchemaReady();
    if (!schemaReady) {
      throw badRequest('Agency runtime settings storage is not ready. Apply the latest database migration first.');
    }

    const parsed = runtimeSettingsPayloadSchema.safeParse(input.body ?? {});
    if (!parsed.success) {
      throw badRequest('Invalid Agency runtime settings payload', {
        issues: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;

    // Il modello di default deve essere un id del CATALOGO curato (AGENCY_AI_MODEL_CATALOG):
    // un id fuori catalogo (es. "sonnet 4.5" scritto a mano) farebbe ripiegare
    // resolveAgencyProviderModel in SILENZIO sul default Anthropic (Opus, il piu' caro).
    // Meglio rifiutare a monte, cosi' non si salva uno stato incoerente e costoso.
    if (payload.ai?.model !== undefined) {
      const modelOption = findAgencyCatalogModel(payload.ai.model);
      if (!modelOption) {
        throw badRequest(
          `Modello AI non valido: "${payload.ai.model}". Scegli un modello dal catalogo.`,
          { validModels: AGENCY_AI_MODEL_CATALOG.map((entry) => entry.id) },
        );
      }
      // Coerenza provider/modello: un modello del provider sbagliato ricadrebbe anch'esso
      // sul default (stesso problema). Si controlla solo se il provider e' esplicitato.
      if (payload.ai.provider && payload.ai.provider !== 'none' && modelOption.provider !== payload.ai.provider) {
        throw badRequest(
          `Il modello "${modelOption.label}" e' del provider "${modelOption.provider}", diverso dal provider selezionato "${payload.ai.provider}". Scegli un modello del provider selezionato.`,
        );
      }
    }

    const writes: Array<Promise<unknown>> = [];

    if (payload.ai?.enabled !== undefined) {
      writes.push(agencyRepository.upsertAgencyRuntimeSetting({
        workspaceId: input.workspaceId,
        key: AGENCY_RUNTIME_SETTING_KEYS.aiEnabled,
        valueJson: payload.ai.enabled,
        isSecret: false,
      }));
    }

    if (payload.ai?.provider !== undefined) {
      writes.push(agencyRepository.upsertAgencyRuntimeSetting({
        workspaceId: input.workspaceId,
        key: AGENCY_RUNTIME_SETTING_KEYS.aiProvider,
        valueJson: payload.ai.provider,
        isSecret: false,
      }));
    }

    if (payload.ai?.model !== undefined) {
      writes.push(agencyRepository.upsertAgencyRuntimeSetting({
        workspaceId: input.workspaceId,
        key: AGENCY_RUNTIME_SETTING_KEYS.aiModel,
        valueJson: payload.ai.model,
        isSecret: false,
      }));
    }

    const aiNumericWrites: Array<[keyof typeof AGENCY_RUNTIME_SETTING_KEYS, number | undefined]> = [
      ['aiTimeoutMs', payload.ai?.timeoutMs],
      ['aiInputMaxChars', payload.ai?.inputMaxChars],
      ['aiStringMaxChars', payload.ai?.stringMaxChars],
      ['aiFileTextMaxChars', payload.ai?.fileTextMaxChars],
      ['aiMaxOutputTokens', payload.ai?.maxOutputTokens],
    ];
    for (const [settingKey, value] of aiNumericWrites) {
      if (value !== undefined) {
        writes.push(agencyRepository.upsertAgencyRuntimeSetting({
          workspaceId: input.workspaceId,
          key: AGENCY_RUNTIME_SETTING_KEYS[settingKey],
          valueJson: value,
          isSecret: false,
        }));
      }
    }

    if (payload.ai?.defaultMode !== undefined) {
      writes.push(agencyRepository.upsertAgencyRuntimeSetting({
        workspaceId: input.workspaceId,
        key: AGENCY_RUNTIME_SETTING_KEYS.aiDefaultMode,
        valueJson: payload.ai.defaultMode,
        isSecret: false,
      }));
    }

    if (payload.ai?.debugEnabled !== undefined) {
      writes.push(agencyRepository.upsertAgencyRuntimeSetting({
        workspaceId: input.workspaceId,
        key: AGENCY_RUNTIME_SETTING_KEYS.aiDebugEnabled,
        valueJson: payload.ai.debugEnabled,
        isSecret: false,
      }));
    }

    if (payload.ai?.functionModels !== undefined) {
      writes.push(agencyRepository.upsertAgencyRuntimeSetting({
        workspaceId: input.workspaceId,
        key: AGENCY_RUNTIME_SETTING_KEYS.aiFunctionModels,
        valueJson: payload.ai.functionModels as Prisma.InputJsonValue,
        isSecret: false,
      }));
    }

    if (payload.competitorSearch?.enabled !== undefined) {
      writes.push(agencyRepository.upsertAgencyRuntimeSetting({
        workspaceId: input.workspaceId,
        key: AGENCY_RUNTIME_SETTING_KEYS.competitorSearchEnabled,
        valueJson: payload.competitorSearch.enabled,
        isSecret: false,
      }));
    }

    if (payload.competitorSearch?.provider !== undefined) {
      writes.push(agencyRepository.upsertAgencyRuntimeSetting({
        workspaceId: input.workspaceId,
        key: AGENCY_RUNTIME_SETTING_KEYS.competitorSearchProvider,
        valueJson: payload.competitorSearch.provider,
        isSecret: false,
      }));
    }

    if (payload.ai?.clearOpenAiApiKey) {
      writes.push(agencyRepository.deleteAgencyRuntimeSetting({
        workspaceId: input.workspaceId,
        key: AGENCY_RUNTIME_SETTING_KEYS.openAiApiKey,
      }));
    } else if (payload.ai?.openAiApiKey) {
      const encrypted = await encryptAgencyRuntimeSecret({
        workspaceId: input.workspaceId,
        key: AGENCY_RUNTIME_SETTING_KEYS.openAiApiKey,
        value: payload.ai.openAiApiKey,
      });
      writes.push(agencyRepository.upsertAgencyRuntimeSetting({
        workspaceId: input.workspaceId,
        key: AGENCY_RUNTIME_SETTING_KEYS.openAiApiKey,
        valueJson: null,
        encrypted,
        isSecret: true,
      }));
    }

    if (payload.ai?.clearAnthropicApiKey) {
      writes.push(agencyRepository.deleteAgencyRuntimeSetting({
        workspaceId: input.workspaceId,
        key: AGENCY_RUNTIME_SETTING_KEYS.anthropicApiKey,
      }));
    } else if (payload.ai?.anthropicApiKey) {
      const encrypted = await encryptAgencyRuntimeSecret({
        workspaceId: input.workspaceId,
        key: AGENCY_RUNTIME_SETTING_KEYS.anthropicApiKey,
        value: payload.ai.anthropicApiKey,
      });
      writes.push(agencyRepository.upsertAgencyRuntimeSetting({
        workspaceId: input.workspaceId,
        key: AGENCY_RUNTIME_SETTING_KEYS.anthropicApiKey,
        valueJson: null,
        encrypted,
        isSecret: true,
      }));
    }

    await Promise.all(writes);

    return this.getAgencyRuntimeSettings({
      workspaceId: input.workspaceId,
      canManage: true,
    });
  },

  async buildProjectWorkingContext(workspaceId: string, projectId: string) {
    const [project, sources, discovery, web, ads, reportMemory, diagnosisMemory, alerts, opportunities, tasks] = await Promise.all([
      this.getProject(workspaceId, projectId),
      this.getProjectSources(workspaceId, projectId),
      this.getProjectDiscovery(workspaceId, projectId),
      this.getProjectWeb(workspaceId, projectId),
      this.getProjectAds(workspaceId, projectId),
      agencyRepository.findProjectMemoryReports(workspaceId, projectId),
      agencyRepository.findProjectMemoryDiagnosis(workspaceId, projectId),
      this.getProjectAlerts(workspaceId, projectId),
      this.getProjectOpportunities(workspaceId, projectId),
      this.getProjectTasks(workspaceId, projectId),
    ]);

    return {
      project: {
        id: project.id,
        name: project.name,
        clientName: project.clientName,
        projectType: project.projectType,
        goal: project.goal,
        statusAgency: project.statusAgency,
        priorityAgency: project.priorityAgency,
      },
      sources,
      sourceReadiness: project.sourceReadiness,
      discovery: {
        sections: discovery.sections,
        contextSummary: discovery.contextSummary,
        sourceReliability: discovery.sourceReliability || getReadableSourceStatus(sources.sourceStatus),
        usedSources: discovery.usedSources || buildSourceReadiness(sources).usedSources,
        missingWarnings: discovery.missingWarnings || sources.missingSourceWarnings || [],
        confidenceBySection: discovery.confidenceBySection || {},
        aiHistory: discovery.aiHistory || [],
      },
      web: {
        available: Boolean(web.output),
        lastUpdatedAt: web.lastUpdatedAt,
        output: web.output,
      },
      ads: {
        available: Boolean(ads.output),
        lastUpdatedAt: ads.lastUpdatedAt,
        output: ads.output,
      },
      reports: {
        available: Boolean(reportMemory?.reportsJson),
        lastUpdatedAt: reportMemory?.updatedAt ? reportMemory.updatedAt.toISOString() : null,
      },
      diagnosis: {
        available: Boolean(diagnosisMemory?.diagnosisJson),
        lastUpdatedAt: diagnosisMemory?.updatedAt ? diagnosisMemory.updatedAt.toISOString() : null,
      },
      alerts: alerts ?? [],
      opportunities: opportunities ?? [],
      tasks: tasks ?? [],
      missingCriticalInfo: Array.from(new Set([
        ...(sources.missingSourceWarnings || []),
        ...(discovery.missingWarnings || []),
        ...(alerts ?? [])
          .filter((entry) => entry.severity === 'critical')
          .map((entry) => entry.title),
      ])).slice(0, 12),
      confidence: {
        sourceStatus: sources.sourceStatus,
        sourceQuality: sources.sourceQuality || sources.sourceStatus,
        isFallbackOnly: sources.sourceStatus === 'missing',
      },
    };
  },

    async getProjectDiscovery(workspaceId: string, projectId: string): Promise<DiscoveryPayload> {
      const project = await agencyRepository.findProjectLite(workspaceId, projectId);
      if (!project) {
        throw notFound('Project not found');
      }

      const memory = await agencyRepository.findProjectMemory(workspaceId, projectId);
      const briefJson = memory?.briefJson as Prisma.JsonValue | null;
      const briefRecord = isRecord(briefJson) ? briefJson : {};
      const sections = normalizeDiscoverySectionsFromBriefJson(briefJson);
      const notes = normalizeDiscoveryNotesFromBriefJson(briefJson);
      const brief = buildDiscoveryBrief(sections, notes);
      const contextSummary = memory?.contextSummary?.trim() || buildDiscoveryContextSummary(sections);

      return {
        sections,
        notes,
        brief,
        contextSummary,
        persisted: Boolean(memory),
        lastUpdatedAt: memory?.updatedAt ? memory.updatedAt.toISOString() : null,
        sourceReliability: typeof briefRecord.sourceReliability === 'string' ? briefRecord.sourceReliability : undefined,
        usedSources: Array.isArray(briefRecord.usedSources)
          ? briefRecord.usedSources.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
          : undefined,
        sectionSources: isRecord(briefRecord.sectionSources)
          ? Object.fromEntries(Object.entries(briefRecord.sectionSources).map(([key, value]) => [
            key,
            Array.isArray(value)
              ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
              : [],
          ]))
          : undefined,
        confidenceBySection: isRecord(briefRecord.confidenceBySection) ? briefRecord.confidenceBySection : undefined,
        aiHistory: Array.isArray(briefRecord.aiHistory) ? briefRecord.aiHistory.filter(isRecord).slice(-30) : [],
        missingWarnings: Array.isArray(briefRecord.missingWarnings)
          ? briefRecord.missingWarnings.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
          : undefined,
      };
    },

  async saveProjectDiscovery(input: {
    workspaceId: string;
    projectId: string;
    body: unknown;
  }): Promise<DiscoveryPayload> {
    const project = await agencyRepository.findProjectLite(input.workspaceId, input.projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    const existingMemory = await agencyRepository.findProjectMemory(input.workspaceId, input.projectId);
    const existingSections = normalizeDiscoverySectionsFromBriefJson(existingMemory?.briefJson as Prisma.JsonValue | null);
    const existingNotes = normalizeDiscoveryNotesFromBriefJson(existingMemory?.briefJson as Prisma.JsonValue | null);
    const parsed = this.parseDiscoveryBody(input.body);
    const rawSections: DiscoverySections = {
      businessContext: parsed.sections.businessContext,
      projectGoal: parsed.sections.projectGoal,
      target: parsed.sections.target,
      offer: parsed.sections.offer,
      brandCommunication: parsed.sections.brandCommunication,
      availableMaterials: parsed.sections.availableMaterials,
      technicalAspects: parsed.sections.technicalAspects,
      marketingAcquisition: parsed.sections.marketingAcquisition,
    };
    const sections = mergeDiscoverySections(rawSections, existingSections);
    const notes = sanitizeDiscoveryText(parsed.notes, existingNotes);
    const brief = buildDiscoveryBrief(sections, notes);
    const contextSummary = buildDiscoveryContextSummary(sections);
    const preservedSourcesJson = extractSourcesJsonFromMemory(existingMemory);

    const memoryRecord = await agencyRepository.upsertProjectMemory({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      briefJson: {
        ...sections,
        notes,
        brief,
      },
      contextSummary,
      sourcesJson: preservedSourcesJson === null ? undefined : preservedSourcesJson as Prisma.InputJsonValue,
    });

      if (!memoryRecord) {
        logAgencyServiceEvent('Discovery persistence unavailable. Returning fallback discovery payload.', {
          projectId: input.projectId,
        });
      } else {
        const syncResults = await Promise.allSettled([
          this.syncProjectAlerts(input.workspaceId, input.projectId),
          this.syncProjectOpportunities(input.workspaceId, input.projectId),
          this.syncProjectTasks(input.workspaceId, input.projectId),
        ]);

        syncResults.forEach((result, index) => {
          if (result.status !== 'rejected') {
            return;
          }

          const syncLabel = index === 0
            ? 'alerts'
            : index === 1
              ? 'opportunities'
              : 'tasks';

          logAgencyServiceEvent('Discovery save completed but a downstream sync failed.', {
            projectId: input.projectId,
            syncLabel,
          });
        });
      }

    return {
      sections,
      notes,
      brief,
      contextSummary,
      persisted: Boolean(memoryRecord),
      lastUpdatedAt: memoryRecord?.updatedAt ? memoryRecord.updatedAt.toISOString() : null,
    };
  },

  async regenerateProjectDiscoveryFromSources(workspaceId: string, projectId: string): Promise<DiscoveryPayload> {
    const [project, loadedSources, existingMemory, indexedRecords] = await Promise.all([
      this.getProject(workspaceId, projectId),
      this.getProjectSources(workspaceId, projectId),
      agencyRepository.findProjectMemory(workspaceId, projectId),
      agencyRepository.listIndexedProjectSources(workspaceId, projectId),
    ]);
    const sources = augmentSourcesWithIndexedRecords(loadedSources, indexedRecords);
    const generated = buildDiscoveryFromProjectSources({ project, sources });
    const confidenceBySection = Object.fromEntries(
      Object.keys(generated.sections).map((key) => [
        key,
        sources.sourceStatus === 'ready' ? 'high' : sources.sourceStatus === 'partial' ? 'medium' : 'low',
      ]),
    );
    const preservedSourcesJson = extractSourcesJsonFromMemory(existingMemory);
    const briefJson = {
      ...generated.sections,
      notes: generated.notes,
      brief: generated.brief,
      sourceReliability: generated.sourceReliability,
      usedSources: generated.usedSources,
      sectionSources: generated.sectionSources,
      confidenceBySection,
      missingWarnings: generated.missingWarnings,
      regeneratedFromSourcesAt: new Date().toISOString(),
    };
    const memoryRecord = await agencyRepository.upsertProjectMemory({
      workspaceId,
      projectId,
      briefJson,
      contextSummary: generated.contextSummary,
      sourcesJson: preservedSourcesJson === null ? undefined : preservedSourcesJson as Prisma.InputJsonValue,
    });

    if (memoryRecord) {
      await Promise.allSettled([
        this.syncProjectAlerts(workspaceId, projectId),
        this.syncProjectOpportunities(workspaceId, projectId),
        this.syncProjectTasks(workspaceId, projectId),
      ]);
    }

    return {
      sections: generated.sections,
      notes: generated.notes,
      brief: generated.brief,
      contextSummary: generated.contextSummary,
      persisted: Boolean(memoryRecord),
      lastUpdatedAt: memoryRecord?.updatedAt ? memoryRecord.updatedAt.toISOString() : null,
      sourceReliability: generated.sourceReliability,
      usedSources: generated.usedSources,
      sectionSources: generated.sectionSources,
      confidenceBySection,
      missingWarnings: generated.missingWarnings,
    } as DiscoveryPayload;
  },

  async generateProjectDiscoveryFromSourcesWithAi(workspaceId: string, projectId: string): Promise<DiscoveryPayload & { aiGeneration: Record<string, unknown> }> {
    const aiStatus = await this.getAgencyAiStatus(workspaceId);
    if (!aiStatus.configured) {
      const fallback = await this.regenerateProjectDiscoveryFromSources(workspaceId, projectId);
      return {
        ...fallback,
        aiGeneration: {
          mode: 'fallback_rule_based',
          aiConfigured: false,
          message: aiStatus.message,
        },
      };
    }

    const [project, loadedSources, existingMemory, indexedRecords] = await Promise.all([
      this.getProject(workspaceId, projectId),
      this.getProjectSources(workspaceId, projectId),
      agencyRepository.findProjectMemory(workspaceId, projectId),
      agencyRepository.listIndexedProjectSources(workspaceId, projectId),
    ]);
    const sources = augmentSourcesWithIndexedRecords(loadedSources, indexedRecords);
    const fallback = buildDiscoveryFromProjectSources({ project, sources });
    const existingSections = normalizeDiscoverySectionsFromBriefJson(existingMemory?.briefJson as Prisma.JsonValue | null);
    const existingBriefJson = isRecord(existingMemory?.briefJson) ? existingMemory.briefJson as Record<string, unknown> : {};
    // RAG: passaggi delle Fonti più pertinenti (best-effort, [] se non disponibili).
    const relevantExcerpts = await retrieveRelevantSourceExcerpts({ workspaceId, projectId, project });
    const aiUserPayload = {
      task: 'generateStructuredBrief',
      project: buildAgencyAiProjectSnapshot(project),
      sources: buildAgencyAiSourceSnapshot(sources),
      relevantExcerpts,
      existingBrief: buildAgencyAiDiscoverySnapshot(existingSections),
      requiredOutput: {
        sections: Object.keys(DISCOVERY_SECTION_LABELS),
        missingFields: ['target', 'offer', 'CTA', 'USP', 'geo', 'tracking', 'socialProof', 'creativeMaterials'],
        confidenceBySection: 'low|medium|high',
        usedSourcesBySection: 'array of source labels',
      },
    };
    const inputHash = buildAgencyAiInputHash(aiUserPayload);
    const aiCache = isRecord(existingBriefJson.aiCache) ? existingBriefJson.aiCache : {};
    const cachedGeneration = isRecord(aiCache.generateStructuredBrief) ? aiCache.generateStructuredBrief : null;
    const cachedPayload = cachedGeneration?.inputHash === inputHash && isRecord(cachedGeneration.payload)
      ? cachedGeneration.payload
      : null;

    try {
      const systemPrompt = [
          'Sei un senior strategist per agenzie digitali.',
          'Genera un brief Discovery strutturato usando solo le fonti dichiarate.',
          'Il campo relevantExcerpts contiene i passaggi testuali piu pertinenti estratti dalle fonti tramite ricerca semantica: usali come prova primaria, preferendoli agli estratti troncati quando disponibili.',
          'Non inventare target, offerta, CTA, USP o dati di mercato non presenti.',
          'Se una informazione manca, scrivi che va validata e proponi domande operative.',
        ].join(' ');
      const aiResult = cachedPayload
        ? {
          payload: cachedPayload,
          meta: {
            functionName: 'discovery.generateBrief',
            model: aiStatus.model,
            inputHash,
            estimatedInputTokens: 0,
            estimatedOutputTokens: 0,
            durationMs: 0,
            cacheHit: true,
            status: 'cache_hit' as const,
          },
        }
        : await runAgencyOpenAiJsonWithMeta({
          workspaceId,
          functionName: 'discovery.generateBrief',
          projectId,
          lockKey: `${workspaceId}:${projectId}:discovery.generateBrief:${inputHash}`,
          system: systemPrompt,
          user: aiUserPayload,
          jsonSchema: DISCOVERY_AI_JSON_SCHEMA,
        });
      const aiPayload = aiResult?.payload || {};

      const aiSections = isRecord(aiPayload?.sections) ? aiPayload.sections : {};
      const sections: DiscoverySections = {
        businessContext: sanitizeDiscoveryText(String(aiSections.businessContext || fallback.sections.businessContext), fallback.sections.businessContext),
        projectGoal: sanitizeDiscoveryText(String(aiSections.projectGoal || fallback.sections.projectGoal), fallback.sections.projectGoal),
        target: sanitizeDiscoveryText(String(aiSections.target || fallback.sections.target), fallback.sections.target),
        offer: sanitizeDiscoveryText(String(aiSections.offer || fallback.sections.offer), fallback.sections.offer),
        brandCommunication: sanitizeDiscoveryText(String(aiSections.brandCommunication || fallback.sections.brandCommunication), fallback.sections.brandCommunication),
        availableMaterials: sanitizeDiscoveryText(String(aiSections.availableMaterials || fallback.sections.availableMaterials), fallback.sections.availableMaterials),
        technicalAspects: sanitizeDiscoveryText(String(aiSections.technicalAspects || fallback.sections.technicalAspects), fallback.sections.technicalAspects),
        marketingAcquisition: sanitizeDiscoveryText(String(aiSections.marketingAcquisition || fallback.sections.marketingAcquisition), fallback.sections.marketingAcquisition),
      };
      const missingFields = Array.isArray(aiPayload?.missingFields)
        ? aiPayload.missingFields.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        : fallback.missingWarnings || [];
      const sectionSources = isRecord(aiPayload?.usedSourcesBySection)
        ? aiPayload.usedSourcesBySection as Record<string, string[]>
        : fallback.sectionSources;
      const notes = [
        'Brief rigenerato con AI lato server usando solo fonti progetto disponibili.',
        `Qualita fonti: ${sources.sourceQuality || sources.sourceStatus}.`,
        missingFields.length ? `Da validare: ${missingFields.join(', ')}.` : '',
      ].filter(Boolean).join('\n');
      const brief = buildDiscoveryBrief(sections, notes);
      const contextSummary = buildDiscoveryContextSummary(sections);
      const preservedSourcesJson = extractSourcesJsonFromMemory(existingMemory);
      const memoryRecord = await agencyRepository.upsertProjectMemory({
        workspaceId,
        projectId,
        briefJson: {
          ...existingBriefJson,
          ...sections,
          notes,
          brief,
          sourceReliability: sources.sourceQuality || fallback.sourceReliability,
          usedSources: fallback.usedSources,
          sectionSources,
          missingWarnings: missingFields,
          confidenceBySection: isRecord(aiPayload?.confidenceBySection) ? aiPayload.confidenceBySection : undefined,
          generationMode: 'ai_with_sources',
          regeneratedFromSourcesAt: new Date().toISOString(),
          aiCache: {
            ...aiCache,
            generateStructuredBrief: {
              inputHash,
              payload: aiPayload,
              updatedAt: new Date().toISOString(),
              model: aiResult?.meta.model || aiStatus.model,
            },
          },
          aiHistory: appendAgencyAiHistory(existingBriefJson.aiHistory, {
            module: 'discovery',
            function: 'generateBrief',
            inputHash,
            cacheHit: Boolean(aiResult?.meta.cacheHit),
            model: aiResult?.meta.model || aiStatus.model,
            estimatedInputTokens: aiResult?.meta.estimatedInputTokens || 0,
            estimatedOutputTokens: aiResult?.meta.estimatedOutputTokens || 0,
            estimatedCostUsd: aiResult?.meta.estimatedCostUsd || 0,
            durationMs: aiResult?.meta.durationMs || 0,
            status: aiResult?.meta.status || 'success',
            generatedAt: new Date().toISOString(),
          }),
        },
        contextSummary,
        sourcesJson: preservedSourcesJson === null ? undefined : preservedSourcesJson as Prisma.InputJsonValue,
      });

      if (memoryRecord) {
        await Promise.allSettled([
          this.syncProjectAlerts(workspaceId, projectId),
          this.syncProjectOpportunities(workspaceId, projectId),
          this.syncProjectTasks(workspaceId, projectId),
        ]);
      }

      return {
        sections,
        notes,
        brief,
        contextSummary,
        persisted: Boolean(memoryRecord),
        lastUpdatedAt: memoryRecord?.updatedAt ? memoryRecord.updatedAt.toISOString() : null,
        sourceReliability: sources.sourceQuality || fallback.sourceReliability,
        usedSources: fallback.usedSources,
        sectionSources,
        missingWarnings: missingFields,
        aiGeneration: {
          mode: 'ai_with_sources',
          aiConfigured: true,
          provider: aiStatus.provider,
          model: aiStatus.model,
          cacheHit: Boolean(aiResult?.meta.cacheHit),
          inputHash,
          estimatedInputTokens: aiResult?.meta.estimatedInputTokens || 0,
          estimatedOutputTokens: aiResult?.meta.estimatedOutputTokens || 0,
          estimatedCostUsd: aiResult?.meta.estimatedCostUsd || 0,
          durationMs: aiResult?.meta.durationMs || 0,
        },
      } as DiscoveryPayload & { aiGeneration: Record<string, unknown> };
    } catch (error) {
      const fallbackPayload = await this.regenerateProjectDiscoveryFromSources(workspaceId, projectId);
      // Budget esaurito: segnalato esplicitamente (non un fallback silenzioso).
      // Si restituisce comunque il brief rule-based, ma con modalità e messaggio chiari.
      if (error instanceof AiBudgetExceededError) {
        return {
          ...fallbackPayload,
          aiGeneration: {
            mode: 'budget_exceeded',
            aiConfigured: true,
            provider: aiStatus.provider,
            model: aiStatus.model,
            budgetExceeded: true,
            dailyLimitUsd: error.dailyLimitUsd,
            spentTodayUsd: error.spentTodayUsd,
            message: error.message,
          },
        };
      }
      return {
        ...fallbackPayload,
        aiGeneration: {
          mode: 'fallback_rule_based',
          aiConfigured: true,
          provider: aiStatus.provider,
          model: aiStatus.model,
          error: error instanceof Error ? error.message : 'AI generation failed',
        },
      };
    }
  },

  async regenerateProjectDiscoverySectionFromSources(input: {
    workspaceId: string;
    projectId: string;
    body: unknown;
  }): Promise<DiscoveryPayload & { regeneratedSection: DiscoverySectionKey }> {
    const parsed = discoverySectionRegenerateBodySchema.parse(input.body);
    const [project, sources, existingMemory] = await Promise.all([
      this.getProject(input.workspaceId, input.projectId),
      this.getProjectSources(input.workspaceId, input.projectId),
      agencyRepository.findProjectMemory(input.workspaceId, input.projectId),
    ]);
    const existingSections = normalizeDiscoverySectionsFromBriefJson(existingMemory?.briefJson as Prisma.JsonValue | null);
    const existingNotes = normalizeDiscoveryNotesFromBriefJson(existingMemory?.briefJson as Prisma.JsonValue | null);
    const generated = buildDiscoveryFromProjectSources({ project, sources });
    const sections: DiscoverySections = {
      ...existingSections,
      [parsed.sectionKey]: generated.sections[parsed.sectionKey],
    };
    const notes = [
      existingNotes,
      `Sezione rigenerata da fonti: ${parsed.sectionKey}. Affidabilita: ${generated.sourceReliability}.`,
      generated.missingWarnings?.length ? `Alert fonti: ${generated.missingWarnings.join(' ')}` : '',
    ].filter(Boolean).join('\n');
    const brief = buildDiscoveryBrief(sections, notes);
    const contextSummary = buildDiscoveryContextSummary(sections);
    const preservedSourcesJson = extractSourcesJsonFromMemory(existingMemory);
    const existingBriefJson = isRecord(existingMemory?.briefJson) ? existingMemory?.briefJson as Record<string, unknown> : {};
    const sectionSources = isRecord(existingBriefJson.sectionSources)
      ? {
        ...existingBriefJson.sectionSources as Record<string, string[]>,
        [parsed.sectionKey]: generated.sectionSources?.[parsed.sectionKey] || generated.usedSources || [],
      }
      : {
        [parsed.sectionKey]: generated.sectionSources?.[parsed.sectionKey] || generated.usedSources || [],
      };
    const missingWarnings = Array.from(new Set([
      ...((Array.isArray(existingBriefJson.missingWarnings) ? existingBriefJson.missingWarnings : []) as string[]),
      ...(generated.missingWarnings || []),
    ].filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)));
    const confidenceBySection = isRecord(existingBriefJson.confidenceBySection)
      ? {
        ...existingBriefJson.confidenceBySection as Record<string, unknown>,
        [parsed.sectionKey]: sources.sourceStatus === 'ready' ? 'high' : sources.sourceStatus === 'partial' ? 'medium' : 'low',
      }
      : {
        [parsed.sectionKey]: sources.sourceStatus === 'ready' ? 'high' : sources.sourceStatus === 'partial' ? 'medium' : 'low',
      };

    const memoryRecord = await agencyRepository.upsertProjectMemory({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      briefJson: {
        ...existingBriefJson,
        ...sections,
        notes,
        brief,
        sourceReliability: generated.sourceReliability,
        usedSources: generated.usedSources,
        sectionSources,
        confidenceBySection,
        missingWarnings,
        regeneratedFromSourcesAt: new Date().toISOString(),
        regeneratedSection: parsed.sectionKey,
      },
      contextSummary,
      sourcesJson: preservedSourcesJson === null ? undefined : preservedSourcesJson as Prisma.InputJsonValue,
    });

    if (memoryRecord) {
      await Promise.allSettled([
        this.syncProjectAlerts(input.workspaceId, input.projectId),
        this.syncProjectOpportunities(input.workspaceId, input.projectId),
        this.syncProjectTasks(input.workspaceId, input.projectId),
      ]);
    }

    return {
      sections,
      notes,
      brief,
      contextSummary,
      persisted: Boolean(memoryRecord),
      lastUpdatedAt: memoryRecord?.updatedAt ? memoryRecord.updatedAt.toISOString() : null,
      sourceReliability: generated.sourceReliability,
      usedSources: generated.usedSources,
      sectionSources,
      confidenceBySection,
      missingWarnings,
      regeneratedSection: parsed.sectionKey,
    };
  },

  async generateProjectDiscoverySectionWithAi(input: {
    workspaceId: string;
    projectId: string;
    body: unknown;
  }): Promise<DiscoveryPayload & { regeneratedSection: DiscoverySectionKey; aiGeneration: Record<string, unknown> }> {
    const parsed = discoverySectionRegenerateBodySchema.parse(input.body);
    const aiStatus = await this.getAgencyAiStatus(input.workspaceId);
    const fallback = await this.regenerateProjectDiscoverySectionFromSources({
      ...input,
      body: { sectionKey: parsed.sectionKey },
    });
    if (!aiStatus.configured) {
      return {
        ...fallback,
        aiGeneration: {
          mode: 'fallback_rule_based',
          aiConfigured: false,
          message: aiStatus.message,
        },
      };
    }

    try {
      const [project, sources, existingMemory] = await Promise.all([
        this.getProject(input.workspaceId, input.projectId),
        this.getProjectSources(input.workspaceId, input.projectId),
        agencyRepository.findProjectMemory(input.workspaceId, input.projectId),
      ]);
      const existingBriefJson = isRecord(existingMemory?.briefJson) ? existingMemory?.briefJson as Record<string, unknown> : {};
      const aiUserPayload = {
        task: 'generateDiscoverySection',
        sectionKey: parsed.sectionKey,
        sectionLabel: DISCOVERY_SECTION_LABELS[parsed.sectionKey],
        project: buildAgencyAiProjectSnapshot(project),
        sources: buildAgencyAiSourceSnapshot(sources),
        existingBrief: buildAgencyAiDiscoverySnapshot(fallback.sections, fallback.notes),
        requiredOutput: {
          sectionText: 'string',
          usedSources: ['source labels'],
          missingFields: ['string'],
          confidence: 'low|medium|high',
        },
      };
      const inputHash = buildAgencyAiInputHash(aiUserPayload);
      const aiCache = isRecord(existingBriefJson.aiCache) ? existingBriefJson.aiCache : {};
      const cacheKey = `discoverySection:${parsed.sectionKey}`;
      const cachedGeneration = isRecord(aiCache[cacheKey]) ? aiCache[cacheKey] as Record<string, unknown> : null;
      const cachedPayload = cachedGeneration?.inputHash === inputHash && isRecord(cachedGeneration.payload)
        ? cachedGeneration.payload
        : null;
      const systemPrompt = [
          'Sei un senior strategist per agenzie digitali.',
          'Rigenera una sola sezione Discovery usando solo le fonti dichiarate.',
          'Non copiare blocchi grezzi: sintetizza in modo operativo.',
          'Non inventare target, offerta, CTA, USP o dati di mercato non presenti.',
          'Se mancano dati, scrivi domande concrete da fare al cliente.',
        ].join(' ');
      const aiResult = cachedPayload
        ? {
          payload: cachedPayload,
          meta: {
            functionName: 'discovery.generateSection',
            model: aiStatus.model,
            inputHash,
            estimatedInputTokens: 0,
            estimatedOutputTokens: 0,
            durationMs: 0,
            cacheHit: true,
            status: 'cache_hit' as const,
          },
        }
        : await runAgencyOpenAiJsonWithMeta({
          workspaceId: input.workspaceId,
          functionName: 'discovery.generateSection',
          projectId: input.projectId,
          lockKey: `${input.workspaceId}:${input.projectId}:discovery.generateSection:${parsed.sectionKey}:${inputHash}`,
          system: systemPrompt,
          user: aiUserPayload,
          jsonSchema: DISCOVERY_SECTION_AI_JSON_SCHEMA,
        });
      const aiPayload = aiResult?.payload || {};
      const source = isRecord(aiPayload) ? aiPayload : {};
      const sectionText = sanitizeDiscoveryText(
        String(source.sectionText || source.text || fallback.sections[parsed.sectionKey]),
        fallback.sections[parsed.sectionKey],
      );
      const sections: DiscoverySections = {
        ...fallback.sections,
        [parsed.sectionKey]: sectionText,
      };
      const aiUsedSources = Array.isArray(source.usedSources)
        ? source.usedSources.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        : fallback.sectionSources?.[parsed.sectionKey] || fallback.usedSources || [];
      const aiMissingFields = Array.isArray(source.missingFields)
        ? source.missingFields.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        : [];
      const sectionSources = isRecord(existingBriefJson.sectionSources)
        ? {
          ...existingBriefJson.sectionSources as Record<string, string[]>,
          [parsed.sectionKey]: aiUsedSources,
        }
        : {
          ...(fallback.sectionSources || {}),
          [parsed.sectionKey]: aiUsedSources,
        };
      const missingWarnings = Array.from(new Set([
        ...(fallback.missingWarnings || []),
        ...aiMissingFields,
      ].filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)));
      const confidenceBySection = isRecord(existingBriefJson.confidenceBySection)
        ? {
          ...existingBriefJson.confidenceBySection as Record<string, unknown>,
          [parsed.sectionKey]: typeof source.confidence === 'string' ? source.confidence : 'medium',
        }
        : {
          [parsed.sectionKey]: typeof source.confidence === 'string' ? source.confidence : 'medium',
        };
      const notes = [
        normalizeDiscoveryNotesFromBriefJson(existingMemory?.briefJson as Prisma.JsonValue | null),
        `Sezione "${DISCOVERY_SECTION_LABELS[parsed.sectionKey]}" rigenerata con AI usando payload compatto.`,
        aiMissingFields.length ? `Da validare: ${aiMissingFields.join(', ')}.` : '',
      ].filter(Boolean).join('\n');
      const brief = buildDiscoveryBrief(sections, notes);
      const contextSummary = buildDiscoveryContextSummary(sections);
      const preservedSourcesJson = extractSourcesJsonFromMemory(existingMemory);
      const memoryRecord = await agencyRepository.upsertProjectMemory({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        briefJson: {
          ...existingBriefJson,
          ...sections,
          notes,
          brief,
          sourceReliability: sources.sourceQuality || fallback.sourceReliability,
          usedSources: Array.from(new Set([...(fallback.usedSources || []), ...aiUsedSources])),
          sectionSources,
          missingWarnings,
          confidenceBySection,
          generationMode: 'ai_with_sources',
          regeneratedFromSourcesAt: new Date().toISOString(),
          regeneratedSection: parsed.sectionKey,
          aiCache: {
            ...aiCache,
            [cacheKey]: {
              inputHash,
              payload: aiPayload,
              updatedAt: new Date().toISOString(),
              model: aiResult?.meta.model || aiStatus.model,
            },
          },
          aiHistory: appendAgencyAiHistory(existingBriefJson.aiHistory, {
            module: 'discovery',
            function: 'generateSection',
            sectionKey: parsed.sectionKey,
            inputHash,
            cacheHit: Boolean(aiResult?.meta.cacheHit),
            model: aiResult?.meta.model || aiStatus.model,
            estimatedInputTokens: aiResult?.meta.estimatedInputTokens || 0,
            estimatedOutputTokens: aiResult?.meta.estimatedOutputTokens || 0,
            estimatedCostUsd: aiResult?.meta.estimatedCostUsd || 0,
            durationMs: aiResult?.meta.durationMs || 0,
            status: aiResult?.meta.status || 'success',
            generatedAt: new Date().toISOString(),
          }),
        },
        contextSummary,
        sourcesJson: preservedSourcesJson === null ? undefined : preservedSourcesJson as Prisma.InputJsonValue,
      });

      if (memoryRecord) {
        await Promise.allSettled([
          this.syncProjectAlerts(input.workspaceId, input.projectId),
          this.syncProjectOpportunities(input.workspaceId, input.projectId),
          this.syncProjectTasks(input.workspaceId, input.projectId),
        ]);
      }

      return {
        sections,
        notes,
        brief,
        contextSummary,
        persisted: Boolean(memoryRecord),
        lastUpdatedAt: memoryRecord?.updatedAt ? memoryRecord.updatedAt.toISOString() : null,
        sourceReliability: sources.sourceQuality || fallback.sourceReliability,
        usedSources: Array.from(new Set([...(fallback.usedSources || []), ...aiUsedSources])),
        sectionSources,
        missingWarnings,
        regeneratedSection: parsed.sectionKey,
        aiGeneration: {
          mode: 'ai_with_sources',
          aiConfigured: true,
          provider: aiStatus.provider,
          model: aiStatus.model,
          cacheHit: Boolean(aiResult?.meta.cacheHit),
          inputHash,
          estimatedInputTokens: aiResult?.meta.estimatedInputTokens || 0,
          estimatedOutputTokens: aiResult?.meta.estimatedOutputTokens || 0,
          estimatedCostUsd: aiResult?.meta.estimatedCostUsd || 0,
          durationMs: aiResult?.meta.durationMs || 0,
        },
      };
    } catch (error) {
      return {
        ...fallback,
        aiGeneration: {
          mode: 'fallback_rule_based',
          aiConfigured: true,
          provider: aiStatus.provider,
          model: aiStatus.model,
          error: error instanceof Error ? error.message : 'AI section generation failed',
        },
      };
    }
  },

  async syncProjectAlerts(workspaceId: string, projectId: string) {
    const project = await agencyRepository.findProjectLite(workspaceId, projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    const [seed, discovery, memoryAds] = await Promise.all([
      getProjectSeed(workspaceId, projectId),
      this.getProjectDiscovery(workspaceId, projectId),
      agencyRepository.findProjectMemoryAds(workspaceId, projectId),
    ]);
    const adsInput = await this.buildProjectAdsInput(workspaceId, projectId);
    const adsOutput = normalizeAdsOutputFromJson(memoryAds?.adsJson as Prisma.JsonValue | null, projectId, adsInput);
    const generatedAlerts = buildRuleBasedAlerts({
      projectTypeKey: seed?.projectType?.key ?? 'marketing_full',
      scopePurchased: (seed?.scopePurchased ?? []).map((entry) => ({
        key: entry.key,
        purchased: entry.purchased,
      })),
      discovery: discovery.sections,
      adsOutput: memoryAds?.adsJson ? adsOutput : null,
    });

    const persistedAlerts = await agencyRepository.replaceProjectAlertsBySource({
      workspaceId,
      projectId,
      source: RULE_SOURCE,
      items: generatedAlerts,
    });

    if (!persistedAlerts) {
      logAgencyServiceEvent('Alerts persistence unavailable. Returning generated fallback alerts.', {
        projectId,
      });

      return generatedAlerts.map((entry, index) => ({
        id: `fallback-alert-${index + 1}`,
        title: entry.title,
        severity: entry.severity.toLowerCase(),
        status: entry.status.toLowerCase(),
        projectId,
        reason: entry.reason ?? null,
        origin: 'fallback_generated',
      }));
    }

    return persistedAlerts.map((entry) => mapAlertRecordToItem({
      id: entry.id,
      title: entry.title,
      severity: entry.severity,
      status: entry.status,
      reason: entry.reason,
      projectId: entry.projectId,
      source: entry.source,
    }));
  },

  async getProjectAlerts(workspaceId: string, projectId: string) {
    const project = await agencyRepository.findProjectLite(workspaceId, projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    const alerts = await agencyRepository.listProjectAlerts(workspaceId, projectId);
    if (!alerts) {
      return null;
    }

    return alerts.map((entry) => mapAlertRecordToItem({
      id: entry.id,
      title: entry.title,
      severity: entry.severity,
      status: entry.status,
      reason: entry.reason,
      projectId: entry.projectId,
      source: entry.source,
    }));
  },

  async getWorkspaceAlerts(workspaceId: string) {
    const alerts = await agencyRepository.listWorkspaceAlerts(workspaceId);
    if (!alerts) {
      return null;
    }

    return alerts.map((entry) => mapAlertRecordToItem({
      id: entry.id,
      title: entry.title,
      severity: entry.severity,
      status: entry.status,
      reason: entry.reason,
      projectId: entry.projectId,
      source: entry.source,
    }));
  },

  async syncProjectOpportunities(workspaceId: string, projectId: string) {
    const project = await agencyRepository.findProjectLite(workspaceId, projectId);
    if (!project) {
      throw notFound('Project not found');
    }
    const generatedOpportunities = await this.evaluateProjectOpportunities(workspaceId, projectId);

    const persistedOpportunities = await agencyRepository.replaceProjectOpportunitiesBySource({
      workspaceId,
      projectId,
      source: RULE_SOURCE,
      items: generatedOpportunities,
    });

    if (!persistedOpportunities) {
      logAgencyServiceEvent('Opportunities persistence unavailable. Returning generated fallback opportunities.', {
        projectId,
      });

      return generatedOpportunities.map((entry, index) => ({
        id: `fallback-opportunity-${index + 1}`,
        title: entry.title,
        stage: entry.stage,
        estimatedValue: entry.estimatedValue,
        status: entry.status.toLowerCase(),
        projectId,
        origin: 'fallback_generated',
        category: entry.category ?? null,
        type: entry.type ?? null,
        rationale: entry.rationale ?? null,
        priority: entry.priority ? entry.priority.toLowerCase() : null,
        score: typeof entry.score === 'number' ? entry.score : null,
        impactLevel: entry.impactLevel ? entry.impactLevel.toLowerCase() : null,
        sourceModule: entry.sourceModule ?? null,
        sourceSignalKey: entry.sourceSignalKey ?? null,
        dedupKey: entry.dedupKey ?? null,
        suggestedService: entry.suggestedService ?? null,
        lastEvaluatedAt: entry.lastEvaluatedAt instanceof Date ? entry.lastEvaluatedAt.toISOString() : null,
      }));
    }

    return persistedOpportunities.map((entry) => mapOpportunityRecordToItem({
      id: entry.id,
      title: entry.title,
      stage: entry.stage,
      estimatedValue: entry.estimatedValue,
      status: entry.status,
      projectId: entry.projectId,
      category: 'category' in entry ? entry.category : null,
      type: 'type' in entry ? entry.type : null,
      rationale: 'rationale' in entry ? entry.rationale : null,
      priority: 'priority' in entry ? entry.priority : null,
      score: 'score' in entry ? entry.score : null,
      impactLevel: 'impactLevel' in entry ? entry.impactLevel : null,
      sourceModule: 'sourceModule' in entry ? entry.sourceModule : null,
      sourceSignalKey: 'sourceSignalKey' in entry ? entry.sourceSignalKey : null,
      dedupKey: 'dedupKey' in entry ? entry.dedupKey : null,
      suggestedService: 'suggestedService' in entry ? entry.suggestedService : null,
      lastEvaluatedAt: 'lastEvaluatedAt' in entry ? entry.lastEvaluatedAt : null,
      source: entry.source,
    }));
  },

  async getProjectOpportunities(workspaceId: string, projectId: string) {
    const project = await agencyRepository.findProjectLite(workspaceId, projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    const opportunities = await agencyRepository.listProjectOpportunities(workspaceId, projectId);
    if (!opportunities) {
      return null;
    }

    return opportunities.map((entry) => mapOpportunityRecordToItem({
      id: entry.id,
      title: entry.title,
      stage: entry.stage,
      estimatedValue: entry.estimatedValue,
      status: entry.status,
      projectId: entry.projectId,
      category: 'category' in entry ? entry.category : null,
      type: 'type' in entry ? entry.type : null,
      rationale: 'rationale' in entry ? entry.rationale : null,
      priority: 'priority' in entry ? entry.priority : null,
      score: 'score' in entry ? entry.score : null,
      impactLevel: 'impactLevel' in entry ? entry.impactLevel : null,
      sourceModule: 'sourceModule' in entry ? entry.sourceModule : null,
      sourceSignalKey: 'sourceSignalKey' in entry ? entry.sourceSignalKey : null,
      dedupKey: 'dedupKey' in entry ? entry.dedupKey : null,
      suggestedService: 'suggestedService' in entry ? entry.suggestedService : null,
      lastEvaluatedAt: 'lastEvaluatedAt' in entry ? entry.lastEvaluatedAt : null,
      source: entry.source,
    }));
  },

  async getWorkspaceOpportunities(workspaceId: string) {
    const opportunities = await agencyRepository.listWorkspaceOpportunities(workspaceId);
    if (!opportunities) {
      return null;
    }

    return opportunities.map((entry) => mapOpportunityRecordToItem({
      id: entry.id,
      title: entry.title,
      stage: entry.stage,
      estimatedValue: entry.estimatedValue,
      status: entry.status,
      projectId: entry.projectId,
      category: 'category' in entry ? entry.category : null,
      type: 'type' in entry ? entry.type : null,
      rationale: 'rationale' in entry ? entry.rationale : null,
      priority: 'priority' in entry ? entry.priority : null,
      score: 'score' in entry ? entry.score : null,
      impactLevel: 'impactLevel' in entry ? entry.impactLevel : null,
      sourceModule: 'sourceModule' in entry ? entry.sourceModule : null,
      sourceSignalKey: 'sourceSignalKey' in entry ? entry.sourceSignalKey : null,
      dedupKey: 'dedupKey' in entry ? entry.dedupKey : null,
      suggestedService: 'suggestedService' in entry ? entry.suggestedService : null,
      lastEvaluatedAt: 'lastEvaluatedAt' in entry ? entry.lastEvaluatedAt : null,
      source: entry.source,
    }));
  },

  async syncProjectActiveModules(workspaceId: string, projectId: string) {
    const project = await agencyRepository.findProjectLite(workspaceId, projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    const snapshot = await agencyRepository.findProjectSnapshot(workspaceId, projectId);
    if (!snapshot) {
      return null;
    }

    const generatedModules = buildRuleBasedActiveModules({
      projectTypeKey: snapshot.projectType?.key ?? 'marketing_full',
      scopePurchased: normalizeScopePurchased(snapshot.scopePurchased as Prisma.JsonValue | null).map((entry) => ({
        key: entry.key,
        purchased: entry.purchased,
      })),
    });

    const persistedModules = await agencyRepository.upsertProjectActiveModules({
      workspaceId,
      projectId,
      source: RULE_SOURCE,
      items: generatedModules.map((entry) => ({
        moduleKey: entry.key,
        moduleLabel: entry.label,
        included: entry.included,
        suggested: entry.suggested,
        active: entry.active,
      })),
    });

    if (!persistedModules) {
      logAgencyServiceEvent('Active modules persistence unavailable. Returning generated fallback modules.', {
        projectId,
      });

      return generatedModules;
    }

    return persistedModules.map((entry) => mapActiveModuleRecordToItem({
      moduleKey: entry.moduleKey,
      moduleLabel: entry.moduleLabel,
      included: entry.included,
      suggested: entry.suggested,
      active: entry.active,
    }));
  },

  async syncProjectTasks(workspaceId: string, projectId: string) {
    const project = await agencyRepository.findProjectLite(workspaceId, projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    const seed = await getProjectSeed(workspaceId, projectId);
    const discovery = await this.getProjectDiscovery(workspaceId, projectId);
    const generatedTasks = buildRuleBasedTasks({
      projectTypeKey: seed?.projectType?.key ?? 'marketing_full',
      scopePurchased: (seed?.scopePurchased ?? []).map((entry) => ({
        key: entry.key,
        purchased: entry.purchased,
      })),
      discovery: discovery.sections,
    });

    const persistedTasks = await agencyRepository.replaceProjectTasksBySource({
      workspaceId,
      projectId,
      sourceType: RULE_SOURCE,
      items: generatedTasks,
    });

    if (!persistedTasks) {
      logAgencyServiceEvent('Tasks persistence unavailable. Returning generated fallback tasks.', {
        projectId,
      });

      return generatedTasks.map((entry, index) => ({
        id: `fallback-task-${index + 1}`,
        projectId,
        title: entry.title,
        description: entry.description ?? null,
        teamRole: entry.teamRole,
        priority: entry.priority.toLowerCase(),
        status: entry.status.toLowerCase(),
        sourceType: RULE_SOURCE,
        dependsOnTaskId: null,
        origin: 'fallback_generated',
      }));
    }

    return persistedTasks.map((entry) => mapTaskRecordToItem({
      id: entry.id,
      projectId: entry.projectId,
      title: entry.title,
      description: entry.description,
      teamRole: entry.teamRole,
      priority: entry.priority,
      status: entry.status,
      sourceType: entry.sourceType,
      dependsOnTaskId: entry.dependsOnTaskId,
    }));
  },

  async getProjectTasks(workspaceId: string, projectId: string) {
    const project = await agencyRepository.findProjectLite(workspaceId, projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    const tasks = await agencyRepository.listProjectTasks(workspaceId, projectId);
    if (!tasks) {
      return null;
    }

    return tasks.map((entry) => mapTaskRecordToItem({
      id: entry.id,
      projectId: entry.projectId,
      title: entry.title,
      description: entry.description,
      teamRole: entry.teamRole,
      priority: entry.priority,
      status: entry.status,
      sourceType: entry.sourceType,
      dependsOnTaskId: entry.dependsOnTaskId,
    }));
  },
};
