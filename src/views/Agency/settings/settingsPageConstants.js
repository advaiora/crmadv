// Costanti della pagina Impostazioni AI: cataloghi di sola lettura mostrati
// in fondo alla pagina (ruoli del team, moduli attivi), mappe fra stato ed
// etichetta e opzioni dei menu a tendina.
// Estratte da AgencySettingsPage.jsx nel giro di spezzatura del 5/8/2026.

export const TEAM_ROLES = [
  { key: "web", label: "Web", owner: "Produzione pagine, wireframe, QA tecnico" },
  { key: "marketing_strategy_pm", label: "Marketing Strategy PM", owner: "Brief, priorita, coordinamento e report" },
  { key: "ads_specialist", label: "Ads Specialist", owner: "Google/Meta setup, targeting, tracking readiness" },
  { key: "graphic_adv_social", label: "Graphic ADV Social", owner: "Creativita social e asset Meta" },
  { key: "graphic_offline", label: "Graphic Offline", owner: "Materiali offline e adattamenti brand" },
];

// I moduli, con il nome che l'utente legge nelle schede di progetto.
//
// ⚠️ Questo elenco deve corrispondere al catalogo vero, che sta nel backend
// (buildRuleBasedActiveModules in agency.service.ts): prima conteneva le chiavi
// tecniche ("sources/assets", "client_report") e voci che moduli non sono
// (Panoramica), e ometteva Memoria. "Agency Brain" resta fuori perche' e'
// l'unico modulo che la vista non mostra mai.
export const MODULES = [
  "Fonti",
  "Brief",
  "Memoria",
  "Contenuti Web",
  "Campagne ADS",
  "Report",
  "Da risolvere",
  "Opportunita",
  "Task",
];

export const SEARCH_STATUS_LABEL = {
  configured: "Configurata",
  configured_not_active: "Configurata",
  configured_error: "Errore provider",
  not_configured: "Non configurata",
};

export const PROVIDER_LABELS = { openai: "OpenAI", anthropic: "Anthropic (Claude)" };

// I provider della ricerca competitor. I primi due hanno un motore vero dietro;
// SerpAPI e Custom restano nell'elenco solo perche' possono essere gia' salvati
// da configurazioni passate — sceglierli lascia la ricerca non configurata.
export const SEARCH_PROVIDER_OPTIONS = [
  { value: "none", label: "Nessuno" },
  { value: "openai_web_search", label: "OpenAI web search" },
  { value: "anthropic_web_search", label: "Anthropic (Claude) web search" },
  { value: "serpapi", label: "SerpAPI (non implementato)" },
  { value: "custom", label: "Custom (non implementato)" },
];

// A quale provider AI appartiene ogni provider di ricerca: serve a filtrare i
// modelli selezionabili e a sapere quale chiave API deve essere presente.
export const SEARCH_PROVIDER_TO_AI_PROVIDER = {
  openai_web_search: "openai",
  anthropic_web_search: "anthropic",
};
