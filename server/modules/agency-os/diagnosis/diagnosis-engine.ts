export type AgencyDiagnosisInput = {
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
  contextSummary: string;
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
    campaignGoal: string;
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
  report: {
    available: boolean;
    persisted: boolean;
    reportStatus: string;
    nextSteps: string[];
    topAlertsCount: number;
    topOpportunitiesCount: number;
    topTasksCount: number;
    updatedAt: string | null;
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
    hasReport: boolean;
    hasAlerts: boolean;
    hasOpportunities: boolean;
    hasTasks: boolean;
  };
};

export type AgencyDiagnosisIssue = {
  key: string;
  title: string;
  summary: string;
  category: string;
  priority: string;
  module: string;
  evidence: string[];
  linkedFindingKey?: string;
};

export type AgencyDiagnosisOutput = {
  projectId: string;
  diagnosisStatus: string;
  evaluatedAt: string | null;
  diagnosisSummary: string;
  criticalFindings: AgencyDiagnosisIssue[];
  probableCauses: AgencyDiagnosisIssue[];
  gapAnalysis: AgencyDiagnosisIssue[];
  recommendedActions: AgencyDiagnosisIssue[];
  interventionPriority: string;
  confidenceLevel: string;
  sourceSummary: AgencyDiagnosisInput['dataSourceSummary'];
  moduleSignals: Record<string, { status: string; summary: string }>;
};

const PRIORITY_SCORE: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const normalizeString = (value: unknown, fallback = '') => (
  typeof value === 'string' ? value : fallback
);

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const containsAny = (value: string, terms: string[]) => {
  const normalized = value.toLowerCase();
  return terms.some((entry) => normalized.includes(entry));
};

const maxPriority = (values: string[]) => {
  return [...values].sort((left, right) => (PRIORITY_SCORE[right] || 0) - (PRIORITY_SCORE[left] || 0))[0] || 'medium';
};

const buildModuleSignals = (input: AgencyDiagnosisInput) => ({
  discovery: {
    status: input.discovery.persisted
      ? 'ready'
      : input.discovery.contextSummary.trim()
        ? 'partial'
        : 'missing',
    summary: input.discovery.contextSummary || 'Discovery non ancora consolidata.',
  },
  web: {
    status: input.web.persisted
      ? 'ready'
      : input.web.available
        ? 'partial'
        : 'missing',
    summary: input.web.available
      ? `Web ${input.web.pageType || 'page'} con CTA ${input.web.ctaPrimary ? 'presente' : 'assente'}.`
      : 'Modulo Web non ancora generato.',
  },
  ads: {
    status: input.ads.persisted
      ? 'ready'
      : input.ads.available
        ? 'partial'
        : 'missing',
    summary: input.ads.available
      ? `Ads su ${input.ads.channelScope} con offer angle ${input.ads.offerAngle ? 'definito' : 'assente'}.`
      : 'Modulo Ads non ancora generato.',
  },
  reporting: {
    status: input.report.persisted
      ? 'ready'
      : input.report.available
        ? 'partial'
        : 'missing',
    summary: input.report.available
      ? `Report ${input.report.reportStatus} con ${input.report.topAlertsCount} alert top.`
      : 'Reporting non ancora consolidato.',
  },
});

