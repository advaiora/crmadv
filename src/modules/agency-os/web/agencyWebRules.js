const ADS_PROJECT_TYPES = new Set(["google_ads", "meta_ads", "google_meta_ads", "local_ads"]);
const WEBSITE_PROJECT_TYPES = new Set(["website", "marketing_full"]);
const ECOMMERCE_PROJECT_TYPES = new Set(["ecommerce"]);

const getScopeFlag = (scopePurchased, key) => {
  if (!Array.isArray(scopePurchased)) {
    return false;
  }

  const found = scopePurchased.find((entry) => entry?.key === key);
  return Boolean(found?.purchased);
};

const normalizeSection = (key, title, objective) => ({
  key,
  title,
  objective,
});

const pushIfMissing = (list, section) => {
  if (list.some((entry) => entry.key === section.key)) {
    return;
  }

  list.push(section);
};

export const buildAgencyWebSectionPlanV1 = (input) => {
  const projectTypeKey = typeof input?.projectTypeKey === "string"
    ? input.projectTypeKey
    : "marketing_full";
  const pageType = typeof input?.pageType === "string" ? input.pageType : "landing";
  const scopePurchased = Array.isArray(input?.scopePurchased) ? input.scopePurchased : [];
  const target = typeof input?.targetSummary === "string" ? input.targetSummary : "";
  const offer = typeof input?.offerSummary === "string" ? input.offerSummary : "";
  const ctaPrimary = typeof input?.ctaPrimary === "string" ? input.ctaPrimary : "";

  const sections = [];
  const isAdsProject = ADS_PROJECT_TYPES.has(projectTypeKey);
  const isWebsiteProject = WEBSITE_PROJECT_TYPES.has(projectTypeKey) || pageType === "website";
  const isEcommerceProject = ECOMMERCE_PROJECT_TYPES.has(projectTypeKey) || pageType === "ecommerce_lite";
  const landingIncluded = getScopeFlag(scopePurchased, "landing");
  const webIncluded = getScopeFlag(scopePurchased, "web");

  pushIfMissing(sections, normalizeSection(
    "hero",
    "Hero",
    `Apertura con promessa chiara${target ? ` per ${target}` : ""} e CTA primaria.`,
  ));

  if (isAdsProject) {
    pushIfMissing(sections, normalizeSection(
      "ad_message_match",
      "Messaggio Campagna -> Pagina",
      "Allineare messaggi ADV e promessa above-the-fold per migliorare conversione.",
    ));
  }

  pushIfMissing(sections, normalizeSection(
    "problem",
    "Problema",
    "Esplicitare il problema attuale e il costo di non agire.",
  ));

  pushIfMissing(sections, normalizeSection(
    "solution",
    "Soluzione",
    `Presentare l'offerta${offer ? ` (${offer})` : ""} come risposta concreta.`,
  ));

  if (isWebsiteProject && webIncluded) {
    pushIfMissing(sections, normalizeSection(
      "services_overview",
      "Panoramica Servizi",
      "Mostrare servizi principali e percorso utente verso il contatto.",
    ));
    pushIfMissing(sections, normalizeSection(
      "process",
      "Processo",
      "Descrivere step operativi per ridurre incertezza decisionale.",
    ));
  }

  if (isEcommerceProject) {
    pushIfMissing(sections, normalizeSection(
      "catalog_spotlight",
      "Highlight Prodotti",
      "Presentare categorie/prodotti principali e leve di acquisto.",
    ));
    pushIfMissing(sections, normalizeSection(
      "offer_stack",
      "Offerta e Incentivi",
      "Evidenziare promo, bundle o garanzie per accelerare la scelta.",
    ));
  }

  if (isAdsProject && !landingIncluded) {
    pushIfMissing(sections, normalizeSection(
      "landing_focus",
      "Focus Landing Dedicata",
      "Inserire modulo/CTA verticale per evitare dispersione traffico ads.",
    ));
  }

  pushIfMissing(sections, normalizeSection(
    "benefits",
    "Benefici",
    "Tradurre le caratteristiche in benefici concreti e misurabili.",
  ));

  pushIfMissing(sections, normalizeSection(
    "trust",
    "Trust / Prova Sociale",
    "Aggiungere case study, numeri, testimonianze o loghi clienti.",
  ));

  pushIfMissing(sections, normalizeSection(
    "faq",
    "FAQ",
    "Gestire obiezioni principali pre-contatto.",
  ));

  pushIfMissing(sections, normalizeSection(
    "cta_final",
    "CTA Finale",
    `Chiusura con chiamata all'azione${ctaPrimary ? `: ${ctaPrimary}` : " chiara e specifica"}.`,
  ));

  return sections;
};

