// Provider e modello della RICERCA COMPETITOR.
//
// Storia di questo file: nasceva per impedire che il "Modello preferito" delle
// Impostazioni AI — che pesca da un catalogo multi-provider, Claude compresi —
// finisse inoltrato all'API di OpenAI, l'unico provider allora previsto per la
// ricerca competitor. Era un cerotto: il vero difetto era che la ricerca
// competitor fosse l'unica funzione AI del CRM con il provider cablato nel
// codice, mentre tutte le altre lo scelgono.
//
// Ora la ricerca competitor ha gli stessi due provider di prima classe del
// resto del CRM — OpenAI e Anthropic — ciascuno con i propri modelli. Questo
// modulo tiene le regole di scelta: quale provider e' davvero utilizzabile
// (serve la chiave del provider scelto) e quale modello mandargli (mai un id
// del provider sbagliato, che tornerebbe indietro come errore e sembrerebbe una
// chiave sbagliata).
//
// Nessuna dipendenza, cosi' e' collaudabile da solo.

export type CompetitorSearchProvider =
  | 'none'
  | 'openai_web_search'
  | 'anthropic_web_search'
  | 'serpapi'
  | 'custom';

export const COMPETITOR_SEARCH_PROVIDERS: readonly CompetitorSearchProvider[] = [
  'none',
  'openai_web_search',
  'anthropic_web_search',
  'serpapi',
  'custom',
] as const;

// I due provider per cui esiste davvero un'implementazione di ricerca online.
// `serpapi` e `custom` restano nell'elenco (sono stati salvati in passato e
// vanno letti senza rompere), ma non hanno un motore dietro.
export type CompetitorSearchEngineProvider = 'openai_web_search' | 'anthropic_web_search';

export const DEFAULT_COMPETITOR_SEARCH_MODEL = 'gpt-4o-mini';
// Default Claude per la ricerca: equilibrato e con la ricerca web di ultima
// generazione (vedi anthropicWebSearchToolType).
export const DEFAULT_ANTHROPIC_COMPETITOR_SEARCH_MODEL = 'claude-sonnet-5';

// Le famiglie di modelli che l'API di OpenAI accetta: `gpt-*`, i modelli di
// ragionamento `o1`/`o3`/`o4`... e `chatgpt-*`. Il controllo e' sul prefisso e
// non su un elenco chiuso, perche' `AGENCY_AI_MODEL` puo' legittimamente
// nominare un modello OpenAI fuori dal catalogo curato.
const OPENAI_MODEL_PREFIX = /^(gpt-|o\d|chatgpt-)/i;

export const isOpenAiModelId = (model: string | null | undefined): boolean => (
  OPENAI_MODEL_PREFIX.test((model ?? '').trim())
);

export const isAnthropicModelId = (model: string | null | undefined): boolean => (
  (model ?? '').trim().toLowerCase().startsWith('claude')
);

// Il provider a cui appartiene un id di modello. `null` quando non si riconosce:
// il chiamante allora ripiega sul default del provider scelto invece di
// indovinare.
export const providerOfModelId = (
  model: string | null | undefined,
): CompetitorSearchEngineProvider | null => {
  if (isAnthropicModelId(model)) {
    return 'anthropic_web_search';
  }
  if (isOpenAiModelId(model)) {
    return 'openai_web_search';
  }
  return null;
};

const otherProvider = (
  provider: CompetitorSearchEngineProvider,
): CompetitorSearchEngineProvider => (
  provider === 'anthropic_web_search' ? 'openai_web_search' : 'anthropic_web_search'
);

/**
 * Modello da usare per una ricerca competitor, dato il provider.
 *
 * Ordine di precedenza:
 * 1. `AGENCY_COMPETITOR_SEARCH_MODEL` — scelta esplicita di chi gestisce il
 *    server, vince sempre **se e' del provider giusto** (anche se non e' nel
 *    catalogo curato: potrebbe essere un id nuovo che questo codice non conosce
 *    ancora, quindi un id non riconosciuto passa comunque);
 * 2. il modello scelto per la ricerca competitor nelle Impostazioni AI;
 * 3. il "Modello preferito" del workspace, ma solo se e' del provider giusto;
 * 4. il default del provider.
 *
 * In nessun caso torna un id dell'altro provider: e' esattamente l'errore che
 * fa sembrare "sbagliata" una chiave che invece e' buona.
 */
