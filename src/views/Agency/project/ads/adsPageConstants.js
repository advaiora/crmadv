// Costanti della pagina Ads di progetto: etichette dei canali e degli
// obiettivi, opzioni dei menu, stati delle campagne, passi del banner
// introduttivo e asset rigenerabili con AI.
// Estratte da AgencyProjectAdsPage.jsx nel giro di spezzatura del 4/8/2026.

export const CHANNEL_SCOPE_LABELS = {
  google: "Google Ads",
  meta: "Meta Ads",
  both: "Google + Meta",
};

export const CAMPAIGN_GOAL_LABELS = {
  lead_generation: "Lead generation",
  sales: "Sales",
  traffic: "Traffic",
  awareness: "Awareness",
};

export const ADS_PROJECT_CHANNELS = [
  { value: "google", label: "Google" },
  { value: "meta", label: "Meta" },
];

export const ADS_PROJECT_STATUSES = ["draft", "in_progress", "review", "approved"];

export const ADS_WORKFLOW_STEPS = [
  { title: "Scegli campagna", description: "Google, Meta o campagna collegata a una landing." },
  { title: "Verifica requisiti", description: "Target, offerta, tracking e landing collegata." },
  { title: "Genera asset", description: "Crea bozze o rigenera singoli asset AI." },
];

export const ADS_AI_ASSET_BLOCKS = [
  { key: "headlines", label: "Headline" },
  { key: "primary_texts", label: "Primary text" },
  { key: "keywords", label: "Keyword" },
  { key: "creative_angles", label: "Angoli creativi" },
  { key: "angle", label: "Angolo offerta" },
  { key: "sitelinks", label: "Sitelink/callout" },
];

export const EMPTY_ADS_PROJECT_DRAFT = {
  channel: "google",
  campaignType: "",
  name: "",
  goal: "",
  linkedWebProjectId: "",
};