const pickFirstNonEmpty = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
};

const normalizeSentence = (value, fallback) => {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  return value.trim();
};

export const buildAgencyWebCopyBlocksV1 = (input) => {
  const projectTypeKey = typeof input?.projectTypeKey === "string"
    ? input.projectTypeKey
    : "marketing_full";
  const pageGoal = pickFirstNonEmpty(input?.pageGoal, input?.discovery?.projectGoal, "Aumentare conversioni qualificate");
  const target = pickFirstNonEmpty(input?.targetSummary, input?.discovery?.target, "un target qualificato");
  const offer = pickFirstNonEmpty(input?.offerSummary, input?.discovery?.offer, "la tua offerta principale");
  const valueProp = pickFirstNonEmpty(input?.valueProp, "Approccio operativo, misurabile e orientato al risultato");
  const businessContext = pickFirstNonEmpty(input?.discovery?.businessContext, "Scenario competitivo in evoluzione");
  const primaryCta = pickFirstNonEmpty(input?.ctaPrimary, "Richiedi una consulenza");

  const isAdsProject = ADS_PROJECT_TYPES.has(projectTypeKey);
  const isEcommerceProject = ECOMMERCE_PROJECT_TYPES.has(projectTypeKey);

  const headline = isEcommerceProject
    ? `Trasforma ${target} in acquisti con ${offer}`
    : `Aiutiamo ${target} a ottenere risultati con ${offer}`;
  const subheadline = `Obiettivo: ${pageGoal}. ${valueProp}.`;
  const intro = `Partiamo da ${businessContext.toLowerCase()} e costruiamo un percorso chiaro verso la conversione.`;

  const benefits = [
    "Messaggio chiaro e orientato all'azione.",
    "Struttura pagina coerente con funnel e obiettivo.",
    isAdsProject
      ? "Allineamento tra campagne adv e contenuto della pagina."
      : "Percorso utente semplificato per ridurre frizione.",
    "CTA esplicite con prossimo passo definito.",
  ];

  const objectionHandling = isEcommerceProject
    ? "Riduciamo i dubbi con prove, garanzie e informazioni rapide su acquisto/spedizione."
    : "Riduciamo i dubbi con casi reali, processo trasparente e aspettative chiare.";

  const ctaSet = {
    primary: primaryCta,
    secondary: "Parla con il team",
    final: isEcommerceProject ? "Acquista ora" : "Prenota una call strategica",
  };

  const faqItems = [
    `In quanto tempo vedo risultati su ${pageGoal.toLowerCase()}?`,
    "Quali materiali servono per partire?",
    isAdsProject
      ? "Come integrate pagina e campagne ads?"
      : "Come gestite il progetto dopo il kickoff?",
  ];

  const trustElements = [
    "Case study o risultato cliente da aggiungere",
    "Testimonianza o prova sociale da confermare",
    "KPI principale da validare con il cliente",
  ];

  return {
    copyBlocks: {
      headline: normalizeSentence(headline, ""),
      subheadline: normalizeSentence(subheadline, ""),
      intro: normalizeSentence(intro, ""),
      benefits: benefits.map((entry) => normalizeSentence(entry, "")).filter(Boolean),
      objectionHandling: normalizeSentence(objectionHandling, ""),
    },
    ctaSet: {
      primary: normalizeSentence(ctaSet.primary, ""),
      secondary: normalizeSentence(ctaSet.secondary, ""),
      final: normalizeSentence(ctaSet.final, ""),
    },
    faqItems: faqItems.map((entry) => normalizeSentence(entry, "")).filter(Boolean),
    trustElements: trustElements.map((entry) => normalizeSentence(entry, "")).filter(Boolean),
  };
};

export const buildAgencyWebOutputV1 = (input) => {
  const sectionPlan = buildAgencyWebSectionPlanV1({
    projectTypeKey: input?.projectTypeKey,
    scopePurchased: input?.scopePurchased,
    targetSummary: input?.targetSummary,
    offerSummary: input?.offerSummary,
    ctaPrimary: input?.ctaPrimary,
    pageType: input?.pageType,
  });

  const generatedCopy = buildAgencyWebCopyBlocksV1({
    projectTypeKey: input?.projectTypeKey,
    pageGoal: input?.pageGoal,
    targetSummary: input?.targetSummary,
    offerSummary: input?.offerSummary,
    valueProp: input?.valueProp,
    ctaPrimary: input?.ctaPrimary,
    discovery: input?.discovery,
  });

  const wireframe = buildAgencyWebWireframeV1({
    sectionPlan,
    copyBlocks: generatedCopy.copyBlocks,
    ctaSet: generatedCopy.ctaSet,
  });

  const previewHtmlBase = buildAgencyWebPreviewHtmlBaseV1({
    sectionPlan,
    copyBlocks: generatedCopy.copyBlocks,
    ctaSet: generatedCopy.ctaSet,
    faqItems: generatedCopy.faqItems,
    trustElements: generatedCopy.trustElements,
  });

  return {
    sectionPlan,
    ...generatedCopy,
    wireframe,
    previewHtmlBase,
  };
};

