import type {
  AgencyPriority,
  ProjectOpportunityStatus,
} from '@prisma/client';

export type AgencyOpportunityInput = {
  projectId: string;
  workspaceId: string;
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
    lastUpdatedAt: string | null;
  };
  contextSummary: string;
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
    previewAvailable: boolean;
    lastGeneratedAt: string | null;
  };
  ads: {
    available: boolean;
    channelScope: 'google' | 'meta' | 'both' | 'none';
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
  alerts: Array<{
    title: string;
    severity: string;
    status: string;
    origin: string;
  }>;
  tasks: Array<{
    title: string;
    teamRole: string;
    priority: string;
    status: string;
    sourceType: string;
  }>;
  dataCompleteness: {
    hasProjectType: boolean;
    hasDiscovery: boolean;
    hasOffer: boolean;
    hasTarget: boolean;
    hasContextSummary: boolean;
    hasWebOutput: boolean;
    hasAdsOutput: boolean;
    hasAlerts: boolean;
    hasTasks: boolean;
  };
};

export type AgencyOpportunityRecordInput = {
  title: string;
  stage: string;
  estimatedValue: number;
  status: ProjectOpportunityStatus;
  category?: string | null;
  type?: string | null;
  rationale?: string | null;
  priority?: AgencyPriority | null;
  score?: number | null;
  impactLevel?: AgencyPriority | null;
  sourceModule?: string | null;
  sourceSignalKey?: string | null;
  dedupKey?: string | null;
  suggestedService?: string | null;
  lastEvaluatedAt?: Date | null;
};

const ADS_PROJECT_TYPES = new Set([
  'google_ads',
  'meta_ads',
  'google_meta_ads',
  'local_ads',
]);

const WEBSITE_PROJECT_TYPES = new Set([
  'website',
  'landing_page',
  'marketing_full',
  'ecommerce',
]);

const getPurchasedFlag = (
  scopePurchased: AgencyOpportunityInput['scopePurchased'],
  key: string,
) => scopePurchased.some((entry) => entry.key === key && entry.purchased);

const normalizeTitleKey = (value: string) => value.trim().toLowerCase();
const normalizeDedupKey = (value: string | null | undefined) => value?.trim().toLowerCase() || '';

const resolveOpportunityKey = (item: AgencyOpportunityRecordInput) => (
  normalizeDedupKey(item.dedupKey) || normalizeTitleKey(item.title)
);

const mergeOpportunityRecords = (
  current: AgencyOpportunityRecordInput,
  incoming: AgencyOpportunityRecordInput,
) => {
  const currentScore = current.score ?? 0;
  const incomingScore = incoming.score ?? 0;
  const winner = incomingScore > currentScore ? incoming : current;
  const loser = winner === current ? incoming : current;
  const mergedSourceModule = current.sourceModule && incoming.sourceModule && current.sourceModule !== incoming.sourceModule
    ? 'cross_module'
    : winner.sourceModule ?? loser.sourceModule ?? null;
  const mergedRationale = winner.rationale?.trim()
    ? (
        loser.rationale?.trim() && loser.rationale?.trim() !== winner.rationale?.trim() && mergedSourceModule === 'cross_module'
          ? `${winner.rationale?.trim()} Segnale confermato anche da un altro modulo del workspace.`
          : winner.rationale?.trim()
      )
    : loser.rationale?.trim() || null;

  return {
    ...winner,
    estimatedValue: Math.max(current.estimatedValue, incoming.estimatedValue),
    rationale: mergedRationale,
    sourceModule: mergedSourceModule,
    suggestedService: winner.suggestedService ?? loser.suggestedService ?? null,
    lastEvaluatedAt: winner.lastEvaluatedAt ?? loser.lastEvaluatedAt ?? null,
  } satisfies AgencyOpportunityRecordInput;
};

