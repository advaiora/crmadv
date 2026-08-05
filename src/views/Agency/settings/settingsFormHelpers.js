// Funzioni pure della pagina Impostazioni Agency: il mappatore che porta le
// impostazioni del server nella bozza del form, e il messaggio informativo che
// riassume quali provider sono configurati.
// Estratte da AgencySettingsPage.jsx nel giro di spezzatura del 5/8/2026.

// Le due chiavi API restano SEMPRE stringhe vuote: il campo e' write-only
// ("vuoto = non cambiare"), quindi il form non riparte mai da un valore letto
// dal server.
export const buildRuntimeForm = (runtimeSettings) => ({
  aiEnabled: Boolean(runtimeSettings?.ai?.enabled),
  aiProvider: runtimeSettings?.ai?.provider || "none",
  aiModel: runtimeSettings?.ai?.model || "gpt-4o-mini",
  aiTimeoutMs: runtimeSettings?.ai?.timeoutMs || 45000,
  aiInputMaxChars: runtimeSettings?.ai?.inputMaxChars || 12000,
  aiStringMaxChars: runtimeSettings?.ai?.stringMaxChars || 1200,
  aiFileTextMaxChars: runtimeSettings?.ai?.fileTextMaxChars || 1800,
  aiMaxOutputTokens: runtimeSettings?.ai?.maxOutputTokens || 1800,
  aiDefaultMode: runtimeSettings?.ai?.defaultMode || "quick",
  aiDebugEnabled: Boolean(runtimeSettings?.ai?.debugEnabled),
  aiFunctionModelsText: JSON.stringify(runtimeSettings?.ai?.functionModels || {}, null, 2),
  openAiApiKey: "",
  anthropicApiKey: "",
  competitorSearchEnabled: Boolean(runtimeSettings?.competitorSearch?.enabled),
  competitorSearchProvider: runtimeSettings?.competitorSearch?.provider || "none",
});

export const getProviderSetupMessage = (aiStatus, competitorSearchSettings) => {
  const aiConfigured = Boolean(aiStatus?.configured);
  const competitorStatus = competitorSearchSettings?.status || "not_configured";
  const competitorConfigured = competitorStatus === "configured" || competitorStatus === "configured_not_active";

  if (aiConfigured && competitorConfigured) {
    return "AI generativa e ricerca competitor online sono configurate lato server. Le ricerche useranno OpenAI web search e non genereranno competitor finti.";
  }

  if (aiConfigured) {
    return "AI generativa configurata lato server. La ricerca competitor online e separata: senza provider search puoi inserire competitor manualmente.";
  }

  if (competitorConfigured) {
    return "Ricerca competitor online configurata. AI generativa non configurata: le altre generazioni restano bozze base dichiarate.";
  }

  return "AI generativa e ricerca competitor online non sono configurate. Puoi lavorare con bozze base e competitor manuali.";
};