const buildGapAnalysis = (input: AgencyDiagnosisInput): AgencyDiagnosisIssue[] => {
  const gaps: AgencyDiagnosisIssue[] = [];
  const technicalText = [
    input.discovery.sections.technicalAspects,
    input.discovery.sections.marketingAcquisition,
    input.contextSummary,
    ...input.alerts.map((entry) => entry.title),
    ...input.alerts.map((entry) => entry.reason || ''),
    ...input.report.nextSteps,
  ].join(' ').toLowerCase();

  const hasTrackingSignal = containsAny(technicalText, ['tracking', 'ga4', 'conversion', 'pixel', 'tag manager', 'utm']);
  const hasOffer = Boolean(
    input.discovery.sections.offer.trim()
    || input.web.offerSummary.trim()
    || input.ads.offerAngle.trim(),
  );
  const hasTrust = input.web.trustElements.length > 0;
  const hasLandingForAds = !input.ads.available || input.web.pageType === 'landing' || input.web.persisted;
  const metaActive = input.ads.channelScope === 'meta' || input.ads.channelScope === 'both';

  if (!input.discovery.persisted || !input.discovery.sections.projectGoal.trim() || !input.discovery.sections.target.trim() || !input.discovery.sections.offer.trim()) {
    gaps.push({
      key: 'discovery_incomplete',
      title: 'Discovery incompleta',
      summary: 'Mancano obiettivo, target o offerta strutturati. La base strategica del progetto resta fragile.',
      category: 'discovery',
      priority: 'high',
      module: 'discovery',
      evidence: [
        input.discovery.sections.projectGoal ? '' : 'projectGoal assente',
        input.discovery.sections.target ? '' : 'target assente',
        input.discovery.sections.offer ? '' : 'offer assente',
      ].filter(Boolean),
    });
  }

  if (!hasOffer) {
    gaps.push({
      key: 'offer_not_clear',
      title: 'Offerta poco chiara',
      summary: 'L’offerta non emerge in modo netto nei moduli disponibili, con rischio di messaging debole.',
      category: 'offer',
      priority: 'high',
      module: 'strategy',
      evidence: ['offer discovery vuota', 'offer summary web assente', 'offer angle ads assente'],
    });
  }

  if (input.web.available && !input.web.ctaPrimary.trim()) {
    gaps.push({
      key: 'cta_missing',
      title: 'CTA primaria non definita',
      summary: 'La pagina Web non espone una CTA primaria chiara e questo riduce la leggibilità del funnel.',
      category: 'cta',
      priority: 'high',
      module: 'web',
      evidence: ['ctaPrimary assente nel modulo Web'],
    });
  }

  if (input.web.available && !hasTrust) {
    gaps.push({
      key: 'trust_missing',
      title: 'Trust e prova sociale insufficienti',
      summary: 'Mancano elementi di fiducia visibili nella pagina, con rischio di conversione più debole.',
      category: 'trust',
      priority: 'medium',
      module: 'web',
      evidence: ['trustElements vuoto'],
    });
  }

  if (!hasTrackingSignal) {
    gaps.push({
      key: 'tracking_unclear',
      title: 'Tracking non esplicito',
      summary: 'Non emerge un segnale chiaro di tracking o misurazione conversioni nei dati disponibili.',
      category: 'tracking',
      priority: 'high',
      module: 'analytics',
      evidence: ['technicalAspects e marketingAcquisition senza tracking esplicito'],
    });
  }

  if (input.ads.available && !hasLandingForAds) {
    gaps.push({
      key: 'landing_ads_mismatch',
      title: 'Coerenza landing/ads debole',
      summary: 'Il progetto usa Ads ma non ha ancora una landing dedicata o un output Web consolidato.',
      category: 'landing',
      priority: 'high',
      module: 'ads',
      evidence: ['Ads disponibile', 'landing dedicata non consolidata'],
    });
  }

  if (metaActive && (input.ads.meta.creativeAnglesCount === 0 || input.ads.meta.assetRequestsCount === 0)) {
    gaps.push({
      key: 'creative_assets_missing',
      title: 'Asset e angoli creativi insufficienti',
      summary: 'Meta Ads richiede creatività e asset dedicati che al momento non risultano abbastanza preparati.',
      category: 'creative',
      priority: 'medium',
      module: 'ads',
      evidence: [
        input.ads.meta.creativeAnglesCount > 0 ? '' : 'creativeAngles assenti',
        input.ads.meta.assetRequestsCount > 0 ? '' : 'assetRequests assenti',
      ].filter(Boolean),
    });
  }

  if (!input.web.available) {
    gaps.push({
      key: 'web_not_generated',
      title: 'Modulo Web non generato',
      summary: 'Manca ancora un output Web utile per validare struttura, CTA e trust.',
      category: 'web',
      priority: input.ads.available ? 'high' : 'medium',
      module: 'web',
      evidence: ['webJson non consolidato'],
    });
  }

  if (!input.ads.available && ['google_ads', 'meta_ads', 'google_meta_ads', 'local_ads'].includes(input.projectType?.key || '')) {
    gaps.push({
      key: 'ads_not_generated',
      title: 'Modulo Ads non generato',
      summary: 'Il progetto è orientato a campagne ma manca ancora un output Ads strutturato.',
      category: 'ads',
      priority: 'high',
      module: 'ads',
      evidence: ['adsJson non consolidato'],
    });
  }

  if (input.report.reportStatus !== 'ready' || input.alerts.some((entry) => entry.severity === 'critical')) {
    gaps.push({
      key: 'project_readiness_low',
      title: 'Readiness complessiva da consolidare',
      summary: 'Il progetto non è ancora in stato stabile: moduli parziali o alert critici mantengono alta l’incertezza operativa.',
      category: 'readiness',
      priority: input.alerts.some((entry) => entry.severity === 'critical') ? 'urgent' : 'medium',
      module: 'project',
      evidence: [
        `reportStatus=${input.report.reportStatus}`,
        input.alerts.some((entry) => entry.severity === 'critical') ? 'alert critici aperti' : '',
      ].filter(Boolean),
    });
  }

  return gaps;
};

