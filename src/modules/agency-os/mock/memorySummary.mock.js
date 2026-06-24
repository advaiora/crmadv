export const getMockMemorySummary = (projectId) => {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : "N/A";

  return {
    projectId: normalizedProjectId,
    lastUpdatedAt: "2026-03-17T09:30:00.000Z",
    keyDecisions: [
      "Priorita al canale paid nelle prossime 2 settimane.",
      "Rimandare redesign completo e iterare su landing attuale.",
    ],
    nextActions: [
      "Validare nuove audience ADV.",
      "Aggiornare tracking conversioni su form principale.",
    ],
    knownRisks: [
      "Budget limitato su campagne prospecting.",
      "Dipendenza da asset creativi non ancora approvati.",
    ],
  };
};