const getSectionHeadlineForWireframe = (key, copyBlocks) => {
  if (key === "hero") {
    return copyBlocks?.headline || "Headline hero";
  }

  if (key === "benefits") {
    const firstBenefit = Array.isArray(copyBlocks?.benefits) ? copyBlocks.benefits[0] : "";
    return firstBenefit || "Beneficio principale";
  }

  if (key === "faq") {
    return "FAQ / gestione obiezioni";
  }

  if (key === "cta_final") {
    return "Call to action finale";
  }

  return "Blocco contenuto";
};

export const buildAgencyWebWireframeV1 = (input) => {
  const sectionPlan = Array.isArray(input?.sectionPlan) ? input.sectionPlan : [];
  const copyBlocks = input?.copyBlocks || {};
  const ctaSet = input?.ctaSet || {};

  const blocks = sectionPlan.map((section, index) => {
    const sectionTitle = section?.title || `Sezione ${index + 1}`;
    const sectionKey = section?.key || `section_${index + 1}`;
    const sectionObjective = section?.objective || "Obiettivo sezione da definire";
    const headline = getSectionHeadlineForWireframe(sectionKey, copyBlocks);
    const ctaLabel = sectionKey === "cta_final"
      ? (ctaSet.final || ctaSet.primary || "CTA finale")
      : (ctaSet.primary || "CTA primaria");

    return [
      `${index + 1}. [${sectionTitle}]`,
      `   - blocco: ${headline}`,
      `   - obiettivo: ${sectionObjective}`,
      `   - CTA: ${ctaLabel}`,
    ].join("\n");
  });

  return {
    mode: "text",
    blocks,
  };
};

const escapeHtml = (value) => {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
};

export const buildAgencyWebPreviewHtmlBaseV1 = (input) => {
  const sectionPlan = Array.isArray(input?.sectionPlan) ? input.sectionPlan : [];
  const copyBlocks = input?.copyBlocks || {};
  const ctaSet = input?.ctaSet || {};
  const faqItems = Array.isArray(input?.faqItems) ? input.faqItems : [];
  const trustElements = Array.isArray(input?.trustElements) ? input.trustElements : [];

  const headline = escapeHtml(copyBlocks.headline || "Headline da completare");
  const subheadline = escapeHtml(copyBlocks.subheadline || "Subheadline da completare");
  const intro = escapeHtml(copyBlocks.intro || "Intro da completare");
  const benefits = Array.isArray(copyBlocks.benefits) ? copyBlocks.benefits : [];

  const sectionsHtml = sectionPlan
    .map((section) => {
      const title = escapeHtml(section?.title || "Section");
      const objective = escapeHtml(section?.objective || "Obiettivo sezione");
      return `<section><h3>${title}</h3><p>${objective}</p></section>`;
    })
    .join("");

  const benefitsHtml = benefits.length > 0
    ? `<ul>${benefits.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul>`
    : "<p>Benefici da completare.</p>";

  const trustHtml = trustElements.length > 0
    ? `<ul>${trustElements.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul>`
    : "<p>Prova sociale da aggiungere.</p>";

  const faqHtml = faqItems.length > 0
    ? `<ul>${faqItems.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul>`
    : "<p>FAQ da completare.</p>";

  const primaryCta = escapeHtml(ctaSet.primary || "CTA primaria");
  const finalCta = escapeHtml(ctaSet.final || ctaSet.primary || "CTA finale");

  return [
    "<main>",
    "<section>",
    `<h1>${headline}</h1>`,
    `<h2>${subheadline}</h2>`,
    `<p>${intro}</p>`,
    `<button>${primaryCta}</button>`,
    "</section>",
    "<section><h3>Benefici</h3>",
    benefitsHtml,
    "</section>",
    "<section><h3>Trust</h3>",
    trustHtml,
    "</section>",
    "<section><h3>FAQ</h3>",
    faqHtml,
    "</section>",
    sectionsHtml,
    "<section>",
    `<button>${finalCta}</button>`,
    "</section>",
    "</main>",
  ].join("");
};
