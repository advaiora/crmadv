const OPPORTUNITIES = [
  {
    id: "opp-001",
    title: "Upsell SEO tecnico",
    stage: "Identificata",
    estimatedValue: 1800,
    projectId: "PRJ-001",
  },
  {
    id: "opp-002",
    title: "Nuova campagna remarketing",
    stage: "In valutazione",
    estimatedValue: 2400,
    projectId: "PRJ-002",
  },
  {
    id: "opp-003",
    title: "Landing secondaria per lead magnet",
    stage: "Proposta",
    estimatedValue: 1200,
    projectId: "PRJ-001",
  },
];

export const listMockAgencyOpportunities = (projectId) => {
  if (!projectId) {
    return OPPORTUNITIES;
  }

  return OPPORTUNITIES.filter((entry) => entry.projectId === projectId);
};