const buildCriticalFindings = (gaps: AgencyDiagnosisIssue[]) => (
  gaps
    .filter((entry) => ['urgent', 'high'].includes(entry.priority))
    .slice(0, 5)
);

const buildProbableCauses = (gaps: AgencyDiagnosisIssue[]): AgencyDiagnosisIssue[] => {
  const causes: AgencyDiagnosisIssue[] = [];

  gaps.forEach((gap) => {
    if (gap.key === 'offer_not_clear') {
      causes.push({
        key: 'cause_positioning_blur',
        title: 'Probabile posizionamento poco leggibile',
        summary: 'Senza un’offerta esplicita il progetto rischia messaggi generici e minore differenziazione.',
        category: 'offer',
        priority: 'high',
        module: 'strategy',
        evidence: gap.evidence,
        linkedFindingKey: gap.key,
      });
    }

    if (gap.key === 'landing_ads_mismatch') {
      causes.push({
        key: 'cause_funnel_mismatch',
        title: 'Probabile incoerenza funnel annuncio-pagina',
        summary: 'Campagne senza landing dedicata tendono a ridurre coerenza di messaggio e conversione.',
        category: 'landing',
        priority: 'high',
        module: 'ads',
        evidence: gap.evidence,
        linkedFindingKey: gap.key,
      });
    }

    if (gap.key === 'cta_missing') {
      causes.push({
        key: 'cause_conversion_friction',
        title: 'Probabile frizione di conversione',
        summary: 'Una CTA assente o debole riduce la chiarezza dell’azione richiesta all’utente.',
        category: 'cta',
        priority: 'high',
        module: 'web',
        evidence: gap.evidence,
        linkedFindingKey: gap.key,
      });
    }

    if (gap.key === 'tracking_unclear') {
      causes.push({
        key: 'cause_measurement_gap',
        title: 'Probabile impossibilità di misurazione affidabile',
        summary: 'Senza tracking esplicito diventa difficile collegare attività e risultato.',
        category: 'tracking',
        priority: 'high',
        module: 'analytics',
        evidence: gap.evidence,
        linkedFindingKey: gap.key,
      });
    }

    if (gap.key === 'discovery_incomplete') {
      causes.push({
        key: 'cause_strategy_weak',
        title: 'Probabile debolezza strategica di base',
        summary: 'Discovery incompleta porta facilmente a copy generico e priorità poco allineate.',
        category: 'discovery',
        priority: 'high',
        module: 'strategy',
        evidence: gap.evidence,
        linkedFindingKey: gap.key,
      });
    }

    if (gap.key === 'creative_assets_missing') {
      causes.push({
        key: 'cause_creative_readiness_low',
        title: 'Probabile debolezza creativa del canale Meta',
        summary: 'Meta senza asset e angoli creativi chiari tende a partire con messaggi poco competitivi.',
        category: 'creative',
        priority: 'medium',
        module: 'ads',
        evidence: gap.evidence,
        linkedFindingKey: gap.key,
      });
    }

    if (gap.key === 'trust_missing') {
      causes.push({
        key: 'cause_low_trust_perception',
        title: 'Probabile percezione di affidabilita debole',
        summary: 'L’assenza di trust element rende piu difficile trasformare interesse in contatto o richiesta.',
        category: 'trust',
        priority: 'medium',
        module: 'web',
        evidence: gap.evidence,
        linkedFindingKey: gap.key,
      });
    }

    if (gap.key === 'web_not_generated') {
      causes.push({
        key: 'cause_web_validation_missing',
        title: 'Probabile mancanza di validazione della pagina',
        summary: 'Senza un output Web il team non puo verificare CTA, struttura e coerenza di conversione.',
        category: 'web',
        priority: gap.priority,
        module: 'web',
        evidence: gap.evidence,
        linkedFindingKey: gap.key,
      });
    }

    if (gap.key === 'ads_not_generated') {
      causes.push({
        key: 'cause_ads_readiness_missing',
        title: 'Probabile readiness campagne insufficiente',
        summary: 'Manca ancora una base Ads strutturata per definire targeting, messaggio e checklist di lancio.',
        category: 'ads',
        priority: gap.priority,
        module: 'ads',
        evidence: gap.evidence,
        linkedFindingKey: gap.key,
      });
    }
  });

  return causes.slice(0, 6);
};