const dedupeOpportunityRecords = (items: AgencyOpportunityRecordInput[]) => {
  const byKey = new Map<string, AgencyOpportunityRecordInput>();

  for (const item of items) {
    const key = resolveOpportunityKey(item);
    if (!key) {
      continue;
    }

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }

    byKey.set(key, mergeOpportunityRecords(existing, item));
  }

  return Array.from(byKey.values());
};

const createOpportunity = (input: {
  title: string;
  stage: string;
  estimatedValue: number;
  status?: ProjectOpportunityStatus;
  category: string;
  type: string;
  priority: AgencyPriority;
  score: number;
  impactLevel: AgencyPriority;
  sourceModule: string;
  sourceSignalKey: string;
  dedupKey: string;
  rationale: string;
  suggestedService?: string | null;
}): AgencyOpportunityRecordInput => ({
  title: input.title,
  stage: input.stage,
  estimatedValue: input.estimatedValue,
  status: input.status ?? 'SUGGESTED',
  category: input.category,
  type: input.type,
  rationale: input.rationale,
  priority: input.priority,
  score: input.score,
  impactLevel: input.impactLevel,
  sourceModule: input.sourceModule,
  sourceSignalKey: input.sourceSignalKey,
  dedupKey: input.dedupKey,
  suggestedService: input.suggestedService ?? null,
  lastEvaluatedAt: new Date(),
});

