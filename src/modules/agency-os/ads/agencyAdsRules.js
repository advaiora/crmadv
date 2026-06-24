const DEFAULT_NEGATIVE_SEEDS = [
  "gratis",
  "download",
  "template",
  "corso",
  "stipendio",
  "lavoro",
];

const SEARCH_FOCUSED_PROJECTS = new Set([
  "google_ads",
  "google_meta_ads",
  "local_ads",
  "landing_page",
]);

const ECOMMERCE_PROJECTS = new Set([
  "ecommerce",
]);

const normalizeText = (value) => (
  typeof value === "string" ? value.trim() : ""
);

const tokenize = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    return [];
  }

  return normalized
    .replace(/[^a-z0-9\s]/gi, " ")
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 3);
};

const uniqueStrings = (items, maxItems = 12) => {
  const seen = new Set();
  const output = [];

  items.forEach((item) => {
    const normalized = normalizeText(item);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key) || output.length >= maxItems) {
      return;
    }

    seen.add(key);
    output.push(normalized);
  });

  return output;
};

const getPurchasedFlag = (scopePurchased, key) => (
  Array.isArray(scopePurchased) && scopePurchased.some((entry) => entry?.key === key && entry?.purchased)
);

const getCampaignType = (projectTypeKey, scopePurchased) => {
  if (ECOMMERCE_PROJECTS.has(projectTypeKey) || getPurchasedFlag(scopePurchased, "ecommerce")) {
    return "Performance Max Ecommerce";
  }

  if (projectTypeKey === "local_ads") {
    return "Search Local Lead Gen";
  }

  if (SEARCH_FOCUSED_PROJECTS.has(projectTypeKey) || getPurchasedFlag(scopePurchased, "google_ads")) {
    return "Search Lead Gen";
  }

  return "Search + Remarketing";
};

const getCampaignStructure = ({ projectTypeKey, offerSummary, targetSummary, web }) => {
  const base = [
    "Campagna brand/protezione query esistenti",
    `Campagna offerta principale: ${offerSummary || "offerta core"}`,
    `Campagna problema/intent: ${targetSummary || "target prioritario"}`,
  ];

  if (projectTypeKey === "local_ads") {
    base.push("Campagna geolocalizzata area servizi");
  }

  if (web?.available) {
    base.push(`Campagna supporto landing ${web.pageType || "dedicata"}`);
  }

  if (projectTypeKey === "google_meta_ads") {
    base.push("Campagna prospecting coordinata con Meta");
  }

  return uniqueStrings(base, 6);
};

const buildKeywordSeeds = ({ offerSummary, targetSummary, discovery, web }) => {
  const offerTokens = tokenize(offerSummary || discovery?.offer);
  const targetTokens = tokenize(targetSummary || discovery?.target);
  const valuePropTokens = tokenize(web?.valueProp);
  const offerBase = normalizeText(offerSummary || discovery?.offer || "servizio");
  const targetBase = normalizeText(targetSummary || discovery?.target || "target");

  return uniqueStrings([
    offerBase,
    `${offerBase} prezzo`,
    `${offerBase} consulenza`,
    `${offerBase} gestione`,
    `${targetBase} ${offerBase}`.trim(),
    ...offerTokens.slice(0, 4).map((entry) => `${entry} servizi`),
    ...targetTokens.slice(0, 4).map((entry) => `${entry} consulenza`),
    ...valuePropTokens.slice(0, 3).map((entry) => `${entry} agency`),
  ], 14);
};