const buildRecommendedActions = (gaps: AgencyDiagnosisIssue[]): AgencyDiagnosisIssue[] => {
  const actions: AgencyDiagnosisIssue[] = [];

  gaps.forEach((gap) => {
    if (gap.key === 'discovery_incomplete') {
      actions.push({
        key: 'action_complete_discovery',
        title: 'Completare Discovery con obiettivo, target e offerta',
        summary: 'Chiudere le sezioni mancanti del brief prima di raffinare copy, Web o Ads.',
        category: 'discovery',
        priority: 'high',
        module: 'discovery',
        evidence: gap.evidence,
      });
    }
    if (gap.key === 'offer_not_clear') {
      actions.push({
        key: 'action_clarify_offer',
        title: 'Chiarire offerta e value proposition nei moduli attivi',
        summary: 'Rendere esplicita l�offerta principale prima di ottimizzare pagina, annunci o reporting.',
        category: 'offer',
        priority: 'high',
        module: 'strategy',
        evidence: gap.evidence,
      });
    }
    if (gap.key === 'landing_ads_mismatch') {
      actions.push({
        key: 'action_complete_landing',
        title: 'Completare landing dedicata prima del lancio Ads',
        summary: 'Allineare struttura pagina e messaggio campagna prima della messa online.',
        category: 'landing',
        priority: 'high',
        module: 'web',
        evidence: gap.evidence,
      });
    }
    if (gap.key === 'cta_missing') {
      actions.push({
        key: 'action_strengthen_cta',
        title: 'Rafforzare CTA primaria nel modulo Web',
        summary: 'Definire un invito all�azione netto e coerente con l�obiettivo del progetto.',
        category: 'cta',
        priority: 'high',
        module: 'web',
        evidence: gap.evidence,
      });
    }
    if (gap.key === 'trust_missing') {
      actions.push({
        key: 'action_add_trust',
        title: 'Integrare prova sociale nella pagina',
        summary: 'Aggiungere trust element, risultati o proof per ridurre l�incertezza.',
        category: 'trust',
        priority: 'medium',
        module: 'web',
        evidence: gap.evidence,
      });
    }
    if (gap.key === 'tracking_unclear') {
      actions.push({
        key: 'action_define_tracking',
        title: 'Esplicitare tracking nel brief tecnico e nel setup',
        summary: 'Formalizzare eventi, conversioni e proprieta da misurare.',
        category: 'tracking',
        priority: 'high',
        module: 'analytics',
        evidence: gap.evidence,
      });
    }
    if (gap.key === 'creative_assets_missing') {
      actions.push({
        key: 'action_prepare_meta_assets',
        title: 'Preparare asset creativi e angoli per Meta',
        summary: 'Chiudere il pacchetto creativita minimo prima del lancio.',
        category: 'creative',
        priority: 'medium',
        module: 'ads',
        evidence: gap.evidence,
      });
    }
    if (gap.key === 'web_not_generated') {
      actions.push({
        key: 'action_generate_web_module',
        title: 'Generare modulo Web per validare struttura e CTA',
        summary: 'Produrre almeno la prima versione Web prima di considerare il progetto pronto.',
        category: 'web',
        priority: gap.priority,
        module: 'web',
        evidence: gap.evidence,
      });
    }
    if (gap.key === 'ads_not_generated') {
      actions.push({
        key: 'action_generate_ads_module',
        title: 'Generare modulo Ads con struttura e checklist base',
        summary: 'Preparare il modulo Ads prima di avviare attivita di lancio o revisione creativa.',
        category: 'ads',
        priority: gap.priority,
        module: 'ads',
        evidence: gap.evidence,
      });
    }
  });

  const unique = new Map<string, AgencyDiagnosisIssue>();
  actions.forEach((entry) => {
    if (!unique.has(entry.key)) {
      unique.set(entry.key, entry);
    }
  });

  return Array.from(unique.values()).slice(0, 6);
};