export const evaluateAgencyOpportunities = (
  input: AgencyOpportunityInput,
): AgencyOpportunityRecordInput[] => {
  const opportunities: AgencyOpportunityRecordInput[] = [];
  const projectTypeKey = input.projectType?.key ?? 'marketing_full';
  const hasLanding = getPurchasedFlag(input.scopePurchased, 'landing');
  const hasSeo = getPurchasedFlag(input.scopePurchased, 'seo');
  const hasTracking = getPurchasedFlag(input.scopePurchased, 'tracking');
  const technicalAspectsLower = input.discovery.sections.technicalAspects.toLowerCase();
  const hasWebOutputSignal = input.web.available
    && (input.web.sectionPlanCount > 0 || input.web.pageGoal.trim().length > 0 || input.web.previewAvailable);
  const hasTrustElements = input.web.trustElements.some((entry) => entry.trim().length > 0);
  const hasClearCta = input.web.ctaPrimary.trim().length >= 6;
  const hasAdsOutputSignal = input.ads.available
    && (
      input.ads.google.keywordSeedsCount > 0
      || input.ads.meta.primaryTextsCount > 0
      || input.ads.meta.assetRequestsCount > 0
    );
  const hasMetaAngles = input.ads.meta.creativeAnglesCount >= 2;
  const hasMetaAssets = input.ads.meta.assetRequestsCount > 0;
  const hasGoogleOfferAngle = input.ads.offerAngle.trim().length >= 6;

  if (ADS_PROJECT_TYPES.has(projectTypeKey) && !hasLanding) {
    opportunities.push(createOpportunity({
      title: 'Landing dedicata consigliata',
      stage: 'Identificata',
      estimatedValue: 1600,
      category: 'landing',
      type: 'critical',
      priority: 'HIGH',
      score: 88,
      impactLevel: 'HIGH',
      sourceModule: 'cross_module',
      sourceSignalKey: 'missing_dedicated_landing',
      dedupKey: 'landing:missing_dedicated_landing',
      rationale: 'Il progetto e orientato ad Ads ma non emerge una landing dedicata. Allineare annuncio e pagina riduce dispersione e aumenta la probabilita di conversione, quindi la priorita resta alta.',
      suggestedService: 'landing',
    }));
  }

  if (WEBSITE_PROJECT_TYPES.has(projectTypeKey) && !hasSeo) {
    opportunities.push(createOpportunity({
      title: 'Pacchetto SEO consigliato per il progetto web',
      stage: 'Proposta',
      estimatedValue: 1400,
      category: 'seo',
      type: 'strategic',
      priority: 'MEDIUM',
      score: 63,
      impactLevel: 'MEDIUM',
      sourceModule: 'web',
      sourceSignalKey: 'seo_module_missing',
      dedupKey: 'seo:seo_module_missing',
      rationale: 'Il progetto ha una componente web ma non risulta un presidio SEO dedicato. Questo limita la crescita organica nel medio periodo, quindi l opportunita resta strategica ma non urgente.',
      suggestedService: 'seo',
    }));
  }

  if (!hasTracking) {
    opportunities.push(createOpportunity({
      title: 'Setup tracking conversioni consigliato',
      stage: 'Identificata',
      estimatedValue: 900,
      category: 'tracking',
      type: 'critical',
      priority: 'HIGH',
      score: 84,
      impactLevel: 'HIGH',
      sourceModule: 'cross_module',
      sourceSignalKey: 'tracking_missing',
      dedupKey: 'tracking:missing_tracking_signal',
      rationale: 'Non emergono segnali affidabili di tracking tra scope e brief tecnico. Senza misurazione corretta diventa difficile attribuire risultati e ottimizzare campagne o pagine, quindi la priorita e alta.',
      suggestedService: 'tracking',
    }));
  }

  if (hasWebOutputSignal && !hasTrustElements) {
    opportunities.push(createOpportunity({
      title: 'Integrare prova sociale nella pagina Web',
      stage: 'Identificata',
      estimatedValue: 700,
      category: 'copy',
      type: 'improvement',
      priority: 'MEDIUM',
      score: 61,
      impactLevel: 'MEDIUM',
      sourceModule: 'web',
      sourceSignalKey: 'missing_trust_elements',
      dedupKey: 'copy:missing_trust_elements',
      rationale: 'L output Web mostra struttura di pagina ma non segnali chiari di prova sociale. Questo indebolisce fiducia e conversione, quindi l intervento e utile ma meno critico di landing e tracking.',
      suggestedService: 'copy',
    }));
  }

  if (hasWebOutputSignal && !hasClearCta) {
    opportunities.push(createOpportunity({
      title: 'Definire CTA primaria chiara per la pagina',
      stage: 'Identificata',
      estimatedValue: 600,
      category: 'copy',
      type: 'improvement',
      priority: 'HIGH',
      score: 72,
      impactLevel: 'MEDIUM',
      sourceModule: 'web',
      sourceSignalKey: 'cta_not_clear',
      dedupKey: 'copy:cta_not_clear',
      rationale: 'La pagina ha contenuto ma non una CTA primaria abbastanza chiara. Se l azione richiesta non e esplicita, il traffico converte peggio, quindi il miglioramento ha priorita medio alta.',
      suggestedService: 'copy',
    }));
  }

  if (WEBSITE_PROJECT_TYPES.has(projectTypeKey) && !hasTracking && !technicalAspectsLower.includes('tracking')) {
    opportunities.push(createOpportunity({
      title: 'Tracking web da esplicitare nel brief tecnico',
      stage: 'Proposta',
      estimatedValue: 950,
      category: 'tracking',
      type: 'improvement',
      priority: 'MEDIUM',
      score: 66,
      impactLevel: 'MEDIUM',
      sourceModule: 'discovery',
      sourceSignalKey: 'tracking_not_explicit_in_brief',
      dedupKey: 'tracking:missing_tracking_signal',
      rationale: 'Nel brief tecnico non compare un piano chiaro di tracking. Il rischio e arrivare in produzione con misurazione incompleta, quindi l opportunita conferma un gap gia rilevato sul tracciamento.',
      suggestedService: 'tracking',
    }));
  }

  if (input.discovery.sections.marketingAcquisition.toLowerCase().includes('meta') && !hasLanding) {
    opportunities.push(createOpportunity({
      title: 'Sprint creativo Meta + landing dedicata',
      stage: 'In valutazione',
      estimatedValue: 1800,
      category: 'landing',
      type: 'commercial',
      priority: 'HIGH',
      score: 83,
      impactLevel: 'HIGH',
      sourceModule: 'ads',
      sourceSignalKey: 'meta_flow_needs_landing',
      dedupKey: 'landing:missing_dedicated_landing',
      rationale: 'La discovery indica un flusso Meta ma non una landing dedicata. Per campagne paid la coerenza tra creative, promessa e pagina e decisiva, quindi il segnale viene trattato come commerciale ad alta priorita.',
      suggestedService: 'landing',
    }));
  }

  if (hasAdsOutputSignal && (projectTypeKey === 'meta_ads' || projectTypeKey === 'google_meta_ads') && !hasMetaAngles) {
    opportunities.push(createOpportunity({
      title: 'Definire angoli creativi piu forti per Meta Ads',
      stage: 'Identificata',
      estimatedValue: 850,
      category: 'creative',
      type: 'improvement',
      priority: 'MEDIUM',
      score: 69,
      impactLevel: 'MEDIUM',
      sourceModule: 'ads',
      sourceSignalKey: 'meta_creative_angles_weak',
      dedupKey: 'creative:meta_creative_angles_weak',
      rationale: 'L output Ads non mostra abbastanza angoli creativi distinti per Meta. Con pochi test creativi il canale scala peggio, quindi l opportunita e concreta ma non critica quanto landing o tracking.',
      suggestedService: 'creative',
    }));
  }

  if (hasAdsOutputSignal && (projectTypeKey === 'meta_ads' || projectTypeKey === 'google_meta_ads') && !hasMetaAssets) {
    opportunities.push(createOpportunity({
      title: 'Preparare asset visual dedicati per Meta Ads',
      stage: 'Identificata',
      estimatedValue: 1100,
      category: 'creative',
      type: 'commercial',
      priority: 'HIGH',
      score: 76,
      impactLevel: 'HIGH',
      sourceModule: 'ads',
      sourceSignalKey: 'meta_assets_missing',
      dedupKey: 'creative:meta_assets_missing',
      rationale: 'Meta Ads risulta attivo ma mancano asset visual dedicati. Senza creativita pronte il lancio rallenta o parte debole, quindi la priorita sale e l impatto resta alto.',
      suggestedService: 'creative',
    }));
  }

  if (hasAdsOutputSignal && (projectTypeKey === 'google_ads' || projectTypeKey === 'google_meta_ads' || projectTypeKey === 'local_ads') && !hasGoogleOfferAngle) {
    opportunities.push(createOpportunity({
      title: 'Chiarire offerta principale per campagne Search',
      stage: 'Identificata',
      estimatedValue: 750,
      category: 'offer',
      type: 'improvement',
      priority: 'MEDIUM',
      score: 67,
      impactLevel: 'MEDIUM',
      sourceModule: 'ads',
      sourceSignalKey: 'search_offer_unclear',
      dedupKey: 'offer:search_offer_unclear',
      rationale: 'Per campagne Search o Local l offerta principale non emerge con sufficiente chiarezza. Se la promessa non e netta, CTR e qualita lead ne risentono, quindi serve un affinamento prima della scala.',
      suggestedService: 'offer_refinement',
    }));
  }

  if (opportunities.length === 0) {
    opportunities.push(createOpportunity({
      title: 'Sprint CRO su pagine ad alto traffico',
      stage: 'Proposta',
      estimatedValue: 1300,
      category: 'copy',
      type: 'strategic',
      priority: 'MEDIUM',
      score: 52,
      impactLevel: 'MEDIUM',
      sourceModule: 'overview',
      sourceSignalKey: 'cro_general_review',
      dedupKey: 'copy:cro_general_review',
      rationale: 'Non emergono gap critici specifici, ma resta spazio per ottimizzare messaggio e conversione sulle pagine a traffico alto. E un opportunita strategica di miglioramento continuo.',
      suggestedService: 'cro',
    }));
  }

  return dedupeOpportunityRecords(opportunities)
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
};
