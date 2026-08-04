// Costanti della pagina Web di progetto: opzioni dei menu a tendina, stati dei
// sub-progetti, passi del banner introduttivo e blocchi rigenerabili con AI.
// Estratte da AgencyProjectWebPage.jsx nel giro di spezzatura del 4/8/2026.

export const PAGE_TYPE_OPTIONS = [
  { value: "landing", label: "Landing" },
  { value: "website", label: "Sito" },
  { value: "homepage", label: "Homepage" },
  { value: "service_page", label: "Service Page" },
  { value: "ecommerce_lite", label: "Ecommerce Lite" },
];

export const WEB_PROJECT_TYPES = [
  { value: "landing", label: "Landing page" },
  { value: "homepage", label: "Homepage" },
  { value: "service_page", label: "Pagina servizio" },
  { value: "ecommerce_page", label: "Pagina ecommerce" },
  { value: "section", label: "Sezione sito" },
];

export const WEB_PROJECT_STATUSES = ["draft", "in_progress", "review", "approved"];

export const WEB_WORKFLOW_STEPS = [
  { title: "Scegli pagina", description: "Landing, pagina servizio o sezione da produrre." },
  { title: "Verifica input", description: "Target, offerta, CTA e fonti prima di generare." },
  { title: "Genera blocchi", description: "Usa AI per singoli blocchi o bozza base completa." },
];

export const WEB_AI_BLOCKS = [
  { key: "hero", label: "Hero" },
  { key: "benefits", label: "Benefici" },
  { key: "faq", label: "FAQ" },
  { key: "cta", label: "CTA" },
  { key: "trust", label: "Trust" },
  { key: "wireframe", label: "Wireframe" },
  { key: "section_plan", label: "Struttura" },
];

export const EMPTY_WEB_PROJECT_DRAFT = {
  type: "landing",
  name: "",
  goal: "",
  target: "",
  primaryCta: "",
};