const buildConfidenceLevel = (input: AgencyDiagnosisInput) => {
  const values = [
    input.dataSourceSummary.hasDiscovery,
    input.dataSourceSummary.hasWeb,
    input.dataSourceSummary.hasAds,
    input.dataSourceSummary.hasReport,
    input.dataSourceSummary.hasAlerts,
    input.dataSourceSummary.hasOpportunities,
    input.dataSourceSummary.hasTasks,
  ];
  const score = values.filter(Boolean).length;

  if (score >= 6) {
    return 'high';
  }
  if (score >= 4) {
    return 'medium';
  }
  return 'low';
};

const buildDiagnosisSummary = (
  input: AgencyDiagnosisInput,
  gaps: AgencyDiagnosisIssue[],
  criticalFindings: AgencyDiagnosisIssue[],
) => {
  if (criticalFindings.length > 0) {
    return `La diagnosis evidenzia ${criticalFindings.length} criticita prioritarie, con focus su ${criticalFindings[0].category}.`;
  }

  if (gaps.length > 0) {
    return `La diagnosis rileva ${gaps.length} gap operativi da consolidare prima di considerare il progetto stabile.`;
  }

  return `Il progetto ${input.projectName || input.projectId} non mostra gap critici evidenti sui moduli attualmente disponibili.`;
};

