// Scelta del modello per la RICERCA COMPETITOR.
//
// La ricerca competitor passa sempre e solo dall'API di OpenAI (`/v1/responses`
// con lo strumento `web_search`): e' l'unico provider previsto. Il "Modello
// preferito" delle Impostazioni AI, invece, pesca da un catalogo
// multi-provider che contiene anche i modelli Claude — quindi non lo si puo'
// inoltrare a OpenAI cosi' com'e': un id `claude-*` mandato a OpenAI torna
// indietro come errore del provider, e sembra una chiave sbagliata.
//
// E' lo stesso problema che `resolveAgencyProviderModel` risolve nel verso
// opposto (provider Anthropic + modello `gpt-*` -> default Claude), qui
// applicato al verso che mancava.

export const DEFAULT_COMPETITOR_SEARCH_MODEL = 'gpt-4o-mini';

// Le famiglie di modelli che l'API di OpenAI accetta: `gpt-*`, i modelli di
// ragionamento `o1`/`o3`/`o4`... e `chatgpt-*`. Il controllo e' sul prefisso e
// non su un elenco chiuso, perche' `AGENCY_AI_MODEL` puo' legittimamente
// nominare un modello OpenAI fuori dal catalogo curato.
const OPENAI_MODEL_PREFIX = /^(gpt-|o\d|chatgpt-)/i;

export const isOpenAiModelId = (model: string | null | undefined): boolean => (
  OPENAI_MODEL_PREFIX.test((model ?? '').trim())
);

/**
 * Modello da usare per una ricerca competitor.
 *
 * Ordine di precedenza:
 * 1. `AGENCY_COMPETITOR_SEARCH_MODEL` — scelta esplicita di chi gestisce il
 *    server, vince sempre (anche se non sembra un modello OpenAI: potrebbe
 *    essere un id nuovo che questo codice non conosce ancora);
 * 2. il "Modello preferito" delle Impostazioni AI, ma **solo se e' un modello
 *    OpenAI**;
 * 3. il default OpenAI.
 */
export const resolveCompetitorSearchModel = (input: {
  envModel?: string | null;
  configuredModel?: string | null;
}): string => {
  const envModel = input.envModel?.trim();
  if (envModel) {
    return envModel;
  }

  const configuredModel = input.configuredModel?.trim();
  if (configuredModel && isOpenAiModelId(configuredModel)) {
    return configuredModel;
  }

  return DEFAULT_COMPETITOR_SEARCH_MODEL;
};