const buildAdGroups = ({ projectTypeKey, offerSummary, targetSummary, keywordSeeds }) => {
  const offerBase = normalizeText(offerSummary || "offerta");
  const targetBase = normalizeText(targetSummary || "target");
  const adGroups = [
    {
      name: "Brand e offerta",
      intent: `Intercettare ricerche dirette su ${offerBase}.`,
      keywords: keywordSeeds.slice(0, 4),
    },
    {
      name: "Problema e soluzione",
      intent: `Intercettare utenti con bisogno attivo nel target ${targetBase}.`,
      keywords: keywordSeeds.slice(2, 7),
    },
  ];

  if (projectTypeKey === "local_ads") {
    adGroups.push({
      name: "Local intent",
      intent: "Catturare domanda locale geolocalizzata con CTA diretta.",
      keywords: uniqueStrings(keywordSeeds.map((entry) => `${entry} vicino a me`), 4),
    });
  }

  if (projectTypeKey === "google_meta_ads") {
    adGroups.push({
      name: "Remarketing warm traffic",
      intent: "Riattivare utenti gia esposti a traffico e contenuti Meta.",
      keywords: uniqueStrings(keywordSeeds.slice(0, 4).map((entry) => `${entry} recensioni`), 4),
    });
  }

  return adGroups;
};

const buildRsaIdeas = ({ offerSummary, ctaPrimary, contextSummary, targetSummary }) => {
  const offerBase = normalizeText(offerSummary || "Soluzione dedicata");
  const cta = normalizeText(ctaPrimary || "Richiedi una consulenza");
  const targetBase = normalizeText(targetSummary || "clienti in target");

  return [
    {
      headlines: uniqueStrings([
        offerBase,
        `${offerBase} per ${targetBase}`.trim(),
        "Strategia chiara e tracciabile",
        "Riduci dispersione del budget",
        cta,
      ], 5),
      descriptions: uniqueStrings([
        `${offerBase} con messaggio chiaro, CTA netta e focus sulla conversione.`,
        `${cta}. Piano operativo costruito su obiettivi e contesto progetto.`,
      ], 2),
    },
    {
      headlines: uniqueStrings([
        "Più lead qualificati",
        "Campagne con tracking controllato",
        `${offerBase} senza sprechi`,
        "Supporto operativo al team marketing",
        targetBase,
      ], 5),
      descriptions: uniqueStrings([
        contextSummary || "Output Ads impostato con logica rule-based conservativa.",
        "Landing, offerta e CTA vengono allineate per sostenere il traffico paid.",
      ], 2),
    },
  ];
};

const buildExtensionsIdeas = ({ ctaPrimary, web }) => uniqueStrings([
  "Sitelink: servizi",
  "Sitelink: case study",
  "Callout: tracking verificato",
  "Callout: supporto operativo",
  "Snippet: moduli inclusi",
  ctaPrimary ? `Lead form: ${ctaPrimary}` : "",
  web?.available ? `Sitelink: ${web.pageType || "landing"} dedicata` : "",
], 8);

const getLandingRecommendation = ({ projectTypeKey, web }) => {
  if (web?.available && web?.pageType === "landing") {
    return "Usare la landing dedicata gia prodotta nel modulo Web come destinazione primaria.";
  }

  if (projectTypeKey === "local_ads") {
    return "Preparare una landing locale con CTA diretta, mappa, trust e tracking verificato.";
  }

  if (projectTypeKey === "ecommerce") {
    return "Inviare traffico verso pagina prodotto/categoria con checkout e tracking ben verificati.";
  }

  return "Consigliata una landing dedicata con offerta chiara, trust e CTA unica.";
};