export const resolveCompetitorSearchModel = (input: {
  provider?: CompetitorSearchEngineProvider;
  envModel?: string | null;
  searchModel?: string | null;
  configuredModel?: string | null;
}): string => {
  const provider = input.provider ?? 'openai_web_search';
  const fallback = provider === 'anthropic_web_search'
    ? DEFAULT_ANTHROPIC_COMPETITOR_SEARCH_MODEL
    : DEFAULT_COMPETITOR_SEARCH_MODEL;

  // Un candidato va bene se e' dichiaratamente del provider scelto. Un id non
  // riconosciuto e' ammesso solo dalla variabile d'ambiente, che e' una scelta
  // deliberata di chi amministra il server.
  const belongsToProvider = (model: string) => providerOfModelId(model) === provider;

  const envModel = input.envModel?.trim();
  if (envModel && providerOfModelId(envModel) !== otherProvider(provider)) {
    return envModel;
  }

  const searchModel = input.searchModel?.trim();
  if (searchModel && belongsToProvider(searchModel)) {
    return searchModel;
  }

  const configuredModel = input.configuredModel?.trim();
  if (configuredModel && belongsToProvider(configuredModel)) {
    return configuredModel;
  }

  return fallback;
};

// Versione dello strumento di ricerca web di Anthropic da dichiarare nella
// richiesta. La variante `_20260209` (con filtro dinamico dei risultati) esiste
// solo sui modelli recenti; sugli altri va usata quella base, altrimenti l'API
// rifiuta lo strumento. In caso di dubbio si sceglie la base: funziona ovunque.
const ANTHROPIC_MODERN_WEB_SEARCH_MODELS = /^claude-(opus-(4-6|4-7|4-8|5)|sonnet-(4-6|5))/i;

export const anthropicWebSearchToolType = (model: string | null | undefined): string => (
  ANTHROPIC_MODERN_WEB_SEARCH_MODELS.test((model ?? '').trim())
    ? 'web_search_20260209'
    : 'web_search_20250305'
);

/**
 * Provider effettivo della ricerca competitor.
 *
 * Non basta che il provider sia selezionato: serve la chiave di QUEL provider.
 * Prima questo controllo guardava solo la chiave OpenAI, quindi con la sola
 * chiave Anthropic la ricerca risultava "non configurata" anche quando c'era
 * tutto il necessario.
 *
 * Ritorna `null` quando la ricerca non e' utilizzabile — con il motivo, cosi'
 * il messaggio all'utente puo' distinguere "spenta" da "manca la chiave".
 */
export const resolveCompetitorSearchProvider = (input: {
  enabled: boolean;
  provider: string;
  openAiKeyConfigured: boolean;
  anthropicKeyConfigured: boolean;
}): {
  provider: CompetitorSearchEngineProvider | null;
  reason: 'ready' | 'disabled' | 'no_provider' | 'unsupported_provider' | 'missing_key';
} => {
  if (!input.enabled) {
    return { provider: null, reason: 'disabled' };
  }
  if (input.provider === 'none' || !input.provider) {
    return { provider: null, reason: 'no_provider' };
  }
  if (input.provider !== 'openai_web_search' && input.provider !== 'anthropic_web_search') {
    // `serpapi` / `custom`: salvabili, ma senza motore dietro.
    return { provider: null, reason: 'unsupported_provider' };
  }

  const keyConfigured = input.provider === 'anthropic_web_search'
    ? input.anthropicKeyConfigured
    : input.openAiKeyConfigured;

  return keyConfigured
    ? { provider: input.provider, reason: 'ready' }
    : { provider: null, reason: 'missing_key' };
};
