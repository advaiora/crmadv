const CONTEXT_SUMMARY_BY_PROJECT_TYPE = {
  google_meta_ads: "Progetto ADV multi-canale con priorita su acquisizione e qualita lead.",
  google_ads: "Progetto ADV focalizzato su intent search e conversione.",
  website: "Progetto web orientato a struttura, UX e crescita organica.",
  marketing_full: "Progetto full-funnel con orchestrazione completa tra web e advertising.",
};

export const getMockContextSummary = ({
  projectType,
  scopePurchased,
  activeModules,
  alerts,
  opportunities,
}) => {
  const baseText = CONTEXT_SUMMARY_BY_PROJECT_TYPE[projectType?.key]
    || "Progetto Agency AI OS in configurazione standard.";
  const purchasedCount = Array.isArray(scopePurchased)
    ? scopePurchased.filter((entry) => entry.purchased).length
    : 0;
  const activeCount = Array.isArray(activeModules)
    ? activeModules.filter((entry) => entry.active).length
    : 0;
  const alertCount = Array.isArray(alerts) ? alerts.length : 0;
  const opportunityCount = Array.isArray(opportunities) ? opportunities.length : 0;

  return `${baseText} Scope acquistati: ${purchasedCount}. Moduli attivi: ${activeCount}. Alert suggeriti: ${alertCount}. Opportunita suggerite: ${opportunityCount}.`;
};
