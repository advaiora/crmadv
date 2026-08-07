// I nomi delle funzioni AI come li scrive il codice ("discovery.generateBrief")
// non sono roba da mostrare a chi guarda i consumi: qui diventano il nome del
// lavoro che l'AI ha fatto davvero.
//
// ⚠️ Le stesse etichette esistono anche lato server, in agency.service.ts
// (AGENCY_AI_ESTIMATABLE_FUNCTIONS): se cambiano li', vanno cambiate anche qui,
// o le stime e i consumi chiameranno la stessa cosa in due modi.

const AI_FUNCTION_LABELS = {
  "discovery.generateBrief": "Brief completo",
  "discovery.generateSection": "Sezione del Brief",
  "web.generateProject": "Struttura sito/landing",
  "web.generateBlock": "Blocco sito",
  "ads.generateAsset": "Copy campagna ADV",
};

// Le stesse funzioni in ordine, per chi deve mostrarle in elenco (il testo
// d'aiuto del campo "Modelli per funzione"): cosi' l'elenco non e' una terza
// copia scritta a mano che si scorda di aggiornarsi.
export const AI_FUNCTION_ENTRIES = Object.entries(AI_FUNCTION_LABELS).map(
  ([functionName, label]) => ({ functionName, label }),
);

// Chi non e' in elenco si mostra com'e': meglio una chiave tecnica di una riga
// vuota o di un consumo che sparisce dal rendiconto.
export const toAiFunctionLabel = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return "n/a";
  }

  const normalized = value.trim();
  return AI_FUNCTION_LABELS[normalized] || normalized;
};