export const buildAgencyGoogleAdsOutputV1 = ({
  projectTypeKey,
  scopePurchased,
  discovery,
  contextSummary,
  offerSummary,
  targetSummary,
  ctaPrimary,
  web,
}) => {
  const normalizedProjectTypeKey = normalizeText(projectTypeKey).toLowerCase() || "marketing_full";
  const normalizedOffer = normalizeText(offerSummary || discovery?.offer || contextSummary || "offerta da chiarire");
  const normalizedTarget = normalizeText(targetSummary || discovery?.target || contextSummary || "target da chiarire");
  const keywordSeeds = buildKeywordSeeds({
    offerSummary: normalizedOffer,
    targetSummary: normalizedTarget,
    discovery,
    web,
  });

  const adGroups = buildAdGroups({
    projectTypeKey: normalizedProjectTypeKey,
    offerSummary: normalizedOffer,
    targetSummary: normalizedTarget,
    keywordSeeds,
  });
  const campaignType = getCampaignType(normalizedProjectTypeKey, scopePurchased);
  const landingRecommendation = getLandingRecommendation({
    projectTypeKey: normalizedProjectTypeKey,
    web,
  });

  return {
    targetingSummary: normalizedTarget,
    offerAngle: normalizedOffer,
    adCopyBlocks: {
      google: uniqueStrings([
        `${normalizedOffer || "Offerta"} con CTA chiara`,
        `${normalizeText(ctaPrimary || "Richiedi una consulenza")} su landing dedicata`,
        "Focus su bisogno, trust e tracciamento",
      ], 4),
    },
    googleAds: {
      campaignType,
      campaignStructure: getCampaignStructure({
        projectTypeKey: normalizedProjectTypeKey,
        offerSummary: normalizedOffer,
        targetSummary: normalizedTarget,
        web,
      }),
      adGroups,
      keywordSeeds,
      negativeSeeds: DEFAULT_NEGATIVE_SEEDS,
      rsaIdeas: buildRsaIdeas({
        offerSummary: normalizedOffer,
        ctaPrimary,
        contextSummary,
        targetSummary: normalizedTarget,
      }),
      extensionsIdeas: buildExtensionsIdeas({
        ctaPrimary,
        web,
      }),
      landingRecommendation,
    },
  };
};

const getMetaCampaignAngle = ({ projectTypeKey, offerSummary, targetSummary }) => {
  if (projectTypeKey === "ecommerce") {
    return `Offerta prodotto e conversione rapida per ${targetSummary || "audience ad alta intenzione"}`;
  }

  if (projectTypeKey === "local_ads") {
    return `Presidio locale con promessa chiara su ${offerSummary || "servizio"} e CTA diretta`;
  }

  if (projectTypeKey === "landing_page") {
    return `Traffico freddo verso landing dedicata con messaggio focalizzato su ${offerSummary || "offerta"}`;
  }

  return `Value proposition operativa per ${targetSummary || "target"} con focus su ${offerSummary || "offerta"}`;
};

const buildAudienceIdeas = ({ projectTypeKey, targetSummary, discovery }) => {
  const targetBase = normalizeText(targetSummary || discovery?.target || "audience core");
  const audiences = [
    `Broad qualificato su ${targetBase}`,
    `Interest stack collegato a ${targetBase}`,
    "Warm audience da visite pagina e contenuti recenti",
  ];

  if (projectTypeKey === "local_ads") {
    audiences.push(`Audience locale geolocalizzata su ${targetBase}`);
  }

  if (projectTypeKey === "ecommerce") {
    audiences.push("Lookalike clienti o aggiunte al carrello");
  }

  return uniqueStrings(audiences, 6);
};

const buildCreativeAngles = ({ offerSummary, valueProp, discovery }) => uniqueStrings([
  `${offerSummary || discovery?.offer || "Offerta"} con outcome concreto`,
  valueProp || "Processo chiaro e misurabile",
  "Riduzione frizione e CTA netta",
  "Trust operativo e prova sociale",
], 6);

const buildMetaHooks = ({ offerSummary, targetSummary, ctaPrimary }) => uniqueStrings([
  `Se oggi ${targetSummary || "il target"} disperde budget, serve una proposta piu chiara.`,
  `${offerSummary || "Offerta"} con messaggio, trust e CTA allineati.`,
  normalizeText(ctaPrimary || "Richiedi una consulenza per vedere il piano operativo."),
], 6);

