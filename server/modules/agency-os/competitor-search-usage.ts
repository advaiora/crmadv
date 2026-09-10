// Lettura dei token consumati da una ricerca competitor.
//
// Le altre generazioni AI del CRM **stimano** i token contando i caratteri
// (`estimateAgencyAiTokens`), perche' passano dal motore condiviso che quel
// numero non ce l'ha. La ricerca competitor invece chiama i provider in proprio
// e la risposta porta i token **veri** dentro `usage`: finora venivano buttati
// via insieme al resto del payload. Qui si leggono.
//
// ⚠️ Il punto delicato e' il ramo Anthropic. Con lo strumento `web_search` il
// modello puo' fermarsi con `stop_reason: "pause_turn"` e la chiamata prosegue
// in un ciclo di continuazioni (fino a ANTHROPIC_SEARCH_MAX_CONTINUATIONS + 1
// giri). Ogni giro e' una richiesta fatturata a se', e la variabile `payload`
// viene riassegnata a ogni giro: chi legge `usage` solo dall'ultimo payload
// sottostima il consumo **fino a quattro volte**. Per questo il consumo si
// ACCUMULA giro per giro con `addCompetitorSearchUsage`, e non si legge alla
// fine del ciclo.

// Chiave della funzione nel rendiconto consumi (AiUsageLog.functionName).
// Resta in inglese come le altre dodici chiavi `area.azione` del catalogo:
// regola ②-bis di CLAUDE.md (una chiave che entra in un elenco gia' popolato
// segue la convenzione di quell'elenco, non l'italiano delle etichette).
export const COMPETITOR_SEARCH_FUNCTION_NAME = 'competitors.search';

export type CompetitorSearchUsage = {
  inputTokens: number;
  outputTokens: number;
};

export const EMPTY_COMPETITOR_SEARCH_USAGE: CompetitorSearchUsage = {
  inputTokens: 0,
  outputTokens: 0,
};

const toTokenCount = (value: unknown): number => (
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

// Legge `usage` da una singola risposta di provider.
//
// OpenAI Responses API e Anthropic Messages API usano gli stessi due nomi
// (`input_tokens` / `output_tokens`), quindi una funzione sola copre entrambi.
// `prompt_tokens` / `completion_tokens` sono la forma della vecchia Chat
// Completions: si accettano come ripiego per non registrare zero token se un
// domani il ramo OpenAI cambiasse endpoint.
//
// Una risposta senza `usage` (o malformata) da' zero, non un errore: la lettura
// dei token non deve mai far fallire una ricerca gia' pagata.
export const readCompetitorSearchUsage = (payload: unknown): CompetitorSearchUsage => {
  if (!isRecord(payload) || !isRecord(payload.usage)) {
    return { ...EMPTY_COMPETITOR_SEARCH_USAGE };
  }
  const usage = payload.usage;
  return {
    inputTokens: toTokenCount(usage.input_tokens) || toTokenCount(usage.prompt_tokens),
    outputTokens: toTokenCount(usage.output_tokens) || toTokenCount(usage.completion_tokens),
  };
};

// Somma al totale corrente i token di un altro giro di risposta. E' la forma da
// usare dentro il ciclo delle continuazioni Anthropic: ogni giro e' fatturato.
export const addCompetitorSearchUsage = (
  total: CompetitorSearchUsage,
  payload: unknown,
): CompetitorSearchUsage => {
  const round = readCompetitorSearchUsage(payload);
  return {
    inputTokens: total.inputTokens + round.inputTokens,
    outputTokens: total.outputTokens + round.outputTokens,
  };
};
