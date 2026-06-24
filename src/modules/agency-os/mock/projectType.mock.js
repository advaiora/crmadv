const PROJECT_TYPE_CATALOG = [
  {
    key: "google_meta_ads",
    label: "Google + Meta Ads",
    description: "Progetto performance su advertising Google e Meta.",
  },
  {
    key: "website",
    label: "Website",
    description: "Progetto orientato a sito, UX e conversione web.",
  },
  {
    key: "google_ads",
    label: "Google Ads",
    description: "Progetto focalizzato su acquisizione paid search.",
  },
  {
    key: "marketing_full",
    label: "Marketing Full",
    description: "Progetto full-funnel con web, ads e reporting.",
  },
];

const pickIndexFromProjectId = (projectId) => {
  const source = typeof projectId === "string" ? projectId.trim() : "";
  if (!source) {
    return 0;
  }

  const lastChar = source[source.length - 1];
  const code = Number(lastChar?.charCodeAt(0) || 0);
  return code % PROJECT_TYPE_CATALOG.length;
};

export const getMockProjectType = (projectId) => {
  return PROJECT_TYPE_CATALOG[pickIndexFromProjectId(projectId)];
};

export const mockProjectTypeCatalog = PROJECT_TYPE_CATALOG;
