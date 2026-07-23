// Structured output di Anthropic (tool-use) per le generazioni JSON di Agency.
//
// Perche' esiste: con Claude il JSON veniva chiesto a parole nel system prompt e poi
// ri-parsato dal testo della risposta. Su risposte lunghe Claude emetteva JSON
// sintatticamente rotto, `JSON.parse` falliva e la generazione ricadeva **in silenzio**
// sul rule-based, con la chiamata comunque fatturata. Obbligando il modello a rispondere
// con una chiamata di "strumento", il JSON lo produce l'API: arriva gia' come oggetto nel
// campo `input` del blocco `tool_use` ed e' valido per costruzione (equivalente di
// `json_object` per OpenAI).
//
// ATTENZIONE (verificato dal vivo il 23/7/2026): lo schema NON puo' essere generico.
// Con un `input_schema` senza proprieta' (`properties: {}`) Claude non ha nulla da
// riempire e risponde con un oggetto segnaposto (`{"_dummy": …}`, 4 token di output):
// JSON validissimo ma vuoto, e per giunta marcato come "AI usata". Lo schema deve
// descrivere davvero i campi attesi: e' lui a guidare la generazione, non il system
// prompt. Per questo il tool-use si attiva SOLO se il chiamante passa il suo schema.
//
// Tenuto in un modulo a parte, senza dipendenze, per poterlo testare in isolamento senza
// importare l'intero agency.service.

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Nome dello "strumento" con cui si obbliga Claude a restituire JSON strutturato.
export const ANTHROPIC_JSON_TOOL_NAME = 'rispondi_json';

export type AnthropicJsonTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

// Costruisce la definizione dello strumento a partire dallo schema del chiamante.
// Lo schema deve essere un JSON Schema di tipo object con le proprieta' attese.
export const buildAnthropicJsonTool = (schema: Record<string, unknown>): AnthropicJsonTool => ({
  name: ANTHROPIC_JSON_TOOL_NAME,
  description:
    'Restituisce la risposta come oggetto JSON strutturato. Compila tutti i campi previsti dallo schema seguendo le istruzioni di sistema.',
  input_schema: schema,
});

// Estrae l'oggetto JSON dal blocco `tool_use` della risposta Anthropic.
// Ritorna null se il blocco non c'e' (il chiamante ripiega sul testo).
export const extractAnthropicToolInput = (
  payload: unknown,
  toolName: string = ANTHROPIC_JSON_TOOL_NAME,
): Record<string, unknown> | null => {
  if (!isRecord(payload)) {
    return null;
  }

  const content = Array.isArray(payload.content) ? payload.content : [];
  for (const part of content) {
    if (
      isRecord(part)
      && part.type === 'tool_use'
      && part.name === toolName
      && isRecord(part.input)
    ) {
      return part.input as Record<string, unknown>;
    }
  }

  return null;
};

// Un payload "vuoto" nonostante il tool_use: sintomo che lo schema non guidava la
// generazione (vedi nota in cima). Serve al runner per non spacciare per AI un contenuto
// che di fatto non c'e'.
export const isEmptyStructuredPayload = (payload: Record<string, unknown> | null): boolean => {
  if (!payload) {
    return true;
  }
  const keys = Object.keys(payload).filter((key) => !key.startsWith('_'));
  return keys.length === 0;
};