export const buildAgencyDiagnosisSnapshot = (input: AgencyDiagnosisInput): AgencyDiagnosisOutput => {
  const gapAnalysis = buildGapAnalysis(input);
  const criticalFindings = buildCriticalFindings(gapAnalysis);
  const probableCauses = buildProbableCauses(gapAnalysis);
  const recommendedActions = buildRecommendedActions(gapAnalysis);
  const confidenceLevel = buildConfidenceLevel(input);
  const interventionPriority = maxPriority([
    ...criticalFindings.map((entry) => entry.priority),
    ...recommendedActions.map((entry) => entry.priority),
  ]);
  const diagnosisStatus = confidenceLevel === 'low'
    ? 'draft'
    : criticalFindings.length > 0
      ? 'needs_review'
      : 'ready';
  const evaluatedAt = new Date().toISOString();

  return {
    projectId: input.projectId,
    diagnosisStatus,
    evaluatedAt,
    diagnosisSummary: buildDiagnosisSummary(input, gapAnalysis, criticalFindings),
    criticalFindings,
    probableCauses,
    gapAnalysis,
    recommendedActions,
    interventionPriority,
    confidenceLevel,
    sourceSummary: input.dataSourceSummary,
    moduleSignals: buildModuleSignals(input),
  };
};

const normalizeIssueList = (value: unknown): AgencyDiagnosisIssue[] => {
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
        key: normalizeString(candidate.key, title.toLowerCase().replace(/\s+/g, '_')),
        title,
        summary: normalizeString(candidate.summary),
        category: normalizeString(candidate.category),
        priority: normalizeString(candidate.priority, 'medium'),
        module: normalizeString(candidate.module),
        evidence: normalizeStringArray(candidate.evidence),
        linkedFindingKey: normalizeString(candidate.linkedFindingKey),
      };
    })
    .filter((entry): entry is AgencyDiagnosisIssue => entry !== null);
};

const normalizeModuleSignals = (value: unknown): AgencyDiagnosisOutput['moduleSignals'] => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<AgencyDiagnosisOutput['moduleSignals']>((accumulator, [key, entry]) => {
    if (!entry || typeof entry !== 'object') {
      return accumulator;
    }

    const candidate = entry as Record<string, unknown>;
    accumulator[key] = {
      status: normalizeString(candidate.status, 'missing'),
      summary: normalizeString(candidate.summary),
    };
    return accumulator;
  }, {});
};

export const normalizeAgencyDiagnosisOutputFromJson = (
  value: unknown,
  fallback: AgencyDiagnosisOutput,
): AgencyDiagnosisOutput => {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const candidate = value as Record<string, unknown>;
  const sourceSummaryCandidate = candidate.sourceSummary && typeof candidate.sourceSummary === 'object'
    ? candidate.sourceSummary as Record<string, unknown>
    : {};

  return {
    ...fallback,
    diagnosisStatus: normalizeString(candidate.diagnosisStatus, fallback.diagnosisStatus),
    evaluatedAt: normalizeString(candidate.evaluatedAt) || fallback.evaluatedAt,
    diagnosisSummary: normalizeString(candidate.diagnosisSummary, fallback.diagnosisSummary),
    criticalFindings: normalizeIssueList(candidate.criticalFindings),
    probableCauses: normalizeIssueList(candidate.probableCauses),
    gapAnalysis: normalizeIssueList(candidate.gapAnalysis),
    recommendedActions: normalizeIssueList(candidate.recommendedActions),
    interventionPriority: normalizeString(candidate.interventionPriority, fallback.interventionPriority),
    confidenceLevel: normalizeString(candidate.confidenceLevel, fallback.confidenceLevel),
    sourceSummary: {
      dominantSource: normalizeString(sourceSummaryCandidate.dominantSource, fallback.sourceSummary.dominantSource) as AgencyDiagnosisInput['dataSourceSummary']['dominantSource'],
      hasDiscovery: Boolean(sourceSummaryCandidate.hasDiscovery),
      hasWeb: Boolean(sourceSummaryCandidate.hasWeb),
      hasAds: Boolean(sourceSummaryCandidate.hasAds),
      hasReport: Boolean(sourceSummaryCandidate.hasReport),
      hasAlerts: Boolean(sourceSummaryCandidate.hasAlerts),
      hasOpportunities: Boolean(sourceSummaryCandidate.hasOpportunities),
      hasTasks: Boolean(sourceSummaryCandidate.hasTasks),
    },
    moduleSignals: normalizeModuleSignals(candidate.moduleSignals),
  };
};


