// Listino e conversione modello → prezzo (spezzato da consumi.mjs il 3/8/2026).
// I prezzi servono solo come PROPORZIONE fra i tipi di token, non come bolletta:
// con l'abbonamento non si paga a token (vedi intestazione di consumi.mjs).

// Prezzi di listino per milione di token, verificati il 23/7/2026.
// Servono solo come PROPORZIONE fra i tipi di token. Se cambiano, si aggiorna qui.
export const PREZZI = {
  'claude-opus-5': { in: 5, out: 25 }, // assunto pari a Opus 4.x finche' non verificato a listino
  'claude-opus-4-8': { in: 5, out: 25 },
  'claude-opus-4-7': { in: 5, out: 25 },
  'claude-opus-4-6': { in: 5, out: 25 },
  'claude-fable-5': { in: 10, out: 50 },
  'claude-sonnet-5': { in: 3, out: 15 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5': { in: 1, out: 5 },
};
export const PREZZO_IGNOTO = { in: 5, out: 25 }; // se esce un modello nuovo, si assume Opus
export const MOLT_SCRITTURA_CACHE = 2; // cache tenuta 1 ora: costa il doppio dell'ingresso
export const MOLT_LETTURA_CACHE = 0.1; // rileggere la cache costa un decimo

// Il modello nei registri puo' avere il suffisso della data
// (es. "claude-haiku-4-5-20251001"): si cerca la chiave di listino piu' lunga
// di cui il modello e' il prolungamento. Senza questo, un modello datato
// finirebbe sul prezzo di ripiego (Opus) e peserebbe fino a 5 volte il vero.
// (Nota #39, corollario: MAI semplificare a un confronto di uguaglianza.)
// Il listino si puo' passare dal test per provare la regola del prefisso piu'
// lungo anche quando nel listino vero nessuna chiave e' prefisso di un'altra.
export function prezzoDi(modello, listino = PREZZI) {
  if (!modello) return PREZZO_IGNOTO;
  if (listino[modello]) return listino[modello];
  let miglior = null;
  for (const chiave of Object.keys(listino)) {
    if (modello.startsWith(chiave) && (!miglior || chiave.length > miglior.length)) miglior = chiave;
  }
  return miglior ? listino[miglior] : PREZZO_IGNOTO;
}
