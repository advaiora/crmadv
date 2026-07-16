// Compressione del contesto della chat (Fase 5, spec sez. "Compressione contesto").
//
// Oltre una soglia (~45% della finestra del modello, tarabile) il contesto VECCHIO
// passato all'AI viene riassunto: l'utente vede sempre lo storico intero (lo legge da
// listMessages), comprimiamo solo cio' che l'AI legge. Il riassunto e' invisibile:
// per l'utente e' solo qualche secondo in piu' di "sta pensando".
//
// Questa e' la versione a FINESTRA, su richiesta e NON persistita: ogni turno si
// riassume la parte piu' vecchia di una finestra di messaggi e si tiene la coda
// recente verbatim. La versione "piena" (riassunto rotante persistito, summary-of-
// summary che copre TUTTO lo storico) richiederebbe una colonna dedicata su
// AiConversation -> una migrazione: rimandata (vedi handoff). La finestra copre gia'
// il caso reale — conversazioni lunghe che perdono il filo o sfondano il contesto.
//
// Qui vive solo la logica DETERMINISTICA (tabella finestre, decisione di soglia,
// taglio finestra/coda, prompt di riassunto): si testa senza chiavi. La chiamata di
// riassunto vera e propria passa dal motore AI (con chiavi), nel service.

export type ContextMessage = { role: 'user' | 'assistant'; content: string };

// Quanti messaggi al massimo si guardano per il contesto: la finestra entro cui la
// compressione lavora. Oltre, i messaggi piu' vecchi non entrano (ne' verbatim ne'
// riassunti) — e' il limite del "rotante non persistito".
export const CONTEXT_FETCH_LIMIT = 40;

// Coda recente sempre tenuta verbatim, anche se supera il budget: gli ultimi turni
// contano piu' di tutto, e non si comprime mai il messaggio corrente.
export const CONTEXT_MIN_TAIL = 6;

// Soglia: oltre questa frazione della finestra del modello (input stimato) si
// comprime. Tarabile. La spec indica ~45-50%.
export const CONTEXT_COMPRESSION_THRESHOLD = 0.45;

// Finestre di contesto per modello (token). Substring match come per i prezzi
// (estimateAgencyAiCostUsd). Valori prudenti: comprimere un filo prima non fa danni,
// sfondare la finestra si'. Default conservativo per l'ignoto.
const DEFAULT_CONTEXT_WINDOW = 128_000;

export const resolveContextWindow = (model: string): number => {
  const m = (model || '').toLowerCase();
  if (m.includes('claude') || m.includes('opus') || m.includes('sonnet') || m.includes('haiku') || m.includes('fable')) {
    return 200_000;
  }
  if (m.includes('gpt-5')) {
    return 272_000;
  }
  if (m.includes('gpt-4o') || m.includes('gpt-4.1') || m.includes('gpt-4-1')) {
    return 128_000;
  }
  return DEFAULT_CONTEXT_WINDOW;
};

// Stessa euristica di estimateAgencyAiTokens (~4 char per token). Tenuta qui per non
// esportare l'interno del service; se una cambia, allineare l'altra.
export const estimateContextTokens = (text: string): number => Math.ceil((text || '').length / 4);

export type CompressionPlan = {
  needsCompression: boolean;
  keepVerbatim: ContextMessage[]; // in ordine cronologico
  toSummarize: ContextMessage[]; // in ordine cronologico, piu' vecchi di keepVerbatim
};

// Decide cosa tenere verbatim e cosa riassumere. Cammina dai messaggi PIU' RECENTI
// all'indietro accumulando token: tiene verbatim finche' stanno nel budget (o finche'
// non ha raggiunto la coda minima), il resto va riassunto. Deterministico.
export const planContextCompression = (input: {
  systemText: string;
  messages: ContextMessage[];
  model: string;
  threshold?: number;
  minTail?: number;
}): CompressionPlan => {
  const threshold = input.threshold ?? CONTEXT_COMPRESSION_THRESHOLD;
  const minTail = input.minTail ?? CONTEXT_MIN_TAIL;
  const window = resolveContextWindow(input.model);
  const budget = Math.floor(window * threshold);
  const systemTokens = estimateContextTokens(input.systemText);
  const historyBudget = Math.max(0, budget - systemTokens);

  const messages = input.messages;
  let used = 0;
  let keptFrom = messages.length; // indice del primo messaggio tenuto verbatim

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const tokens = estimateContextTokens(messages[i].content);
    const keptCount = messages.length - keptFrom;
    const withinBudget = used + tokens <= historyBudget;
    const belowMinTail = keptCount < minTail;
    if (withinBudget || belowMinTail) {
      used += tokens;
      keptFrom = i;
    } else {
      break;
    }
  }

  const keepVerbatim = messages.slice(keptFrom);
  const toSummarize = messages.slice(0, keptFrom);
  return {
    needsCompression: toSummarize.length > 0,
    keepVerbatim,
    toSummarize,
  };
};

// Prompt per la chiamata di riassunto. Chiede un riassunto fattuale e compatto del
// pezzo di conversazione vecchio: decisioni, fatti, numeri, nomi, domande aperte —
// senza preamboli. Restituito come system + messages per runAgencyAiTextWithMeta.
export const buildSummaryRequest = (
  toSummarize: ContextMessage[],
): { system: string; messages: ContextMessage[] } => {
  const transcript = toSummarize
    .map((m) => `${m.role === 'assistant' ? 'AI' : 'Utente'}: ${m.content}`)
    .join('\n');
  const system = [
    'Sei un compressore di contesto. Riassumi in modo FATTUALE e COMPATTO la porzione',
    'piu\' vecchia di una conversazione, cosi\' che un assistente possa proseguirla senza',
    'aver letto i messaggi originali. Conserva: decisioni prese, fatti, numeri, nomi,',
    'preferenze e domande ancora aperte. Ometti convenevoli e ripetizioni. Niente',
    'preamboli ne\' commenti: scrivi solo il riassunto, al massimo 200 parole.',
  ].join(' ');
  return {
    system,
    messages: [{ role: 'user', content: `Conversazione da riassumere:\n\n${transcript}` }],
  };
};

// Etichetta con cui il riassunto entra nel contesto dell'AI. Un turno 'user' sintetico
// in testa: lo storico verbatim lo segue. Marcato chiaramente come contesto pregresso.
export const buildCompressedContext = (
  summaryText: string,
  keepVerbatim: ContextMessage[],
): ContextMessage[] => {
  const summary: ContextMessage = {
    role: 'user',
    content: `[Riassunto della conversazione precedente, per contesto]\n${summaryText}`,
  };
  return [summary, ...keepVerbatim];
};