const buildMetaPrimaryTexts = ({ offerSummary, targetSummary, valueProp, ctaPrimary }) => {
  const offerBase = normalizeText(offerSummary || "una proposta piu chiara");
  const targetBase = normalizeText(targetSummary || "il tuo target");
  const cta = normalizeText(ctaPrimary || "Richiedi una consulenza");

  return uniqueStrings([
    `${offerBase} pensata per ${targetBase}. Messaggio diretto, CTA unica e percorso piu lineare verso la conversione. ${cta}.`,
    `${targetBase} vede tante promesse confuse. Qui il focus e su valore, prova e prossima azione concreta. ${cta}.`,
    `${offerBase} con impostazione piu leggibile per paid social: hook iniziale, beneficio chiaro e call to action finale. ${cta}.`,
  ], 4);
};

const buildMetaHeadlines = ({ offerSummary, ctaPrimary, targetSummary }) => uniqueStrings([
  offerSummary || "Offerta chiara",
  `${offerSummary || "Soluzione"} per ${targetSummary || "target"}`.trim(),
  ctaPrimary || "Prenota una call",
  "Messaggio piu chiaro, piu conversioni",
], 5);

const buildMetaAssetRequests = ({ projectTypeKey, web }) => {
  const assets = [
    "Visual quadrato 1:1 con hook iniziale",
    "Visual verticale 4:5 con CTA finale",
    "Versione statica con trust e benefit principali",
  ];

  if (projectTypeKey === "ecommerce") {
    assets.push("Creativita prodotto con focus su prezzo, beneficio e prova");
  }

  if (web?.available) {
    assets.push(`Screenshot o estratti coerenti con ${web.pageType || "landing"} esistente`);
  }

  return uniqueStrings(assets, 6);
};

export const buildAgencyMetaAdsOutputV1 = ({
  projectTypeKey,
  discovery,
  contextSummary,
  offerSummary,
  targetSummary,
  ctaPrimary,
  web,
}) => {
  const normalizedProjectTypeKey = normalizeText(projectTypeKey).toLowerCase() || "marketing_full";
  const normalizedOffer = normalizeText(offerSummary || discovery?.offer || contextSummary || "offerta da chiarire");
  const normalizedTarget = normalizeText(targetSummary || discovery?.target || contextSummary || "target da chiarire");
  const valueProp = normalizeText(web?.valueProp);
  const hooks = buildMetaHooks({
    offerSummary: normalizedOffer,
    targetSummary: normalizedTarget,
    ctaPrimary,
  });

  return {
    messageHooks: hooks,
    adCopyBlocks: {
      meta: uniqueStrings([
        `${normalizedOffer || "Offerta"} con hook iniziale forte`,
        `${normalizedTarget || "Target"} + trust + CTA`,
        "Formato paid social con beneficio, prova e azione",
      ], 4),
    },
    metaAds: {
      campaignAngle: getMetaCampaignAngle({
        projectTypeKey: normalizedProjectTypeKey,
        offerSummary: normalizedOffer,
        targetSummary: normalizedTarget,
      }),
      audienceIdeas: buildAudienceIdeas({
        projectTypeKey: normalizedProjectTypeKey,
        targetSummary: normalizedTarget,
        discovery,
      }),
      creativeAngles: buildCreativeAngles({
        offerSummary: normalizedOffer,
        valueProp,
        discovery,
      }),
      hooks,
      primaryTexts: buildMetaPrimaryTexts({
        offerSummary: normalizedOffer,
        targetSummary: normalizedTarget,
        valueProp,
        ctaPrimary,
      }),
      headlines: buildMetaHeadlines({
        offerSummary: normalizedOffer,
        ctaPrimary,
        targetSummary: normalizedTarget,
      }),
      ctaIdeas: uniqueStrings([
        ctaPrimary || "Prenota una call",
        "Richiedi la strategia",
        "Scopri il piano operativo",
      ], 4),
      assetRequests: buildMetaAssetRequests({
        projectTypeKey: normalizedProjectTypeKey,
        web,
      }),
    },
  };
};

