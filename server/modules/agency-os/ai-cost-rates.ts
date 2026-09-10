// Tariffe dei modelli AI (dollari per 1 milione di token, input/output) e
// ripiego per i modelli non riconosciuti.
//
// Perche' questo modulo esiste invece di una catena di ternari dentro
// agency.service.ts: il ripiego `{ 2, 8 }` era **muto**. Ogni modello non
// riconosciuto veniva prezzato con una tariffa inventata e nessuno lo sapeva,
// ne' a schermo ne' nei log. Separando la scelta della tariffa dal calcolo del
// costo, chi chiama puo' sapere se la tariffa e' quella vera (`matched: true`)
// oppure il ripiego (`matched: false`) e comportarsi di conseguenza.
//
// La tabella e' una copia fedele della catena che stava in
// `estimateAgencyAiCostUsd`: stesso ordine di verifica, stessi prezzi. L'ordine
// conta ed e' dal piu' specifico al piu' generico ('gpt-4o-mini' prima di
// 'gpt-4o', i modelli Claude per nome prima del generico 'claude').

export type AgencyAiRates = {
  inputPerMillion: number;
  outputPerMillion: number;
};

export type AgencyAiRatesResolution = AgencyAiRates & {
  // false quando nessuna voce della tabella corrisponde e si sta usando
  // AGENCY_AI_FALLBACK_RATES: il costo calcolato e' una supposizione.
  matched: boolean;
};

// Usata quando il modello non corrisponde a nessuna voce nota. Non e' il prezzo
// di niente: e' un ordine di grandezza per non lasciare il costo a zero.
export const AGENCY_AI_FALLBACK_RATES: AgencyAiRates = { inputPerMillion: 2, outputPerMillion: 8 };

// Ogni voce: la sottostringa da cercare nel nome del modello (gia' minuscolo) e
// la tariffa. Prima corrispondenza vince, quindi l'ordine e' significativo.
const AGENCY_AI_RATE_TABLE: Array<{ match: string[]; rates: AgencyAiRates }> = [
  { match: ['gpt-4o-mini'], rates: { inputPerMillion: 0.15, outputPerMillion: 0.6 } },
  { match: ['gpt-4o'], rates: { inputPerMillion: 5, outputPerMillion: 15 } },
  { match: ['gpt-5'], rates: { inputPerMillion: 1.25, outputPerMillion: 10 } },
  { match: ['claude-haiku', 'haiku'], rates: { inputPerMillion: 1, outputPerMillion: 5 } },
  { match: ['claude-sonnet', 'sonnet'], rates: { inputPerMillion: 3, outputPerMillion: 15 } },
  { match: ['claude-opus', 'opus'], rates: { inputPerMillion: 5, outputPerMillion: 25 } },
  { match: ['claude-fable', 'fable'], rates: { inputPerMillion: 10, outputPerMillion: 50 } },
  // Ultima rete per i Claude non elencati sopra: prezzo di Opus, prudenziale.
  { match: ['claude'], rates: { inputPerMillion: 5, outputPerMillion: 25 } },
];

// Tariffa di un modello. `matched: false` segnala che si sta ripiegando: chi
// chiama decide se e' accettabile in silenzio o se va segnalato.
export const resolveAgencyAiRates = (model: string): AgencyAiRatesResolution => {
  const normalizedModel = (model || '').toLowerCase();
  for (const entry of AGENCY_AI_RATE_TABLE) {
    if (entry.match.some((needle) => normalizedModel.includes(needle))) {
      return { ...entry.rates, matched: true };
    }
  }
  return { ...AGENCY_AI_FALLBACK_RATES, matched: false };
};

// Costo in dollari di una chiamata, dato il modello e i token consumati.
export const computeAgencyAiCostUsd = (
  model: string,
  inputTokens: number,
  outputTokens: number,
): number => {
  const rates = resolveAgencyAiRates(model);
  const cost = ((inputTokens / 1_000_000) * rates.inputPerMillion)
    + ((outputTokens / 1_000_000) * rates.outputPerMillion);
  return Number(cost.toFixed(6));
};
