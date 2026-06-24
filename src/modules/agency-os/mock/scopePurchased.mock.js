import { getMockProjectType } from "./projectType.mock";

const SCOPE_TEMPLATES = {
  google_meta_ads: [
    { key: "strategy", label: "Strategia", purchased: true },
    { key: "landing", label: "Landing dedicata", purchased: false },
    { key: "web", label: "Sito", purchased: false },
    { key: "ads", label: "Campaign Ads", purchased: true },
    { key: "tracking", label: "Tracking", purchased: true },
    { key: "seo", label: "SEO", purchased: false },
    { key: "reporting", label: "Reportistica avanzata", purchased: true },
  ],
  website: [
    { key: "strategy", label: "Strategia", purchased: true },
    { key: "landing", label: "Landing dedicata", purchased: true },
    { key: "web", label: "Sito", purchased: true },
    { key: "ads", label: "Campaign Ads", purchased: false },
    { key: "tracking", label: "Tracking", purchased: false },
    { key: "seo", label: "SEO", purchased: false },
    { key: "reporting", label: "Reportistica avanzata", purchased: true },
  ],
  google_ads: [
    { key: "strategy", label: "Strategia", purchased: true },
    { key: "landing", label: "Landing dedicata", purchased: true },
    { key: "web", label: "Sito", purchased: false },
    { key: "ads", label: "Campaign Ads", purchased: true },
    { key: "tracking", label: "Tracking", purchased: true },
    { key: "seo", label: "SEO", purchased: false },
    { key: "reporting", label: "Reportistica avanzata", purchased: true },
  ],
  marketing_full: [
    { key: "strategy", label: "Strategia", purchased: true },
    { key: "landing", label: "Landing dedicata", purchased: true },
    { key: "web", label: "Sito", purchased: true },
    { key: "ads", label: "Campaign Ads", purchased: true },
    { key: "tracking", label: "Tracking", purchased: true },
    { key: "seo", label: "SEO", purchased: true },
    { key: "reporting", label: "Reportistica avanzata", purchased: true },
  ],
};

export const getMockScopePurchased = (projectId) => {
  const projectType = getMockProjectType(projectId);
  const selectedScope = SCOPE_TEMPLATES[projectType?.key] || SCOPE_TEMPLATES.marketing_full;
  return selectedScope.map((entry) => ({ ...entry }));
};