export const buildAgencyAdsOperationalOutputV1 = ({
  channelScope,
  projectTypeKey,
  discovery,
  web,
  googleAds,
  metaAds,
  ctaPrimary,
}) => {
  const normalizedChannelScope = normalizeText(channelScope).toLowerCase() || "both";
  const needsGoogle = normalizedChannelScope === "google" || normalizedChannelScope === "both";
  const needsMeta = normalizedChannelScope === "meta" || normalizedChannelScope === "both";
  const trustCount = Array.isArray(web?.trustElements) ? web.trustElements.length : 0;
  const technicalNotes = normalizeText(discovery?.technicalAspects).toLowerCase();
  const trackingReady = technicalNotes.includes("ga4") || technicalNotes.includes("tracking") || technicalNotes.includes("pixel");
  const hasLanding = Boolean(web?.available && web?.pageType === "landing");
  const assetRequests = [];
  const checklist = [];

  const pushChecklist = (key, label, channel, status) => {
    checklist.push({
      key,
      label,
      channel,
      status,
    });
  };

  pushChecklist(
    "shared_cta",
    `CTA principale allineata: ${normalizeText(ctaPrimary || web?.ctaPrimary) || "da definire"}`,
    "shared",
    normalizeText(ctaPrimary || web?.ctaPrimary) ? "ready" : "pending",
  );
  pushChecklist(
    "shared_tracking",
    "Tracking di conversione verificato",
    "shared",
    trackingReady ? "ready" : "pending",
  );
  pushChecklist(
    "shared_trust",
    "Trust element coerenti tra Ads e landing",
    "shared",
    trustCount > 0 ? "ready" : "pending",
  );

  if (needsGoogle) {
    pushChecklist(
      "google_keywords",
      "Keyword seed e negative seed revisionate",
      "google",
      googleAds?.keywordSeeds?.length > 0 ? "ready" : "pending",
    );
    pushChecklist(
      "google_rsa",
      "RSA headline/description revisionate",
      "google",
      googleAds?.rsaIdeas?.length > 0 ? "ready" : "pending",
    );
    pushChecklist(
      "google_landing",
      "Landing o destinazione Google confermata",
      "google",
      hasLanding || normalizeText(googleAds?.landingRecommendation) ? "ready" : "pending",
    );

    assetRequests.push(
      "Confermare CTA e benefit principali sulla destinazione Google Ads",
      "Validare screenshot, proof o trust element per la landing",
    );
    if (!hasLanding && projectTypeKey !== "ecommerce") {
      assetRequests.push("Preparare landing dedicata o sezione servizio con messaggio specifico per Google Ads");
    }
  }

  if (needsMeta) {
    pushChecklist(
      "meta_hooks",
      "Hook e angle creativi approvati",
      "meta",
      metaAds?.hooks?.length > 0 ? "ready" : "pending",
    );
    pushChecklist(
      "meta_copy",
      "Primary text e headline approvati",
      "meta",
      metaAds?.primaryTexts?.length > 0 && metaAds?.headlines?.length > 0 ? "ready" : "pending",
    );
    pushChecklist(
      "meta_visual",
      "Visual statici/video richiesti al reparto grafico",
      "meta",
      metaAds?.assetRequests?.length > 0 ? "ready" : "pending",
    );

    assetRequests.push(
      "Preparare visual 1:1 e 4:5 coerenti con hook e CTA",
      "Raccogliere proof, risultati o claim verificabili per Meta Ads",
    );
    assetRequests.push(...(metaAds?.assetRequests || []));
  }

  if (!trackingReady) {
    assetRequests.push("Verificare evento conversione, form submit e parametri UTM prima del lancio");
  }

  if (trustCount === 0) {
    assetRequests.push("Recuperare almeno 1-2 elementi trust: recensioni, case study o proof sintetica");
  }

  return {
    assetRequests: uniqueStrings(assetRequests, 16),
    launchChecklist: checklist,
  };
};
